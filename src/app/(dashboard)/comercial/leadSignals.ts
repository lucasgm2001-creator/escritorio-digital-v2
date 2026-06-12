import type { Lead } from './types'

// Funil estilo Pipedrive: a cor é ALARME, não enfeite. Cada card carrega no
// máximo UM sinal, com prioridade quente > esfriando > atenção.

export type LeadSignal = 'hot' | 'cold' | 'warm' | 'none'

// Score 0–1000: a faixa "Quente" do sistema começa em >650 (ver score.ts).
const HOT_SCORE = 650
const DAY_MS = 86_400_000

/** Dias parado na etapa: desde a última movimentação/contato (fallback: criação). */
export function daysStopped(lead: Lead): number {
  const ref = lead.last_contact_at || lead.created_at
  if (!ref) return 0
  const diff = Date.now() - new Date(ref).getTime()
  if (Number.isNaN(diff)) return 0
  return Math.max(0, Math.floor(diff / DAY_MS))
}

/** Sinal do card. Etapas terminais (ganho/perda) nunca rotulam rotting/quente. */
export function getLeadSignal(lead: Lead): LeadSignal {
  if (lead.status === 'fechado' || lead.status === 'perdido') return 'none'

  const isHot = lead.score >= HOT_SCORE || lead.prioridade === 'alta' || lead.prioridade === 'urgente'
  if (isHot) return 'hot'

  const days = daysStopped(lead)
  if (days >= 5) return 'cold'   // esfriando — risco de perder
  if (days >= 3) return 'warm'   // atenção — parado
  return 'none'
}

/** Próxima ação derivada de next_contact (rótulo relativo curto). null se não houver. */
export function nextActionLabel(lead: Lead): string | null {
  if (!lead.next_contact) return null
  const d = new Date(lead.next_contact)
  if (Number.isNaN(d.getTime())) return null

  const today = new Date(); today.setHours(0, 0, 0, 0)
  const target = new Date(d); target.setHours(0, 0, 0, 0)
  const diff = Math.round((target.getTime() - today.getTime()) / DAY_MS)

  if (diff < 0)  return 'atrasado'
  if (diff === 0) return 'hoje'
  if (diff === 1) return 'amanhã'
  if (diff < 7)  return target.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')
  return target.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
}
