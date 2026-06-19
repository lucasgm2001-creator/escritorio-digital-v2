'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn, timeAgo } from '@/lib/utils'
import { Panel } from '@/components/bento/Panel'
import { LiveDot } from '@/components/bento/LiveDot'
import { AgentChat } from './AgentChat'
import { NewsSection } from './NewsSection'
import { Maximize2, X, Trash2, Check, Clock, CalendarDays } from 'lucide-react'
import type { Activity, Notice } from '@/types'
import type { Task, LinkOption } from '../tarefas/types'
import { TarefasClient } from '../tarefas/TarefasClient'

type Tab = 'activities' | 'tarefas' | 'agent'

interface Props {
  initialActivities: Activity[]
  initialNotices: Notice[]
  initialTasks: Task[]
  linkOptions: LinkOption[]
  userName: string
  userId: string
}

interface CalendarEvent {
  id: string
  user_id: string
  title: string
  date: string
  start_time?: string
  end_time?: string
  description?: string
  type: 'reuniao' | 'ligacao' | 'tarefa' | 'outro'
  color: string
  created_at: string
}

type CalendarView = 'annual' | 'monthly' | 'weekly' | 'daily'

const EVENT_TYPE_LABELS: Record<string, string> = {
  reuniao: 'Reunião',
  ligacao: 'Ligação',
  tarefa: 'Tarefa',
  outro: 'Outro',
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

function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

// Dia (YYYY-MM-DD) no fuso de Brasília — pra contar "hoje" certo, zerando 00:00 BRT.
function saoPauloDay(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}

// Linha de evento de agenda no Mural (read-only; toca pra abrir o detalhe no Calendar).
function MuralAgendaRow({ ev, onClick }: { ev: CalendarEvent; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick}
      className="w-full text-left rounded-bento border border-bento-border p-3 hover:border-lime/60 transition-colors">
      <div className="flex items-center justify-between mb-1 gap-2">
        <p className="text-sm font-semibold text-bento-text truncate">{ev.title}</p>
        <span className="shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border border-lime/40 text-lime-fg font-semibold">
          <Clock className="w-3 h-3" /> Agenda
        </span>
      </div>
      <p className="font-tech text-xs text-bento-dim">
        {ev.start_time ? ev.start_time.slice(0, 5) : 'Hoje'}{ev.description ? ` · ${ev.description}` : ''}
      </p>
    </button>
  )
}

// Linha de tarefa no Mural — MESMA fonte da Agenda. Cor COM significado:
// vermelho = atrasada · lime = no prazo · cinza/apagada = concluída. Toca → aba Tarefas.
type TaskState = 'overdue' | 'ontime' | 'done'
function MuralTaskRow({ task, state, onClick }: { task: Task; state: TaskState; onClick: () => void }) {
  const hora = task.due_time ? task.due_time.slice(0, 5) : ''
  const dia = task.due_date ? `${task.due_date.slice(8, 10)}/${task.due_date.slice(5, 7)}` : ''
  const overdue = state === 'overdue', done = state === 'done'
  return (
    <button type="button" onClick={onClick}
      className={cn('w-full text-left rounded-bento border p-3 transition-colors',
        overdue ? 'border-red-800/50 bg-red-900/10 hover:border-red-700/70'
          : done ? 'border-bento-border/50 opacity-60 hover:opacity-100'
          : 'border-bento-border hover:border-lime/60')}>
      <div className="flex items-center justify-between mb-1 gap-2">
        <p className={cn('text-sm font-semibold truncate', done ? 'text-bento-muted line-through' : 'text-bento-text')}>{task.title}</p>
        <span className={cn('shrink-0 inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold',
          overdue ? 'border-red-700/50 text-red-400'
            : done ? 'border-bento-border text-bento-muted'
            : 'border-lime/40 text-lime-fg')}>
          {done ? <Check className="w-3 h-3" /> : <Clock className="w-3 h-3" />} Tarefa
        </span>
      </div>
      <p className={cn('font-tech text-xs', overdue ? 'text-red-400' : done ? 'text-bento-muted' : 'text-bento-dim')}>
        {overdue ? `Atrasada · ${hora ? `${hora} · ` : ''}${dia}`
          : done ? `Concluída · ${dia}`
          : `${dia}${hora ? ` · ${hora}` : ''}`}
      </p>
    </button>
  )
}

