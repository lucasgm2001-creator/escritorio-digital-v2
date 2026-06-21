'use client'

import { useState, useEffect, useRef } from 'react'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import { updateClient, payDueWeeks, voidClientWeek } from '@/lib/commission/actions'
import { createClient } from '@/lib/supabase/client'
import { useSave } from '@/lib/useSave'
import { formatCurrency, formatDate, timeAgo } from '@/lib/utils'
import { useToast } from '@/components/ui/toast'
import { FUSO_OPTIONS } from '../comercial/types'

export interface Client {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  plan_weekly: number
  plano_id?: string | null
  status: 'ativo' | 'inativo' | 'prospect'
  start_date?: string
  end_date?: string
  assigned_name?: string
  nicho?: string
  fuso?: 'leste' | 'central' | 'montanha' | 'pacifico' | null
  jobs?: string[]
  created_at: string
}

interface Plan { id: string; nome: string; valor_semanal: number }
interface ClientPayment { id: string; numero_semana: number; valor_usd: number; paid_on: string; anulado?: boolean }

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
  focusClientId?: string | null   // vindo da aba Contatos: expande/rola até este cliente
  onFocusHandled?: () => void
}

// Tokens bento, theme-aware (não usar #hex/roxo hardcoded).
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// IMPORTANTE: ClientRow em escopo de MÓDULO. Antes era definido dentro de
// ClientesClient e contém o <input> de "jobs" — a cada tecla o pai
// re-renderizava, ClientRow era recriado e o input remontava (perdia o foco,
// "só entra 1 letra"). Fora, o nó é estável. Estado/handlers chegam via props.
interface ClientRowProps {
  client: Client
  plans: Plan[]
  payments: Record<string, ClientPayment[]>
  payOpenId: string | null
  payBusyId: string | null
  onTogglePay: (id: string) => void
  onMarkWeek: (client: Client) => void
  onPayMonth: (client: Client) => void
  onVoidWeek: (client: Client, numero: number) => void
  onRunAuto: (client: Client) => void
  inactive?: boolean
  editingJobsId: string | null
  jobInput: string
  expandedId: string | null
  activities: Activity[]
  loadingActivities: boolean
  onEdit: (client: Client) => void
  onToggleJobs: (id: string) => void
  setJobInput: (v: string) => void
  onAddJob: (client: Client) => void
  onRemoveJob: (client: Client, idx: number) => void
  onToggleActivities: (id: string) => void
  onReativar: (client: Client) => void
  onInativar: (client: Client) => void
}

