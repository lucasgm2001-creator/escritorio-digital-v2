'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Commission {
  id: string
  seller_id: string
  seller_name?: string
  lead_id?: string
  lead_name?: string
  amount: number
  percentage: number
  status: 'pendente' | 'aprovada' | 'paga'
  due_date?: string
  paid_at?: string
  created_at: string
}

interface Props {
  currentUser: { id: string; name: string; role: string }
}

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', bg: 'bg-amber-50',  text: 'text-amber-600',  border: 'border-amber-200' },
  aprovada: { label: 'Aprovada', bg: 'bg-blue-50',   text: 'text-blue-600',   border: 'border-blue-200'  },
  paga:     { label: 'Paga',     bg: 'bg-emerald-50', text: 'text-emerald-600', border: 'border-emerald-200' },
} as const

export function ComissoesTab({ currentUser }: Props) {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'todos' | Commission['status']>('todos')

  const supabase = createClient()
  const canManageAll = currentUser.role === 'admin' || currentUser.role === 'financeiro'

  useEffect(() => {
    const load = async () => {
      let q = supabase.from('commissions').select('*').order('created_at', { ascending: false })
      if (!canManageAll) q = q.eq('seller_id', currentUser.id)
      const { data } = await q
      setCommissions(data ?? [])
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleStatusChange = async (id: string, status: Commission['status']) => {
    if (!canManageAll) return
    await supabase.from('commissions').update({
      status,
      paid_at: status === 'paga' ? new Date().toISOString() : null,
    }).eq('id', id)
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const filtered = statusFilter === 'todos'
    ? commissions
    : commissions.filter(c => c.status === statusFilter)

  const total    = commissions.reduce((s, c) => s + c.amount, 0)
  const pendente = commissions.filter(c => c.status === 'pendente').reduce((s, c) => s + c.amount, 0)
  const pago     = commissions.filter(c => c.status === 'paga').reduce((s, c) => s + c.amount, 0)

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <p className="text-xs text-slate-500 font-medium">Total de Comissões</p>
          <p className="text-2xl font-bold text-slate-900 mt-1 tabular-nums">{fmt(total)}</p>
          <p className="text-xs text-slate-400 mt-0.5">{commissions.length} registros</p>
        </div>
        <div className="bg-amber-50 rounded-xl border border-amber-200 p-5">
          <p className="text-xs text-amber-600 font-medium">A Pagar</p>
          <p className="text-2xl font-bold text-amber-700 mt-1 tabular-nums">{fmt(pendente)}</p>
          <p className="text-xs text-amber-500 mt-0.5">
            {commissions.filter(c => c.status === 'pendente').length} pendentes
          </p>
        </div>
        <div className="bg-emerald-50 rounded-xl border border-emerald-200 p-5">
          <p className="text-xs text-emerald-600 font-medium">Pago</p>
          <p className="text-2xl font-bold text-emerald-700 mt-1 tabular-nums">{fmt(pago)}</p>
          <p className="text-xs text-emerald-500 mt-0.5">
            {commissions.filter(c => c.status === 'paga').length} pagos
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-slate-200">
          <h3 className="font-semibold text-slate-800 text-sm">
            {canManageAll ? 'Todas as Comissões' : 'Minhas Comissões'}
          </h3>
          <div className="flex gap-1 bg-slate-100 rounded-lg p-1">
            {(['todos', 'pendente', 'aprovada', 'paga'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                  statusFilter === s
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'text-slate-500 hover:text-slate-700'
                }`}
              >
                {s === 'todos' ? 'Todos' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">
            {commissions.length === 0 ? 'Nenhuma comissão registrada' : 'Nenhuma comissão com este filtro'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  {canManageAll && (
                    <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Vendedor</th>
                  )}
                  <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Lead</th>
                  <th className="text-right text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">%</th>
                  <th className="text-right text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Valor</th>
                  <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Vencimento</th>
                  <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Status</th>
                  {canManageAll && (
                    <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Alterar</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map(c => {
                  const s = STATUS_CONFIG[c.status]
                  return (
                    <tr key={c.id} className="hover:bg-slate-50 transition-colors">
                      {canManageAll && (
                        <td className="px-4 py-3 text-slate-700 font-medium">{c.seller_name ?? '—'}</td>
                      )}
                      <td className="px-4 py-3 text-slate-600">{c.lead_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-slate-500 tabular-nums">{c.percentage}%</td>
                      <td className="px-4 py-3 text-right font-bold text-slate-800 tabular-nums">{fmt(c.amount)}</td>
                      <td className="px-4 py-3 text-slate-500 text-xs">
                        {c.due_date ? new Date(c.due_date).toLocaleDateString('pt-BR') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${s.bg} ${s.text} ${s.border}`}>
                          {s.label}
                        </span>
                      </td>
                      {canManageAll && (
                        <td className="px-4 py-3">
                          <select
                            value={c.status}
                            onChange={e => handleStatusChange(c.id, e.target.value as Commission['status'])}
                            className="text-xs border border-slate-200 rounded-lg px-2.5 py-1 focus:outline-none focus:border-primary-400 bg-white"
                          >
                            <option value="pendente">Pendente</option>
                            <option value="aprovada">Aprovada</option>
                            <option value="paga">Paga</option>
                          </select>
                        </td>
                      )}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
