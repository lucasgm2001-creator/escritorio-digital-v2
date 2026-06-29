import type { LeadMarker, LeadType } from '@/components/map/LeadMap'

// Centro geográfico aproximado [lon, lat] de cada estado dos EUA. Os leads/clients têm `state` (UF) mas NÃO
// lat/lon — então posicionamos no centro do estado. (Modos "por estado"/"calor" agregam por UF, então a
// precisão por-marcador não importa; no modo "individual" espalhamos em espiral p/ não empilhar.)
const CENTROIDS: Record<string, [number, number]> = {
  AL: [-86.83, 32.80], AK: [-152.0, 63.5], AZ: [-111.66, 34.17], AR: [-92.44, 34.75], CA: [-119.68, 37.18],
  CO: [-105.55, 39.0], CT: [-72.73, 41.60], DE: [-75.51, 39.0], DC: [-77.03, 38.90], FL: [-81.69, 28.63],
  GA: [-83.44, 32.65], HI: [-157.0, 20.6], ID: [-114.61, 44.35], IL: [-89.20, 40.06], IN: [-86.26, 39.89],
  IA: [-93.50, 42.07], KS: [-98.38, 38.50], KY: [-84.86, 37.53], LA: [-91.96, 31.05], ME: [-69.24, 45.37],
  MD: [-76.80, 39.06], MA: [-71.81, 42.26], MI: [-84.54, 44.35], MN: [-94.31, 46.28], MS: [-89.66, 32.74],
  MO: [-92.46, 38.36], MT: [-109.65, 46.92], NE: [-99.81, 41.53], NV: [-116.66, 39.33], NH: [-71.58, 43.69],
  NJ: [-74.52, 40.06], NM: [-106.11, 34.41], NY: [-75.50, 42.95], NC: [-79.39, 35.54], ND: [-100.30, 47.45],
  OH: [-82.79, 40.29], OK: [-97.50, 35.57], OR: [-120.56, 43.94], PA: [-77.80, 40.99], RI: [-71.51, 41.68],
  SC: [-80.90, 33.86], SD: [-100.23, 44.30], TN: [-86.35, 35.86], TX: [-99.34, 31.49], UT: [-111.67, 39.32],
  VT: [-72.66, 44.07], VA: [-78.45, 37.52], WA: [-120.45, 47.38], WV: [-80.62, 38.64], WI: [-89.99, 44.62],
  WY: [-107.55, 43.0], PR: [-66.5, 18.2],
}

// Leads "abertos" (mesma regra do funil/mapa): exclui fechado/perdido/lixeira.
const CLOSED = new Set(['fechado', 'perdido', 'lixeira'])

type Row = { name?: string | null; state?: string | null; status?: string | null }

// Converte leads + clients reais em markers do LeadMap.
//  • cliente ativo → 'cliente'; lead aberto com status 'novo' → 'novo'; demais leads abertos → 'lead'.
//  • carrega o NOME real (leads.name / clients.name) p/ o painel de clique listar os registros.
//  • posiciona no centro do estado (UF de `state`); sem UF válida → ignora.
//  • espiral determinística por índice-no-estado (golden angle) p/ não empilhar no modo individual.
export function toLeadMarkers(leads: Row[], clients: Row[]): LeadMarker[] {
  const out: LeadMarker[] = []
  const perState: Record<string, number> = {}
  const push = (uf: string, type: LeadType, name: string | null | undefined) => {
    const ce = CENTROIDS[uf]
    if (!ce) return
    const n = (perState[uf] = (perState[uf] ?? 0) + 1) - 1   // 0-based dentro do estado
    const ang = n * 2.39996323                                // golden angle (rad)
    const rad = 0.2 * Math.sqrt(n)                            // graus; cresce devagar p/ caber no estado
    out.push({ uf, type, name: (name ?? '').trim() || 'Sem nome', lon: ce[0] + Math.cos(ang) * rad, lat: ce[1] + Math.sin(ang) * rad })
  }
  for (const c of clients) {
    if ((c.status ?? '') !== 'ativo') continue
    push((c.state ?? '').trim().toUpperCase(), 'cliente', c.name)
  }
  for (const l of leads) {
    const st = (l.status ?? '')
    if (CLOSED.has(st)) continue
    push((l.state ?? '').trim().toUpperCase(), st === 'novo' ? 'novo' : 'lead', l.name)
  }
  return out
}