function getWeekDays(referenceDate: Date): { label: string; date: Date; dateStr: string }[] {
  const jsDay = referenceDate.getDay()
  const daysToMonday = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(referenceDate)
  monday.setDate(monday.getDate() + daysToMonday)
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
  return labels.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { label, date: d, dateStr: toDateStr(d) }
  })
}

function getMonthDays(year: number, month: number): { date: Date; dateStr: string; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  const jsDay = firstDay.getDay()
  const daysToMonday = jsDay === 0 ? -6 : 1 - jsDay
  startDate.setDate(startDate.getDate() + daysToMonday)

  const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push({ date: d, dateStr: toDateStr(d), isCurrentMonth: d.getMonth() === month })
  }
  return days
}

function getHourSlots(): { hour: number; label: string }[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hour: i + 6,
    label: `${String(i + 6).padStart(2, '0')}:00`,
  }))
}

const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
const MONTH_ABBR  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// Campos de formulário no estilo Bento (superfícies theme-aware + foco no acento).
const bentoInput = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// ─── Event Modal ──────────────────────────────────────────────────────────────

interface EventModalProps {
  date: Date
  hour?: number
  userId: string
  onClose: () => void
  onSaved: (event: CalendarEvent) => void
}

// Fecha modal no ESC (além do X e do clique fora). Reusado pelos modais da Agenda.
function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

