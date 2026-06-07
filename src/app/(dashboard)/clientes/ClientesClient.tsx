'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils'

interface Client {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  plan_weekly: number
  status: 'ativo' | 'inativo' | 'prospect'
  start_date?: string
  end_date?: string
  assigned_name?: string
  jobs?: string[]
  created_at: string
}

interface Activity {
  id: string
  type: string
  description: string
  user_name?: string
  created_at: string
}

interface Props {
  initialClients: Client[]
  currentUser: { id: string; name: string }
}

const PLANS = [140, 190, 250]

const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

export function ClientesClient({ initialClients, currentUser }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', plan_weekly: '140' })
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '', plan_weekly: '' })
  const [loading, setLoading] = useState(false)
  const [editingJobsId, setEditingJobsId] = useState<string | null>(null)
  const [jobInput, setJobInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [lastCreateTime, setLastCreateTime] = useState<number>(0) // Rate limiting

  const supabase = createClient()

  const filtered = clients.filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return c.name.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q) ||
      c.phone?.includes(q)
  })

  const ativos   = filtered.filter(c => c.status === 'ativo')
  const inativos = filtered.filter(c => c.status === 'inativo')
  const mrr      = clients.filter(c => c.status === 'ativo').reduce((sum, c) => sum + c.plan_weekly * 4, 0)

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    // Rate limiting: máximo 1 criação por segundo
    const now = Date.now()
    if (now - lastCreateTime < 1000) {
      return
    }

    setLoading(true)
    const { data, error } = await supabase.from('clients').insert({
      name: form.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      plan_weekly: parseFloat(form.plan_weekly),
      status: 'ativo',
      start_date: new Date().toISOString().slice(0, 10),
      assigned_name: currentUser.name,
    }).select().single()

    if (!error && data) {
      setClients(prev => [data as Client, ...prev])
      setLastCreateTime(Date.now()) // Rate limiting
      await supabase.from('activities').insert({
        type: 'client',
        description: `Novo cliente ativo: ${form.name}`,
        user_name: currentUser.name,
        entity_id: data.id,
      })
      setNewOpen(false)
      setForm({ name: '', company: '', email: '', phone: '', plan_weekly: '140' })
    }
    setLoading(false)
  }

  const handleSaveEdit = async () => {
    if (!editClient) return
    setLoading(true)
    await supabase.from('clients').update({
      name: editForm.name || editClient.name,
      company: editForm.company || null,
      email: editForm.email || null,
      phone: editForm.phone || null,
      plan_weekly: parseFloat(editForm.plan_weekly) || editClient.plan_weekly,
    }).eq('id', editClient.id)
    setClients(prev => prev.map(c => c.id === editClient.id ? {
      ...c,
      name: editForm.name || c.name,
      company: editForm.company || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      plan_weekly: parseFloat(editForm.plan_weekly) || c.plan_weekly,
    } : c))
    setEditClient(null)
    setLoading(false)
  }

  const handleAddJob = async (client: Client) => {
    const job = jobInput.trim()
    if (!job) return
    const jobs = [...(client.jobs ?? []), job]
    await supabase.from('clients').update({ jobs }).eq('id', client.id)
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, jobs } : c))
    setJobInput('')
  }

  const handleRemoveJob = async (client: Client, idx: number) => {
    const jobs = (client.jobs ?? []).filter((_, i) => i !== idx)
    await supabase.from('clients').update({ jobs }).eq('id', client.id)
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, jobs } : c))
  }

  const handleInativar = async (client: Client) => {
    const reason = window.prompt(`Motivo para inativar ${client.name}?`)
    if (reason === null) return
    await supabase.from('clients').update({
      status: 'inativo', end_date: new Date().toISOString().slice(0, 10), end_reason: reason,
    }).eq('id', client.id)
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'inativo' as const } : c))
    await supabase.from('activities').insert({
      type: 'client',
      description: `Cliente inativado: ${client.name}. Motivo: ${reason}`,
      user_name: currentUser.name,
      entity_id: client.id,
    })
  }

  const handleReativar = async (client: Client) => {
    await supabase.from('clients').update({ status: 'ativo', end_date: null }).eq('id', client.id)
    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'ativo' as const } : c))
  }

  const loadActivities = async (clientId: string) => {
    if (expandedId === clientId) { setExpandedId(null); return }
    setExpandedId(clientId)
    setLoadingActivities(true)
    const { data } = await supabase
      .from('activities')
      .select('*')
      .eq('entity_id', clientId)
      .order('created_at', { ascending: false })
      .limit(10)
    setActivities(data ?? [])
    setLoadingActivities(false)
  }

  const ClientRow = ({ client, inactive }: { client: Client; inactive?: boolean }) => (
    <div className={`rounded-xl border transition-all duration-150 ${inactive ? 'border-[#2d3748]/40 opacity-60' : 'border-[#2d3748] hover:border-[#3d4f6a]'}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-3.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${inactive ? 'bg-[#1e2533]' : 'bg-primary-900/40 border border-primary-800/40'}`}>
          <span className={`text-sm font-bold ${inactive ? 'text-muted-foreground' : 'text-primary-400'}`}>{client.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-foreground text-sm truncate">{client.name}</p>
          {client.company && <p className="text-xs text-muted-foreground truncate">{client.company}</p>}
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border tabular-nums shrink-0 ${
          inactive
            ? 'text-muted-foreground border-[#2d3748] bg-[#1e2533]'
            : 'text-green-400 border-green-800/50 bg-green-900/20'
        }`}>
          {formatCurrency(client.plan_weekly, 'en-US', 'USD')}/sem
        </span>
        {client.start_date && (
          <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
            {inactive ? 'encerrado' : `desde ${formatDate(client.start_date)}`}
          </span>
        )}
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!inactive && (
            <button
              onClick={() => { setEditClient(client); setEditForm({ name: client.name, company: client.company ?? '', email: client.email ?? '', phone: client.phone ?? '', plan_weekly: String(client.plan_weekly) }) }}
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#2d3748] rounded-lg transition-colors"
              title="Editar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => { setEditingJobsId(editingJobsId === client.id ? null : client.id); setJobInput('') }}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#2d3748] rounded-lg transition-colors"
            title="Jobs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
          <button
            onClick={() => loadActivities(client.id)}
            className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-[#2d3748] rounded-lg transition-colors"
            title="Histórico"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {inactive ? (
            <button onClick={() => handleReativar(client)} className="text-xs text-green-400 hover:text-green-300 transition-colors ml-1">Reativar</button>
          ) : (
            <button onClick={() => handleInativar(client)} className="text-xs text-red-400 hover:text-red-300 transition-colors ml-1">Inativar</button>
          )}
        </div>
      </div>

      {/* Jobs panel */}
      {editingJobsId === client.id && (
        <div className="px-4 pb-3.5 border-t border-[#2d3748]/60 pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Jobs / Serviços</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(client.jobs ?? []).map((job, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-primary-900/30 text-primary-300 border border-primary-800/40 rounded-full px-2.5 py-0.5 text-xs font-medium">
                {job}
                {!inactive && (
                  <button onClick={() => handleRemoveJob(client, idx)} className="text-primary-500 hover:text-primary-300 transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
            {(client.jobs ?? []).length === 0 && <span className="text-xs text-muted-foreground">Nenhum job cadastrado.</span>}
          </div>
          {!inactive && (
            <div className="flex gap-2">
              <input
                value={jobInput}
                onChange={e => setJobInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), handleAddJob(client))}
                placeholder="Ex: Gestão de tráfego..."
                className="flex-1 bg-[#161b22] border border-[#2d3748] rounded-lg px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600"
              />
              <button onClick={() => handleAddJob(client)} disabled={!jobInput.trim()}
                className="px-3 py-1.5 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-500 disabled:opacity-40 transition-colors">
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity history */}
      {expandedId === client.id && (
        <div className="px-4 pb-3.5 border-t border-[#2d3748]/60 pt-3">
          <p className="text-xs font-semibold text-muted-foreground mb-2">Histórico de Atividades</p>
          {loadingActivities ? (
            <p className="text-xs text-muted-foreground">Carregando...</p>
          ) : activities.length === 0 ? (
            <p className="text-xs text-muted-foreground">Nenhuma atividade registrada.</p>
          ) : (
            <div className="space-y-1.5">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <span className="w-1 h-1 rounded-full bg-primary-500 mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-foreground">{a.description}</span>
                    <span className="text-muted-foreground ml-2">— {a.user_name} · {timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Clientes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Contratos ativos e histórico</p>
        </div>
        <button onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors shadow-glow-sm">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Contratos Ativos',   value: clients.filter(c => c.status === 'ativo').length, color: 'text-green-400',   accent: 'before:bg-green-500' },
          { label: 'MRR Total',          value: formatCurrency(mrr, 'en-US', 'USD'),              color: 'text-primary-400', accent: 'before:bg-primary-500' },
          { label: 'Contratos Inativos', value: clients.filter(c => c.status === 'inativo').length, color: 'text-muted-foreground', accent: 'before:bg-slate-500' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.accent}`}>
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, email..."
          className="w-full pl-9 pr-3 py-2 bg-[#161b22] border border-[#2d3748] rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600" />
      </div>

      {/* Ativos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <h2 className="text-sm font-semibold text-foreground">Contratos Ativos</h2>
          <span className="text-xs text-muted-foreground">({ativos.length})</span>
        </div>
        <div className="space-y-2">
          {ativos.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">Nenhum cliente ativo.</p>
          ) : ativos.map(c => <ClientRow key={c.id} client={c} />)}
        </div>
      </div>

      {/* Inativos */}
      {inativos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <h2 className="text-sm font-semibold text-muted-foreground">Contratos Inativos</h2>
            <span className="text-xs text-muted-foreground">({inativos.length})</span>
          </div>
          <div className="space-y-2">
            {inativos.map(c => <ClientRow key={c.id} client={c} inactive />)}
          </div>
        </div>
      )}

      {/* Modal novo cliente */}
      {newOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-t-2xl sm:rounded-2xl shadow-card-hover w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground">Novo Cliente</h2>
              <button onClick={() => setNewOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-3">
              {[
                { k: 'name',    label: 'Nome *',  ph: 'Nome do cliente', req: true },
                { k: 'company', label: 'Empresa', ph: 'Empresa', req: false },
                { k: 'email',   label: 'Email',   ph: 'email@exemplo.com', req: false },
                { k: 'phone',   label: 'Telefone',ph: '+55 (11) 99999-9999', req: false },
              ].map(f => (
                <div key={f.k}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                  <input required={f.req} value={form[f.k as keyof typeof form]}
                    onChange={e => set(f.k, e.target.value)} placeholder={f.ph} className={inputCls} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Plano semanal (USD)</label>
                <div className="flex gap-2">
                  {PLANS.map(p => (
                    <button key={p} type="button" onClick={() => set('plan_weekly', String(p))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        form.plan_weekly === String(p)
                          ? 'bg-primary-600 text-white border-primary-600 shadow-glow-sm'
                          : 'border-[#2d3748] text-muted-foreground hover:border-primary-700'
                      }`}>
                      ${p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setNewOpen(false)}
                  className="flex-1 border border-[#2d3748] text-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal edição inline */}
      {editClient && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-t-2xl sm:rounded-2xl shadow-card-hover w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground">Editar Cliente</h2>
              <button onClick={() => setEditClient(null)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { k: 'name',    label: 'Nome',    ph: editClient.name },
                { k: 'company', label: 'Empresa', ph: editClient.company ?? '' },
                { k: 'email',   label: 'Email',   ph: editClient.email ?? '' },
                { k: 'phone',   label: 'Telefone',ph: editClient.phone ?? '' },
              ].map(f => (
                <div key={f.k}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">{f.label}</label>
                  <input
                    value={editForm[f.k as keyof typeof editForm]}
                    onChange={e => setEditForm(p => ({ ...p, [f.k]: e.target.value }))}
                    placeholder={f.ph}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">Plano (USD/sem)</label>
                <div className="flex gap-2">
                  {PLANS.map(p => (
                    <button key={p} type="button" onClick={() => setEditForm(prev => ({ ...prev, plan_weekly: String(p) }))}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-all ${
                        editForm.plan_weekly === String(p)
                          ? 'bg-primary-600 text-white border-primary-600'
                          : 'border-[#2d3748] text-muted-foreground hover:border-primary-700'
                      }`}>
                      ${p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditClient(null)}
                  className="flex-1 border border-[#2d3748] text-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveEdit} disabled={loading}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
