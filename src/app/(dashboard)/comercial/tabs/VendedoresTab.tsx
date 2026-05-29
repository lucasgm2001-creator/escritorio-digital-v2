'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Seller } from '@/types'

interface Props { currentUser: { id: string; name: string; role: string } }

export function VendedoresTab({ currentUser }: Props) {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', cargo: '' })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()
  const isAdmin = ['admin', 'administrador'].includes((currentUser.role ?? '').toLowerCase())

  useEffect(() => {
    supabase.from('sellers').select('*').order('name').then(({ data }) => {
      setSellers(data ?? [])
      setLoading(false)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleAdd = async () => {
    if (!form.name.trim()) return
    setSaving(true)
    const { data } = await supabase.from('sellers').insert({
      name: form.name.trim(),
      email: form.email.trim() || null,
      cargo: form.cargo.trim() || null,
      status: 'ativo',
      total_sales: 0,
      total_commissions: 0,
      leads_assigned: 0,
      conversion_rate: 0,
    }).select().single()

    if (data) setSellers(prev => [...prev, data as Seller])
    setForm({ name: '', email: '', cargo: '' })
    setAddOpen(false)
    setSaving(false)
  }

  const handleToggle = async (id: string, current: 'ativo' | 'inativo') => {
    const next = current === 'ativo' ? 'inativo' : 'ativo'
    await supabase.from('sellers').update({ status: next }).eq('id', id)
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status: next } : s))
  }

  const active   = sellers.filter(s => s.status === 'ativo').length
  const inactive = sellers.filter(s => s.status === 'inativo').length

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Vendedores</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{active} ativos · {inactive} inativos</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors shadow-glow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Vendedor
          </button>
        )}
      </div>

      {/* Modal overlay */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-2xl shadow-card-hover w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground text-base">Adicionar Vendedor</h2>
              <button
                onClick={() => { setAddOpen(false); setForm({ name: '', email: '', cargo: '' }) }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: 'name',  label: 'Nome *',       type: 'text',  placeholder: 'Nome completo' },
                { key: 'email', label: 'E-mail',       type: 'email', placeholder: 'email@exemplo.com' },
                { key: 'cargo', label: 'Cargo / Perfil', type: 'text', placeholder: 'Ex: SDR, Closer, Account...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    onKeyDown={e => e.key === 'Enter' && f.key === 'cargo' && handleAdd()}
                    className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600"
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setAddOpen(false); setForm({ name: '', email: '', cargo: '' }) }}
                  className="flex-1 border border-[#2d3748] text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50 shadow-glow-sm"
                >
                  {saving ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161b22] rounded-xl border border-[#2d3748] overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : sellers.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Nenhum vendedor cadastrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0d1117]/50 border-b border-[#2d3748]">
                {['Vendedor','E-mail','Cargo','Leads','Conv.','Vendas','Status','Ações'].map(h => (
                  <th key={h} className={`text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide ${h === 'Leads' || h === 'Conv.' || h === 'Vendas' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/60">
              {sellers.map(s => (
                <tr key={s.id} className={`hover:bg-[#1a2133]/60 transition-colors ${s.status === 'inativo' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-900/40 border border-primary-800/40 flex items-center justify-center flex-none">
                        <span className="text-xs font-bold text-primary-400">{s.name[0]}</span>
                      </div>
                      <span className="font-semibold text-foreground">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{(s as unknown as Record<string, string>).cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">{s.leads_assigned}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {(s.conversion_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                    {s.total_sales > 0 ? `R$ ${s.total_sales.toLocaleString('pt-BR')}` : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${
                      s.status === 'ativo'
                        ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'
                        : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                    }`}>
                      {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(s.id, s.status)}
                      className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                    >
                      {s.status === 'ativo' ? 'Desativar' : 'Ativar'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
