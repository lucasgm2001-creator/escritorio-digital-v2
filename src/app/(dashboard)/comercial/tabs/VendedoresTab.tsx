'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Seller } from '@/types'

export function VendedoresTab() {
  const [sellers, setSellers] = useState<Seller[]>([])
  const [loading, setLoading] = useState(true)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', phone: '' })
  const [saving, setSaving] = useState(false)

  const supabase = createClient()

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
      phone: form.phone.trim() || null,
      status: 'ativo',
      total_sales: 0,
      total_commissions: 0,
      leads_assigned: 0,
      conversion_rate: 0,
    }).select().single()

    if (data) setSellers(prev => [...prev, data as Seller])
    setForm({ name: '', email: '', phone: '' })
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
          <h3 className="font-semibold text-slate-800">Vendedores</h3>
          <p className="text-xs text-slate-400 mt-0.5">{active} ativos · {inactive} inativos</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-2 bg-primary-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-800 transition-colors shadow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Vendedor
        </button>
      </div>

      {/* Add form */}
      {addOpen && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-slate-700 mb-4">Adicionar Vendedor</h4>
          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'name',  label: 'Nome *',  type: 'text',  placeholder: 'Nome completo' },
              { key: 'email', label: 'Email',   type: 'email', placeholder: 'email@exemplo.com' },
              { key: 'phone', label: 'Telefone',type: 'tel',   placeholder: '(11) 99999-9999' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-slate-600 mb-1.5">{f.label}</label>
                <input
                  type={f.type}
                  value={form[f.key as keyof typeof form]}
                  onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 bg-white"
                  placeholder={f.placeholder}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-2 mt-4">
            <button
              onClick={() => { setAddOpen(false); setForm({ name: '', email: '', phone: '' }) }}
              className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-100 transition-colors"
            >
              Cancelar
            </button>
            <button
              onClick={handleAdd}
              disabled={saving || !form.name.trim()}
              className="px-4 py-2 bg-primary-900 text-white rounded-lg text-sm font-semibold hover:bg-primary-800 transition-colors disabled:opacity-50 shadow-sm"
            >
              {saving ? 'Salvando...' : 'Adicionar'}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="p-10 text-center text-slate-400 text-sm">Carregando...</div>
        ) : sellers.length === 0 ? (
          <div className="p-10 text-center text-slate-400 text-sm">Nenhum vendedor cadastrado</div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Vendedor</th>
                <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Email</th>
                <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Telefone</th>
                <th className="text-right text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Leads</th>
                <th className="text-right text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Conv.</th>
                <th className="text-right text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Vendas</th>
                <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Status</th>
                <th className="text-left text-xs text-slate-500 font-semibold px-4 py-3 uppercase tracking-wide">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sellers.map(s => (
                <tr key={s.id} className={`hover:bg-slate-50 transition-colors ${s.status === 'inativo' ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-primary-100 flex items-center justify-center flex-none shadow-sm">
                        <span className="text-xs font-bold text-primary-700">{s.name[0]}</span>
                      </div>
                      <span className="font-semibold text-slate-800">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-slate-500 text-xs">{s.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-slate-700 tabular-nums">{s.leads_assigned}</td>
                  <td className="px-4 py-3 text-right text-slate-600 tabular-nums">
                    {(s.conversion_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-800 tabular-nums">
                    {s.total_sales > 0
                      ? `R$ ${s.total_sales.toLocaleString('pt-BR', { minimumFractionDigits: 0 })}`
                      : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${
                      s.status === 'ativo'
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                        : 'bg-slate-100 text-slate-500 border-slate-200'
                    }`}>
                      {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(s.id, s.status)}
                      className="text-xs text-slate-500 hover:text-slate-800 underline underline-offset-2 transition-colors"
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