function ClientRow({
  client, plans, payments, payOpenId, payBusyId, onTogglePay, onMarkWeek, onPayMonth, onVoidWeek, onRunAuto,
  inactive, editingJobsId, jobInput, expandedId, activities, loadingActivities,
  onEdit, onToggleJobs, setJobInput, onAddJob, onRemoveJob, onToggleActivities, onReativar, onInativar,
}: ClientRowProps) {
  // Plano do banco manda; plan_weekly é só fallback legado.
  const plan = plans.find(p => p.id === client.plano_id)
  const weekly = plan?.valor_semanal ?? client.plan_weekly
  const pays = (payments[client.id] ?? []).slice().sort((a, b) => a.numero_semana - b.numero_semana)
  const paidNums = pays.map(p => p.numero_semana)
  const totalRecebido = pays.filter(p => !p.anulado).reduce((s, p) => s + Number(p.valor_usd), 0)
  const payOpen = payOpenId === client.id
  const payBusy = payBusyId === client.id
  let nextUnpaid = 1; { const s = new Set(paidNums); while (s.has(nextUnpaid)) nextUnpaid++ }
  return (
    <div id={`cli-row-${client.id}`} className={`bento-fx transition-colors duration-150 ${inactive ? 'opacity-60' : 'hover:border-lime/40'}`}>
      {/* Main row */}
      <div className="flex items-center gap-3 p-3.5">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${inactive ? 'bg-bento-bg' : 'bg-lime/15 border border-lime/30'}`}>
          <span className={`text-sm font-bold ${inactive ? 'text-bento-muted' : 'text-lime-fg'}`}>{client.name[0]}</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-bento-text text-sm truncate">{client.name}</p>
          {client.company && <p className="text-xs text-bento-muted truncate">{client.company}</p>}
        </div>
        <span className={`font-tech text-xs font-semibold px-2.5 py-1 rounded-full border tabular-nums shrink-0 ${
          inactive
            ? 'text-bento-muted border-bento-border bg-bento-bg'
            : 'text-green-400 border-green-800/50 bg-green-900/20'
        }`}>
          {plan ? `${plan.nome} · ` : ''}{formatCurrency(weekly, 'en-US', 'USD')}/sem
        </span>
        {client.start_date && (
          <span className="text-xs text-bento-muted shrink-0 hidden md:block">
            {inactive ? 'encerrado' : `desde ${formatDate(client.start_date)}`}
          </span>
        )}
        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {!inactive && (
            <button
              onClick={() => onEdit(client)}
              className="p-1.5 text-bento-muted hover:text-bento-text hover:bg-bento-bg rounded-lg transition-colors"
              title="Editar"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
            </button>
          )}
          <button
            onClick={() => onToggleJobs(client.id)}
            className="p-1.5 text-bento-muted hover:text-bento-text hover:bg-bento-bg rounded-lg transition-colors"
            title="Jobs"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
          </button>
          <button
            onClick={() => onToggleActivities(client.id)}
            className="p-1.5 text-bento-muted hover:text-bento-text hover:bg-bento-bg rounded-lg transition-colors"
            title="Histórico"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          <button
            onClick={() => onTogglePay(client.id)}
            className="p-1.5 text-bento-muted hover:text-bento-text hover:bg-bento-bg rounded-lg transition-colors"
            title="Pagamentos"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 7v1m0 8v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </button>
          {inactive ? (
            <button onClick={() => onReativar(client)} className="text-xs text-green-400 hover:text-green-300 transition-colors ml-1">Reativar</button>
          ) : (
            <button onClick={() => onInativar(client)} className="text-xs text-red-400 hover:text-red-300 transition-colors ml-1">Inativar</button>
          )}
        </div>
      </div>

      {/* Jobs panel */}
      {editingJobsId === client.id && (
        <div className="px-4 pb-3.5 border-t border-bento-border/60 pt-3">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Jobs / Serviços</p>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {(client.jobs ?? []).map((job, idx) => (
              <span key={idx} className="inline-flex items-center gap-1 bg-lime/15 text-lime-fg border border-lime/30 rounded-full px-2.5 py-0.5 text-xs font-medium">
                {job}
                {!inactive && (
                  <button onClick={() => onRemoveJob(client, idx)} className="text-lime-fg/70 hover:text-lime-fg transition-colors">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                )}
              </span>
            ))}
            {(client.jobs ?? []).length === 0 && <span className="text-xs text-bento-muted">Nenhum job cadastrado.</span>}
          </div>
          {!inactive && (
            <div className="flex gap-2">
              <input
                value={jobInput}
                onChange={e => setJobInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), onAddJob(client))}
                placeholder="Ex: Gestão de tráfego..."
                className="flex-1 bg-bento-bg border border-bento-border rounded-btn px-3 py-1.5 text-xs text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime"
              />
              <button onClick={() => onAddJob(client)} disabled={!jobInput.trim()}
                className="bento-btn px-3 py-1.5 rounded-btn text-xs font-semibold disabled:opacity-40 min-h-0">
                Add
              </button>
            </div>
          )}
        </div>
      )}

      {/* Activity history */}
      {expandedId === client.id && (
        <div className="px-4 pb-3.5 border-t border-bento-border/60 pt-3">
          <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-2">Histórico de Atividades</p>
          {loadingActivities ? (
            <p className="text-xs text-bento-muted">Carregando...</p>
          ) : activities.length === 0 ? (
            <p className="text-xs text-bento-muted">Nenhuma atividade registrada.</p>
          ) : (
            <div className="space-y-1.5">
              {activities.map(a => (
                <div key={a.id} className="flex items-start gap-2 text-xs">
                  <span className="w-1 h-1 rounded-full bg-lime mt-1.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <span className="text-bento-dim">{a.description}</span>
                    <span className="text-bento-muted ml-2">— {a.user_name} · {timeAgo(a.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagamentos — semanas pagas do contrato (receita) + derivação/estorno da comissão */}
      {payOpen && (
        <div className="px-4 pb-3.5 border-t border-bento-border/60 pt-3">
          <div className="flex items-center justify-between mb-2">
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Semanas pagas{plan ? ` · ${formatCurrency(weekly, 'en-US', 'USD')}/sem` : ''}</p>
            <p className="font-tech text-[11px] text-bento-text tabular-nums">Recebido {formatCurrency(totalRecebido, 'en-US', 'USD')}</p>
          </div>
          {pays.length === 0 ? (
            <p className="text-xs text-bento-muted mb-3">Nenhuma semana registrada.</p>
          ) : (
            <div className="space-y-1 mb-3">
              {pays.map(p => (
                <div key={p.id} className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-tech text-bento-dim tabular-nums">S{p.numero_semana} · {formatDate(p.paid_on)}</span>
                  <span className="flex items-center gap-2">
                    <span className={`font-tech tabular-nums ${p.anulado ? 'line-through text-bento-muted' : 'text-bento-text'}`}>{formatCurrency(Number(p.valor_usd), 'en-US', 'USD')}</span>
                    {p.anulado
                      ? <span className="text-[10px] text-red-400 font-semibold">anulada</span>
                      : !inactive && <button onClick={() => onVoidWeek(client, p.numero_semana)} disabled={payBusy} className="text-[10px] text-red-400 hover:text-red-300 disabled:opacity-50">Anular</button>}
                  </span>
                </div>
              ))}
            </div>
          )}
          {!inactive && (
            <div className="flex flex-wrap gap-2">
              <button onClick={() => onMarkWeek(client)} disabled={payBusy}
                className="bento-btn px-3 py-1.5 rounded-btn text-xs font-semibold disabled:opacity-50">
                {payBusy ? 'Registrando...' : `Marcar semana ${nextUnpaid}`}
              </button>
              <button onClick={() => onPayMonth(client)} disabled={payBusy}
                className="px-3 py-1.5 rounded-btn text-xs border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
                Pagar mês (4 semanas)
              </button>
              <button onClick={() => onRunAuto(client)} disabled={payBusy} title="Testa o agendador neste cliente (server-side)"
                className="px-3 py-1.5 rounded-btn text-xs border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
                Rodar auto agora
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function ClientesClient({ initialClients, currentUser, focusClientId, onFocusHandled }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  // Reflete dados frescos do servidor após router.refresh() (revalidação ao focar a aba).
  useEffect(() => { setClients(initialClients) }, [initialClients])
  // Tempo real: criar/editar/excluir cliente reflete ao vivo (merge por id).
  useRealtimeRows<Client>('clients', setClients)
  const [search, setSearch] = useState('')
  const [newOpen, setNewOpen] = useState(false)
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', plano_id: '', fuso: '', nicho: '' })
  const [editForm, setEditForm] = useState({ name: '', company: '', email: '', phone: '', plano_id: '', fuso: '', nicho: '' })
  const [plans, setPlans] = useState<Plan[]>([])
  const [payments, setPayments] = useState<Record<string, ClientPayment[]>>({})
  const [payOpenId, setPayOpenId] = useState<string | null>(null)
  const [payBusyId, setPayBusyId] = useState<string | null>(null)
  const payBusyRef = useRef(false)
  const [loading, setLoading] = useState(false)
  const [editingJobsId, setEditingJobsId] = useState<string | null>(null)
  const [jobInput, setJobInput] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [activities, setActivities] = useState<Activity[]>([])
  const [loadingActivities, setLoadingActivities] = useState(false)
  const [lastCreateTime, setLastCreateTime] = useState<number>(0) // Rate limiting

  const supabase = createClient()
  const save = useSave()
  const { toast } = useToast()

  // Planos ativos (por ordem). Lê plans; o cliente aponta pra um via plano_id.
  useEffect(() => {
    supabase.from('plans').select('id, nome, valor_semanal').eq('ativo', true).order('ordem')
      .then(({ data }) => {
        const list = (data ?? []) as Plan[]
        setPlans(list)
        setForm(prev => prev.plano_id ? prev : { ...prev, plano_id: list[0]?.id ?? '' })
      })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pagamentos por cliente (client_payments). select('*') é tolerante: se a coluna `anulado`
  // ainda não existir no banco, simplesmente vem undefined (tratado como não-anulada).
  useEffect(() => {
    supabase.from('client_payments').select('*').then(({ data }) => {
      const map: Record<string, ClientPayment[]> = {}
      for (const r of data ?? []) (map[(r as { client_id: string }).client_id] ??= []).push(r as unknown as ClientPayment)
      setPayments(map)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const reloadPayments = async (clientId: string) => {
    const { data } = await supabase.from('client_payments').select('*').eq('client_id', clientId)
    setPayments(prev => ({ ...prev, [clientId]: (data ?? []) as unknown as ClientPayment[] }))
  }

  // Cotação efetiva (mesma do /api/fx) — congela no lançamento, nunca 0.
  const getRate = async (): Promise<number> => {
    try {
      const res = await fetch('/api/fx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
      if (res.ok) { const d = await res.json(); const r = Number(d.effective); if (r > 0) return r }
    } catch { /* fallback abaixo */ }
    return 5.40
  }
  // Marca a próxima semana VENCIDA (date-gated em payDueWeeks: paid_on = data real; nunca futura).
  // Guarda síncrona anti-duplo-clique (como no agente).
  const handleMarkWeek = async (client: Client) => {
    if (payBusyRef.current) return
    payBusyRef.current = true; setPayBusyId(client.id)
    try {
      const r = await payDueWeeks(supabase, client.id, await getRate(), 1)
      if (r.marked.length === 0) { toast({ type: 'error', message: r.reason === 'inativo' ? 'Cliente inativo — congelado.' : 'Nenhuma semana vencida até hoje.' }); return }
      await reloadPayments(client.id)
    } finally { payBusyRef.current = false; setPayBusyId(null) }
  }

  // "Pagar o mês" = marca as semanas VENCIDAS até hoje (no máx. 4), via payDueWeeks. Nunca futura.
  const handlePayMonth = async (client: Client) => {
    if (payBusyRef.current) return
    payBusyRef.current = true; setPayBusyId(client.id)
    try {
      const r = await payDueWeeks(supabase, client.id, await getRate(), 4)
      if (r.marked.length === 0) { toast({ type: 'error', message: r.reason === 'inativo' ? 'Cliente inativo — congelado.' : 'Nenhuma semana vencida até hoje.' }); return }
      await reloadPayments(client.id)
    } finally { payBusyRef.current = false; setPayBusyId(null) }
  }

  // Estorno: anula a semana (receita) + remove a comissão derivada. Confirmação leve.
  const handleVoidWeek = async (client: Client, numero: number) => {
    if (payBusyRef.current) return
    if (!window.confirm(`Anular a semana ${numero} de ${client.name}? A comissão dessa semana também sai.`)) return
    payBusyRef.current = true; setPayBusyId(client.id)
    try {
      const res = await voidClientWeek(supabase, client.id, numero)
      if (!res.ok) { toast({ type: 'error', message: 'Não foi possível anular a semana.' }); return }
      await reloadPayments(client.id)
    } finally { payBusyRef.current = false; setPayBusyId(null) }
  }

  // Gatilho manual do agendador NESTE cliente (testa o caminho server-side antes de ligar pra todos).
  const handleRunAuto = async (client: Client) => {
    if (payBusyRef.current) return
    payBusyRef.current = true; setPayBusyId(client.id)
    try {
      const res = await fetch('/api/commission/auto', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ clientId: client.id }) })
      const j = await res.json().catch(() => ({}))
      await reloadPayments(client.id)
      toast({ type: j?.ok ? 'success' : 'error', message: j?.result ? `Auto: ${j.result}` : (j?.ok ? 'Auto executado.' : 'Falha ao rodar o auto.') })
    } catch {
      toast({ type: 'error', message: 'Falha ao rodar o auto (rede).' })
    } finally { payBusyRef.current = false; setPayBusyId(null) }
  }

  const togglePay = (id: string) => setPayOpenId(payOpenId === id ? null : id)

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
  const planOf   = (c: Client) => plans.find(p => p.id === c.plano_id)
  const mrr      = clients.filter(c => c.status === 'ativo').reduce((sum, c) => sum + (planOf(c)?.valor_semanal ?? c.plan_weekly) * 4, 0)

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()

    // Rate limiting: máximo 1 criação por segundo
    const now = Date.now()
    if (now - lastCreateTime < 1000) {
      return
    }

    const createPlan = plans.find(p => p.id === form.plano_id) ?? plans[0]
    setLoading(true)
    const { ok, data } = await save<Client>({
      run: () => supabase.from('clients').insert({
        name: form.name,
        company: form.company || null,
        email: form.email || null,
        phone: form.phone || null,
        plano_id: createPlan?.id ?? null,
        plan_weekly: createPlan?.valor_semanal ?? 140,
        status: 'ativo',
        start_date: new Date().toISOString().slice(0, 10),
        assigned_name: currentUser.name,
        nicho: form.nicho.trim() || null,
        fuso: form.fuso || null,
      }).select().single(),
      success: 'Cliente criado.',
      error: 'Não foi possível criar o cliente',
    })

    if (ok && data) {
      setClients(prev => [data, ...prev])
      setLastCreateTime(Date.now()) // Rate limiting
      await supabase.from('activities').insert({
        type: 'client',
        description: `Novo cliente ativo: ${form.name}`,
        user_name: currentUser.name,
        entity_id: data.id,
      })
      setNewOpen(false)
      setForm({ name: '', company: '', email: '', phone: '', plano_id: plans[0]?.id ?? '', fuso: '', nicho: '' })
    }
    setLoading(false)
  }

  const handleSaveEdit = async () => {
    if (!editClient) return
    const target = editClient
    setLoading(true)
    const editPlan = plans.find(p => p.id === editForm.plano_id)
    const patch = {
      name: editForm.name || target.name,
      company: editForm.company || undefined,
      email: editForm.email || undefined,
      phone: editForm.phone || undefined,
      plano_id: editForm.plano_id || target.plano_id || null,
      plan_weekly: editPlan?.valor_semanal ?? target.plan_weekly,
      nicho: editForm.nicho.trim() || null,
      fuso: editForm.fuso || null,
    }
    const { ok } = await save({
      optimistic: () => setClients(prev => prev.map(c => c.id === target.id ? ({ ...c, ...patch } as Client) : c)),
      run: () => updateClient(supabase, target.id, {
        name: patch.name,
        company: editForm.company || null,
        email: editForm.email || null,
        phone: editForm.phone || null,
        plano_id: patch.plano_id,
        plan_weekly: patch.plan_weekly,
        nicho: patch.nicho,
        fuso: patch.fuso,
      }),
      rollback: () => setClients(prev => prev.map(c => c.id === target.id ? target : c)),
      success: 'Cliente atualizado.',
      error: 'Não foi possível salvar o cliente',
    })
    if (ok) setEditClient(null)
    setLoading(false)
  }

  const handleAddJob = async (client: Client) => {
    const job = jobInput.trim()
    if (!job) return
    const jobs = [...(client.jobs ?? []), job]
    const prevJobs = client.jobs
    setJobInput('')
    await save({
      optimistic: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, jobs } : c)),
      run: () => supabase.from('clients').update({ jobs }).eq('id', client.id),
      rollback: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, jobs: prevJobs } : c)),
      error: 'Não foi possível adicionar o serviço',
    })
  }

  const handleRemoveJob = async (client: Client, idx: number) => {
    const jobs = (client.jobs ?? []).filter((_, i) => i !== idx)
    const prevJobs = client.jobs
    await save({
      optimistic: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, jobs } : c)),
      run: () => supabase.from('clients').update({ jobs }).eq('id', client.id),
      rollback: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, jobs: prevJobs } : c)),
      error: 'Não foi possível remover o serviço',
    })
  }

  const handleInativar = async (client: Client) => {
    const reason = window.prompt(`Motivo para inativar ${client.name}?`)
    if (reason === null) return
    const { ok } = await save({
      optimistic: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'inativo' as const } : c)),
      run: () => supabase.from('clients').update({
        status: 'inativo', end_date: new Date().toISOString().slice(0, 10), end_reason: reason,
      }).eq('id', client.id),
      rollback: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: client.status } : c)),
      success: 'Cliente inativado.',
      error: 'Não foi possível inativar o cliente',
    })
    if (ok) {
      await supabase.from('activities').insert({
        type: 'client',
        description: `Cliente inativado: ${client.name}. Motivo: ${reason}`,
        user_name: currentUser.name,
        entity_id: client.id,
      })
    }
  }

  const handleReativar = async (client: Client) => {
    await save({
      optimistic: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'ativo' as const } : c)),
      run: () => supabase.from('clients').update({ status: 'ativo', end_date: null }).eq('id', client.id),
      rollback: () => setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: client.status } : c)),
      success: 'Cliente reativado.',
      error: 'Não foi possível reativar o cliente',
    })
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

  // Foco vindo da aba Contatos: expande o cliente + rola até ele (loadActivities não colapsa se ainda fechado).
  useEffect(() => {
    if (!focusClientId) return
    if (expandedId !== focusClientId) loadActivities(focusClientId)
    requestAnimationFrame(() => document.getElementById(`cli-row-${focusClientId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }))
    onFocusHandled?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusClientId])

  // Handlers passados ao ClientRow (escopo de módulo).
  const openEdit = (client: Client) => {
    setEditClient(client)
    setEditForm({ name: client.name, company: client.company ?? '', email: client.email ?? '', phone: client.phone ?? '', plano_id: client.plano_id ?? '', fuso: client.fuso ?? '', nicho: client.nicho ?? '' })
  }
  const toggleJobs = (id: string) => { setEditingJobsId(editingJobsId === id ? null : id); setJobInput('') }

  const rowProps = {
    plans,
    payments, payOpenId, payBusyId,
    onTogglePay: togglePay, onMarkWeek: handleMarkWeek, onPayMonth: handlePayMonth,
    onVoidWeek: handleVoidWeek, onRunAuto: handleRunAuto,
    editingJobsId, jobInput, expandedId, activities, loadingActivities,
    onEdit: openEdit, onToggleJobs: toggleJobs, setJobInput,
    onAddJob: handleAddJob, onRemoveJob: handleRemoveJob,
    onToggleActivities: loadActivities, onReativar: handleReativar, onInativar: handleInativar,
  }

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-5 animate-fade-in font-body">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-bento-text tracking-tight">Clientes</h1>
          <p className="text-bento-muted text-sm mt-0.5">Contratos ativos e histórico</p>
        </div>
        <button onClick={() => setNewOpen(true)}
          className="bento-btn flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Cliente
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'MRR Total',          value: formatCurrency(mrr, 'en-US', 'USD'),              color: 'text-lime-fg',   accent: 'before:bg-lime' },
          { label: 'Contratos Ativos',   value: clients.filter(c => c.status === 'ativo').length, color: 'text-green-400', accent: 'before:bg-green-500' },
          { label: 'Contratos Inativos', value: clients.filter(c => c.status === 'inativo').length, color: 'text-bento-muted', accent: 'before:bg-slate-500' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.accent}`}>
            <p className="text-xs text-bento-muted font-medium">{s.label}</p>
            <p className={`font-display text-2xl font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-bento-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        </svg>
        <input value={search} onChange={e => setSearch(e.target.value)}
          placeholder="Buscar por nome, empresa, email..."
          className="w-full pl-9 pr-3 py-2 bg-bento-bg border border-bento-border rounded-btn text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime" />
      </div>

      {/* Ativos */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500" />
          <h2 className="text-sm font-semibold text-bento-text">Contratos Ativos</h2>
          <span className="text-xs text-bento-muted">({ativos.length})</span>
        </div>
        <div className="space-y-2">
          {ativos.length === 0 ? (
            <p className="text-sm text-bento-muted py-4 text-center">Nenhum cliente ativo.</p>
          ) : ativos.map(c => <ClientRow key={c.id} client={c} {...rowProps} />)}
        </div>
      </div>

      {/* Inativos */}
      {inativos.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3">
            <span className="w-1.5 h-1.5 rounded-full bg-slate-500" />
            <h2 className="text-sm font-semibold text-bento-muted">Contratos Inativos</h2>
            <span className="text-xs text-bento-muted">({inativos.length})</span>
          </div>
          <div className="space-y-2">
            {inativos.map(c => <ClientRow key={c.id} client={c} inactive {...rowProps} />)}
          </div>
        </div>
      )}

      {/* Modal novo cliente */}
      {newOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-bento-border">
              <h2 className="font-display font-bold text-bento-text">Novo Cliente</h2>
              <button onClick={() => setNewOpen(false)} className="text-bento-muted hover:text-bento-text transition-colors">
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
                  <label className="block text-xs font-medium text-bento-dim mb-1">{f.label}</label>
                  <input required={f.req} value={form[f.k as keyof typeof form]}
                    onChange={e => set(f.k, e.target.value)} placeholder={f.ph} className={inputCls} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Plano</label>
                <select value={form.plano_id} onChange={e => set('plano_id', e.target.value)} className={inputCls}>
                  {plans.length === 0 && <option value="">Carregando…</option>}
                  {plans.map(p => <option key={p.id} value={p.id}>{p.nome} — ${p.valor_semanal}/sem</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Nicho</label>
                <input value={form.nicho} onChange={e => set('nicho', e.target.value)} placeholder="Ex: Roofing, HVAC..." className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Fuso horário</label>
                <select value={form.fuso} onChange={e => set('fuso', e.target.value)} className={inputCls}>
                  <option value="">Sem fuso</option>
                  {FUSO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setNewOpen(false)}
                  className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50">
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
          <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-bento-border">
              <h2 className="font-display font-bold text-bento-text">Editar Cliente</h2>
              <button onClick={() => setEditClient(null)} className="text-bento-muted hover:text-bento-text transition-colors">
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
                  <label className="block text-xs font-medium text-bento-dim mb-1">{f.label}</label>
                  <input
                    value={editForm[f.k as keyof typeof editForm]}
                    onChange={e => setEditForm(p => ({ ...p, [f.k]: e.target.value }))}
                    placeholder={f.ph}
                    className={inputCls}
                  />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Plano</label>
                <select value={editForm.plano_id} onChange={e => setEditForm(prev => ({ ...prev, plano_id: e.target.value }))} className={inputCls}>
                  {plans.map(p => <option key={p.id} value={p.id}>{p.nome} — ${p.valor_semanal}/sem</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Nicho</label>
                <input value={editForm.nicho} onChange={e => setEditForm(p => ({ ...p, nicho: e.target.value }))} placeholder="Ex: Roofing, HVAC..." className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Fuso horário</label>
                <select value={editForm.fuso} onChange={e => setEditForm(p => ({ ...p, fuso: e.target.value }))} className={inputCls}>
                  <option value="">Sem fuso</option>
                  {FUSO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={() => setEditClient(null)}
                  className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors">
                  Cancelar
                </button>
                <button onClick={handleSaveEdit} disabled={loading}
                  className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50">
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
