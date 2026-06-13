// Teste/validação dos cálculos de comissão (Fase 1) — SEM TELA.
// Roda os casos obrigatórios e imprime os números no terminal.
// Como rodar:  npx tsx scripts/commission-test.ts
//        (ou)  npx ts-node --compiler-options '{"module":"CommonJS"}' scripts/commission-test.ts

import {
  monthlySummary, dealTotal, nextPayoutProjection, resolveRate, salaryForMonth,
} from '../src/lib/commission/calc'
import type { Deal, WeeklyPayment, Meeting, SalaryPeriod, FxConfig } from '../src/lib/commission/types'

let failures = 0
const USD = (n: number) => `US$${n.toFixed(2)}`
const BRL = (n: number) => `R$${n.toFixed(2)}`
function section(t: string) { console.log(`\n=== ${t} ===`) }
function check(label: string, got: number, expected: number) {
  const ok = Math.abs(got - expected) < 0.005
  if (!ok) failures++
  console.log(`  ${ok ? '✅' : '❌'} ${label}: ${got}  (esperado ${expected})`)
}

const fxAuto: FxConfig = { cotacaoManual: null, cotacaoTravada: false }

// ──────────────────────────────────────────────────────────────────────────
section('Teste 1 — Venda fechada 20/mai: 1 semana em maio, 3 em junho')
const deal1: Deal = {
  id: 'd1', sellerId: 's1', valorTotalUsd: 100, tetoSemanas: 4,
  valorPorSemanaUsd: 25, status: 'em_andamento', dataFechamento: '2026-05-20',
}
const weeks1: WeeklyPayment[] = [
  { id: 'w1', dealId: 'd1', numeroSemana: 1, valorUsd: 25, paidOn: '2026-05-25', cotacaoUsdBrl: 5.00 },
  { id: 'w2', dealId: 'd1', numeroSemana: 2, valorUsd: 25, paidOn: '2026-06-05', cotacaoUsdBrl: 5.00 },
  { id: 'w3', dealId: 'd1', numeroSemana: 3, valorUsd: 25, paidOn: '2026-06-12', cotacaoUsdBrl: 5.00 },
  { id: 'w4', dealId: 'd1', numeroSemana: 4, valorUsd: 25, paidOn: '2026-06-19', cotacaoUsdBrl: 5.00 },
]
const base1 = { salaries: [] as SalaryPeriod[], meetings: [] as Meeting[], weeks: weeks1, fx: fxAuto, automaticRate: 5.00 }
const mai = monthlySummary({ ...base1, year: 2026, month: 5 })
const jun = monthlySummary({ ...base1, year: 2026, month: 6 })
console.log(`  maio  → ${mai.weeksCount} semana(s) = ${USD(mai.weeksUsd)}`)
console.log(`  junho → ${jun.weeksCount} semana(s) = ${USD(jun.weeksUsd)}`)
check('maio  (semanas USD)', mai.weeksUsd, 25)
check('junho (semanas USD)', jun.weeksUsd, 75)

// ──────────────────────────────────────────────────────────────────────────
section('Teste 2 — Salário US$500 + 2 reuniões (US$30) + 1 semana (US$25) = US$555')
const sal2: SalaryPeriod[] = [{ sellerId: 's2', valorUsd: 500, effectiveFrom: '2026-01-01' }]
const meet2: Meeting[] = [
  { id: 'm1', sellerId: 's2', metOn: '2026-06-03', valorUsd: 15, cotacaoUsdBrl: 5.00 },
  { id: 'm2', sellerId: 's2', metOn: '2026-06-18', valorUsd: 15, cotacaoUsdBrl: 5.00 },
]
const weeks2: WeeklyPayment[] = [
  { id: 'w21', dealId: 'd2', numeroSemana: 1, valorUsd: 25, paidOn: '2026-06-10', cotacaoUsdBrl: 5.00 },
]
// Cotação automática do salário = 5.40 (não-congelada); reuniões/semana congeladas em 5.00.
const s2 = monthlySummary({ year: 2026, month: 6, salaries: sal2, meetings: meet2, weeks: weeks2, fx: fxAuto, automaticRate: 5.40 })
console.log(`  USD: salário ${USD(s2.salaryUsd)} + reuniões ${USD(s2.meetingsUsd)} + semanas ${USD(s2.weeksUsd)} = ${USD(s2.totalUsd)}`)
console.log(`  BRL: salário ${BRL(s2.salaryBrl)} (cot ${s2.rateUsed}) + reuniões ${BRL(s2.meetingsBrl)} (congelada 5.00) + semanas ${BRL(s2.weeksBrl)} (congelada 5.00) = ${BRL(s2.totalBrl)}`)
check('total USD', s2.totalUsd, 555)
check('total BRL (500*5.40 + 30*5 + 25*5)', s2.totalBrl, 2975)

