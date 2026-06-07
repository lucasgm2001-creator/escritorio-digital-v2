'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

interface Seller {
  id: string
  name: string
  fixed_salary: number
  start_date?: string
  observations?: string
}

export function FixoTab() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState({ fixed_salary: '', start_date: '', observations: '' })
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('sellers')
          .select('id, name, fixed_salary, start_date, observations')
          .order('name')

        if (error) {
          console.warn('[FixoTab] query error:', error.message)
          setSellers([])
        } else {
          setSellers((data ?? []) as Seller[])
        }
      } catch (err) {
        console.error('[FixoTab] unexpected error:', err)
        setSellers([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const handleEdit = (seller: Seller) => {
    setEditingId(seller.id)
    setForm({
      fixed_salary: seller.fixed_salary?.toString() || '',
      start_date: seller.start_date?.split('T')[0] || '',
      observations: seller.observations || '',
    })
  }

  const handleSave = async () => {
    if (!editingId) return

    const salaryNum = form.fixed_salary ? parseFloat(form.fixed_salary) : 0
    if (isNaN(salaryNum) || salaryNum < 0) {
      alert('Salário fixo deve ser um número válido e não negativo')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      await supabase.from('sellers').update({
        fixed_salary: salaryNum,
        start_date: form.start_date || null,
        observations: form.observations || null,
      }).eq('id', editingId)

      setSellers(prev =>
        prev.map(s =>
          s.id === editingId
            ? {
                ...s,
                fixed_salary: salaryNum,
                start_date: form.start_date,
                observations: form.observations,
              }
            : s
        )
      )

      setEditingId(null)
      setForm({ fixed_salary: '', start_date: '', observations: '' })
    } catch (err) {
      console.error('[FixoTab] save error:', err)
      alert('Erro ao salvar. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-background animate-fade-in">
      {/* Header */}
      <div>
        <h3 className="font-semibold text-foreground">Salários Fixos</h3>
        <p className="text-xs text-muted-foreground mt-0.5">Gerencie salários fixos mensais dos vendedores</p>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] rounded-xl border border-[#2d3748] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground text-sm">
            <span className="w-5 h-5 border-2 border-muted-foreground/20 border-t-primary-500 rounded-full animate-spin" />
            Carregando...
          </div>
        ) : sellers.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-muted-foreground font-medium">Nenhum vendedor cadastrado</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[640px]">
            <thead>
              <tr className="bg-[#0d1117]/50 border-b border-[#2d3748]">
                {['Vendedor', 'Salário Fixo', 'Data de Início', 'Observações', 'Ações'].map(h => (
                  <th key={h} className={`text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide ${
                    h === 'Salário Fixo' ? 'text-right' : 'text-left'
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/60">
              {sellers.map(s => (
                <tr key={s.id} className="hover:bg-[#1a2133]/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-900/40 border border-primary-800/40 flex items-center justify-center flex-none">
                        <span className="text-xs font-bold text-primary-400">{s.name[0]}</span>
                      </div>
                      <span className="font-semibold text-foreground">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">
                    {s.fixed_salary ? fmt(s.fixed_salary) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {s.start_date ? formatDate(s.start_date) : '—'}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {s.observations ? s.observations.substring(0, 30) + (s.observations.length > 30 ? '...' : '') : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleEdit(s)}
                      className="text-xs text-primary-400 hover:text-primary-300 underline underline-offset-2 transition-colors"
                    >
                      Editar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Edit Modal */}
      {editingId && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-t-2xl sm:rounded-2xl shadow-card-hover w-full sm:max-w-sm max-h-[92vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground text-base">Editar Salário Fixo</h2>
              <button
                onClick={() => {
                  setEditingId(null)
                  setForm({ fixed_salary: '', start_date: '', observations: '' })
                }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Vendedor</label>
                <div className="px-3 py-2 bg-[#1e2533] border border-[#2d3748] rounded-lg text-sm text-muted-foreground">
                  {sellers.find(s => s.id === editingId)?.name || '—'}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Salário Fixo Mensal (R$) *</label>
                <input
                  type="number"
                  value={form.fixed_salary}
                  onChange={e => setForm(p => ({ ...p, fixed_salary: e.target.value }))}
                  className={inputCls}
                  placeholder="0,00"
                  min="0"
                  step="100"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data de Início</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={e => setForm(p => ({ ...p, start_date: e.target.value }))}
                  className={inputCls}
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Observações</label>
                <textarea
                  value={form.observations}
                  onChange={e => setForm(p => ({ ...p, observations: e.target.value }))}
                  className={inputCls}
                  placeholder="Ex: Revisão em junho, vale refeição incluso..."
                  rows={3}
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => {
                    setEditingId(null)
                    setForm({ fixed_salary: '', start_date: '', observations: '' })
                  }}
                  disabled={saving}
                  className="flex-1 border border-[#2d3748] text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving || !form.fixed_salary}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50 shadow-glow-sm"
                >
                  {saving ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
