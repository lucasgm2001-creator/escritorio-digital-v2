'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, prefer-const -- componente de mapa fornecido as-is (d3-geo/topojson client tipam GeoJSON como any). */

/**
 * LeadMap — 3D / glass US lead map for Next.js.
 *
 * Features
 *  - 2D / 3D view with adjustable tilt angle
 *  - 3 themes: ciber (cyan, default) · lima (verde-lima) · ambar
 *  - 3 modes: individual markers · per-state bubbles · heatmap (calor)
 *  - hover a state to see name + novos leads / leads / clientes / total
 *  - timezone frontier lines (ET / CT / MT / PT) cutting between states
 *
 * Colors: novos leads = lilás · leads = azul · clientes = verde.
 *
 * Deps:  npm i d3-geo topojson-client
 *        npm i -D @types/d3-geo @types/topojson-client
 *
 * Map data is fetched from the us-atlas CDN at runtime (no extra dependency).
 *
 * NOTE (escritório-digital): a barra de controle (showControls) foi movida pra Configurações > Mapa.
 * As props view/tilt/mode/theme são SINCRONIZADAS com o estado (config salva = fonte única) — ver os
 * useEffect logo abaixo das declarações de estado.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { geoAlbersUsa, geoPath } from 'd3-geo';
import { feature, mesh } from 'topojson-client';

export type LeadType = 'novo' | 'lead' | 'cliente';
export type ViewMode = '2d' | '3d';
export type DisplayMode = 'individual' | 'estado' | 'calor';
export type ThemeKey = 'ciber' | 'lima' | 'ambar';

export interface LeadMarker {
  lat: number;
  lon: number;
  uf: string;       // 2-letter US state code (e.g. 'TX')
  type: LeadType;
  name: string;     // nome do registro (lead/cliente) — listado no painel de clique
  city?: string;
}

export interface LeadMapProps {
  markers?: LeadMarker[];
  height?: number;
  view?: ViewMode;
  tilt?: number;          // degrees (only used in 3D)
  mode?: DisplayMode;
  theme?: ThemeKey;
  show?: Partial<Record<LeadType, boolean>>; // visibilidade por tipo (default todos true)
  resumo?: boolean;                          // tooltip de resumo no hover (default true)
  showControls?: boolean; // built-in vista/modo/tema bar (default true)
  showHeader?: boolean;   // title + live timezone clocks (default true)
  topoUrl?: string;
  className?: string;
}

const COLORS: Record<LeadType, string> = {
  novo: '#A78BFA',
  lead: '#38BDF8',
  cliente: '#34D399',
};
const TYPE_LABEL: Record<LeadType, string> = {
  novo: 'Novos leads',
  lead: 'Leads',
  cliente: 'Clientes',
};

const NAME_TO_ABBR: Record<string, string> = {
  Alabama: 'AL', Alaska: 'AK', Arizona: 'AZ', Arkansas: 'AR', California: 'CA',
  Colorado: 'CO', Connecticut: 'CT', Delaware: 'DE', 'District of Columbia': 'DC',
  Florida: 'FL', Georgia: 'GA', Hawaii: 'HI', Idaho: 'ID', Illinois: 'IL',
  Indiana: 'IN', Iowa: 'IA', Kansas: 'KS', Kentucky: 'KY', Louisiana: 'LA',
  Maine: 'ME', Maryland: 'MD', Massachusetts: 'MA', Michigan: 'MI', Minnesota: 'MN',
  Mississippi: 'MS', Missouri: 'MO', Montana: 'MT', Nebraska: 'NE', Nevada: 'NV',
  'New Hampshire': 'NH', 'New Jersey': 'NJ', 'New Mexico': 'NM', 'New York': 'NY',
  'North Carolina': 'NC', 'North Dakota': 'ND', Ohio: 'OH', Oklahoma: 'OK',
  Oregon: 'OR', Pennsylvania: 'PA', 'Rhode Island': 'RI', 'South Carolina': 'SC',
  'South Dakota': 'SD', Tennessee: 'TN', Texas: 'TX', Utah: 'UT', Vermont: 'VT',
  Virginia: 'VA', Washington: 'WA', 'West Virginia': 'WV', Wisconsin: 'WI',
  Wyoming: 'WY', 'Puerto Rico': 'PR',
};
const ABBR_TO_NAME: Record<string, string> = Object.fromEntries(
  Object.entries(NAME_TO_ABBR).map(([n, a]) => [a, n])
);
ABBR_TO_NAME.DC = 'Washington, D.C.';

const TZ_BY_ABBR: Record<string, string> = {};
const setTz = (z: string, list: string[]) => list.forEach((a) => (TZ_BY_ABBR[a] = z));
setTz('ET', ['ME','NH','VT','MA','RI','CT','NY','NJ','PA','DE','MD','DC','VA','WV','NC','SC','GA','FL','OH','MI','IN','KY']);
setTz('CT', ['WI','IL','MN','IA','MO','AR','LA','MS','AL','TN','OK','KS','NE','SD','ND','TX']);
setTz('MT', ['MT','WY','CO','NM','ID','UT','AZ']);
setTz('PT', ['WA','OR','CA','NV','AK']);
TZ_BY_ABBR.HI = 'HT';
const tzOfName = (name: string) => TZ_BY_ABBR[NAME_TO_ABBR[name]] || '';

const ZONE_LABELS: { at: [number, number]; txt: string }[] = [
  { at: [-119.5, 43.5], txt: 'PACÍFICO' },
  { at: [-110, 43], txt: 'MONTANHA' },
  { at: [-97.5, 42], txt: 'CENTRAL' },
  { at: [-80, 42], txt: 'LESTE' },
];

const FUSOS: { abbr: string; tz: string; dot: string }[] = [
  { abbr: 'ET', tz: 'America/New_York', dot: '#38BDF8' },
  { abbr: 'CT', tz: 'America/Chicago', dot: '#34D399' },
  { abbr: 'MT', tz: 'America/Denver', dot: '#A78BFA' },
  { abbr: 'PT', tz: 'America/Los_Angeles', dot: '#7DEBFF' },
];

interface ThemeConf {
  label: string; accent: string;
  vars: Record<string, string>;
  stateStroke: string; nationEdge: string;
  zoneFill: Record<string, string>;
  labelColor: string; baseDark: string; heat: string; tzWide: string; tz: string;
}
const THEMES: Record<ThemeKey, ThemeConf> = {
  ciber: {
    label: 'Cíber', accent: '#7DEBFF',
    vars: { '--bg': 'radial-gradient(130% 100% at 50% -10%,#0d1424 0%,#070a12 55%,#05070d 100%)', '--glow': 'rgba(56,189,248,0.16)', '--grid': 'rgba(120,160,220,0.07)', '--accent': '#7DEBFF', '--line': 'rgba(125,235,255,0.5)' },
    stateStroke: 'rgba(120,150,200,0.16)', nationEdge: 'rgba(125,235,255,0.16)',
    zoneFill: { PT: '#0f1a2e', MT: '#0c1626', CT: '#101c32', ET: '#0d1a2c', HT: '#0c1626' },
    labelColor: 'rgba(150,185,225,0.4)', baseDark: '#0a1018', heat: '#38BDF8', tzWide: 'rgba(94,231,255,0.28)', tz: '#7DEBFF',
  },
  lima: {
    label: 'Lima', accent: '#C2F73A',
    vars: { '--bg': 'radial-gradient(130% 100% at 50% -10%,#0f1610 0%,#080b06 55%,#050703 100%)', '--glow': 'rgba(194,247,58,0.14)', '--grid': 'rgba(150,200,90,0.07)', '--accent': '#C2F73A', '--line': 'rgba(194,247,58,0.5)' },
    stateStroke: 'rgba(150,190,110,0.16)', nationEdge: 'rgba(194,247,58,0.16)',
    zoneFill: { PT: '#101a0f', MT: '#0c160b', CT: '#121c10', ET: '#0f1a0d', HT: '#0c160b' },
    labelColor: 'rgba(180,210,140,0.42)', baseDark: '#0a120a', heat: '#9BC91F', tzWide: 'rgba(194,247,58,0.26)', tz: '#C2F73A',
  },
  ambar: {
    label: 'Âmbar', accent: '#FFB454',
    vars: { '--bg': 'radial-gradient(130% 100% at 50% -10%,#1a1410 0%,#0d0a06 55%,#070503 100%)', '--glow': 'rgba(255,180,84,0.14)', '--grid': 'rgba(210,170,110,0.07)', '--accent': '#FFB454', '--line': 'rgba(255,180,84,0.5)' },
    stateStroke: 'rgba(210,170,110,0.16)', nationEdge: 'rgba(255,180,84,0.18)',
    zoneFill: { PT: '#1b150d', MT: '#16110a', CT: '#1d160f', ET: '#1a140d', HT: '#16110a' },
    labelColor: 'rgba(225,190,140,0.42)', baseDark: '#140f08', heat: '#FFB454', tzWide: 'rgba(255,180,84,0.26)', tz: '#FFB454',
  },
};

function mix(h1: string, h2: string, t: number) {
  const p = (h: string) => { h = h.replace('#', ''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; };
  const a = p(h1), b = p(h2);
  return '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('');
}

export const SAMPLE_MARKERS: LeadMarker[] = ([
  { city: 'Seattle', uf: 'WA', lat: 47.61, lon: -122.33, type: 'novo' },
  { city: 'Spokane', uf: 'WA', lat: 47.66, lon: -117.43, type: 'lead' },
  { city: 'Sacramento', uf: 'CA', lat: 38.58, lon: -121.49, type: 'novo' },
  { city: 'San Francisco', uf: 'CA', lat: 37.77, lon: -122.42, type: 'lead' },
  { city: 'San Jose', uf: 'CA', lat: 37.34, lon: -121.89, type: 'cliente' },
  { city: 'Los Angeles', uf: 'CA', lat: 34.05, lon: -118.24, type: 'cliente' },
  { city: 'San Diego', uf: 'CA', lat: 32.72, lon: -117.16, type: 'lead' },
  { city: 'Phoenix', uf: 'AZ', lat: 33.45, lon: -112.07, type: 'lead' },
  { city: 'Tucson', uf: 'AZ', lat: 32.22, lon: -110.97, type: 'cliente' },
  { city: 'Denver', uf: 'CO', lat: 39.74, lon: -104.99, type: 'novo' },
  { city: 'Colorado Springs', uf: 'CO', lat: 38.83, lon: -104.82, type: 'lead' },
  { city: 'Dallas', uf: 'TX', lat: 32.78, lon: -96.8, type: 'lead' },
  { city: 'Fort Worth', uf: 'TX', lat: 32.75, lon: -97.33, type: 'lead' },
  { city: 'Austin', uf: 'TX', lat: 30.27, lon: -97.74, type: 'novo' },
  { city: 'San Antonio', uf: 'TX', lat: 29.42, lon: -98.49, type: 'lead' },
  { city: 'Houston', uf: 'TX', lat: 29.76, lon: -95.37, type: 'cliente' },
  { city: 'Chicago', uf: 'IL', lat: 41.85, lon: -87.65, type: 'lead' },
  { city: 'Springfield', uf: 'IL', lat: 39.8, lon: -89.64, type: 'novo' },
  { city: 'Nashville', uf: 'TN', lat: 36.16, lon: -86.78, type: 'cliente' },
  { city: 'Memphis', uf: 'TN', lat: 35.15, lon: -90.05, type: 'lead' },
  { city: 'Atlanta', uf: 'GA', lat: 33.75, lon: -84.39, type: 'lead' },
  { city: 'Savannah', uf: 'GA', lat: 32.08, lon: -81.09, type: 'novo' },
  { city: 'Miami', uf: 'FL', lat: 25.76, lon: -80.19, type: 'lead' },
  { city: 'Orlando', uf: 'FL', lat: 28.54, lon: -81.38, type: 'cliente' },
  { city: 'Tampa', uf: 'FL', lat: 27.95, lon: -82.46, type: 'novo' },
  { city: 'Jacksonville', uf: 'FL', lat: 30.33, lon: -81.66, type: 'lead' },
  { city: 'Charlotte', uf: 'NC', lat: 35.23, lon: -80.84, type: 'lead' },
  { city: 'Raleigh', uf: 'NC', lat: 35.78, lon: -78.64, type: 'cliente' },
  { city: 'New York', uf: 'NY', lat: 40.71, lon: -74.0, type: 'lead' },
  { city: 'Buffalo', uf: 'NY', lat: 42.89, lon: -78.88, type: 'novo' },
  { city: 'Albany', uf: 'NY', lat: 42.65, lon: -73.75, type: 'cliente' },
  { city: 'Philadelphia', uf: 'PA', lat: 39.95, lon: -75.16, type: 'cliente' },
  { city: 'Pittsburgh', uf: 'PA', lat: 40.44, lon: -79.99, type: 'novo' },
  { city: 'Boston', uf: 'MA', lat: 42.36, lon: -71.06, type: 'novo' },
  { city: 'Worcester', uf: 'MA', lat: 42.26, lon: -71.8, type: 'lead' },
  { city: 'Washington', uf: 'DC', lat: 38.9, lon: -77.04, type: 'cliente' },
] as Omit<LeadMarker, 'name'>[]).map((m) => ({ ...m, name: m.city ?? m.uf }));

type StateCount = { novo: number; lead: number; cliente: number; total: number };

const MONO = "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace";
// Dimensões estimadas do tooltip — usadas p/ clampar nas bordas e centrá-lo verticalmente no cursor.
const TOOLTIP_W = 184;
const TOOLTIP_H = 132;

export default function LeadMap({
  markers = SAMPLE_MARKERS,
  height = 540,
  view: viewProp = '3d',
  tilt: tiltProp = 15,
  mode: modeProp = 'individual',
  theme: themeProp = 'ciber',
  show,
  resumo = true,
  showControls = true,
  showHeader = true,
  topoUrl = 'https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json',
  className,
}: LeadMapProps) {
  const [topo, setTopo] = useState<any>(null);
  const [now, setNow] = useState<Date>(() => new Date());
  const [view, setView] = useState<ViewMode>(viewProp);
  const [angle, setAngle] = useState<number>(tiltProp);
  const [mode, setMode] = useState<DisplayMode>(modeProp);
  const [themeKey, setThemeKey] = useState<ThemeKey>(themeProp);
  const [hover, setHover] = useState<{ abbr: string; x: number; y: number } | null>(null);
  const [panelUf, setPanelUf] = useState<string | null>(null);   // estado do painel de clique (registros do estado)

  // Config salva é a FONTE ÚNICA: quando as props mudam (Configurações > Mapa salvou), o mapa reflete.
  // Com showControls=false não há toggles internos; estes effects garantem o sync mesmo assim.
  useEffect(() => setView(viewProp), [viewProp]);
  useEffect(() => setAngle(tiltProp), [tiltProp]);
  useEffect(() => setMode(modeProp), [modeProp]);
  useEffect(() => setThemeKey(themeProp), [themeProp]);

  const panelRef = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(900);
  const H = height;
  const th = THEMES[themeKey];

  // VISIBILIDADE por tipo (Configurações > Mapa). Esconder = some de verdade em TODOS os modos; as contagens
  // (hover/estado/calor) só somam markers visíveis.
  const vis = { novo: show?.novo ?? true, lead: show?.lead ?? true, cliente: show?.cliente ?? true };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- deps são os campos primitivos de `vis` (objeto recriado a cada render).
  const visMarkers = useMemo(() => markers.filter((m) => vis[m.type]), [markers, vis.novo, vis.lead, vis.cliente]);

  useEffect(() => {
    let on = true;
    fetch(topoUrl).then((r) => r.json()).then((t) => on && setTopo(t)).catch(() => {});
    return () => { on = false; };
  }, [topoUrl]);

  useEffect(() => {
    const el = panelRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(() => setW(el.clientWidth || 900));
    ro.observe(el);
    setW(el.clientWidth || 900);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(id);
  }, []);

  // Painel de registros (clique no estado): fecha no Esc.
  useEffect(() => {
    if (!panelUf) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelUf(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelUf]);

  const counts = useMemo(() => {
    const m: Record<string, StateCount> = {};
    visMarkers.forEach((k) => {
      if (!m[k.uf]) m[k.uf] = { novo: 0, lead: 0, cliente: 0, total: 0 };
      m[k.uf][k.type]++; m[k.uf].total++;
    });
    return m;
  }, [visMarkers]);
  const maxT = useMemo(() => Math.max(1, ...Object.values(counts).map((c) => c.total)), [counts]);

  const built = useMemo(() => {
    if (!topo) return null;
    const states = feature(topo, topo.objects.states) as any;
    const nation = feature(topo, topo.objects.nation) as any;
    const proj = geoAlbersUsa().fitExtent([[24, 18], [w - 24, H - 30]], states);
    const path = geoPath(proj);
    const tzMesh = mesh(topo, topo.objects.states, (a: any, b: any) =>
      a !== b && tzOfName(a.properties.name) !== tzOfName(b.properties.name)
    );
    return { states, nation, proj, path, tzMesh };
  }, [topo, w, H]);

  const clocks = FUSOS.map((f) => {
    const time = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: f.tz }).format(now);
    const h = parseInt(new Intl.DateTimeFormat('en-US', { hour: '2-digit', hour12: false, timeZone: f.tz }).format(now), 10);
    return { ...f, time, color: h >= 8 && h < 18 ? '#fff' : 'rgba(225,232,244,0.7)' };
  });

  const onPathMove = (abbr: string) => (e: React.MouseEvent) => {
    const r = panelRef.current?.getBoundingClientRect();
    if (!r) return;
    const cx = e.clientX - r.left, cy = e.clientY - r.top;
    // À DIREITA do cursor e centrado verticalmente nele; se não couber à direita, vira pra esquerda. Clampa nas bordas.
    let x = cx + 14;
    if (x + TOOLTIP_W > r.width) x = cx - TOOLTIP_W - 14;
    let y = cy - TOOLTIP_H / 2;
    if (x < 6) x = 6;
    if (y < 6) y = 6;
    if (y + TOOLTIP_H > r.height - 6) y = r.height - TOOLTIP_H - 6;
    setHover({ abbr, x, y });
  };

  const seg = (active: boolean): React.CSSProperties => ({
    padding: '6px 13px', fontFamily: MONO, fontSize: 12, borderRadius: 9, cursor: 'pointer',
    whiteSpace: 'nowrap', userSelect: 'none', lineHeight: 1.2,
    ...(active ? { background: 'rgba(255,255,255,0.09)', color: '#fff', boxShadow: 'inset 0 0 0 1px var(--accent)' } : { color: 'rgba(200,215,235,0.6)' }),
  });

  const tip = hover ? (counts[hover.abbr] || { novo: 0, lead: 0, cliente: 0, total: 0 }) : null;

  return (
    <div
      ref={panelRef}
      className={className}
      style={{
        ...(th.vars as React.CSSProperties),
        position: 'relative', width: '100%', maxWidth: 1080,
        border: '1px solid rgba(255,255,255,0.09)', borderRadius: 22,
        background: 'linear-gradient(180deg,rgba(255,255,255,0.045),rgba(255,255,255,0.012))',
        boxShadow: '0 30px 80px -30px rgba(0,0,0,0.8), inset 0 1px 0 rgba(255,255,255,0.08)',
        backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)', overflow: 'hidden',
        color: '#E8ECF4', fontFamily: "'Space Grotesk', -apple-system, system-ui, sans-serif",
      }}
    >
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1, background: 'linear-gradient(90deg,transparent,var(--line),transparent)' }} />

      {showHeader && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', padding: '22px 24px 4px' }}>
          <div>
            <div style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.18em', textTransform: 'uppercase', color: 'rgba(150,185,225,0.55)', marginBottom: 7 }}>Lead Map · EUA</div>
            <div style={{ fontSize: 23, fontWeight: 600, letterSpacing: '-0.01em', lineHeight: 1 }}>Mapa de Leads</div>
            <div style={{ fontSize: 12.5, color: 'rgba(190,205,230,0.6)', marginTop: 5 }}>Distribuição por fuso horário</div>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {clocks.map((z) => (
              <div key={z.abbr} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, padding: '7px 11px', borderRadius: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(8px)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontFamily: MONO, fontSize: 9, letterSpacing: '0.12em', color: 'rgba(160,190,225,0.7)' }}>
                  <span style={{ width: 5, height: 5, borderRadius: '50%', background: z.dot }} />{z.abbr}
                </div>
                <div style={{ fontFamily: MONO, fontSize: 14, color: z.color, lineHeight: 1 }}>{z.time}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {showControls && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px 18px', flexWrap: 'wrap', padding: '12px 24px 8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(150,185,225,0.5)' }}>Vista</span>
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {(['3d', '2d'] as ViewMode[]).map((v) => (
                <span key={v} onClick={() => setView(v)} style={seg(view === v)}>{v.toUpperCase()}</span>
              ))}
            </div>
            {view === '3d' && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, marginLeft: 4 }}>
                <input type="range" min={0} max={45} value={angle} onChange={(e) => setAngle(+e.target.value)} style={{ width: 88, accentColor: 'var(--accent)', cursor: 'pointer' }} />
                <span style={{ fontFamily: MONO, fontSize: 11, color: 'rgba(200,215,235,0.7)', width: 30 }}>{angle}°</span>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(150,185,225,0.5)' }}>Modo</span>
            <div style={{ display: 'inline-flex', gap: 2, padding: 3, borderRadius: 11, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}>
              {([['individual', 'Individual'], ['estado', 'Por estado'], ['calor', 'Calor']] as [DisplayMode, string][]).map(([k, label]) => (
                <span key={k} onClick={() => setMode(k)} style={seg(mode === k)}>{label}</span>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginLeft: 'auto' }}>
            <span style={{ fontFamily: MONO, fontSize: 9, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(150,185,225,0.5)' }}>Tema</span>
            <div style={{ display: 'inline-flex', gap: 8 }}>
              {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                <span key={k} title={THEMES[k].label} onClick={() => setThemeKey(k)} style={{ width: 22, height: 22, borderRadius: 7, cursor: 'pointer', background: THEMES[k].accent, display: 'inline-block', opacity: themeKey === k ? 1 : 0.5, boxShadow: themeKey === k ? `0 0 0 2px rgba(255,255,255,0.92),0 0 10px ${THEMES[k].accent}` : '0 0 0 1px rgba(255,255,255,0.22)' }} />
              ))}
            </div>
          </div>
        </div>
      )}

      <div style={{ position: 'relative', height: H, marginTop: 2 }}>
        <div style={{ position: 'absolute', left: '50%', top: '62%', width: '62%', height: 200, transform: 'translate(-50%,-50%)', background: 'radial-gradient(ellipse at center,var(--glow),transparent 70%)', filter: 'blur(26px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', inset: 0, perspective: '1600px', perspectiveOrigin: '50% 32%' }}>
          <div style={{ position: 'absolute', inset: 0, transform: view === '2d' ? 'none' : `rotateX(${angle}deg)`, transformOrigin: 'center 36%', transformStyle: 'preserve-3d' }}>
            {view === '3d' && (
              <div style={{ position: 'absolute', inset: '-20% -10%', backgroundImage: 'linear-gradient(var(--grid) 1px,transparent 1px),linear-gradient(90deg,var(--grid) 1px,transparent 1px)', backgroundSize: '30px 30px', WebkitMaskImage: 'radial-gradient(ellipse 60% 60% at 50% 45%,#000 30%,transparent 80%)', maskImage: 'radial-gradient(ellipse 60% 60% at 50% 45%,#000 30%,transparent 80%)', pointerEvents: 'none' }} />
            )}
            <div style={{ position: 'absolute', inset: 0 }}>
              {built ? (
                <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} style={{ display: 'block', width: '100%', height: '100%', overflow: 'visible' }}>
                  <defs>
                    <filter id="lm-mglow" x="-80%" y="-80%" width="260%" height="260%">
                      <feGaussianBlur stdDeviation="4" result="b" />
                      <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
                    </filter>
                    <filter id="lm-tzglow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="3" /></filter>
                    <filter id="lm-heatblur" x="-120%" y="-120%" width="340%" height="340%"><feGaussianBlur stdDeviation="11" /></filter>
                  </defs>

                  <path d={built.path(built.nation) || ''} transform="translate(0,15)" fill="#04060d" opacity={0.85} />

                  {built.states.features.map((f: any, i: number) => {
                    const abbr = NAME_TO_ABBR[f.properties.name];
                    const z = tzOfName(f.properties.name);
                    const cnt = counts[abbr]?.total || 0;
                    const fill = mode === 'calor'
                      ? (cnt > 0 ? mix(th.baseDark, th.heat, Math.min(1, cnt / maxT) * 0.92) : th.baseDark)
                      : (th.zoneFill[z] || th.baseDark);
                    const isHover = hover?.abbr === abbr;
                    return (
                      <path key={i} d={built.path(f) || ''} fill={fill}
                        stroke={isHover ? th.accent : th.stateStroke} strokeWidth={isHover ? 1.5 : 0.6}
                        style={{ cursor: 'pointer' }}
                        onMouseMove={onPathMove(abbr)} onMouseLeave={() => setHover(null)}
                        onClick={() => { if (abbr) setPanelUf(abbr); }} />
                    );
                  })}

                  <path d={built.path(built.nation) || ''} fill="none" stroke={th.nationEdge} strokeWidth={1} style={{ pointerEvents: 'none' }} />

                  {mode === 'calor' && built.states.features.map((f: any, i: number) => {
                    const cnt = counts[NAME_TO_ABBR[f.properties.name]]?.total || 0;
                    if (cnt <= 0) return null;
                    const ce = built.path.centroid(f);
                    if (!ce || isNaN(ce[0])) return null;
                    return <circle key={`h${i}`} cx={ce[0]} cy={ce[1]} r={16 + cnt * 9} fill={th.heat} fillOpacity={0.1 + 0.1 * Math.min(1, cnt / maxT)} filter="url(#lm-heatblur)" style={{ pointerEvents: 'none' }} />;
                  })}

                  {built.tzMesh && (
                    <>
                      <path d={built.path(built.tzMesh as any) || ''} fill="none" stroke={th.tzWide} strokeWidth={3.5} strokeLinecap="round" filter="url(#lm-tzglow)" style={{ pointerEvents: 'none' }} />
                      <path d={built.path(built.tzMesh as any) || ''} fill="none" stroke={th.tz} strokeWidth={1.1} strokeOpacity={0.6} style={{ pointerEvents: 'none' }} />
                    </>
                  )}
                  {ZONE_LABELS.map((zl, i) => {
                    const p = built.proj(zl.at); if (!p) return null;
                    return <text key={`z${i}`} x={p[0]} y={p[1]} textAnchor="middle" fontFamily={MONO} fontSize={10.5} letterSpacing={2.5} fill={th.labelColor} style={{ pointerEvents: 'none' }}>{zl.txt}</text>;
                  })}

                  {mode === 'individual' && visMarkers.map((m, i) => {
                    const p = built.proj([m.lon, m.lat]); if (!p) return null;
                    const col = COLORS[m.type];
                    return (
                      <g key={`m${i}`} filter="url(#lm-mglow)" style={{ cursor: 'pointer' }} onClick={() => setPanelUf(m.uf)}>
                        <circle cx={p[0]} cy={p[1]} r={9} fill={col} fillOpacity={0.18} />
                        <circle cx={p[0]} cy={p[1]} r={5.4} fill={col} stroke="rgba(255,255,255,0.65)" strokeWidth={1.1} />
                        <circle cx={p[0] - 1.6} cy={p[1] - 1.7} r={1.5} fill="rgba(255,255,255,0.85)" />
                      </g>
                    );
                  })}

                  {mode === 'estado' && built.states.features.map((f: any, i: number) => {
                    const cnt = counts[NAME_TO_ABBR[f.properties.name]];
                    if (!cnt || cnt.total <= 0) return null;
                    const ce = built.path.centroid(f);
                    if (!ce || isNaN(ce[0])) return null;
                    const order = ([['lead', cnt.lead], ['cliente', cnt.cliente], ['novo', cnt.novo]] as [LeadType, number][]).sort((a, b) => b[1] - a[1]);
                    const col = COLORS[order[0][0]];
                    const r = 10 + Math.sqrt(cnt.total) * 6;
                    const bAbbr = NAME_TO_ABBR[f.properties.name];
                    return (
                      <g key={`b${i}`} filter="url(#lm-mglow)" style={{ cursor: 'pointer' }} onClick={() => { if (bAbbr) setPanelUf(bAbbr); }}>
                        <circle cx={ce[0]} cy={ce[1]} r={r + 4} fill={col} fillOpacity={0.16} />
                        <circle cx={ce[0]} cy={ce[1]} r={r} fill={col} fillOpacity={0.92} stroke="rgba(255,255,255,0.7)" strokeWidth={1.2} />
                        <text x={ce[0]} y={ce[1]} dy="0.35em" textAnchor="middle" fontFamily={MONO} fontWeight={500} fontSize={cnt.total >= 4 ? 13 : 11} fill="#0a0f16">{cnt.total}</text>
                      </g>
                    );
                  })}
                </svg>
              ) : (
                <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(160,185,220,0.5)', fontFamily: MONO, fontSize: 12 }}>Carregando mapa…</div>
              )}
            </div>
          </div>
        </div>

        {hover && tip && resumo && !panelUf && (
          <div style={{ position: 'absolute', left: hover.x, top: hover.y, zIndex: 6, pointerEvents: 'none', width: TOOLTIP_W, padding: '11px 13px', borderRadius: 12, background: 'rgba(9,13,21,0.92)', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 16px 40px -12px rgba(0,0,0,0.8)', backdropFilter: 'blur(10px)' }}>
            <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 7 }}>{ABBR_TO_NAME[hover.abbr] || hover.abbr}</div>
            {(['novo', 'lead', 'cliente'] as LeadType[]).filter((t) => vis[t]).map((t) => (
              <div key={t} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '2px 0' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12, color: 'rgba(220,228,242,0.85)' }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: COLORS[t], boxShadow: `0 0 6px ${COLORS[t]}` }} />{TYPE_LABEL[t]}
                </span>
                <span style={{ fontFamily: MONO, fontSize: 12, color: '#fff' }}>{tip[t]}</span>
              </div>
            ))}
            <div style={{ marginTop: 7, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.12)', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: MONO, fontSize: 10, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(160,185,220,0.7)' }}>Total</span>
              <span style={{ fontFamily: MONO, fontSize: 13, color: 'var(--accent)' }}>{tip.total}</span>
            </div>
          </div>
        )}

        {/* PAINEL DE CLIQUE: registros do estado, agrupados por tipo, com NOMES (respeita o filtro de visibilidade).
            Centrado na área do mapa (nunca sai da tela); fecha no X / clicar fora / Esc. */}
        {panelUf && (() => {
          const recs = visMarkers.filter((m) => m.uf === panelUf);
          const groups: Record<LeadType, string[]> = { novo: [], lead: [], cliente: [] };
          recs.forEach((m) => groups[m.type].push(m.name));
          const order: [LeadType, string][] = [['novo', 'Novos leads'], ['lead', 'Leads'], ['cliente', 'Clientes']];
          return (
            <div onClick={() => setPanelUf(null)} style={{ position: 'absolute', inset: 0, zIndex: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, background: 'rgba(2,4,9,0.55)', backdropFilter: 'blur(3px)' }}>
              <div onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label={`Registros — ${ABBR_TO_NAME[panelUf] || panelUf}`}
                style={{ width: 'min(360px, 100%)', maxHeight: '88%', display: 'flex', flexDirection: 'column', borderRadius: 16, background: 'rgba(10,14,22,0.97)', border: '1px solid rgba(255,255,255,0.13)', boxShadow: '0 28px 70px -18px rgba(0,0,0,0.88)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '14px 16px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: 15 }}>{ABBR_TO_NAME[panelUf] || panelUf}</div>
                    <div style={{ fontFamily: MONO, fontSize: 10.5, color: 'rgba(170,195,225,0.6)', marginTop: 2 }}>{recs.length} {recs.length === 1 ? 'registro' : 'registros'}</div>
                  </div>
                  <button onClick={() => setPanelUf(null)} aria-label="Fechar" style={{ cursor: 'pointer', flex: 'none', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.13)', borderRadius: 9, width: 30, height: 30, color: '#fff', fontSize: 17, lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
                </div>
                <div style={{ overflowY: 'auto', padding: '12px 16px 16px' }}>
                  {recs.length === 0 ? (
                    <div style={{ fontFamily: MONO, fontSize: 12, color: 'rgba(180,200,225,0.6)' }}>Nada visível neste estado (confira os filtros em Configurações &gt; Mapa).</div>
                  ) : order.filter(([t]) => groups[t].length > 0).map(([t, label]) => (
                    <div key={t} style={{ marginBottom: 14 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 7, fontFamily: MONO, fontSize: 10, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'rgba(185,205,230,0.72)' }}>
                        <span style={{ width: 9, height: 9, borderRadius: '50%', background: COLORS[t], boxShadow: `0 0 6px ${COLORS[t]}` }} />{label}<span style={{ color: 'rgba(150,175,205,0.55)' }}>· {groups[t].length}</span>
                      </div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                        {groups[t].map((nm, i) => (
                          <div key={i} style={{ fontSize: 13.5, color: 'rgba(228,235,246,0.92)', paddingLeft: 16, lineHeight: 1.35 }}>{nm}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          );
        })()}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px 20px', flexWrap: 'wrap' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 16, padding: '9px 15px', borderRadius: 13, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', backdropFilter: 'blur(10px)', fontFamily: MONO, fontSize: 11.5, color: 'rgba(210,222,240,0.85)' }}>
          {([['novo', 'Novo lead'], ['lead', 'Leads'], ['cliente', 'Clientes']] as [LeadType, string][]).map(([t, label]) => (
            <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <span style={{ width: 10, height: 10, borderRadius: '50%', background: COLORS[t], boxShadow: `0 0 8px ${COLORS[t]}` }} />{label}
            </span>
          ))}
        </div>
        {mode === 'calor' && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontFamily: MONO, fontSize: 10.5, color: 'rgba(180,200,225,0.6)' }}>
            menos<span style={{ width: 64, height: 8, borderRadius: 4, background: 'linear-gradient(90deg,rgba(255,255,255,0.07),var(--accent))' }} />mais
          </span>
        )}
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontFamily: MONO, fontSize: 10.5, color: 'rgba(150,185,225,0.55)' }}>
          <span style={{ width: 16, height: 0, borderTop: '1.5px solid var(--accent)', boxShadow: '0 0 6px var(--accent)' }} />linha de fuso horário
        </span>
      </div>
    </div>
  );
}