// ──────────────────────────────────────────────────────────────────────────
section('Teste 3 — Venda interrompida na 2ª semana → congela em US$50 (não projeta 3 e 4)')
const deal3: Deal = {
  id: 'd3', sellerId: 's3', valorTotalUsd: 100, tetoSemanas: 4,
  valorPorSemanaUsd: 25, status: 'interrompido', dataFechamento: '2026-05-01',
}
const weeks3: WeeklyPayment[] = [
  { id: 'w31', dealId: 'd3', numeroSemana: 1, valorUsd: 25, paidOn: '2026-05-10', cotacaoUsdBrl: 5.00 },
  { id: 'w32', dealId: 'd3', numeroSemana: 2, valorUsd: 25, paidOn: '2026-05-17', cotacaoUsdBrl: 5.00 },
]
const t3 = dealTotal(deal3, weeks3)
console.log(`  recebido ${USD(t3.recebidoUsd)} | semanas restantes ${t3.semanasRestantes} | projetado restante ${USD(t3.projetadoRestanteUsd)} | TOTAL ${USD(t3.totalProjetadoUsd)}`)
check('recebido USD', t3.recebidoUsd, 50)
check('total (congelado) USD', t3.totalProjetadoUsd, 50)
check('semanas restantes (sem projeção)', t3.semanasRestantes, 0)
// Comparação: a MESMA venda em_andamento projetaria as 2 que faltam (total 100).
const t3b = dealTotal({ ...deal3, id: 'd3b', status: 'em_andamento' }, weeks3.map(w => ({ ...w, dealId: 'd3b' })))
console.log(`  (comparação em_andamento) recebido ${USD(t3b.recebidoUsd)} + projeta ${t3b.semanasRestantes} semana(s) = ${USD(t3b.totalProjetadoUsd)}`)
check('em_andamento projeta restantes → total', t3b.totalProjetadoUsd, 100)

// ──────────────────────────────────────────────────────────────────────────
section('Teste 4 — Conversão USD→BRL: automática vs travada (mesmo valor US$555)')
const valor = 555
const fxAutomatica: FxConfig = { cotacaoManual: 5.00, cotacaoTravada: false }
const fxTravada: FxConfig = { cotacaoManual: 5.00, cotacaoTravada: true }
const rAuto = resolveRate(fxAutomatica, 5.40)
const rTrav = resolveRate(fxTravada, 5.40)
console.log(`  automática (ignora manual, usa 5.40): ${USD(valor)} = ${BRL(valor * rAuto)}`)
console.log(`  travada    (usa manual 5.00):         ${USD(valor)} = ${BRL(valor * rTrav)}`)
check('rate automática', rAuto, 5.40)
check('rate travada', rTrav, 5.00)
check('BRL automática (555*5.40)', valor * rAuto, 2997)
check('BRL travada (555*5.00)', valor * rTrav, 2775)

// ──────────────────────────────────────────────────────────────────────────
section('Teste 5 — Aumento de salário: US$500 até julho, US$700 de agosto')
const sal5: SalaryPeriod[] = [
  { sellerId: 's5', valorUsd: 500, effectiveFrom: '2026-01-01' },
  { sellerId: 's5', valorUsd: 700, effectiveFrom: '2026-08-01' },
]
const jun5 = salaryForMonth(sal5, 2026, 6)
const jul5 = salaryForMonth(sal5, 2026, 7)
const ago5 = salaryForMonth(sal5, 2026, 8)
console.log(`  junho ${USD(jun5)} | julho ${USD(jul5)} | agosto ${USD(ago5)}`)
check('junho  usa 500', jun5, 500)
check('julho  usa 500', jul5, 500)
check('agosto usa 700', ago5, 700)

// ──────────────────────────────────────────────────────────────────────────
section('Bônus — Projeção do próximo dia 1º (hoje = 2026-06-15)')
const proj = nextPayoutProjection('2026-06-15', { salaries: sal2, meetings: meet2, weeks: weeks2, fx: fxAuto, automaticRate: 5.40 })
console.log(`  próximo pagamento: ${proj.proximoPagamento} (fecha o mês ${proj.refMonth}/${proj.refYear})`)
console.log(`  vai cair: ${USD(proj.summary.totalUsd)}  /  ${BRL(proj.summary.totalBrl)}`)
check('próximo pagamento paga junho (total USD)', proj.summary.totalUsd, 555)

// ──────────────────────────────────────────────────────────────────────────
console.log(`\n${failures === 0 ? '✅ TODOS OS CASOS BATERAM COM O ESPERADO' : `❌ ${failures} verificação(ões) FALHARAM`}`)
process.exit(failures === 0 ? 0 : 1)
