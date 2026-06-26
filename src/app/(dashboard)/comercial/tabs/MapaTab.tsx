'use client'

import { useState, useEffect, useMemo, type MouseEvent } from 'react'
import usMap from '@/data/us-map.json'
import { cn } from '@/lib/utils'
import { getMapSkin, getMapSep, MAP_SETTINGS_EVENT, type MapSkin } from '@/lib/mapSettings'
import type { Lead } from '../types'
import type { Client } from '../../clientes/ClientesClient'

// ── Mapa dos EUA. Geografia = src/data/us-map.json. UM ponto por ESTADO: leads (azul #2E7BFF) e
//    clientes (verde #00E08A) lado a lado, com o NÚMERO dentro; halo + sombra (3D sutil). As 3 placas
//    são tingidas como faixas de fuso (nomes iguais ao relógio do topo). Dinheiro NÃO entra aqui. ──

type Region = 'W' | 'C' | 'E'
type Filter = 'todos' | 'clientes' | 'leads'

const DIR: Record<Region, number> = { W: -1, C: 0, E: 1 }   // deslocamento das placas (×SEP)
// Nomes de fuso IGUAIS ao relógio do topo (Topbar): EUA Oeste · EUA Mont. · EUA Leste.
const FUSO_LABEL: Record<Region, string> = { W: 'EUA Oeste', C: 'EUA Mont.', E: 'EUA Leste' }
const OPEN_EXCLUDE = new Set(['fechado', 'perdido', 'lixeira'])   // leads "fechados" não entram

const HIT_PX = 26                              // área de toque generosa
const LEAD_COLOR = '#2E7BFF', CLIENT_COLOR = '#00E08A'

const MAP = usMap as unknown as {
  W: number; H: number
  regions: { key: Region; name: string; fill: string; lines: string; lx: number; ly: number }[]
  areaCodes: Record<string, { x: number; y: number; st: string; region: Region; city: string }>
  states: Record<string, { x: number; y: number; region: Region }>
}

interface StateAgg { st: string; x: number; y: number; region: Region; leads: string[]; clients: string[] }

