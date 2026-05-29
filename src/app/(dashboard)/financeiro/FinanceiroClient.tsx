'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { formatDate } from '@/lib/utils'

interface Payment {
  id: string
  description: string
  amount: number
  type: 'receita' | 'despesa'
  status: 'pendente' | 'pago' | 'cancelado' | 'atrasado'
  due_date: string
  paid_at?: string
  category?: string
  created_at: string
}

interface SeriePoint { label: string; rec: number; dep: number }

interface Props {
  stats: { receitas: number; despesas: number; saldo: number; pendentes: number }
  serie: SeriePoint[]
  payments: Payment[]
}

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
}

const STATUS_COLORS: Record<string, string> = {
  pago:      'bg-green-900/30 text-green-400 border-green-800/50',
  pendente:  'bg-amber-900/30 text-amber-400 border-amber-800/50',
  atrasado:  'bg-red-900/30   text-red-400   border-red-800/50',
  cancelado: 'bg-slate-800/40 text-slate-400 border-slate-700/50',
}

const MODAL_EMPTY = { description: '', amount: '', type: 'receita' as 'receita' | 'despesa', due_date: '', category: '' }

// SVG bar chart — sem dependência externa
function CashFlowChart({ serie }: { serie: SeriePoint[] }) {
  const hasData = serie.some(p => p.rec > 0 || p.dep > 0)
  if (!hasData) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3">
        <svg className="w-10 h-10 text-muted-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
        </svg>
        <p className="text-sm text-muted-foreground">Nenhum dado financeiro registrado ainda</p>
        <p className="text-xs text-muted-foreground/60">Cadastre pagamentos para ver o fluxo de caixa</p>
      </div>
    )
  }

  const maxVal = Math.max(...serie.flatMap(p => [p.rec, p.dep]), 1)
  const chartH = 160
  const barW   = 18
  const gap    = 6
  const groupW = barW * 2 + gap + 20
  const svgW   = groupW * serie.length

  return (
    <div className="overflow-x-auto">
      <svg width={svgW} height={chartH + 32} className="min-w-full">
        {/* Grid lines */}
        {[0, 0.25, 0.5, 0.75, 1].map(pct => {
          const y = chartH - chartH * pct
          return (
            <g key={pct}>
              <line x1={0} y1={y} x2={svgW} y2={y} stroke="#2d3748" strokeWidth={0.5} strokeDasharray="4,4" />
              <text x={svgW - 2} y={y - 3} fontSize={8} fill="#7d8590" textAnchor="end">
                {fmtBRL(maxVal * pct)}
              </text>
            </g>
          )
        })}

        {/* Bars */}
        {serie.map((pt, i) => {
          const x     = i * groupW + 10
          const recH  = (pt.rec / maxVal) * chartH
          const depH  = (pt.dep / maxVal) * chartH
          const recY  = chartH - recH
          const depY  = chartH - depH

          return (
            <g key={i}>
              {/* Receita bar */}
              <rect x={x} y={recY} width={barW} height={recH}
                rx={3} fill="#22c55e" fillOpacity={0.7} />
              {/* Despesa bar */}
              <rect x={x + barW + gap} y={depY} width={barW} height={depH}
                rx={3} fill="#ef4444" fillOpacity={0.7} />
              {/* Label */}
              <text x={x + barW + gap / 2} y={chartH + 16}
                fontSize={9} fill="#7d8590" textAnchor="middle">
                {pt.label}
              </text>
            </g>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="flex items-center gap-5 mt-2 px-2">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-green-500/70" />
          <span className="text-xs text-muted-foreground">Receitas</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm bg-red-500/70" />
          <span className="text-xs text-muted-foreground">Despesas</span>
        </div>
      </div>
    </div>
  )
}

export function FinanceiroClient({ stats, serie, payments }: Props) {
  const [showModal, setShowModal] = useState(false)
  const [form, setForm] = useState(MODAL_EMPTY)
  const [saving, setSaving] = useState(false)
  const [list, setList] = useState<Payment[]>(payments)
  const [filter, setFilter] = useState<'todos' | 'receita' | 'despesa'>('todos')

  const supabase = createClient()

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data, error } = await supabase.from('payments').insert({
      description: form.description,
      amount: parseFloat(form.amount) || 0,
      type: form.type,
      status: 'pendente',
      due_date: form.due_date,
      category: form.category || null,
    }).select().single()
    if (!error && data) {
      setList(prev => [data as Payment, ...prev])
      setShowModal(false)
      setForm(MODAL_EMPTY)
    }
    setSaving(false)
  }

  const handleMarkPaid = async (id: string) => {
    await supabase.from('payments').update({ status: 'pago', paid_at: new Date().toISOString() }).eq('id', id)
    setList(prev => prev.map(p => p.id === id ? { ...p, status: 'pago' as const } : p))
  }

  const filtered = filter === 'todos' ? list : list.filter(p => p.type === filter)

  const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Financeiro</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Fluxo de caixa e receitas</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-glow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Lançamento
        </button>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Receitas (pagas)',  value: fmtBRL(stats.receitas),  color: 'text-green-400',   accent: 'before:bg-green-500' },
          { label: 'Despesas (pagas)', value: fmtBRL(stats.despesas),  color: 'text-red-400',     accent: 'before:bg-red-500' },
          { label: 'Saldo',            value: fmtBRL(stats.saldo),     color: stats.saldo >= 0 ? 'text-primary-400' : 'text-red-400', accent: 'before:bg-primary-500' },
          { label: 'A receber',        value: fmtBRL(stats.pendentes), color: 'text-amber-400',   accent: 'before:bg-amber-500' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.accent}`}>
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Cash flow chart */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Fluxo de Caixa — últimos 6 meses</CardTitle>
        </CardHeader>
        <CardContent>
          <CashFlowChart serie={serie} />
        </CardContent>
      </Card>

      {/* Payments list */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Lançamentos</CardTitle>
            <div className="flex gap-0.5 bg-[#161b22] rounded-lg p-0.5 border border-[#2d3748]">
              {(['todos', 'receita', 'despesa'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  className={`px-3 py-1 rounded-md text-xs font-medium capitalize transition-all ${
                    filter === f ? 'bg-[#1e2533] text-foreground border border-[#3d4f6a]' : 'text-muted-foreground hover:text-foreground'
                  }`}>
                  {f === 'todos' ? 'Todos' : f === 'receita' ? 'Receitas' : 'Despesas'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {filtered.length === 0 ? (
            <div className="py-14 text-center text-muted-foreground text-sm">
              <svg className="w-8 h-8 mx-auto mb-3 text-muted-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 14l6-6m-5.5.5h.01m4.99 5h.01M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16l3.5-2 3.5 2 3.5-2 3.5 2z" />
              </svg>
              Nenhum lançamento encontrado
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d3748] bg-[#0d1117]/50">
                    {['Descrição', 'Tipo', 'Valor', 'Vencimento', 'Status', ''].map(h => (
                      <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3748]/60">
                  {filtered.map(p => (
                    <tr key={p.id} className="hover:bg-[#1a2133]/60 transition-colors">
                      <td className="px-4 py-3 font-medium text-foreground">{p.description}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                          p.type === 'receita'
                            ? 'bg-green-900/20 text-green-400 border-green-800/40'
                            : 'bg-red-900/20 text-red-400 border-red-800/40'
                        }`}>
                          {p.type === 'receita' ? 'Receita' : 'Despesa'}
                        </span>
                      </td>
                      <td className={`px-4 py-3 font-semibold tabular-nums ${p.type === 'receita' ? 'text-green-400' : 'text-red-400'}`}>
                        {p.type === 'despesa' ? '−' : '+'}{fmtBRL(p.amount)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.due_date ? formatDate(p.due_date) : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border font-medium capitalize ${STATUS_COLORS[p.status] ?? ''}`}>
                          {p.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {p.status === 'pendente' && (
                          <button onClick={() => handleMarkPaid(p.id)}
                            className="text-xs text-green-400 hover:text-green-300 transition-colors whitespace-nowrap">
                            Marcar pago
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground">Novo Lançamento</h2>
              <button onClick={() => setShowModal(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
                <div className="flex gap-2">
                  {(['receita', 'despesa'] as const).map(t => (
                    <button key={t} type="button" onClick={() => setForm(p => ({ ...p, type: t }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-all ${
                        form.type === t
                          ? t === 'receita'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-red-600 text-white border-red-600'
                          : 'border-[#2d3748] text-muted-foreground hover:border-[#3d4f6a]'
                      }`}>
                      {t === 'receita' ? 'Receita' : 'Despesa'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Descrição *</label>
                <input required value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
                  className={inputCls} placeholder="Ex: MRR Cliente ABC" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Valor (R$) *</label>
                  <input required type="number" min="0" step="0.01" value={form.amount}
                    onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
                    className={inputCls} placeholder="0,00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Vencimento *</label>
                  <input required type="date" value={form.due_date}
                    onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                    className={inputCls} />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Categoria</label>
                <input value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                  className={inputCls} placeholder="Ex: salário, ferramenta, MRR..." />
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setShowModal(false)}
                  className="flex-1 border border-[#2d3748] text-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={saving}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50">
                  {saving ? 'Salvando...' : 'Criar Lançamento'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
