'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

interface SellerRow {
  id: string
  name: string
  email?: string
  cargo?: string
  monthly_goal?: number
  default_commission?: number
  fixed_salary?: number
  start_date?: string
  observations?: string
  status: 'ativo' | 'inativo'
  leads_assigned: number
  conversion_rate: number
  total_sales: number
  created_at: string
}

interface Commission {
  id: string
  seller_id: string
  seller_name?: string
  lead_id?: string
  lead_name?: string
  description?: string
  amount: number
  percentage: number
  status: 'pendente' | 'aprovada' | 'paga'
  due_date?: string
  paid_at?: string
  created_at: string
}

const STATUS_CFG = {
  pendente: { label: 'Pendente', bg: 'bg-amber-900/30',   text: 'text-amber-400',   border: 'border-amber-800/50' },
  aprovada: { label: 'Aprovada', bg: 'bg-blue-900/30',    text: 'text-blue-400',    border: 'border-blue-800/50'  },
  paga:     { label: 'Paga',     bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-800/50' },
} as const

const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

// ─── Seller Profile Panel ─────────────────────────────────────────────────────

function SellerProfile({
  seller, isAdmin, onClose, onUpdated,
}: {
  seller: SellerRow
  isAdmin: boolean
  onClose: () => void
  onUpdated: (s: SellerRow) => void
}) {
  const [fixedForm, setFixedForm] = useState({
    fixed_salary: seller.fixed_salary?.toString() ?? '',
    start_date: seller.start_date?.split('T')[0] ?? '',
    observations: seller.observations ?? '',
  })
  const [savingFixed, setSavingFixed]  = useState(false)
  const [commissions, setCommissions]  = useState<Commission[]>([])
  const [loadingCom, setLoadingCom]    = useState(true)
  const [leads, setLeads]              = useState<Array<{ id: string; name: string }>>([])
  const [showAddCom, setShowAddCom]    = useState(false)
  const [comForm, setComForm]          = useState({ lead_id: '', description: '', percentage: '10', amount: '', due_date: '' })
  const [savingCom, setSavingCom]      = useState(false)
  const [comError, setComError]        = useState('')
  const [activeTab, setActiveTab]      = useState<'info' | 'fixo' | 'comissoes'>('info')

  const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

  useEffect(() => {
    const supabase = createClient()
    supabase.from('commissions').select('*').eq('seller_id', seller.id).order('created_at', { ascending: false })
      .then(({ data }) => { setCommissions(data ?? []); setLoadingCom(false) })
    supabase.from('leads').select('id, name').order('name').then(({ data }) => setLeads(data ?? []))
  }, [seller.id])

  const handleSaveFixed = async () => {
    setSavingFixed(true)
    try {
      const supabase = createClient()
      const salaryNum = parseFloat(fixedForm.fixed_salary) || 0
      await supabase.from('sellers').update({
        fixed_salary: salaryNum,
        start_date: fixedForm.start_date || null,
        observations: fixedForm.observations || null,
      }).eq('id', seller.id)
      onUpdated({ ...seller, fixed_salary: salaryNum, start_date: fixedForm.start_date, observations: fixedForm.observations })
    } finally {
      setSavingFixed(false)
    }
  }

  const handleAddCommission = async () => {
    if (!comForm.amount) { setComError('Valor é obrigatório'); return }
    setSavingCom(true); setComError('')
    try {
      const supabase = createClient()
      const lead = leads.find(l => l.id === comForm.lead_id)
      const { data, error } = await supabase.from('commissions').insert({
        seller_id: seller.id,
        seller_name: seller.name,
        lead_id: comForm.lead_id || null,
        lead_name: lead?.name || null,
        description: comForm.description || null,
        percentage: parseFloat(comForm.percentage) || 0,
        amount: parseFloat(comForm.amount),
        status: 'pendente',
        due_date: comForm.due_date || null,
      }).select().single()
      if (error) throw error
      setCommissions(prev => [data as Commission, ...prev])
      setShowAddCom(false)
      setComForm({ lead_id: '', description: '', percentage: '10', amount: '', due_date: '' })
    } catch {
      setComError('Erro ao adicionar comissão.')
    } finally {
      setSavingCom(false)
    }
  }

  const handleStatusChange = async (id: string, status: Commission['status']) => {
    const supabase = createClient()
    await supabase.from('commissions').update({
      status, paid_at: status === 'paga' ? new Date().toISOString() : null,
    }).eq('id', id)
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const totalPaid    = commissions.filter(c => c.status === 'paga').reduce((s,c) => s + c.amount, 0)
  const totalPending = commissions.filter(c => c.status === 'pendente').reduce((s,c) => s + c.amount, 0)

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#161b22] border border-[#2d3748] rounded-t-2xl sm:rounded-2xl shadow-card-hover w-full sm:max-w-2xl max-h-[90vh] flex flex-col animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-[#2d3748] shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-900/40 border border-primary-800/40 flex items-center justify-center">
              <span className="text-sm font-bold text-primary-400">{seller.name[0]}</span>
            </div>
            <div>
              <h2 className="font-bold text-foreground">{seller.name}</h2>
              <p className="text-xs text-muted-foreground">{seller.cargo ?? seller.email ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Sub-tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-[#2d3748] shrink-0">
          {[
            { key: 'info' as const, label: 'Informações' },
            { key: 'fixo' as const, label: 'Salário Fixo' },
            { key: 'comissoes' as const, label: 'Comissões' },
          ].map(t => (
            <button key={t.key} onClick={() => setActiveTab(t.key)}
              className={`px-3 py-2.5 text-xs font-medium border-b-2 transition-colors ${
                activeTab === t.key ? 'border-primary-600 text-primary-400' : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}>
              {t.label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">

          {/* Info tab */}
          {activeTab === 'info' && (
            <div className="space-y-3">
              {[
                { label: 'E-mail',     value: seller.email ?? '—' },
                { label: 'Cargo',      value: seller.cargo ?? '—' },
                { label: 'Meta Mensal', value: seller.monthly_goal ? fmt(seller.monthly_goal) : '—' },
                { label: 'Comissão',   value: `${seller.default_commission ?? 0}%` },
                { label: 'Leads',      value: String(seller.leads_assigned) },
                { label: 'Conversão',  value: `${(seller.conversion_rate * 100).toFixed(1)}%` },
                { label: 'Desde',      value: seller.created_at ? formatDate(seller.created_at) : '—' },
                { label: 'Status',     value: seller.status === 'ativo' ? 'Ativo' : 'Inativo' },
              ].map(row => (
                <div key={row.label} className="flex items-center justify-between py-2 border-b border-[#2d3748]/40 last:border-0">
                  <span className="text-xs text-muted-foreground">{row.label}</span>
                  <span className="text-sm text-foreground font-medium">{row.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Fixo tab */}
          {activeTab === 'fixo' && (
            isAdmin ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Salário Fixo Mensal (R$)</label>
                  <input type="number" value={fixedForm.fixed_salary}
                    onChange={e => setFixedForm(p => ({ ...p, fixed_salary: e.target.value }))}
                    className={inputCls} placeholder="0,00" min="0" step="100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data de Início</label>
                  <input type="date" value={fixedForm.start_date}
                    onChange={e => setFixedForm(p => ({ ...p, start_date: e.target.value }))}
                    className={inputCls} />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Observações</label>
                  <textarea value={fixedForm.observations}
                    onChange={e => setFixedForm(p => ({ ...p, observations: e.target.value }))}
                    className={`${inputCls} resize-none`} rows={3}
                    placeholder="Ex: revisão em junho, vale refeição incluso..." />
                </div>
                <button onClick={handleSaveFixed} disabled={savingFixed}
                  className="w-full bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50 shadow-glow-sm min-h-[44px]">
                  {savingFixed ? 'Salvando...' : 'Salvar Salário Fixo'}
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <svg className="w-10 h-10 mb-3 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <p className="text-sm text-muted-foreground font-medium">Acesso Restrito</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Apenas administradores podem gerenciar salários</p>
              </div>
            )
          )}

          {/* Comissoes tab */}
          {activeTab === 'comissoes' && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#1a2133] border border-[#2d3748] rounded-xl p-3">
                  <p className="text-xs text-emerald-400 font-medium">Total Pago</p>
                  <p className="text-lg font-bold text-emerald-300 mt-0.5 tabular-nums">{fmt(totalPaid)}</p>
                </div>
                <div className="bg-[#1a2133] border border-[#2d3748] rounded-xl p-3">
                  <p className="text-xs text-amber-400 font-medium">A Pagar</p>
                  <p className="text-lg font-bold text-amber-300 mt-0.5 tabular-nums">{fmt(totalPending)}</p>
                </div>
              </div>

              {/* Add commission (admin only) */}
              {isAdmin && (
                <button onClick={() => setShowAddCom(!showAddCom)}
                  className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors shadow-glow-sm min-h-[44px]">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Nova Comissão
                </button>
              )}

              {/* Add commission form */}
              {showAddCom && (
                <div className="bg-[#1e2533] border border-[#2d3748] rounded-xl p-4 space-y-3">
                  {comError && <p className="text-xs text-red-400">{comError}</p>}
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Lead relacionado</label>
                    <select value={comForm.lead_id} onChange={e => setComForm(p => ({ ...p, lead_id: e.target.value }))} className={inputCls}>
                      <option value="">Nenhum (opcional)</option>
                      {leads.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
                    <input value={comForm.description} onChange={e => setComForm(p => ({ ...p, description: e.target.value }))}
                      className={inputCls} placeholder="Ex: comissão por fechamento" />
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">% Comissão</label>
                      <input type="number" value={comForm.percentage} onChange={e => setComForm(p => ({ ...p, percentage: e.target.value }))}
                        className={inputCls} min="0" max="100" step="0.1" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Valor (R$) *</label>
                      <input type="number" value={comForm.amount} onChange={e => setComForm(p => ({ ...p, amount: e.target.value }))}
                        className={inputCls} min="0" step="0.01" placeholder="0,00" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-muted-foreground mb-1">Vencimento</label>
                      <input type="date" value={comForm.due_date} onChange={e => setComForm(p => ({ ...p, due_date: e.target.value }))} className={inputCls} />
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => setShowAddCom(false)}
                      className="flex-1 border border-[#2d3748] text-muted-foreground py-2 rounded-lg text-sm hover:bg-[#1a2133] transition-colors min-h-[44px]">
                      Cancelar
                    </button>
                    <button onClick={handleAddCommission} disabled={savingCom || !comForm.amount}
                      className="flex-1 bg-primary-600 text-white py-2 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50 min-h-[44px]">
                      {savingCom ? 'Salvando...' : 'Adicionar'}
                    </button>
                  </div>
                </div>
              )}

              {/* Commission list */}
              {loadingCom ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground text-sm gap-2">
                  <span className="w-4 h-4 border-2 border-muted-foreground/20 border-t-primary-500 rounded-full animate-spin" />
                  Carregando...
                </div>
              ) : commissions.length === 0 ? (
                <p className="text-center text-sm text-muted-foreground py-8">Nenhuma comissão registrada.</p>
              ) : (
                <div className="space-y-2">
                  {commissions.map(c => {
                    const s = STATUS_CFG[c.status]
                    return (
                      <div key={c.id} className="flex items-center justify-between bg-[#1a2133] border border-[#2d3748] rounded-xl px-4 py-3 gap-3">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground font-medium truncate">{c.lead_name ?? c.description ?? 'Sem descrição'}</p>
                          <p className="text-xs text-muted-foreground">
                            {fmt(c.amount)} · {c.percentage}%
                            {c.due_date ? ` · ${new Date(c.due_date).toLocaleDateString('pt-BR')}` : ''}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`text-[11px] px-2 py-0.5 rounded-full border font-medium ${s.bg} ${s.text} ${s.border}`}>
                            {s.label}
                          </span>
                          {isAdmin && (
                            <select value={c.status} onChange={e => handleStatusChange(c.id, e.target.value as Commission['status'])}
                              className="text-xs border border-[#2d3748] rounded-lg px-2 py-1 bg-[#1e2533] text-foreground focus:outline-none focus:border-primary-600">
                              <option value="pendente">Pendente</option>
                              <option value="aprovada">Aprovada</option>
                              <option value="paga">Paga</option>
                            </select>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main VendedoresTab ───────────────────────────────────────────────────────

export function VendedoresTab() {
  const [sellers, setSellers]     = useState<SellerRow[]>([])
  const [loading, setLoading]     = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [addOpen, setAddOpen]     = useState(false)
  const [selectedSeller, setSelectedSeller] = useState<SellerRow | null>(null)
  const [form, setForm] = useState({ name: '', email: '', telefone: '', cargo: '', monthly_goal: '', default_commission: '' })
  const [saving, setSaving] = useState(false)

  // App pessoal de usuário único: acesso total.
  const isAdmin = true

  const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('sellers')
          .select('id, name, email, cargo, monthly_goal, default_commission, fixed_salary, start_date, observations, status, leads_assigned, conversion_rate, total_sales, created_at')
          .order('name')

        if (error) {
          setFetchError(error.code === '42P01'
            ? 'Tabela sellers não encontrada. Rode a migration 005 no Supabase.'
            : `Erro ao carregar vendedores: ${error.message}`
          )
          setSellers([])
        } else {
          setSellers((data ?? []) as SellerRow[])
          setFetchError(null)
        }
      } catch {
        setSellers([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const handleAdd = async () => {
    if (!form.name.trim()) return
    const monthlyGoalNum = form.monthly_goal ? parseFloat(form.monthly_goal) : 0
    const commissionNum  = form.default_commission ? parseFloat(form.default_commission) : 0
    if (form.monthly_goal && (isNaN(monthlyGoalNum) || monthlyGoalNum < 0)) { alert('Meta mensal inválida'); return }
    if (form.default_commission && (isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100)) { alert('Comissão deve ser 0-100%'); return }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('sellers').insert({
        name: form.name.trim(), email: form.email.trim() || null, phone: form.telefone.trim() || null,
        cargo: form.cargo.trim() || null, monthly_goal: monthlyGoalNum, default_commission: commissionNum,
        status: 'ativo', total_sales: 0, total_commissions: 0, leads_assigned: 0, conversion_rate: 0,
      }).select('id, name, email, cargo, monthly_goal, default_commission, fixed_salary, start_date, observations, status, leads_assigned, conversion_rate, total_sales, created_at').single()

      if (!error && data) setSellers(prev => [...prev, data as SellerRow])
    } finally {
      setForm({ name: '', email: '', telefone: '', cargo: '', monthly_goal: '', default_commission: '' })
      setAddOpen(false)
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, current: 'ativo' | 'inativo') => {
    const next = current === 'ativo' ? 'inativo' : 'ativo'
    const supabase = createClient()
    await supabase.from('sellers').update({ status: next }).eq('id', id)
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status: next } : s))
  }

  const active   = sellers.filter(s => s.status === 'ativo').length
  const inactive = sellers.filter(s => s.status === 'inativo').length

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-background animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-foreground">Vendedores</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{active} ativos · {inactive} inativos</p>
        </div>
        {isAdmin && (
          <button onClick={() => setAddOpen(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors shadow-glow-sm min-h-[44px]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Vendedor
          </button>
        )}
      </div>

      {fetchError && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-400">{fetchError}</div>
      )}

      {/* Desktop table */}
      <div className="hidden sm:block bg-[#161b22] rounded-xl border border-[#2d3748] overflow-hidden">
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
                {['Vendedor','E-mail','Cargo','Meta','Conv.','Status',''].map(h => (
                  <th key={h} className={`text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide ${h === 'Meta' || h === 'Conv.' ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/60">
              {sellers.map(s => (
                <tr key={s.id} className={`hover:bg-[#1a2133]/60 transition-colors cursor-pointer ${s.status === 'inativo' ? 'opacity-50' : ''}`}
                  onClick={() => setSelectedSeller(s)}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-900/40 border border-primary-800/40 flex items-center justify-center flex-none">
                        <span className="text-xs font-bold text-primary-400">{s.name[0]}</span>
                      </div>
                      <span className="font-semibold text-foreground">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">
                    {s.monthly_goal ? `R$ ${s.monthly_goal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{(s.conversion_rate * 100).toFixed(1)}%</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${s.status === 'ativo' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 'bg-slate-800/40 text-slate-400 border-slate-700/50'}`}>
                      {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                    {isAdmin && (
                      <button onClick={() => handleToggle(s.id, s.status)}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors">
                        {s.status === 'ativo' ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        )}
      </div>

      {/* Mobile cards */}
      <div className="sm:hidden space-y-3">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground text-sm">
            <span className="w-5 h-5 border-2 border-muted-foreground/20 border-t-primary-500 rounded-full animate-spin" />
            Carregando...
          </div>
        ) : sellers.length === 0 ? (
          <div className="py-16 text-center bg-[#161b22] border border-[#2d3748] rounded-xl">
            <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-muted-foreground font-medium">Nenhum vendedor cadastrado</p>
          </div>
        ) : sellers.map(s => (
          <div key={s.id} onClick={() => setSelectedSeller(s)}
            className={`bg-[#161b22] border border-[#2d3748] rounded-xl p-4 cursor-pointer hover:border-primary-600/40 transition-colors ${s.status === 'inativo' ? 'opacity-50' : ''}`}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-primary-900/40 border border-primary-800/40 flex items-center justify-center">
                  <span className="text-sm font-bold text-primary-400">{s.name[0]}</span>
                </div>
                <div>
                  <p className="font-semibold text-foreground text-sm">{s.name}</p>
                  <p className="text-xs text-muted-foreground">{s.cargo ?? s.email ?? '—'}</p>
                </div>
              </div>
              <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${s.status === 'ativo' ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50' : 'bg-slate-800/40 text-slate-400 border-slate-700/50'}`}>
                {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 text-center">
              <div className="bg-[#1a2133] rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Meta</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{s.monthly_goal ? `R$${(s.monthly_goal/1000).toFixed(1)}k` : '—'}</p>
              </div>
              <div className="bg-[#1a2133] rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Leads</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{s.leads_assigned}</p>
              </div>
              <div className="bg-[#1a2133] rounded-lg p-2">
                <p className="text-[10px] text-muted-foreground">Conv.</p>
                <p className="text-xs font-semibold text-foreground mt-0.5">{(s.conversion_rate * 100).toFixed(1)}%</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add seller modal */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-t-2xl sm:rounded-2xl shadow-card-hover w-full sm:max-w-sm animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground text-base">Novo Vendedor</h2>
              <button onClick={() => { setAddOpen(false); setForm({ name:'', email:'', telefone:'', cargo:'', monthly_goal:'', default_commission:'' }) }}
                className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
              {[
                { key:'name',     label:'Nome *',   type:'text',  ph:'Nome completo' },
                { key:'email',    label:'E-mail',   type:'email', ph:'email@exemplo.com' },
                { key:'telefone', label:'Telefone', type:'tel',   ph:'(11) 99999-9999' },
                { key:'cargo',    label:'Cargo',    type:'text',  ph:'Ex: SDR, Closer...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls} placeholder={f.ph} />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Meta Mensal (R$)</label>
                  <input type="number" value={form.monthly_goal} onChange={e => setForm(p => ({ ...p, monthly_goal: e.target.value }))}
                    className={inputCls} placeholder="0,00" min="0" step="100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Comissão (%)</label>
                  <input type="number" value={form.default_commission} onChange={e => setForm(p => ({ ...p, default_commission: e.target.value }))}
                    className={inputCls} placeholder="0" min="0" max="100" step="0.1" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => { setAddOpen(false); setForm({ name:'', email:'', telefone:'', cargo:'', monthly_goal:'', default_commission:'' }) }}
                  className="flex-1 border border-[#2d3748] text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors min-h-[44px]">
                  Cancelar
                </button>
                <button onClick={handleAdd} disabled={saving || !form.name.trim()}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50 shadow-glow-sm min-h-[44px]">
                  {saving ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Seller profile panel */}
      {selectedSeller && (
        <SellerProfile
          seller={selectedSeller}
          isAdmin={isAdmin}
          onClose={() => setSelectedSeller(null)}
          onUpdated={updated => setSellers(prev => prev.map(s => s.id === updated.id ? updated : s))}
        />
      )}
    </div>
  )
}