export function MapaTab({ leads, clients, showLeads = true, showClients = true, showFusos = true, embedded = false }: {
  leads: Lead[]; clients: Client[]
  showLeads?: boolean; showClients?: boolean; showFusos?: boolean
  embedded?: boolean   // dentro do Hall/prévia: esconde a barra de topo e ajusta o fit ao container
}) {
  const [skin, setSkin] = useState<MapSkin>('blue')
  const [sep, setSep] = useState<number>(4)
  const [filter, setFilter] = useState<Filter>('todos')
  const [hot, setHot] = useState<Region | null>(null)
  const [sel, setSel] = useState<{ agg: StateAgg; left: number; top: number; mobile: boolean } | null>(null)
  // O SVG escala 100% pelo viewBox (sem medir o container em px). Os pinos são desenhados em unidades
  // do viewBox e escalam junto com o mapa. MAP_SCALE só calibra o tamanho-base do pino p/ casar com o
  // visual de desktop (≈ 560px de altura) — em telas menores tudo encolhe proporcionalmente.
  const MAP_SCALE = 0.9
  const effSep = sep === 4 ? 2 : sep

  useEffect(() => {
    const sync = () => { setSkin(getMapSkin()); setSep(getMapSep()) }
    sync()
    window.addEventListener(MAP_SETTINGS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(MAP_SETTINGS_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [])

  useEffect(() => {
    if (!sel) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setSel(null) }
    const onDoc = (e: Event) => {
      const t = e.target as Element | null
      if (t?.closest?.('.ed-map-panel') || t?.closest?.('.pin')) return
      setSel(null)
    }
    window.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDoc)
    document.addEventListener('touchstart', onDoc)
    return () => {
      window.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDoc)
      document.removeEventListener('touchstart', onDoc)
    }
  }, [sel])

  // Estado do registro: state (US válido) ou DDD→estado. Agrega leads em aberto + clientes ativos.
  const states = useMemo(() => {
    const map = new Map<string, StateAgg>()
    const get = (st: string): StateAgg | null => {
      const s = MAP.states[st]; if (!s) return null
      let b = map.get(st)
      if (!b) { b = { st, x: s.x, y: s.y, region: s.region, leads: [], clients: [] }; map.set(st, b) }
      return b
    }
    const stateOf = (rec: { state?: string | null; area_code?: string | null }): string | null => {
      const st = (rec.state ?? '').trim().toUpperCase()
      if (st && MAP.states[st]) return st
      const code = (rec.area_code ?? '').trim()
      if (code && MAP.areaCodes[code]) return MAP.areaCodes[code].st
      return null
    }
    for (const c of clients) { if (c.status !== 'ativo') continue; const st = stateOf(c); if (st) get(st)?.clients.push(c.name || 'Cliente') }
    for (const l of leads) { if (OPEN_EXCLUDE.has(l.status)) continue; const st = stateOf(l); if (st) get(st)?.leads.push(l.name || 'Lead') }
    return Array.from(map.values())
  }, [leads, clients])

  const totalClients = useMemo(() => states.reduce((s, m) => s + m.clients.length, 0), [states])
  const totalLeads = useMemo(() => states.reduce((s, m) => s + m.leads.length, 0), [states])

  // Pontos a desenhar (respeitando filtro + toggles). Estado com os dois → azul à esq, verde à dir.
  interface Pt { key: string; type: 'lead' | 'client'; x: number; y: number; count: number; agg: StateAgg }
  const points = useMemo<Pt[]>(() => {
    const showL = showLeads && filter !== 'clientes'
    const showC = showClients && filter !== 'leads'
    const off = 7 / MAP_SCALE
    const out: Pt[] = []
    for (const m of states) {
      const hasL = showL && m.leads.length > 0
      const hasC = showC && m.clients.length > 0
      const bx = m.x + DIR[m.region] * effSep
      if (hasL && hasC) {
        out.push({ key: m.st + ':l', type: 'lead', x: bx - off, y: m.y, count: m.leads.length, agg: m })
        out.push({ key: m.st + ':c', type: 'client', x: bx + off, y: m.y, count: m.clients.length, agg: m })
      } else if (hasL) {
        out.push({ key: m.st + ':l', type: 'lead', x: bx, y: m.y, count: m.leads.length, agg: m })
      } else if (hasC) {
        out.push({ key: m.st + ':c', type: 'client', x: bx, y: m.y, count: m.clients.length, agg: m })
      }
    }
    return out
  }, [states, showLeads, showClients, filter, effSep])

  const openPanel = (agg: StateAgg, e: MouseEvent) => {
    const r = (e.currentTarget as Element).getBoundingClientRect()
    const mobile = window.innerWidth <= 700
    if (mobile) { setSel({ agg, left: 0, top: 0, mobile }); return }
    const pw = 268, ph = 260
    let left = r.right + 14, top = r.top - 12
    if (left + pw > window.innerWidth - 12) left = r.left - pw - 14
    if (left < 12) left = 12
    if (top + ph > window.innerHeight - 12) top = window.innerHeight - ph - 12
    if (top < 12) top = 12
    setSel({ agg, left, top, mobile })
  }

  return (
    <div className={cn('overflow-hidden bg-bento-bg', embedded ? 'h-full p-0' : 'h-full p-4 sm:p-6')}>
      <div className={cn('ed-map mx-auto', !embedded && 'max-w-[1180px]', embedded && 'h-full flex flex-col', 'skin-' + skin, !showFusos && 'flat-fuso')}>
        {!embedded && (
          <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="font-display font-bold text-bento-text text-lg">Mapa de Clientes e Leads</h2>
              <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1">
                {(['todos', 'clientes', 'leads'] as Filter[]).map(f => (
                  <button key={f} onClick={() => { setFilter(f); setSel(null) }}
                    className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                      filter === f ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
                    {f === 'todos' ? 'Todos' : f === 'clientes' ? 'Clientes' : 'Leads'}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Counter label="Estados" value={states.length} />
              <Counter label="Clientes" value={totalClients} cls="text-[#00E08A]" />
              <Counter label="Leads" value={totalLeads} cls="text-[#2E7BFF]" />
            </div>
          </div>
        )}

        {/* Palco do mapa — embutido: preenche a altura (flex-1); avulso: usa a proporção do mapa. */}
        <div className={cn('ed-map-stage', embedded ? 'flex-1 min-h-0' : 'aspect-[1000/624]')}>
          {/* Escala SÓ pelo viewBox: w/h 100% do palco, sem px fixos. preserveAspectRatio centraliza
              e nunca distorce (letterbox se a caixa não bater 1000/624). */}
          <svg className="ed-map-svg" viewBox={`0 0 ${MAP.W} ${MAP.H}`} preserveAspectRatio="xMidYMid meet"
            style={{ width: '100%', height: '100%', margin: '0 auto', display: 'block' }}
            xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Mapa dos EUA com clientes e leads">
            <defs>
              {/* Pontos de vidro: leads azul, clientes verde. Halo (blur) + sombra suave (flutuando). */}
              <radialGradient id="ed-g-lead" cx="38%" cy="32%" r="70%"><stop offset="0" stopColor="#EAF3FF" /><stop offset=".35" stopColor="#7FB2FF" /><stop offset=".72" stopColor="#2E7BFF" /><stop offset="1" stopColor="#15539C" /></radialGradient>
              <radialGradient id="ed-g-client" cx="38%" cy="32%" r="70%"><stop offset="0" stopColor="#E6FFF6" /><stop offset=".35" stopColor="#5FF0C0" /><stop offset=".72" stopColor="#00E08A" /><stop offset="1" stopColor="#018A56" /></radialGradient>
              <filter id="ed-pt-halo" x="-150%" y="-150%" width="400%" height="400%"><feGaussianBlur stdDeviation="3" /></filter>
              <filter id="ed-pt-shadow" x="-80%" y="-80%" width="260%" height="260%"><feDropShadow dx="0" dy="0.9" stdDeviation="0.9" floodColor="#000" floodOpacity="0.35" /></filter>
              <filter id="ed-glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.4" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
            </defs>

            {MAP.regions.map(r => (
              <g key={r.key} className={cn('region', 'region-' + r.key, hot === r.key && 'hot')} transform={`translate(${DIR[r.key] * effSep},0)`}
                onMouseEnter={() => setHot(r.key)} onMouseLeave={() => setHot(h => (h === r.key ? null : h))}>
                <path className="fillHit" d={r.fill} />
                <path className="fill" d={r.fill} />
                <path className="lines" d={r.lines} />
                <path className="edge" d={r.fill} />
                <path className="edgeGlow" d={r.fill} />
                {showFusos && <text className="rlabel" x={r.lx} y={r.ly}>{FUSO_LABEL[r.key]}</text>}
              </g>
            ))}

            <g>
              {points.map(p => (
                <StatePoint key={p.key} type={p.type} x={p.x} y={p.y} count={p.count} scale={MAP_SCALE}
                  selected={sel?.agg.st === p.agg.st} onClick={e => openPanel(p.agg, e)} />
              ))}
            </g>
          </svg>
          <div className="ed-map-vig" />
          {skin === 'holo' && <div className="ed-map-scan" />}
        </div>

        {/* Legenda */}
        <div className="flex items-center justify-center gap-x-4 gap-y-1 flex-wrap mt-2 font-tech text-[10.5px] text-bento-muted">
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: LEAD_COLOR }} />Leads no estado</span>
          <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full" style={{ background: CLIENT_COLOR }} />Clientes no estado</span>
          <span className="text-bento-muted/70">dois lado a lado = tem os dois</span>
        </div>

        {sel && (
          <div className="ed-map-panel" style={sel.mobile ? { left: 8, right: 8, bottom: 10 } : { left: sel.left, top: sel.top }}>
            <button className="ed-map-x" onClick={() => setSel(null)} aria-label="Fechar">&#215;</button>
            <div className="ed-map-ph">
              <div className="ed-map-city">{sel.agg.st}</div>
              <div className="ed-map-badges"><span className="ed-map-bdg">{FUSO_LABEL[sel.agg.region]}</span></div>
            </div>
            <div className="ed-map-pb">
              {sel.agg.clients.length > 0 && <PanelSection title="Clientes" cls="client" items={sel.agg.clients} />}
              {sel.agg.leads.length > 0 && <PanelSection title="Leads" cls="lead" items={sel.agg.leads} />}
              {sel.agg.clients.length === 0 && sel.agg.leads.length === 0 && <p className="ed-map-empty">Sem registros.</p>}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Counter({ label, value, cls }: { label: string; value: number; cls?: string }) {
  return (
    <span className="font-tech text-[11px] text-bento-text border border-bento-border bg-bento-panel rounded-lg px-2.5 py-1.5 inline-flex items-baseline gap-1.5">
      <b className={cn('text-sm font-bold', cls)}>{value}</b>
      <span className="uppercase tracking-wider text-[9px] text-bento-muted">{label}</span>
    </span>
  )
}

// Ponto do estado: halo + núcleo de vidro (gradiente) + sombra + reflexo + NÚMERO branco no centro.
function StatePoint({ type, x, y, count, scale, selected, onClick }: {
  type: 'lead' | 'client'; x: number; y: number; count: number; scale: number; selected: boolean; onClick: (e: MouseEvent) => void
}) {
  const u = (px: number) => px / (scale || 1)
  const color = type === 'lead' ? LEAD_COLOR : CLIENT_COLOR
  const digits = String(count).length
  const coreR = 8 + (digits >= 3 ? 2.5 : 0)
  return (
    <g className={cn('pin', type, selected && 'sel')} transform={`translate(${x},${y})`}
      role="button" tabIndex={0} onClick={e => { e.stopPropagation(); onClick(e) }}>
      <circle r={u(coreR + 5)} fill={color} opacity={0.18} filter="url(#ed-pt-halo)" />
      <circle className="selRing" r={u(coreR + 3)} />
      <circle r={u(coreR)} fill={`url(#ed-g-${type})`} filter="url(#ed-pt-shadow)" />
      <circle r={u(coreR)} fill="none" stroke="rgba(255,255,255,0.32)" strokeWidth="0.6" vectorEffect="non-scaling-stroke" />
      <circle cx={u(-coreR * 0.32)} cy={u(-coreR * 0.36)} r={u(coreR * 0.26)} fill="#fff" opacity={0.7} />
      <text className="pinCount" fontSize={u(digits >= 3 ? 6.5 : 8)}>{count}</text>
      <circle className="hit" r={u(HIT_PX)} fill="transparent" />
    </g>
  )
}

function PanelSection({ title, cls, items }: { title: string; cls: 'client' | 'lead'; items: string[] }) {
  return (
    <div className="ed-map-sec">
      <div className={cn('ed-map-cap', cls)}>{title} · {items.length}</div>
      {items.map((nm, i) => (
        <div className="ed-map-cli" key={i}>
          <span className="ed-map-ix">{String(i + 1).padStart(2, '0')}</span>
          <span className={cn('ed-map-tk', cls)} />
          <span className="ed-map-nm">{nm}</span>
        </div>
      ))}
    </div>
  )
}