function EventModal({ date, hour, userId, onClose, onSaved }: EventModalProps) {
  const [form, setForm] = useState({
    title: '',
    date: toDateStr(date),
    start_time: hour != null ? `${String(hour).padStart(2,'0')}:00` : '',
    end_time: hour != null ? `${String(hour + 1).padStart(2,'0')}:00` : '',
    description: '',
    type: 'reuniao' as CalendarEvent['type'],
    color: '#C2F73A',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const colors = ['#C2F73A','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Título é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase.from('calendar_events').insert({
        user_id: userId,
        title: form.title.trim(),
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        description: form.description || null,
        type: form.type,
        color: form.color,
      }).select().single()

      if (err) {
        console.error('[calendar_events.insert] Error:', err)
        setError(`Erro ao salvar evento: ${err.message}`)
        setSaving(false)
        return
      }
      onSaved(data as CalendarEvent)
      onClose()
    } catch (error) {
      console.error('[calendar_events.insert] Unexpected error:', error)
      setError(error instanceof Error ? `Erro ao salvar evento: ${error.message}` : 'Erro ao salvar evento.')
      setSaving(false)
    }
  }

  useEscape(onClose)

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div onClick={e => e.stopPropagation()} className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-bento-border">
          <h2 className="font-display font-bold text-bento-text text-base">Novo Evento</h2>
          <button onClick={onClose} className="text-bento-muted hover:text-bento-text transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Título *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Reunião com cliente" className={bentoInput} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Data</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={bentoInput} />
            </div>
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as CalendarEvent['type'] }))}
                className={bentoInput}>
                {Object.entries(EVENT_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Início</label>
              <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className={bentoInput} />
            </div>
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Fim</label>
              <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className={bentoInput} />
            </div>
          </div>

          <div>
            <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Descrição (opcional)</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Detalhes do evento..." rows={2}
              className={`${bentoInput} resize-none`} />
          </div>

          <div>
            <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Cor</label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-bento-text ring-offset-2 ring-offset-bento-panel' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors min-h-[44px]">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Event Detail Modal ───────────────────────────────────────────────────────

function EventDetailModal({ event, onClose, onDelete }: { event: CalendarEvent; onClose: () => void; onDelete: (id: string) => void }) {
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()
    const { error } = await supabase.from('calendar_events').delete().eq('id', event.id)
    if (error) {
      setDeleting(false)
      toast({ type: 'error', message: `Não foi possível excluir o evento: ${error.message}` })
      return
    }
    onDelete(event.id)
    onClose()
  }

  useEscape(onClose)

  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div onClick={e => e.stopPropagation()} className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-sm animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-bento-border">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
            <h2 className="font-display font-bold text-bento-text text-base">{event.title}</h2>
          </div>
          <button onClick={onClose} className="text-bento-muted hover:text-bento-text transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-bento-dim">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </div>
          {(event.start_time || event.end_time) && (
            <div className="flex items-center gap-2 text-sm text-bento-dim">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {event.start_time?.slice(0,5)} {event.end_time ? `– ${event.end_time.slice(0,5)}` : ''}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-bento-dim">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {EVENT_TYPE_LABELS[event.type]}
          </div>
          {event.description && (
            <p className="text-sm text-bento-dim bg-bento-bg rounded-btn px-3 py-2">{event.description}</p>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="w-full mt-2 border border-red-800/50 text-red-400 py-2 rounded-btn text-sm hover:bg-red-900/20 transition-colors disabled:opacity-50 min-h-[44px]">
            {deleting ? 'Excluindo...' : 'Excluir evento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Detalhe do DIA (tarefas + eventos). Fecha por X, ESC, clique fora — e o toggle (clicar
// de novo no mesmo dia) é tratado no onClick do dia. Read-only.
function DayDetailModal({ dateStr, events, tasks, todayStr, onClose }: {
  dateStr: string; events: CalendarEvent[]; tasks: Task[]; todayStr: string; onClose: () => void
}) {
  useEscape(onClose)
  const titulo = new Date(dateStr + 'T12:00:00').toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })
  return (
    <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div onClick={e => e.stopPropagation()} className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md max-h-[85vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-bento-border">
          <h2 className="font-display font-bold text-bento-text text-base capitalize">{titulo}</h2>
          <button onClick={onClose} aria-label="Fechar" className="text-bento-muted hover:text-bento-text transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-4">
          {tasks.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Tarefas</p>
              {tasks.map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className={cn('w-2 h-2 rounded-full flex-none', t.done ? 'bg-bento-muted' : (t.due_date ?? '') < todayStr ? 'bg-red-500' : 'bg-lime')} />
                  <span className={cn('text-sm flex-1 min-w-0', t.done ? 'line-through text-bento-muted' : 'text-bento-text')}>{t.title}</span>
                  {t.due_time && <span className="font-tech text-[11px] text-bento-muted flex-none">{t.due_time.slice(0, 5)}</span>}
                </div>
              ))}
            </div>
          )}
          {events.length > 0 && (
            <div className="space-y-1.5">
              <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Eventos</p>
              {events.map(e => (
                <div key={e.id} className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-sm flex-none" style={{ backgroundColor: e.color }} />
                  <span className="text-sm flex-1 min-w-0 text-bento-text">{e.title}</span>
                  {e.start_time && <span className="font-tech text-[11px] text-bento-muted flex-none">{e.start_time.slice(0, 5)}</span>}
                </div>
              ))}
            </div>
          )}
          {tasks.length === 0 && events.length === 0 && (
            <p className="text-sm text-bento-muted text-center py-4">Nada neste dia.</p>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Calendar Component ───────────────────────────────────────────────────────

interface CalendarProps {
  userId: string
  events: CalendarEvent[]
  tasks: Task[]
  onEventsChange: (events: CalendarEvent[]) => void
  focusEvent?: CalendarEvent | null
  onFocusHandled?: () => void
}

function Calendar({ userId, events, tasks, onEventsChange, focusEvent, onFocusHandled }: CalendarProps) {
  const now = new Date()
  const todayStr = toDateStr(now)

  const [view, setView]           = useState<CalendarView>('weekly')
  const [selectedYear, setYear]   = useState(now.getFullYear())
  const [selectedMonth, setMonth] = useState(now.getMonth())
  const [weekBase, setWeekBase]   = useState(now)
  const [dailyDate, setDailyDate] = useState(now)

  const [eventModal, setEventModal]   = useState<{ date: Date; hour?: number } | null>(null)
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)

  // Abre o detalhe (read-only) quando o Mural pede foco num evento; limpa o pedido no pai.
  useEffect(() => {
    if (focusEvent) { setDetailEvent(focusEvent); onFocusHandled?.() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusEvent])

  const eventsMap = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    (acc[ev.date] = acc[ev.date] ?? []).push(ev)
    return acc
  }, {})

  // Tarefas por dia (mesma fonte do Mural: tabela tasks; casa pelo dia civil due_date, sem fuso).
  const [selectedDay, setSelectedDay] = useState<string | null>(null)
  const tasksByDay = tasks.reduce<Record<string, Task[]>>((acc, t) => {
    if (t.due_date) (acc[t.due_date] = acc[t.due_date] ?? []).push(t)
    return acc
  }, {})

  const handleEventSaved = (ev: CalendarEvent) => {
    onEventsChange([...events, ev])
  }
  const handleEventDeleted = (id: string) => {
    onEventsChange(events.filter(e => e.id !== id))
  }

  const navigate = (dir: -1 | 1) => {
    if (view === 'annual') {
      setYear(y => y + dir)
    } else if (view === 'monthly') {
      const d = new Date(selectedYear, selectedMonth + dir, 1)
      setYear(d.getFullYear()); setMonth(d.getMonth())
    } else if (view === 'weekly') {
      const d = new Date(weekBase)
      d.setDate(d.getDate() + dir * 7)
      setWeekBase(d)
    } else {
      const d = new Date(dailyDate)
      d.setDate(d.getDate() + dir)
      setDailyDate(d)
    }
  }

  const breadcrumb = () => {
    if (view === 'annual') return String(selectedYear)
    if (view === 'monthly') return `${selectedYear} — ${MONTH_NAMES[selectedMonth]}`
    if (view === 'weekly') {
      const days = getWeekDays(weekBase)
      return `Semana de ${days[0].date.getDate()}/${days[0].date.getMonth()+1}`
    }
    return `${selectedYear} — ${MONTH_NAMES[dailyDate.getMonth()]} — ${dailyDate.getDate()}`
  }

  // ── Annual view ──────────────────────────────────────────────────────────
  const AnnualView = () => (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
      {Array.from({ length: 12 }, (_, i) => {
        const isCurrentMonth = now.getFullYear() === selectedYear && i === now.getMonth()
        const monthStr = `${selectedYear}-${String(i + 1).padStart(2, '0')}`
        const hasEvents = events.some(e => e.date.startsWith(monthStr))
        const monthHasTasks = tasks.some(t => !t.done && (t.due_date ?? '').startsWith(monthStr))
        return (
          <button key={i} onClick={() => { setMonth(i); setView('monthly') }}
            className={`rounded-bento p-3 border text-center transition-all hover:border-lime/60 cursor-pointer ${
              isCurrentMonth ? 'bg-lime/15 border-lime/40' : 'bg-bento-bg border-bento-border'
            }`}>
            <p className={`font-display text-sm font-bold capitalize ${isCurrentMonth ? 'text-lime-fg' : 'text-bento-text'}`}>
              {MONTH_ABBR[i]}
            </p>
            {(hasEvents || monthHasTasks) && (
              <div className="flex justify-center items-center gap-0.5 mt-1.5">
                {events.filter(e => e.date.startsWith(monthStr)).slice(0, 3).map(e => (
                  <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                ))}
                {monthHasTasks && <span className="w-1.5 h-1.5 rounded-full bg-lime" />}
              </div>
            )}
          </button>
        )
      })}
    </div>
  )

  // ── Monthly view ─────────────────────────────────────────────────────────
  const MonthlyView = () => {
    const days = getMonthDays(selectedYear, selectedMonth)
    return (
      <div>
        <div className="grid grid-cols-7 gap-1 mb-1">
          {['Seg','Ter','Qua','Qui','Sex','Sab','Dom'].map(d => (
            <div key={d} className="text-center font-tech text-[10px] uppercase tracking-[0.12em] font-semibold text-bento-muted py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ date, dateStr, isCurrentMonth }, i) => {
            const dayEvents = eventsMap[dateStr] ?? []
            const pend = (tasksByDay[dateStr] ?? []).filter(t => !t.done)
            const isToday = dateStr === todayStr
            return (
              <button key={i} onClick={() => setSelectedDay(s => s === dateStr ? null : dateStr)}
                className={`rounded-md p-1.5 min-h-[56px] border text-left transition-all hover:border-lime/50 ${
                  isToday ? 'bg-lime/15 border-lime/40' :
                  selectedDay === dateStr ? 'border-lime/60 bg-bento-bg' :
                  isCurrentMonth ? 'bg-bento-bg border-bento-border' : 'bg-transparent border-bento-border/40'
                }`}>
                <span className={`font-display text-xs font-medium ${
                  isToday ? 'text-lime-fg' : isCurrentMonth ? 'text-bento-text' : 'text-bento-muted/50'
                }`}>{date.getDate()}</span>
                <div className="flex flex-wrap items-center gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map(e => (
                    <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                  ))}
                  {pend.length > 0 && <span className={cn('w-1.5 h-1.5 rounded-full', pend.some(t => (t.due_date ?? '') < todayStr) ? 'bg-red-500' : 'bg-lime')} />}
                </div>
                {pend.length > 0 && <span className="block text-[9px] text-bento-dim leading-tight truncate mt-0.5">{pend[0].title}{pend.length > 1 ? ` +${pend.length - 1}` : ''}</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  // ── Weekly view ──────────────────────────────────────────────────────────
  const WeeklyView = () => {
    const days = getWeekDays(weekBase)
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 snap-x sm:grid sm:grid-cols-7 sm:overflow-visible sm:pb-0">
        {days.map(({ label, date, dateStr }) => {
          const dayEvents = eventsMap[dateStr] ?? []
          const pend = (tasksByDay[dateStr] ?? []).filter(t => !t.done)
          const isToday = dateStr === todayStr
          return (
            <button key={dateStr} onClick={() => setSelectedDay(s => s === dateStr ? null : dateStr)}
              className={`min-w-[88px] shrink-0 snap-start sm:min-w-0 sm:shrink rounded-bento p-3 border text-center transition-all hover:border-lime/60 cursor-pointer ${
                isToday ? 'bg-lime/15 border-lime/40' : selectedDay === dateStr ? 'border-lime/60 bg-bento-bg' : 'bg-bento-bg border-bento-border'
              }`}>
              <p className={`font-tech text-[10px] uppercase tracking-[0.12em] ${isToday ? 'text-lime-fg' : 'text-bento-muted'}`}>{label}</p>
              <p className={`font-display text-xl font-bold mt-1 tabular-nums ${isToday ? 'text-lime-fg' : 'text-bento-text'}`}>
                {date.getDate()}
              </p>
              {dayEvents.length > 0 && (
                <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                  {dayEvents.slice(0, 3).map(e => (
                    <span key={e.id} className="w-2 h-2 rounded-sm" style={{ backgroundColor: e.color }} />
                  ))}
                  {dayEvents.length > 3 && <span className="text-[9px] text-bento-muted w-full text-center">+{dayEvents.length - 3}</span>}
                </div>
              )}
              {pend.length > 0 && (
                <div className="mt-1.5 space-y-0.5 text-left">
                  {pend.slice(0, 2).map(t => (
                    <div key={t.id} className="flex items-center gap-1">
                      <span className={cn('w-1.5 h-1.5 rounded-full flex-none', (t.due_date ?? '') < todayStr ? 'bg-red-500' : 'bg-lime')} />
                      <span className="text-[9px] text-bento-dim leading-tight truncate">{t.title}</span>
                    </div>
                  ))}
                  {pend.length > 2 && <span className="block text-[9px] text-bento-muted">+{pend.length - 2}</span>}
                </div>
              )}
            </button>
          )
        })}
      </div>
    )
  }

  // ── Daily view ───────────────────────────────────────────────────────────
  const DailyView = () => {
    const dailyStr = toDateStr(dailyDate)
    const dayEvents = eventsMap[dailyStr] ?? []
    const dayTasks = tasksByDay[dailyStr] ?? []
    const slots = getHourSlots()
    const currentHour = now.getHours()

    return (
      <div className="space-y-1">
        {dayTasks.length > 0 && (
          <div className="mb-3 rounded-bento border border-bento-border bg-bento-bg p-3 space-y-1.5">
            <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Tarefas do dia</p>
            {dayTasks.map(t => (
              <div key={t.id} className="flex items-center gap-2">
                <span className={cn('w-1.5 h-1.5 rounded-full flex-none', t.done ? 'bg-bento-muted' : (t.due_date ?? '') < todayStr ? 'bg-red-500' : 'bg-lime')} />
                <span className={cn('text-xs flex-1 min-w-0 truncate', t.done ? 'line-through text-bento-muted' : 'text-bento-text')}>{t.title}</span>
                {t.due_time && <span className="font-tech text-[10px] text-bento-muted">{t.due_time.slice(0, 5)}</span>}
              </div>
            ))}
          </div>
        )}
        {slots.map(({ hour, label }) => {
          const slotEvents = dayEvents.filter(e => {
            if (!e.start_time) return false
            const h = parseInt(e.start_time.split(':')[0], 10)
            return h === hour
          })
          const isNow = dailyStr === todayStr && currentHour === hour

          return (
            <div key={hour} className="flex gap-3">
              <span className={`font-tech text-xs tabular-nums w-12 pt-2 shrink-0 text-right ${isNow ? 'text-lime-fg font-semibold' : 'text-bento-muted/60'}`}>
                {label}
              </span>
              <button onClick={() => setEventModal({ date: dailyDate, hour })}
                className={`flex-1 min-h-[40px] rounded-md border text-left px-3 py-1.5 transition-all hover:border-lime/50 group ${
                  isNow ? 'bg-lime/10 border-lime/30' : 'bg-bento-bg border-bento-border'
                }`}>
                {slotEvents.length > 0 ? (
                  <div className="space-y-0.5">
                    {slotEvents.map(e => (
                      <div key={e.id} onClick={ev => { ev.stopPropagation(); setDetailEvent(e) }}
                        className="flex items-center gap-2 cursor-pointer">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: e.color }} />
                        <span className="text-xs font-medium text-bento-text">{e.title}</span>
                        <span className="text-[10px] text-bento-muted">{EVENT_TYPE_LABELS[e.type]}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-transparent group-hover:text-bento-muted/60 transition-colors">
                    + adicionar evento
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <>
      <section className="bento-fx p-5">
        <div className="flex items-center gap-2 mb-3">
          <CalendarDays className="w-4 h-4 text-lime-fg" />
          <h2 className="font-display font-bold text-bento-text text-sm tracking-tight">Agenda</h2>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2">
            <button onClick={() => navigate(-1)}
              className="p-1.5 rounded-md hover:bg-bento-bg text-bento-muted hover:text-bento-text transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="font-display text-sm font-semibold text-bento-text">{breadcrumb()}</span>
            <button onClick={() => navigate(1)}
              className="p-1.5 rounded-md hover:bg-bento-bg text-bento-muted hover:text-bento-text transition-colors">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <div className="flex gap-1 flex-wrap">
            {(['daily','weekly','monthly','annual'] as CalendarView[]).map(v => (
              <button key={v} onClick={() => setView(v)}
                className={`px-2.5 py-1 rounded-md font-tech text-[11px] uppercase tracking-wide font-medium transition-all ${
                  view === v ? 'bg-lime text-lime-ink' : 'bg-bento-bg text-bento-muted border border-bento-border hover:border-lime'
                }`}>
                {v === 'daily' ? 'Diário' : v === 'weekly' ? 'Semanal' : v === 'monthly' ? 'Mensal' : 'Anual'}
              </button>
            ))}
          </div>
        </div>
        <div>
          {view === 'annual'  && <AnnualView />}
          {view === 'monthly' && <MonthlyView />}
          {view === 'weekly'  && <WeeklyView />}
          {view === 'daily'   && <DailyView />}
        </div>
      </section>

      {eventModal && (
        <EventModal
          date={eventModal.date}
          hour={eventModal.hour}
          userId={userId}
          onClose={() => setEventModal(null)}
          onSaved={handleEventSaved}
        />
      )}

      {detailEvent && (
        <EventDetailModal
          event={detailEvent}
          onClose={() => setDetailEvent(null)}
          onDelete={handleEventDeleted}
        />
      )}

      {selectedDay && (
        <DayDetailModal
          dateStr={selectedDay}
          events={eventsMap[selectedDay] ?? []}
          tasks={tasksByDay[selectedDay] ?? []}
          todayStr={todayStr}
          onClose={() => setSelectedDay(null)}
        />
      )}
    </>
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
  const hojeStr = saoPauloDay(new Date())
  const sortByDate = (a: Task, b: Task) =>
    ((a.due_date || '') + (a.due_time || '99:99')).localeCompare((b.due_date || '') + (b.due_time || '99:99'))
  const tarefasComData    = initialTasks.filter(t => !!t.due_date)
  const tarefasAtrasadas  = tarefasComData.filter(t => !t.done && (t.due_date as string) <  hojeStr).sort(sortByDate)
  const tarefasProximas   = tarefasComData.filter(t => !t.done && (t.due_date as string) >= hojeStr).sort(sortByDate)
  const tarefasConcluidas = tarefasComData.filter(t => t.done).sort((a, b) => sortByDate(b, a))   // recentes primeiro
  const eventosHoje = calEvents.filter(e => e.date === hojeStr).sort((a, b) => (a.start_time || '99:99').localeCompare(b.start_time || '99:99'))
  const muralVazio = tarefasAtrasadas.length + tarefasProximas.length + tarefasConcluidas.length + eventosHoje.length + notices.length === 0

  const todaySP = saoPauloDay(new Date())
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
                    ? <p className="text-sm text-bento-muted py-6 text-center">Nada na agenda, tarefas ou avisos.</p>
                    : <>
                    {/* Mesma fonte da Agenda: atrasadas → eventos de hoje → próximas → concluídas → avisos. */}
                    {tarefasAtrasadas.map(t => (
                      <MuralTaskRow key={`tk-${t.id}`} task={t} state="overdue" onClick={() => router.push('/tarefas')} />
                    ))}
                    {eventosHoje.map(ev => (
                      <MuralAgendaRow key={`ev-${ev.id}`} ev={ev} onClick={() => setFocusEvent(ev)} />
                    ))}
                    {tarefasProximas.map(t => (
                      <MuralTaskRow key={`tk-${t.id}`} task={t} state="ontime" onClick={() => router.push('/tarefas')} />
                    ))}
                    {tarefasConcluidas.map(t => (
                      <MuralTaskRow key={`tk-${t.id}`} task={t} state="done" onClick={() => router.push('/tarefas')} />
                    ))}
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
