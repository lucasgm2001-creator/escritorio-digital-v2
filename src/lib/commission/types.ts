// Módulo de Comissão — tipos (Fase 1).
// Moeda base do sistema = USD. BRL é SÓ exibição (USD x cotação).
// Cada comissão (reunião / semana) guarda a cotação CONGELADA da data → histórico imutável.

export type DealStatus = 'em_andamento' | 'interrompido' | 'concluido'

/** Configuração global da cotação USD->BRL (uma linha só no banco). */
export interface FxConfig {
  cotacaoManual: number | null
  cotacaoTravada: boolean
}

/** Salário fixo (USD) de um vendedor a partir de um mês. Aumento vale só pra frente. */
export interface SalaryPeriod {
  sellerId: string
  valorUsd: number
  effectiveFrom: string // 'YYYY-MM-DD' (1º dia do mês de vigência)
}

/** Reunião realizada (US$15). Conta no mês de metOn. */
export interface Meeting {
  id: string
  sellerId: string
  metOn: string         // 'YYYY-MM-DD' -> define o mês
  valorUsd: number      // 15
  cotacaoUsdBrl: number // congelada na data
}

/** Venda (contrato de comissão). US$100 em até `tetoSemanas` semanas de US$25. */
export interface Deal {
  id: string
  sellerId: string
  valorTotalUsd: number     // 100
  tetoSemanas: number       // 4
  valorPorSemanaUsd: number // 25 (= total / teto, congelado)
  status: DealStatus
  dataFechamento: string    // 'YYYY-MM-DD' (informativo; NÃO define o mês das semanas)
}

/** Semana de uma venda RECEBIDA pelo cliente. Conta no mês de paidOn. */
export interface WeeklyPayment {
  id: string
  dealId: string
  numeroSemana: number
  valorUsd: number      // 25
  paidOn: string        // 'YYYY-MM-DD' -> define o mês
  cotacaoUsdBrl: number // congelada no recebimento
}

/** Resultado do resumo mensal de um vendedor. */
export interface MonthlySummary {
  year: number
  month: number
  salaryUsd: number
  meetingsCount: number
  meetingsUsd: number
  weeksCount: number
  weeksUsd: number
  totalUsd: number
  // BRL (exibição): reuniões/semanas pela cotação CONGELADA; salário pela cotação vigente.
  rateUsed: number      // cotação usada p/ converter o salário (não-congelado)
  salaryBrl: number
  meetingsBrl: number
  weeksBrl: number
  totalBrl: number
}

/** Total de uma venda considerando o status. */
export interface DealTotal {
  dealId: string
  status: DealStatus
  semanasPagas: number
  semanasRestantes: number
  recebidoUsd: number
  projetadoRestanteUsd: number
  totalProjetadoUsd: number
  recebidoBrl: number
  congelado: boolean // true se interrompido/concluido (não projeta mais semanas)
}

/** Projeção do próximo dia 1º (o que cai no próximo pagamento). */
export interface NextPayout {
  proximoPagamento: string // 'YYYY-MM-DD' (próximo dia 1º)
  refYear: number
  refMonth: number
  summary: MonthlySummary
}
