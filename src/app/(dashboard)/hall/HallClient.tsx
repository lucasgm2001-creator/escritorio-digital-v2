'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn, timeAgo } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import { LiveDot } from '@/components/bento/LiveDot'
import { AgentChat } from './AgentChat'
import { NewsSection } from './NewsSection'
import { Maximize2, X, Trash2, Check, Clock } from 'lucide-react'
import type { Activity, Notice } from '@/types'
import type { Task, LinkOption } from '../tarefas/types'
import { TarefasClient } from '../tarefas/TarefasClient'
import { Calendar } from './Calendar'
import { type CalendarEvent } from './calendarShared'
import { dayBR } from './dateBR'

type Tab = 'activities' | 'tarefas' | 'agent'

interface Props {
  initialActivities: Activity[]
  initialNotices: Notice[]
  initialTasks: Task[]
  linkOptions: LinkOption[]
  userName: string
  userId: string
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  client: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  payment: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  task: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  campaign: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  system: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
}

// Status semânticos (não-acento): cores próprias preservadas nos dois temas.
const ACTIVITY_COLORS: Record<string, string> = {
  lead:     'bg-blue-900/40 text-blue-400',
  client:   'bg-lime/15 text-lime-fg',
  payment:  'bg-green-900/40 text-green-400',
  task:     'bg-amber-900/40 text-amber-400',
  campaign: 'bg-purple-900/40 text-purple-400',
  system:   'bg-slate-800/60 text-slate-400',
}

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  lead: 'Leads', client: 'Clientes', payment: 'Pagamentos',
  task: 'Tarefas', campaign: 'Campanhas', system: 'Sistema',
}

const NOTICE_BORDER: Record<string, string> = {
  info:    'border-blue-800/50 bg-blue-900/20',
  warning: 'border-amber-800/50 bg-amber-900/20',
  urgent:  'border-red-800/50 bg-red-900/20',
}

const NOTICE_LABEL: Record<string, string> = { info: 'Info', warning: 'Atenção', urgent: 'Urgente' }
const NOTICE_PILL: Record<string, string> = {
  info:    'bg-blue-900/40 text-blue-400 border-blue-800/50',
  warning: 'bg-amber-900/40 text-amber-400 border-amber-800/50',
  urgent:  'bg-red-900/40 text-red-400 border-red-800/50',
}

function computeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

// Linha de evento de agenda no Mural (compacta, 1 linha; toca pra abrir no Calendar).
function MuralAgendaRow({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-2 text-left rounded-bento border border-lime/30 px-3 py-2 hover:border-lime/60 transition-colors">
      <Clock className="w-3.5 h-3.5 text-lime-fg flex-none" />
      <span className="text-sm text-bento-text truncate flex-1 min-w-0">{ev.title}</span>
      {ev.start_time && <span className="font-tech text-[11px] text-bento-muted flex-none tabular-nums">{ev.start_time.slice(0, 5)}</span>}
    </button>
  )
}

// Linha de tarefa no Mural (compacta, 1 linha). O Mural mostra só tarefas de HOJE pendentes,
// então o ponto lime = "do dia". Título trunca em 1 linha. Toca → aba Tarefas.
function MuralTaskRow({ task, onClick }: { task: Task; onClick: () => void }) {
  const hora = task.due_time ? task.due_time.slice(0, 5) : ''
  return (
    <button type="button" onClick={onClick}
      className="w-full flex items-center gap-2 text-left rounded-bento border border-bento-border px-3 py-2 hover:border-lime/60 transition-colors">
      <span className="w-1.5 h-1.5 rounded-full bg-lime flex-none" />
      <span className="text-sm text-bento-text truncate flex-1 min-w-0">{task.title}</span>
      {hora && <span className="font-tech text-[11px] text-bento-muted flex-none tabular-nums">{hora}</span>}
    </button>
  )
}

