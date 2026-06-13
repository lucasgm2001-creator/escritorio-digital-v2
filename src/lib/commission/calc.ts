// Módulo de Comissão — funções de cálculo PURAS (Fase 1).
// Sem banco, sem React: recebem os dados já carregados e devolvem os números.
// Regras: USD é a moeda real; BRL é exibição. Cada evento conta no mês da sua
// data real (semana=paidOn, reunião=metOn). Histórico imutável via cotação congelada.

import type {
  FxConfig, SalaryPeriod, Meeting, Deal, WeeklyPayment,
  MonthlySummary, DealTotal, NextPayout,
} from './types'

const pad2 = (n: number) => String(n).padStart(2, '0')
const monthKey = (year: number, month: number) => `${year}-${pad2(month)}`
const inMonth = (dateStr: string, year: number, month: number) => dateStr.slice(0, 7) === monthKey(year, month)
const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100

/**
 * Cotação a aplicar em conversões NÃO-congeladas (salário, novos registros):
 * se travada e há valor manual, usa a manual; senão, usa a automática informada.
 */
export function resolveRate(fx: FxConfig, automaticRate: number): number {
  return fx.cotacaoTravada && fx.cotacaoManual != null ? fx.cotacaoManual : automaticRate
}

/**
 * Salário vigente para um mês: o período com a maior `effectiveFrom` <= 1º dia do mês.
 * (Comparação de datas ISO 'YYYY-MM-DD' é segura lexicograficamente.)
 */
export function salaryForMonth(salaries: SalaryPeriod[], year: number, month: number): number {
  const firstDay = `${monthKey(year, month)}-01`
  const applicable = salaries
    .filter(s => s.effectiveFrom <= firstDay)
    .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]
  return applicable ? applicable.valorUsd : 0
}

export interface MonthlyInput {
  year: number
  month: number
  salaries: SalaryPeriod[] // do vendedor
  meetings: Meeting[]      // do vendedor (qualquer mês — a função filtra)
  weeks: WeeklyPayment[]   // do vendedor (qualquer mês — já juntadas via deal)
  fx: FxConfig
  automaticRate: number    // cotação automática vigente (p/ converter o salário)
}

/** Resumo mensal isolado: salário do mês + reuniões (metOn) + semanas recebidas (paidOn). */
export function monthlySummary(input: MonthlyInput): MonthlySummary {
  const { year, month, salaries, meetings, weeks, fx, automaticRate } = input

  const salaryUsd = salaryForMonth(salaries, year, month)
  const rateUsed = resolveRate(fx, automaticRate)
  const salaryBrl = round2(salaryUsd * rateUsed)

  const mtgs = meetings.filter(m => inMonth(m.metOn, year, month))
  const meetingsUsd = round2(mtgs.reduce((s, m) => s + m.valorUsd, 0))
  const meetingsBrl = round2(mtgs.reduce((s, m) => s + m.valorUsd * m.cotacaoUsdBrl, 0))

  const wks = weeks.filter(w => inMonth(w.paidOn, year, month))
  const weeksUsd = round2(wks.reduce((s, w) => s + w.valorUsd, 0))
  const weeksBrl = round2(wks.reduce((s, w) => s + w.valorUsd * w.cotacaoUsdBrl, 0))

  return {
    year, month,
    salaryUsd,
    meetingsCount: mtgs.length, meetingsUsd,
    weeksCount: wks.length, weeksUsd,
    totalUsd: round2(salaryUsd + meetingsUsd + weeksUsd),
    rateUsed,
    salaryBrl, meetingsBrl, weeksBrl,
    totalBrl: round2(salaryBrl + meetingsBrl + weeksBrl),
  }
}

/**
 * Total de uma venda considerando o status:
 *  - em_andamento: soma o recebido + projeta as semanas que faltam até o teto.
 *  - interrompido/concluido: congela só no que foi pago (sem projeção).
 */
export function dealTotal(deal: Deal, weeks: WeeklyPayment[]): DealTotal {
  const pagas = weeks.filter(w => w.dealId === deal.id)
  const semanasPagas = pagas.length
  const recebidoUsd = round2(pagas.reduce((s, w) => s + w.valorUsd, 0))
  const recebidoBrl = round2(pagas.reduce((s, w) => s + w.valorUsd * w.cotacaoUsdBrl, 0))

  const congelado = deal.status !== 'em_andamento'
  const semanasRestantes = congelado ? 0 : Math.max(0, deal.tetoSemanas - semanasPagas)
  const projetadoRestanteUsd = round2(semanasRestantes * deal.valorPorSemanaUsd)
  const totalProjetadoUsd = round2(recebidoUsd + projetadoRestanteUsd)

  return {
    dealId: deal.id, status: deal.status,
    semanasPagas, semanasRestantes,
    recebidoUsd, projetadoRestanteUsd, totalProjetadoUsd,
    recebidoBrl, congelado,
  }
}

/**
 * Projeção do próximo dia 1º: paga o acumulado do mês de `refDate`
 * (salário do mês + reuniões + semanas recebidas até agora). O pagamento
 * cai no 1º dia do mês seguinte ao de refDate.
 */
export function nextPayoutProjection(
  refDate: string,
  input: Omit<MonthlyInput, 'year' | 'month'>,
): NextPayout {
  const [y, m] = refDate.split('-').map(Number)
  const nextMonth = m === 12 ? 1 : m + 1
  const nextYear = m === 12 ? y + 1 : y
  const proximoPagamento = `${monthKey(nextYear, nextMonth)}-01`
  const summary = monthlySummary({ ...input, year: y, month: m })
  return { proximoPagamento, refYear: y, refMonth: m, summary }
}
