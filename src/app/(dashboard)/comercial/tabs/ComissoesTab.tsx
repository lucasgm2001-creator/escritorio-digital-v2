'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Commission {
  id: string
  seller_id: string
  seller_name?: string
  lead_id?: string
  lead_name?: string
  cargo?: string
  description?: string
  amount: number
  percentage: number
  status: 'pendente' | 'aprovada' | 'paga'
  due_date?: string
  paid_at?: string
  created_at: string
}

interface Props {
  currentUser: { id: string; name: string }
}

const STATUS_CONFIG = {
  pendente: { label: 'Pendente', bg: 'bg-amber-900/30',   text: 'text-amber-400',   border: 'border-amber-800/50' },
  aprovada: { label: 'Aprovada', bg: 'bg-blue-900/30',    text: 'text-blue-400',    border: 'border-blue-800/50'  },
  paga:     { label: 'Paga',     bg: 'bg-emerald-900/30', text: 'text-emerald-400', border: 'border-emerald-800/50' },
} as const

export function ComissoesTab({ currentUser }: Props) {
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'todos' | Commission['status']>('todos')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [sellers, setSellers] = useState<Array<{ id: string; name: string }>>([])
  const [leads, setLeads] = useState<Array<{ id: string; name: string }>>([])
  const [createForm, setCreateForm] = useState({
    seller_id: '',
    lead_id: '',
    cargo: '',
    description: '',
    percentage: '10',
    amount: '',
    due_date: '',
    password: '',
  })
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const supabase = createClient()
  // App pessoal de usuário único: acesso total.
  const canManageAll = true

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

  useEffect(() => {
    const loadSellerData = async () => {
      if (!showCreateModal) return
      const client = createClient()
      const [{ data: sellersData }, { data: leadsData }] = await Promise.all([
        client.from('profiles').select('id, name'),
        client.from('leads').select('id, name').order('name'),
      ])
      setSellers(sellersData ?? [])
      setLeads(leadsData ?? [])
    }
    loadSellerData()
  }, [showCreateModal])

  const handleStatusChange = async (id: string, status: Commission['status']) => {
    if (!canManageAll) return
    await supabase.from('commissions').update({
      status,
      paid_at: status === 'paga' ? new Date().toISOString() : null,
    }).eq('id', id)
    setCommissions(prev => prev.map(c => c.id === id ? { ...c, status } : c))
  }

  const handleCreateCommission = async (e: React.FormEvent) => {
    e.preventDefault()
    setCreateError('')
    setCreating(true)

    try {
      if (!createForm.seller_id || createForm.percentage === '' || createForm.amount === '') {
        throw new Error('Preencha todos os campos obrigatórios')
      }

      const percentageNum = parseFloat(createForm.percentage)
      const amountNum = parseFloat(createForm.amount)

      if (isNaN(percentageNum) || isNaN(amountNum)) {
        throw new Error('Percentual e valor devem ser números válidos')
      }

      if (percentageNum < 0 || percentageNum > 100) {
        throw new Error('Percentual deve estar entre 0 e 100')
      }

      if (amountNum < 0) {
        throw new Error('Valor não pode ser negativo')
      }

      if (!createForm.password || createForm.password.length === 0) {
        throw new Error('Digite sua senha para confirmar')
      }

      // Validar senha
      let passwordValid = false
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 10000) // 10s timeout

        const passwordRes = await fetch('/api/auth/verify-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: createForm.password }),
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (!passwordRes.ok) {
          throw new Error('Erro ao validar senha. Verifique sua conexão e tente novamente.')
        }

        const passwordData = await passwordRes.json()
        if (!passwordData.valid) {
          throw new Error('Senha incorreta.')
        }
        passwordValid = true
      } catch (passwordErr) {
        throw new Error(
          passwordErr instanceof Error && passwordErr.message.includes('timeout')
            ? 'Validação de senha expirou. Verifique sua conexão e tente novamente.'
            : passwordErr instanceof Error
              ? passwordErr.message
              : 'Erro ao validar senha. Tente novamente.'
        )
      }

      if (!passwordValid) {
        throw new Error('Falha ao validar senha.')
      }

      const seller = sellers.find(s => s.id === createForm.seller_id)
      const lead = leads.find(l => l.id === createForm.lead_id)

      const newCommission = {
        seller_id: createForm.seller_id,
        seller_name: seller?.name,
        lead_id: createForm.lead_id || null,
        lead_name: lead?.name || null,
        cargo: createForm.cargo || null,
        description: createForm.description || null,
        amount: parseFloat(createForm.amount),
        percentage: parseFloat(createForm.percentage),
        status: 'pendente' as const,
        due_date: createForm.due_date || null,
      }

      const { data, error } = await supabase.from('commissions').insert(newCommission).select().single()
      if (error) throw error

      setCommissions(prev => [data, ...prev])
      setShowCreateModal(false)
      setCreateForm({
        seller_id: '',
        lead_id: '',
        cargo: '',
        description: '',
        percentage: '10',
        amount: '',
        due_date: '',
        password: '',
      })
    } catch (err) {
      setCreateError(err instanceof Error ? err.message : 'Erro ao criar comissão')
    } finally {
      setCreating(false)
    }
  }

  const filtered = statusFilter === 'todos'
    ? commissions
    : commissions.filter(c => c.status === statusFilter)

  const total    = commissions.reduce((s, c) => s + c.amount, 0)
  const pendente = commissions.filter(c => c.status === 'pendente').reduce((s, c) => s + c.amount, 0)
  const pago     = commissions.filter(c => c.status === 'paga').reduce((s, c) => s + c.amount, 0)

  const fmt = (v: number) => `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-background">
      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-[#161b22] rounded-xl border border-[#2d3748] p-5 shadow-sm">
          <p className="text-xs text-muted-foreground font-medium">Total de Comissões</p>
          <p className="text-2xl font-bold text-foreground mt-1 tabular-nums">{fmt(total)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{commissions.length} registros</p>
          {canManageAll && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="mt-3 w-full bg-primary-600 text-white text-xs px-3 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors"
            >
              + Nova Comissão
            </button>
          )}
        </div>
        <div className="stat-card before:bg-amber-500">
          <p className="text-xs text-amber-400 font-medium">A Pagar</p>
          <p className="text-2xl font-bold text-amber-300 mt-1 tabular-nums">{fmt(pendente)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {commissions.filter(c => c.status === 'pendente').length} pendentes
          </p>
        </div>
        <div className="stat-card before:bg-emerald-500">
          <p className="text-xs text-emerald-400 font-medium">Pago</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1 tabular-nums">{fmt(pago)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {commissions.filter(c => c.status === 'paga').length} pagos
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="bg-[#161b22] rounded-xl border border-[#2d3748] shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#2d3748]">
          <h3 className="font-semibold text-foreground text-sm">
            {canManageAll ? 'Todas as Comissões' : 'Minhas Comissões'}
          </h3>
          <div className="flex gap-1 bg-[#1e2533] rounded-lg p-1">
            {(['todos', 'pendente', 'aprovada', 'paga'] as const).map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all capitalize ${
                  statusFilter === s
                    ? 'bg-[#161b22] text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {s === 'todos' ? 'Todos' : STATUS_CONFIG[s].label}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-muted-foreground text-sm">Carregando...</div>
        ) : filtered.length === 0 ? (
          <div className="p-10 text-center text-muted-foreground text-sm">
            {commissions.length === 0 ? 'Nenhuma comissão registrada' : 'Nenhuma comissão com este filtro'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-[#0d1117]/50 border-b border-[#2d3748]">
                  {canManageAll && (
                    <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Vendedor</th>
                  )}
                  <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Lead</th>
                  <th className="text-right text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">%</th>
                  <th className="text-right text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Valor</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Vencimento</th>
                  <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Status</th>
                  {canManageAll && (
                    <th className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">Alterar</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2d3748]/60">
                {filtered.map(c => {
                  const s = STATUS_CONFIG[c.status]
                  return (
                    <tr key={c.id} className="hover:bg-[#0d1117]/50 transition-colors">
                      {canManageAll && (
                        <td className="px-4 py-3 text-muted-foreground font-medium">{c.seller_name ?? '—'}</td>
                      )}
                      <td className="px-4 py-3 text-muted-foreground">{c.lead_name ?? '—'}</td>
                      <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">{c.percentage}%</td>
                      <td className="px-4 py-3 text-right font-bold text-foreground tabular-nums">{fmt(c.amount)}</td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
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
                            className="text-xs border border-[#2d3748] rounded-lg px-2.5 py-1 focus:outline-none focus:border-primary-600 bg-[#1e2533] text-foreground"
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

      {/* Modal - Nova Comissão */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#161b22] rounded-t-xl sm:rounded-xl border border-[#2d3748] w-full sm:max-w-md p-6 max-h-[90vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-semibold text-foreground">Nova Comissão</h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateError('')
                  setCreateForm({
                    seller_id: '',
                    lead_id: '',
                    cargo: '',
                    description: '',
                    percentage: '10',
                    amount: '',
                    due_date: '',
                    password: '',
                  })
                }}
                className="text-muted-foreground hover:text-foreground text-2xl leading-none"
              >
                ×
              </button>
            </div>

            {createError && (
              <div className="mb-4 p-3 bg-red-900/30 border border-red-800/50 rounded-lg text-sm text-red-400">
                {createError}
              </div>
            )}

            <form onSubmit={handleCreateCommission} className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Vendedor *</label>
                <select
                  value={createForm.seller_id}
                  onChange={e => setCreateForm(p => ({ ...p, seller_id: e.target.value }))}
                  className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary-600"
                  required
                >
                  <option value="">Selecione um vendedor</option>
                  {sellers.map(s => (
                    <option key={s.id} value={s.id}>{s.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Lead</label>
                <select
                  value={createForm.lead_id}
                  onChange={e => setCreateForm(p => ({ ...p, lead_id: e.target.value }))}
                  className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary-600"
                >
                  <option value="">Selecione um lead (opcional)</option>
                  {leads.map(l => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Cargo</label>
                <input
                  type="text"
                  value={createForm.cargo}
                  onChange={e => setCreateForm(p => ({ ...p, cargo: e.target.value }))}
                  placeholder="ex: ADS Manager"
                  className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Descrição</label>
                <textarea
                  value={createForm.description}
                  onChange={e => setCreateForm(p => ({ ...p, description: e.target.value }))}
                  placeholder="ex: Comissão por lead qualificado"
                  className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary-600"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Percentual % *</label>
                  <input
                    type="number"
                    value={createForm.percentage}
                    onChange={e => setCreateForm(p => ({ ...p, percentage: e.target.value }))}
                    min="0"
                    max="100"
                    step="0.1"
                    className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">Valor (R$) *</label>
                  <input
                    type="number"
                    value={createForm.amount}
                    onChange={e => setCreateForm(p => ({ ...p, amount: e.target.value }))}
                    min="0"
                    step="0.01"
                    placeholder="0,00"
                    className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary-600"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Vencimento</label>
                <input
                  type="date"
                  value={createForm.due_date}
                  onChange={e => setCreateForm(p => ({ ...p, due_date: e.target.value }))}
                  className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground focus:outline-none focus:border-primary-600"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Confirmar com Senha *</label>
                <input
                  type="password"
                  value={createForm.password}
                  onChange={e => setCreateForm(p => ({ ...p, password: e.target.value }))}
                  placeholder="Digite sua senha"
                  className="w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder-muted-foreground focus:outline-none focus:border-primary-600"
                  required
                />
                <p className="text-xs text-muted-foreground mt-1">Você será pedido para confirmar com sua senha</p>
              </div>

              <div className="flex gap-2 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false)
                    setCreateError('')
                    setCreateForm({
                      seller_id: '',
                      lead_id: '',
                      cargo: '',
                      description: '',
                      percentage: '10',
                      amount: '',
                      due_date: '',
                      password: '',
                    })
                  }}
                  disabled={creating}
                  className="flex-1 bg-[#1e2533] border border-[#2d3748] text-foreground px-4 py-2 rounded-lg font-medium hover:bg-[#262d35] transition-colors disabled:opacity-50"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="flex-1 bg-primary-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-primary-700 transition-colors disabled:opacity-50"
                >
                  {creating ? 'Salvando...' : 'Criar Comissão'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
