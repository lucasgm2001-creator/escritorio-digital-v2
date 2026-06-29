'use client'
import { useEffect, useState } from 'react'
import type { ViewMode, DisplayMode, ThemeKey, LeadType } from '@/components/map/LeadMap'

// Config do LeadMap, persistida em localStorage ('mapPrefs'). Configurações ESCREVE (saveMapPrefs); o mapa LÊ
// no mount e REAGE a mudança (evento 'storage' = outras abas; 'mapPrefs-change' = mesma aba). Fonte ÚNICA.
export interface MapPrefs {
  view: ViewMode
  tilt: number
  mode: DisplayMode
  theme: ThemeKey
  show: Record<LeadType, boolean>   // visibilidade por tipo (novo/lead/cliente) no mapa
  resumo: boolean                   // tooltip de resumo ao passar o mouse
}

export const DEFAULT_MAP_PREFS: MapPrefs = {
  view: '3d', tilt: 15, mode: 'individual', theme: 'lima',
  show: { novo: true, lead: true, cliente: true },
  resumo: true,
}
const KEY = 'mapPrefs'
const CHANGE_EVT = 'mapPrefs-change'

const bool = (v: unknown, d: boolean) => (typeof v === 'boolean' ? v : d)

// Lê + normaliza (qualquer valor inválido cai no default). Só no client. Migração suave: prefs antigo SEM os
// campos novos (show/resumo) → preenche com defaults.
export function readMapPrefs(): MapPrefs {
  if (typeof window === 'undefined') return DEFAULT_MAP_PREFS
  try {
    const raw = window.localStorage.getItem(KEY)
    if (!raw) return DEFAULT_MAP_PREFS
    const p = JSON.parse(raw) as Partial<MapPrefs>
    const sh = (p.show && typeof p.show === 'object' ? p.show : {}) as Partial<Record<LeadType, boolean>>
    return {
      view: p.view === '2d' || p.view === '3d' ? p.view : DEFAULT_MAP_PREFS.view,
      tilt: typeof p.tilt === 'number' && isFinite(p.tilt) ? Math.min(45, Math.max(0, Math.round(p.tilt))) : DEFAULT_MAP_PREFS.tilt,
      mode: p.mode === 'individual' || p.mode === 'estado' || p.mode === 'calor' ? p.mode : DEFAULT_MAP_PREFS.mode,
      theme: p.theme === 'ciber' || p.theme === 'lima' || p.theme === 'ambar' ? p.theme : DEFAULT_MAP_PREFS.theme,
      show: { novo: bool(sh.novo, true), lead: bool(sh.lead, true), cliente: bool(sh.cliente, true) },
      resumo: bool(p.resumo, true),
    }
  } catch { return DEFAULT_MAP_PREFS }
}

export function saveMapPrefs(next: MapPrefs): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next))
    // 'storage' NÃO dispara na MESMA aba que escreveu → evento próprio p/ a UI/mapa reagirem na hora.
    window.dispatchEvent(new CustomEvent(CHANGE_EVT))
  } catch { /* ignore */ }
}

// Estado vivo da config. SSR-safe: começa no default e LÊ o localStorage no client (useEffect) → sem mismatch.
export function useMapPrefs(): MapPrefs {
  const [prefs, setPrefs] = useState<MapPrefs>(DEFAULT_MAP_PREFS)
  useEffect(() => {
    setPrefs(readMapPrefs())
    const onChange = () => setPrefs(readMapPrefs())
    window.addEventListener('storage', onChange)        // outras abas
    window.addEventListener(CHANGE_EVT, onChange)       // mesma aba
    return () => {
      window.removeEventListener('storage', onChange)
      window.removeEventListener(CHANGE_EVT, onChange)
    }
  }, [])
  return prefs
}
