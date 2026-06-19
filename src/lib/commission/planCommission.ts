// Comissão por plano (Fase 2A) — fórmula PURA, sem banco e sem React.
// Reusada pela UI (preview da tela de Planos) E pelo won-flow (criação do deal novo).
// NÃO afeta payWeek/calc.ts: estes continuam lendo deal.valor_por_semana_usd (snapshot).
// pct null/inválido = LEGADO → comissão de US$25/semana fixo (vendas antigas intactas).

export const LEGACY_VPS_USD = 25
export const DEFAULT_TETO_SEMANAS = 4

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Valor da comissão por semana a partir do valor semanal do plano e do %.
 * pct null/<=0/NaN → legado (US$25). Caso contrário, round2(valorSemanal * pct / 100).
 */
export function weeklyCommissionUsd(valorSemanal: number, pct: number | null | undefined): number {
  if (pct == null || !Number.isFinite(pct) || pct <= 0) return LEGACY_VPS_USD
  return round2((Number(valorSemanal) || 0) * pct / 100)
}

/** True se o % é válido (gera comissão por plano); false = cai no legado US$25. */
export function hasCommissionPct(pct: number | null | undefined): pct is number {
  return pct != null && Number.isFinite(pct) && pct > 0
}
