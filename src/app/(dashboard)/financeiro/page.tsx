import { createClient } from '@/lib/supabase/server'
import { FinanceiroClient } from './FinanceiroClient'

export default async function FinanceiroPage() {
  const supabase = createClient()

  // Busca todos os pagamentos
  const { data: payments } = await supabase
    .from('payments')
    .select('*')
    .order('due_date', { ascending: false })

  const all = payments ?? []

  const receitas   = all.filter(p => p.type === 'receita' && p.status === 'pago')
  const despesas   = all.filter(p => p.type === 'despesa' && p.status === 'pago')
  const pendentes  = all.filter(p => p.status === 'pendente' && p.type === 'receita')

  const totalReceitas  = receitas.reduce((s, p) => s + p.amount, 0)
  const totalDespesas  = despesas.reduce((s, p) => s + p.amount, 0)
  const totalPendentes = pendentes.reduce((s, p) => s + p.amount, 0)
  const saldo          = totalReceitas - totalDespesas

  // Monta série histórica dos últimos 6 meses
  const now   = new Date()
  const serie = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    const label = d.toLocaleDateString('pt-BR', { month: 'short', year: '2-digit' })
    const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`

    const rec = all
      .filter(p => p.type === 'receita' && p.status === 'pago' && p.due_date?.startsWith(key))
      .reduce((s, p) => s + p.amount, 0)

    const dep = all
      .filter(p => p.type === 'despesa' && p.status === 'pago' && p.due_date?.startsWith(key))
      .reduce((s, p) => s + p.amount, 0)

    return { label, rec, dep }
  })

  return (
    <FinanceiroClient
      stats={{ receitas: totalReceitas, despesas: totalDespesas, saldo, pendentes: totalPendentes }}
      serie={serie}
      payments={all}
    />
  )
}