// Modal "ver histórico": abre com os itens já em memória (view maior) e, no botão
// "Ver histórico", busca o histórico PERSISTIDO inteiro da tabela (activities/notices).
function HistoryModal({ kind, initial, onClose }: {
  kind: 'activities' | 'notices'
  initial: (Activity | Notice)[]
  onClose: () => void
}) {
  const [items, setItems] = useState<(Activity | Notice)[]>(initial)
  const [full, setFull] = useState(false)
  const [loading, setLoading] = useState(false)

  const loadFull = async () => {
    setLoading(true)
    const supabase = createClient()
    const { data } = await supabase.from(kind).select('*').order('created_at', { ascending: false }).limit(500)
    if (data) setItems(data as (Activity | Notice)[])
    setFull(true)
    setLoading(false)
  }

  const title = kind === 'activities' ? 'Atividade Recente' : 'Mural de Avisos'

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full max-w-lg max-h-[82vh] bg-bento-panel border border-bento-border rounded-bento shadow-card-hover flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-bento-border shrink-0">
          <h3 className="font-display font-bold text-bento-text">{title}</h3>
          <div className="flex items-center gap-2">
            {!full && (
              <button onClick={loadFull} disabled={loading}
                className="font-tech text-[11px] uppercase tracking-wide text-lime-fg hover:text-lime transition-colors font-semibold disabled:opacity-50">
                {loading ? 'Carregando…' : 'Ver histórico'}
              </button>
            )}
            <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors"><X className="w-4 h-4" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {items.length === 0 ? (
            <p className="text-sm text-bento-muted text-center py-10">Nada {kind === 'activities' ? 'registrado' : 'no mural'} ainda.</p>
          ) : kind === 'activities' ? (
            <div className="divide-y divide-bento-border/60">
              {(items as Activity[]).map(a => (
                <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>{ACTIVITY_ICONS[a.type]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-bento-text leading-snug">{a.description}</p>
                    <p className="font-tech text-xs text-bento-muted mt-0.5">{a.user_name ? `${a.user_name} · ` : ''}{timeAgo(a.created_at)}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-2.5">
              {(items as Notice[]).map(n => (
                <div key={n.id} className={`rounded-bento border p-3 ${NOTICE_BORDER[n.priority] ?? 'border-bento-border'}`}>
                  <div className="flex items-center justify-between mb-1 gap-2">
                    <p className="text-sm font-semibold text-bento-text">{n.title}</p>
                    <span className={`shrink-0 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${NOTICE_PILL[n.priority] ?? 'border-bento-border text-bento-muted'}`}>{NOTICE_LABEL[n.priority] ?? n.priority}</span>
                  </div>
                  {n.content && <p className="text-xs text-bento-dim">{n.content}</p>}
                  {n.author_name && <p className="font-tech text-xs text-bento-muted/70 mt-1">— {n.author_name} · {timeAgo(n.created_at)}</p>}
                </div>
              ))}
            </div>
          )}
          {full && <p className="font-tech text-[10px] text-bento-muted text-center pt-3">Histórico completo · {items.length} {items.length === 1 ? 'registro' : 'registros'}</p>}
        </div>
      </div>
    </div>
  )
}

// ─── Main HallClient ──────────────────────────────────────────────────────────

export function HallClient({ initialActivities, initialNotices, initialTasks, linkOptions, userName, userId }: Props) {
  const [activeTab, setActiveTab]     = useState<Tab>('activities')
  const [activities, setActivities]   = useState<Activity[]>(initialActivities)
  const [notices, setNotices]         = useState<Notice[]>(initialNotices)
  // Reflete dados frescos do servidor após router.refresh() (revalidação ao focar a aba).
  // Realtime continua atualizando entre refreshes; aqui só reconcilia com a verdade do server.
  useEffect(() => { setActivities(initialActivities); setNotices(initialNotices) }, [initialActivities, initialNotices])
  const [greeting, setGreeting]       = useState('')
  const [today, setToday]             = useState('')
  const [onlineUsers, setOnlineUsers] = useState<{ id: string; name: string }[]>([{ id: userId, name: userName }])
  const [onlineOpen, setOnlineOpen] = useState(false)
  const [history, setHistory] = useState<null | 'activities' | 'notices'>(null)
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [noticeForm, setNoticeForm]   = useState({ title: '', content: '', priority: 'info' as 'info' | 'warning' | 'urgent' })
  const [savingNotice, setSavingNotice] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null)   // aviso aguardando confirmação
  const [deletingNotice, setDeletingNotice] = useState<string | null>(null) // aviso sendo excluído
  const [calEvents, setCalEvents]     = useState<CalendarEvent[]>([])
  const [focusEvent, setFocusEvent]   = useState<CalendarEvent | null>(null)
  const [counts, setCounts]           = useState({ leads: 0, clientes: 0 })
  const [activitiesExpanded, setActivitiesExpanded] = useState(false)
  const [muralVerMais, setMuralVerMais] = useState(false)   // Mural: revela o resto das tarefas de hoje
  const router = useRouter()

  // App pessoal de usuário único: acesso total.
  const canPostNotice = true

  // Deep-link: /hall?tab=tarefas (vindo do redirect de /tarefas) abre a aba certa.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'tarefas' || t === 'agent' || t === 'activities') setActiveTab(t as Tab)
  }, [])

  useEffect(() => {
    setGreeting(computeGreeting())
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  // Contagens p/ os KPIs (Leads/Clientes) — head count, barato.
  useEffect(() => {
    const supabase = createClient()
    Promise.all([
      supabase.from('leads').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('status', 'ativo'),
    ]).then(([l, c]) => setCounts({ leads: l.count ?? 0, clientes: c.count ?? 0 }))
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.from('calendar_events').select('*').eq('user_id', userId).order('date').then(({ data }) => {
      if (data) setCalEvents(data as CalendarEvent[])
    })

    // Tarefas do Mural vêm de initialTasks (mesma fonte da Agenda) — sem carga separada aqui.

    const dataChannel = supabase.channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        p => setActivities(prev => [p.new as Activity, ...prev.slice(0, 19)]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' },
        p => setNotices(prev => [p.new as Notice, ...prev.slice(0, 9)]))
      .on('postgres_changes', { event: 'DELETE', schema: 'public', table: 'notices' },
        p => setNotices(prev => prev.filter(n => n.id !== (p.old as { id?: string }).id)))
      .subscribe()

    const presenceChannel = supabase.channel('hall-presence', { config: { presence: { key: userId } } })
    presenceChannel
      .on('presence', { event: 'sync' }, () => {
        const state = presenceChannel.presenceState() as Record<string, Array<{ user_id?: string; name?: string }>>
        const seen = new Map<string, string>()
        for (const arr of Object.values(state)) for (const p of arr) {
          if (p.user_id) seen.set(p.user_id, p.name || 'Usuário')
        }
        const list = Array.from(seen, ([id, name]) => ({ id, name }))
        setOnlineUsers(list.length ? list : [{ id: userId, name: userName }])
      })
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ user_id: userId, name: userName })
      })

    return () => {
      dataChannel.unsubscribe().then(() => supabase.removeChannel(dataChannel))
      presenceChannel.unsubscribe().then(() => supabase.removeChannel(presenceChannel))
    }
  }, [userId, userName])

  const handlePostNotice = async () => {
    if (!noticeForm.title.trim()) return
    setSavingNotice(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('notices').insert({ ...noticeForm, author_id: userId, author_name: userName })
      if (error) { alert('Erro ao postar aviso.'); setSavingNotice(false); return }
      setNoticeForm({ title: '', content: '', priority: 'info' })
      setShowNoticeForm(false)
    } finally {
      setSavingNotice(false)
    }
  }

  // Exclui só o aviso (notices). NÃO toca em activities. RLS já permite delete (migration 005).
  const handleDeleteNotice = async (id: string) => {
    setDeletingNotice(id)
    const supabase = createClient()
    const { error } = await supabase.from('notices').delete().eq('id', id)
    if (error) { alert('Não foi possível excluir o aviso.'); setDeletingNotice(null); return }
    setNotices(prev => prev.filter(n => n.id !== id))
    setConfirmDelete(null)
    setDeletingNotice(null)
  }

  // ── Mural ↔ Agenda: MESMA fonte (initialTasks, idêntica à do Calendar) ──────────
  // Toda tarefa com data que aparece na Agenda aparece aqui também. Ordem: atrasadas →
  // próximas (por data) → concluídas (apagadas). Mantém os eventos de HOJE e os avisos.
  const hojeStr = dayBR(new Date())
  // Mural ENXUTO: só o DIA. Tarefas de HOJE pendentes (data civil de Brasília) — atrasadas, futuras
  // e concluídas NÃO entram (a Agenda continua mostrando tudo). Eventos de hoje + avisos seguem.
  const MURAL_LIMIT = 4
  const tarefasHoje = initialTasks
    .filter(t => t.due_date === hojeStr && !t.done)
    .sort((a, b) => (a.due_time || '99:99').localeCompare(b.due_time || '99:99'))
  const tarefasHojeVis = muralVerMais ? tarefasHoje : tarefasHoje.slice(0, MURAL_LIMIT)
  const eventosHoje = calEvents.filter(e => e.date === hojeStr).sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'))
  const muralVazio = tarefasHoje.length + eventosHoje.length + notices.length === 0

  const todaySP = dayBR(new Date())
  // KPIs do dia (reusa dados já carregados): tarefas de hoje pendentes + próximas reuniões na agenda.
  const tasksToday = initialTasks.filter(t => t.due_date === todaySP && !t.done).length
  const reunioesUpcoming = calEvents.filter(e => e.type === 'reuniao' && e.date >= todaySP).length

  // Proporção por tipo de atividade (funil → barras de proporção).
  const typeCounts = Object.entries(
    activities.reduce<Record<string, number>>((acc, a) => { acc[a.type] = (acc[a.type] ?? 0) + 1; return acc }, {})
  ).sort((a, b) => b[1] - a[1])
  const maxType = Math.max(1, ...typeCounts.map(([, c]) => c))

  const TABS = [
    {
      id: 'activities' as Tab, label: 'Visão Geral',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      id: 'tarefas' as Tab, label: 'Tarefas',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
    },
    {
      id: 'agent' as Tab, label: 'Agente',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
    },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-4 animate-fade-in font-body">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl sm:text-2xl font-bold text-bento-text tracking-tight">
            {greeting ? `${greeting}, ${userName}` : userName}
          </h1>
          <p className="text-bento-muted mt-0.5 capitalize text-sm">{today}</p>
        </div>
        <div className="relative">
          <button onClick={() => setOnlineOpen(o => !o)}
            className="flex items-center gap-2 rounded-full border border-bento-border bg-bento-panel px-3 py-1.5 hover:border-lime transition-colors">
            <LiveDot />
            <span className="font-tech text-xs font-medium text-lime-fg tabular-nums">{onlineUsers.length} online</span>
          </button>
          {onlineOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setOnlineOpen(false)} />
              <div className="absolute right-0 top-10 z-40 w-52 bg-bento-panel border border-bento-border rounded-bento shadow-card-hover py-1.5">
                <p className="px-3 py-1 font-tech text-[10px] uppercase tracking-wide text-bento-muted">Online agora</p>
                {onlineUsers.map(u => (
                  <div key={u.id} className="flex items-center gap-2 px-3 py-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-lime flex-none" />
                    <span className="text-sm text-bento-text truncate">{u.name}{u.id === userId ? ' (você)' : ''}</span>
                  </div>
                ))}
                {/* TODO(presença): vem do Supabase Realtime e conta só quem está com o
                    Hall aberto — não reflete quem está logado em outras telas. Evoluir
                    com last_seen/heartbeat se precisar de presença global. */}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bento-border">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-lime text-lime-fg' : 'border-transparent text-bento-muted hover:text-bento-text'
            }`}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Canvas com grade técnica — todos os painéis vivem aqui dentro */}
      <div className="bento-canvas p-4 sm:p-5 space-y-4">

        {activeTab === 'activities' && (
          <>
            {/* KPIs — faixa fina (label + número numa linha) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                { label: 'Leads',        value: counts.leads },
                { label: 'Clientes',     value: counts.clientes },
                { label: 'Tarefas hoje', value: tasksToday },
                { label: 'Reuniões',     value: reunioesUpcoming },
              ].map(k => (
                <div key={k.label} className="bento-fx px-3 py-2 flex items-baseline justify-between gap-2">
                  <span className="font-tech text-[11px] uppercase tracking-wide text-bento-muted truncate">{k.label}</span>
                  <span className="font-display text-xl font-bold text-bento-text tabular-nums leading-none">{k.value}</span>
                </div>
              ))}
            </div>

            {/* AGENDA — full width, altura NATURAL (sem stretch/h-full → sem buraco no modo Semanal) */}
            <Calendar userId={userId} events={calEvents} tasks={initialTasks} onEventsChange={setCalEvents} focusEvent={focusEvent} onFocusHandled={() => setFocusEvent(null)} />

            {/* ATIVIDADES RECENTES + MURAL — lado a lado, mesma altura */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-stretch">
              <Panel className="h-full" label="Atividades Recentes" action={
                <div className="flex items-center gap-2">
                  <button onClick={() => setHistory('activities')} aria-label="Ampliar e ver histórico"
                    className="text-bento-muted hover:text-lime-fg transition-colors"><Maximize2 className="w-3.5 h-3.5" /></button>
                  <LiveDot />
                </div>
              }>
                {/* Resumo por tipo — barras de proporção */}
                {typeCounts.length > 0 && (
                  <div className="space-y-2 mb-4 pb-4 border-b border-bento-border/60">
                    <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Atividades por tipo</p>
                    {typeCounts.slice(0, 4).map(([type, count], i) => (
                      <div key={type}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs text-bento-dim">{ACTIVITY_TYPE_LABELS[type] ?? type}</span>
                          <span className="font-tech text-xs font-semibold text-bento-text tabular-nums">{String(count).padStart(2, '0')}</span>
                        </div>
                        <div className="bento-track">
                          <div className={cn('bento-fill', i === 0 ? '' : i < 2 ? 'dim' : 'mut')} style={{ width: `${(count / maxType) * 100}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div className="space-y-0 divide-y divide-bento-border/60">
                  {activities.length === 0 ? (
                    <p className="text-sm text-bento-muted py-6 text-center">Nenhuma atividade ainda.</p>
                  ) : activities.slice(0, activitiesExpanded ? activities.length : 3).map(a => {
                    const entityId = (a as { entity_id?: string | null }).entity_id
                    const clickable = a.type === 'lead' && !!entityId
                    return (
                    <div key={a.id}
                      onClick={clickable ? () => router.push(`/comercial?lead=${entityId}`) : undefined}
                      role={clickable ? 'button' : undefined}
                      tabIndex={clickable ? 0 : undefined}
                      className={cn('flex items-start gap-3 py-3 first:pt-0 last:pb-0',
                        clickable && 'cursor-pointer hover:bg-bento-bg/50 rounded-md -mx-1.5 px-1.5 transition-colors')}>
                      <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>
                        {ACTIVITY_ICONS[a.type]}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-bento-text leading-snug">{a.description}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {a.user_name && <><p className="text-xs text-bento-muted">{a.user_name}</p><span className="text-bento-muted/50 text-xs">·</span></>}
                          <p className="font-tech text-xs text-bento-muted">{timeAgo(a.created_at)}</p>
                        </div>
                      </div>
                    </div>
                    )
                  })}
                </div>
                {activities.length > 3 && (
                  <button type="button" onClick={() => setActivitiesExpanded(v => !v)}
                    className="font-tech text-[11px] uppercase tracking-wide text-lime-fg hover:text-lime transition-colors font-semibold mt-3 self-start">
                    {activitiesExpanded ? 'Ver menos' : `Ver mais (${activities.length - 3})`}
                  </button>
                )}
              </Panel>

              <Panel
                className="h-full"
                label="Mural de Avisos"
                action={
                  <div className="flex items-center gap-2.5">
                    {canPostNotice && (
                      <button onClick={() => setShowNoticeForm(!showNoticeForm)}
                        className="font-tech text-[11px] uppercase tracking-wide text-lime-fg hover:text-lime transition-colors font-semibold flex items-center gap-1">
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Postar
                      </button>
                    )}
                    <button onClick={() => setHistory('notices')} aria-label="Ampliar e ver histórico"
                      className="text-bento-muted hover:text-lime-fg transition-colors"><Maximize2 className="w-3.5 h-3.5" /></button>
                  </div>
                }
              >
                <div className="space-y-2.5">
                  {showNoticeForm && (
                    <div className="bg-bento-bg border border-bento-border rounded-bento p-3 space-y-2 mb-3">
                      <input value={noticeForm.title} onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))}
                        placeholder="Título" className="w-full bg-bento-panel border border-bento-border rounded-btn px-3 py-1.5 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime" />
                      <textarea value={noticeForm.content} onChange={e => setNoticeForm(p => ({ ...p, content: e.target.value }))}
                        placeholder="Mensagem..." rows={2}
                        className="w-full bg-bento-panel border border-bento-border rounded-btn px-3 py-1.5 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime resize-none" />
                      <div className="flex gap-1.5">
                        {(['info','warning','urgent'] as const).map(p => (
                          <button key={p} onClick={() => setNoticeForm(prev => ({ ...prev, priority: p }))}
                            className={`flex-1 py-1 rounded-md text-xs font-medium border transition-all ${
                              noticeForm.priority === p ? NOTICE_PILL[p] : 'bg-transparent text-bento-muted border-bento-border'
                            }`}>
                            {NOTICE_LABEL[p]}
                          </button>
                        ))}
                        <button onClick={handlePostNotice} disabled={savingNotice || !noticeForm.title.trim()}
                          className="bento-btn px-3 py-1 rounded-btn text-xs font-semibold disabled:opacity-50">
                          {savingNotice ? '...' : 'OK'}
                        </button>
                      </div>
                    </div>
                  )}
                  {muralVazio
                    ? <p className="text-sm text-bento-muted py-6 text-center">Nenhuma tarefa para hoje.</p>
                    : <>
                    {/* Só o DIA: eventos de hoje + tarefas de hoje (máx 4 + "ver mais") + avisos. */}
                    {eventosHoje.map(ev => (
                      <MuralAgendaRow key={`ev-${ev.id}`} ev={ev} onClick={() => setFocusEvent(ev)} />
                    ))}
                    {tarefasHojeVis.map(t => (
                      <MuralTaskRow key={`tk-${t.id}`} task={t} onClick={() => router.push('/tarefas')} />
                    ))}
                    {tarefasHoje.length > MURAL_LIMIT && (
                      <button type="button" onClick={() => setMuralVerMais(v => !v)}
                        className="w-full text-center font-tech text-[11px] text-bento-muted hover:text-lime-fg py-1 transition-colors">
                        {muralVerMais ? 'ver menos' : `ver mais (${tarefasHoje.length - MURAL_LIMIT})`}
                      </button>
                    )}
                    {notices.map(n => (
                      <div key={n.id} className={`rounded-bento border p-3 ${NOTICE_BORDER[n.priority] ?? 'border-bento-border'}`}>
                        <div className="flex items-center justify-between mb-1 gap-2">
                          <p className="text-sm font-semibold text-bento-text truncate">{n.title}</p>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${NOTICE_PILL[n.priority] ?? 'border-bento-border text-bento-muted'}`}>
                              {NOTICE_LABEL[n.priority] ?? n.priority}
                            </span>
                            {confirmDelete === n.id ? (
                              <span className="flex items-center gap-1">
                                <button onClick={() => handleDeleteNotice(n.id)} disabled={deletingNotice === n.id}
                                  className="p-1 rounded-btn text-red-400 hover:bg-red-900/20 disabled:opacity-50 transition-colors" aria-label="Confirmar exclusão" title="Confirmar exclusão">
                                  <Check className="w-3.5 h-3.5" />
                                </button>
                                <button onClick={() => setConfirmDelete(null)} disabled={deletingNotice === n.id}
                                  className="p-1 rounded-btn text-bento-muted hover:text-bento-text hover:bg-bento-bg disabled:opacity-50 transition-colors" aria-label="Cancelar" title="Cancelar">
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </span>
                            ) : (
                              <button onClick={() => setConfirmDelete(n.id)}
                                className="p-1 rounded-btn text-bento-muted hover:text-red-400 hover:bg-red-900/20 transition-colors" aria-label="Excluir aviso" title="Excluir aviso">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-xs text-bento-dim">{n.content}</p>
                        {n.author_name && <p className="font-tech text-xs text-bento-muted/70 mt-1">— {n.author_name} · {timeAgo(n.created_at)}</p>}
                      </div>
                    ))}
                    </>
                  }
                </div>
              </Panel>
            </div>

            {/* NOTÍCIAS DO SETOR — full width embaixo, em grid (pode ocupar altura sem desequilibrar) */}
            <NewsSection />
          </>
        )}

        {activeTab === 'tarefas' && (
          <TarefasClient initialTasks={initialTasks} linkOptions={linkOptions} currentUser={{ id: userId, name: userName }} />
        )}

        {activeTab === 'agent' && (
          <div className="bento-fx h-[600px] overflow-hidden">
            <AgentChat userId={userId} userName={userName} />
          </div>
        )}

      </div>

      {history && (
        <HistoryModal kind={history} initial={history === 'activities' ? activities : notices} onClose={() => setHistory(null)} />
      )}
    </div>
  )
}
