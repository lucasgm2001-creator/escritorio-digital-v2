'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/system/TimeAgo'
import { Panel } from '@/components/bento/Panel'
import { LiveDot } from '@/components/bento/LiveDot'
import { AgentChat } from './AgentChat'
import { NewsSection } from './NewsSection'
import { CollapsibleSection } from '@/components/mobile/CollapsibleSection'
import { X, Clock, CalendarDays, Activity as ActivityIcon, Newspaper } from 'lucide-react'
import type { Activity, Notice } from '@/types'
import type { Task, LinkOption } from '../tarefas/types'
import type { Lead } from '../comercial/types'
import type { Client } from '../clientes/ClientesClient'
import { TarefasClient } from '../tarefas/TarefasClient'
import { RelatorioComercial } from '../tarefas/RelatorioComercial'
import { ErrorBoundary } from '@/components/system/ErrorBoundary'
import { Calendar } from './Calendar'
import { type CalendarEvent } from './calendarShared'
import { dayBR } from './dateBR'
import dynamic from 'next/dynamic'
import { getHallSettings, DEFAULT_HALL_SETTINGS, HALL_SETTINGS_EVENT, type HallSettings } from '@/lib/hallSettings'
// Mapa pesado (geografia us-map.json) — só no client, sob demanda.
const MapaTab = dynamic(() => import('../comercial/tabs/MapaTab').then(m => ({ default: m.MapaTab })), { ssr: false })

type Tab = 'activities' | 'mapa' | 'tarefas' | 'relatorio' | 'agent'

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
function HistoryModal({ kind, onClose }: {
  kind: 'activities' | 'notices'
  onClose: () => void
}) {
  const PAGE = 200
  const [items, setItems] = useState<(Activity | Notice)[]>([])
  const [loading, setLoading] = useState(false)
  const [hasMore, setHasMore] = useState(true)

  // Pagina do banco do mais recente pro mais antigo (lotes de 200, via .range). Só leitura.
  const loadMore = async () => {
    if (loading) return
    setLoading(true)
    const supabase = createClient()
    const from = items.length
    const { data } = await supabase.from(kind).select('*')
      .order('created_at', { ascending: false }).range(from, from + PAGE - 1)
    const rows = (data ?? []) as (Activity | Notice)[]
    setItems(prev => [...prev, ...rows])
    setHasMore(rows.length === PAGE)
    setLoading(false)
  }
  // Carrega o 1º lote ao abrir; "Carregar mais" busca os próximos.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { loadMore() }, [])

  const title = kind === 'activities' ? 'Atividade Recente' : 'Mural de Avisos'

  return (
    <div className="fixed inset-0 z-[90] flex items-stretch sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative w-full h-full sm:h-auto sm:max-w-lg sm:max-h-[82vh] bg-bento-panel border border-bento-border rounded-none sm:rounded-bento shadow-card-hover flex flex-col overflow-hidden">
        <div className="flex items-center justify-between gap-3 p-4 border-b border-bento-border shrink-0">
          <h3 className="font-display font-bold text-bento-text">{title} — Histórico</h3>
          <button onClick={onClose} aria-label="Fechar" className="p-1.5 rounded-lg text-bento-muted hover:text-bento-text hover:bg-bento-bg transition-colors"><X className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">
          {loading && items.length === 0 ? (
            <p className="text-sm text-bento-muted text-center py-10">Carregando histórico…</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-bento-muted text-center py-10">Nada {kind === 'activities' ? 'registrado' : 'no mural'} ainda.</p>
          ) : kind === 'activities' ? (
            <div className="divide-y divide-bento-border/60">
              {(items as Activity[]).map(a => (
                <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0">
                  <div className={`w-7 h-7 rounded-md flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>{ACTIVITY_ICONS[a.type]}</div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-bento-text leading-snug">{a.description}</p>
                    <p className="font-tech text-xs text-bento-muted mt-0.5">{a.user_name ? `${a.user_name} · ` : ''}<TimeAgo date={a.created_at} /></p>
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
                  {n.author_name && <p className="font-tech text-xs text-bento-muted/70 mt-1">— {n.author_name} · <TimeAgo date={n.created_at} /></p>}
                </div>
              ))}
            </div>
          )}
          {items.length > 0 && (
            <div className="pt-3 text-center">
              {hasMore ? (
                <button onClick={loadMore} disabled={loading}
                  className="font-tech text-[11px] uppercase tracking-wide text-lime-fg hover:text-lime transition-colors font-semibold disabled:opacity-50 min-h-[36px]">
                  {loading ? 'Carregando…' : 'Carregar mais'}
                </button>
              ) : (
                <p className="font-tech text-[10px] text-bento-muted">Fim do histórico · {items.length} {items.length === 1 ? 'registro' : 'registros'}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main HallClient ──────────────────────────────────────────────────────────

export function HallClient({ initialActivities, initialTasks, linkOptions, userName, userId }: Props) {
  const [activeTab, setActiveTab]     = useState<Tab>('activities')
  const [activities, setActivities]   = useState<Activity[]>(initialActivities)
  // Reflete dados frescos do servidor após router.refresh() (revalidação ao focar a aba).
  useEffect(() => { setActivities(initialActivities) }, [initialActivities])
  const [greeting, setGreeting]       = useState('')
  const [today, setToday]             = useState('')
  const [history, setHistory] = useState<null | 'activities' | 'notices'>(null)
  const [calEvents, setCalEvents]     = useState<CalendarEvent[]>([])
  const [focusEvent, setFocusEvent]   = useState<CalendarEvent | null>(null)
  const [activitiesExpanded, setActivitiesExpanded] = useState(false)
  // Mapa + métricas (leads/clientes do banco) e config da Visão Geral (por usuário).
  const [mapLeads, setMapLeads]   = useState<Lead[]>([])
  const [mapClients, setMapClients] = useState<Client[]>([])
  const [hallCfg, setHallCfg]     = useState<HallSettings>(DEFAULT_HALL_SETTINGS)
  const router = useRouter()

  // Deep-link: /hall?tab=tarefas (vindo do redirect de /tarefas) abre a aba certa.
  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('tab')
    if (t === 'tarefas' || t === 'agent' || t === 'activities' || t === 'mapa' || t === 'relatorio') setActiveTab(t as Tab)
  }, [])

  useEffect(() => {
    setGreeting(computeGreeting())
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  // Config da Visão Geral (por usuário, localStorage) — lida no client p/ não dar hydration mismatch.
  useEffect(() => {
    const sync = () => setHallCfg(getHallSettings(userId))
    sync()
    window.addEventListener(HALL_SETTINGS_EVENT, sync)
    window.addEventListener('storage', sync)
    return () => { window.removeEventListener(HALL_SETTINGS_EVENT, sync); window.removeEventListener('storage', sync) }
  }, [userId])

  // Leads + clientes p/ o MAPA e as MÉTRICAS (campos leves). Agenda em paralelo + realtime de atividades.
  useEffect(() => {
    const supabase = createClient()
    supabase.from('leads').select('id, name, status, state, area_code, created_at').then(({ data }) => { if (data) setMapLeads(data as unknown as Lead[]) })
    supabase.from('clients').select('id, name, status, state, area_code').then(({ data }) => { if (data) setMapClients(data as unknown as Client[]) })
    supabase.from('calendar_events').select('*').eq('user_id', userId).order('date').then(({ data }) => { if (data) setCalEvents(data as CalendarEvent[]) })

    const dataChannel = supabase.channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        p => setActivities(prev => [p.new as Activity, ...prev.slice(0, 19)]))
      .subscribe()
    return () => { dataChannel.unsubscribe().then(() => supabase.removeChannel(dataChannel)) }
  }, [userId])

  // ── Mural ↔ Agenda: MESMA fonte (initialTasks, idêntica à do Calendar) ──────────
  // Toda tarefa com data que aparece na Agenda aparece aqui também. Ordem: atrasadas →
  // próximas (por data) → concluídas (apagadas). Mantém os eventos de HOJE e os avisos.
  // Tarefas/eventos de HOJE (data civil de Brasília) — alimentam a coluna "Tarefas de hoje" (com hora).
  const hojeStr = dayBR(new Date())
  const tarefasHoje = initialTasks
    .filter(t => t.due_date === hojeStr && !t.done)
    .sort((a, b) => (a.due_time || '99:99').localeCompare(b.due_time || '99:99'))
  const eventosHoje = calEvents.filter(e => e.date === hojeStr).sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'))

  // Métricas da Visão Geral — do banco (leads/clientes). Conversão coerente com o funil.
  const clientesAtivos = mapClients.filter(c => c.status === 'ativo').length
  const leadsAbertos = mapLeads.filter(l => !['fechado', 'perdido', 'lixeira'].includes(l.status)).length
  const leadsNovos = mapLeads.filter(l => l.created_at && new Date(l.created_at).getTime() >= Date.now() - 7 * 86400000).length
  const conversao = (clientesAtivos + leadsAbertos) > 0 ? Math.round((clientesAtivos / (clientesAtivos + leadsAbertos)) * 100) : 0
  const METRICS: { key: keyof HallSettings['metrics']; label: string; value: string; mobile: boolean }[] = [
    { key: 'clientesAtivos', label: 'Clientes ativos', value: String(clientesAtivos), mobile: true },
    { key: 'leadsAbertos', label: 'Leads em aberto', value: String(leadsAbertos), mobile: true },
    { key: 'leadsNovos', label: 'Leads novos', value: String(leadsNovos), mobile: false },
    { key: 'conversao', label: 'Conversão', value: `${conversao}%`, mobile: false },
  ]

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
      id: 'mapa' as Tab, label: 'Mapa',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17.657 16.657L13.414 20.9a2 2 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><circle cx="12" cy="11" r="2.5" strokeWidth={1.75} /></svg>,
    },
    {
      id: 'tarefas' as Tab, label: 'Tarefas',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" /></svg>,
    },
    {
      id: 'relatorio' as Tab, label: 'Relatório',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>,
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
      </div>

      {/* Tabs — rola NA HORIZONTAL no mobile (sem quebrar linha) e fica fixo no topo (segue o scroll). */}
      <div className="flex flex-nowrap gap-1 border-b border-bento-border overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sticky top-0 z-20 bg-background">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors shrink-0 whitespace-nowrap ${
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
            {/* (a) AGENDA SEMANAL — topo, largura cheia. No mobile rola na horizontal (dentro do Calendar). */}
            {hallCfg.blocks.agenda && (
              <CollapsibleSection title="Agenda" icon={CalendarDays} defaultOpen>
                <Calendar userId={userId} events={calEvents} tasks={initialTasks} onEventsChange={setCalEvents} focusEvent={focusEvent} onFocusHandled={() => setFocusEvent(null)} />
              </CollapsibleSection>
            )}

            {/* (b) Tarefas de hoje (esq) · Atividade recente (dir). No mobile empilha. */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 items-start">
              {hallCfg.blocks.tarefas && (
                <CollapsibleSection title="Tarefas de hoje" icon={CalendarDays} defaultOpen>
                  <Panel className="h-full max-lg:p-3" headerClassName="max-lg:hidden" label="Tarefas de hoje">
                    <div className="space-y-2">
                      {eventosHoje.length === 0 && tarefasHoje.length === 0
                        ? <p className="text-sm text-bento-muted py-6 text-center">Nada para hoje.</p>
                        : <>
                            {eventosHoje.map(ev => <MuralAgendaRow key={`ev-${ev.id}`} ev={ev} onClick={() => setFocusEvent(ev)} />)}
                            {tarefasHoje.map(t => <MuralTaskRow key={`tk-${t.id}`} task={t} onClick={() => router.push('/tarefas')} />)}
                          </>}
                    </div>
                  </Panel>
                </CollapsibleSection>
              )}
              {hallCfg.blocks.atividade && (
              <CollapsibleSection title="Atividades Recentes" icon={ActivityIcon}>
                <Panel className="h-full max-lg:p-3" headerClassName="max-lg:hidden" label="Atividades Recentes" action={<LiveDot />}>
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
                          <p className="font-tech text-xs text-bento-muted"><TimeAgo date={a.created_at} /></p>
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
                <button type="button" onClick={() => setHistory('activities')}
                  className="mt-3 pt-3 border-t border-bento-border/60 w-full text-center font-tech text-[11px] uppercase tracking-wide text-bento-muted hover:text-lime-fg transition-colors">
                  Ver histórico
                </button>
                </Panel>
              </CollapsibleSection>
              )}
            </div>

            {/* (c) NOTÍCIAS — largura cheia. TODO(feed): a FONTE das notícias é a definir; hoje usa o
                feed real da tabela `news` (NewsSection). Trocar por outro provedor quando definido. */}
            {hallCfg.blocks.noticias && (
              <CollapsibleSection title="Notícias do Setor" icon={Newspaper}>
                <NewsSection />
              </CollapsibleSection>
            )}
          </>
        )}

        {activeTab === 'mapa' && (
          <>
            {/* 4 cards de métricas (do banco) — todos os habilitados, inclusive no mobile (2×2). */}
            {METRICS.some(m => hallCfg.metrics[m.key]) && (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {METRICS.filter(m => hallCfg.metrics[m.key]).map(m => (
                  <div key={m.key} className="bento-fx px-3 py-2.5 flex flex-col gap-1">
                    <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted truncate">{m.label}</span>
                    <span className="font-display text-2xl font-bold text-bento-text tabular-nums leading-none">{m.value}</span>
                  </div>
                ))}
              </div>
            )}
            {/* Mapa CHEIO — largura do conteúdo (máx ~1000px centralizado) e bem alto. Sem botão tela cheia. */}
            <Panel className="max-lg:p-3" headerClassName="max-lg:hidden" label="Mapa de Clientes e Leads">
              <div className="h-[440px] sm:h-[560px] max-w-[1000px] mx-auto">
                <ErrorBoundary>
                  <MapaTab embedded leads={mapLeads} clients={mapClients} showLeads={hallCfg.map.leads} showClients={hallCfg.map.clients} showFusos={hallCfg.map.fusos} />
                </ErrorBoundary>
              </div>
            </Panel>
          </>
        )}

        {activeTab === 'tarefas' && (
          <TarefasClient initialTasks={initialTasks} linkOptions={linkOptions} currentUser={{ id: userId, name: userName }} />
        )}

        {activeTab === 'relatorio' && (
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-5">
            <ErrorBoundary>
              <RelatorioComercial />
            </ErrorBoundary>
          </div>
        )}

        {activeTab === 'agent' && (
          <div className="bento-fx h-[600px] overflow-hidden">
            <AgentChat userId={userId} userName={userName} />
          </div>
        )}

      </div>

      {history && (
        <HistoryModal kind={history} onClose={() => setHistory(null)} />
      )}
    </div>
  )
}
