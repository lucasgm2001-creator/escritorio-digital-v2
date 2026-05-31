'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/utils'
import { AgentChat } from './AgentChat'
import type { Activity, Notice } from '@/types'

type Tab = 'activities' | 'agent'

interface Props {
  initialActivities: Activity[]
  initialNotices: Notice[]
  userName: string
  userRole: string
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

const ACTIVITY_COLORS: Record<string, string> = {
  lead:     'bg-blue-900/40 text-blue-400',
  client:   'bg-indigo-900/40 text-indigo-400',
  payment:  'bg-green-900/40 text-green-400',
  task:     'bg-amber-900/40 text-amber-400',
  campaign: 'bg-purple-900/40 text-purple-400',
  system:   'bg-slate-800/60 text-slate-400',
}

const NOTICE_BORDER: Record<string, string> = {
  info:    'border-blue-800/50 bg-blue-900/20',
  warning: 'border-amber-800/50 bg-amber-900/20',
  urgent:  'border-red-800/50 bg-red-900/20',
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

// ─── Event Modal ──────────────────────────────────────────────────────────────

interface EventModalProps {
  date: Date
  hour?: number
  userId: string
  onClose: () => void
  onSaved: (event: CalendarEvent) => void
}

function EventModal({ date, hour, userId, onClose, onSaved }: EventModalProps) {
  const [form, setForm] = useState({
    title: '',
    date: toDateStr(date),
    start_time: hour != null ? `${String(hour).padStart(2,'0')}:00` : '',
    end_time: hour != null ? `${String(hour + 1).padStart(2,'0')}:00` : '',
    description: '',
    type: 'reuniao' as CalendarEvent['type'],
    color: '#6366f1',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const colors = ['#6366f1','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']

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

  const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#161b22] border border-[#2d3748] rounded-t-2xl sm:rounded-2xl shadow-card-hover w-full sm:max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
          <h2 className="font-bold text-foreground text-base">Novo Evento</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Título *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Reunião com cliente" className={inputCls} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as CalendarEvent['type'] }))}
                className={inputCls}>
                {Object.entries(EVENT_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Início</label>
              <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1.5">Fim</label>
              <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className={inputCls} />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Descrição (opcional)</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Detalhes do evento..." rows={2}
              className={`${inputCls} resize-none`} />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1.5">Cor</label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-white ring-offset-2 ring-offset-[#161b22]' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-[#2d3748] text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors min-h-[44px]">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50 shadow-glow-sm min-h-[44px]">
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

  const handleDelete = async () => {
    setDeleting(true)
    const supabase = createClient()
    await supabase.from('calendar_events').delete().eq('id', event.id)
    onDelete(event.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bg-[#161b22] border border-[#2d3748] rounded-t-2xl sm:rounded-2xl shadow-card-hover w-full sm:max-w-sm animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
          <div className="flex items-center gap-2.5">
            <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: event.color }} />
            <h2 className="font-bold text-foreground text-base">{event.title}</h2>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            {new Date(event.date + 'T12:00:00').toLocaleDateString('pt-BR', { weekday:'long', day:'numeric', month:'long', year:'numeric' })}
          </div>
          {(event.start_time || event.end_time) && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {event.start_time?.slice(0,5)} {event.end_time ? `– ${event.end_time.slice(0,5)}` : ''}
            </div>
          )}
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            {EVENT_TYPE_LABELS[event.type]}
          </div>
          {event.description && (
            <p className="text-sm text-muted-foreground bg-[#1e2533] rounded-lg px-3 py-2">{event.description}</p>
          )}
          <button onClick={handleDelete} disabled={deleting}
            className="w-full mt-2 border border-red-800/50 text-red-400 py-2 rounded-lg text-sm hover:bg-red-900/20 transition-colors disabled:opacity-50 min-h-[44px]">
            {deleting ? 'Excluindo...' : 'Excluir evento'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Calendar Component ───────────────────────────────────────────────────────

interface CalendarProps {
  userId: string
  events: CalendarEvent[]
  onEventsChange: (events: CalendarEvent[]) => void
}

function Calendar({ userId, events, onEventsChange }: CalendarProps) {
  const now = new Date()
  const todayStr = toDateStr(now)

  const [view, setView]           = useState<CalendarView>('weekly')
  const [selectedYear, setYear]   = useState(now.getFullYear())
  const [selectedMonth, setMonth] = useState(now.getMonth())
  const [weekBase, setWeekBase]   = useState(now)
  const [dailyDate, setDailyDate] = useState(now)

  const [eventModal, setEventModal]   = useState<{ date: Date; hour?: number } | null>(null)
  const [detailEvent, setDetailEvent] = useState<CalendarEvent | null>(null)

  const eventsMap = events.reduce<Record<string, CalendarEvent[]>>((acc, ev) => {
    (acc[ev.date] = acc[ev.date] ?? []).push(ev)
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
        return (
          <button key={i} onClick={() => { setMonth(i); setView('monthly') }}
            className={`rounded-xl p-3 border text-center transition-all hover:border-primary-600/60 cursor-pointer ${
              isCurrentMonth ? 'bg-primary-600/20 border-primary-600/40' : 'bg-[#1a2133] border-[#2d3748]'
            }`}>
            <p className={`text-sm font-bold capitalize ${isCurrentMonth ? 'text-primary-400' : 'text-foreground'}`}>
              {MONTH_ABBR[i]}
            </p>
            {hasEvents && (
              <div className="flex justify-center gap-0.5 mt-1.5">
                {events.filter(e => e.date.startsWith(monthStr)).slice(0, 3).map(e => (
                  <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                ))}
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
            <div key={d} className="text-center text-xs font-bold text-muted-foreground py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {days.map(({ date, dateStr, isCurrentMonth }, i) => {
            const dayEvents = eventsMap[dateStr] ?? []
            const isToday = dateStr === todayStr
            return (
              <button key={i} onClick={() => { setDailyDate(date); setView('daily') }}
                className={`rounded-lg p-1.5 min-h-[52px] border text-left transition-all hover:border-primary-600/50 ${
                  isToday ? 'bg-primary-600/20 border-primary-600/40' :
                  isCurrentMonth ? 'bg-[#1a2133] border-[#2d3748]' : 'bg-[#0d1117] border-[#1a2133]'
                }`}>
                <span className={`text-xs font-medium ${
                  isToday ? 'text-primary-400' : isCurrentMonth ? 'text-foreground' : 'text-muted-foreground/40'
                }`}>{date.getDate()}</span>
                <div className="flex flex-wrap gap-0.5 mt-0.5">
                  {dayEvents.slice(0, 3).map(e => (
                    <span key={e.id} className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: e.color }} />
                  ))}
                  {dayEvents.length > 3 && <span className="text-[9px] text-muted-foreground">+{dayEvents.length - 3}</span>}
                </div>
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
      <div className="grid grid-cols-7 gap-2">
        {days.map(({ label, date, dateStr }) => {
          const dayEvents = eventsMap[dateStr] ?? []
          const isToday = dateStr === todayStr
          return (
            <button key={dateStr} onClick={() => { setDailyDate(date); setView('daily') }}
              className={`rounded-xl p-3 border text-center transition-all hover:border-primary-600/60 cursor-pointer ${
                isToday ? 'bg-primary-600/20 border-primary-600/40 shadow-glow-sm' : 'bg-[#1a2133] border-[#2d3748] hover:border-[#3d4f6a]'
              }`}>
              <p className={`text-xs font-medium ${isToday ? 'text-primary-400' : 'text-muted-foreground'}`}>{label}</p>
              <p className={`text-xl font-bold mt-1 tabular-nums ${isToday ? 'text-primary-300' : 'text-foreground'}`}>
                {date.getDate()}
              </p>
              <div className="flex flex-wrap justify-center gap-0.5 mt-1.5">
                {dayEvents.slice(0, 2).map(e => (
                  <span key={e.id} className="w-2 h-2 rounded-sm" style={{ backgroundColor: e.color }} />
                ))}
                {dayEvents.length > 2 && <span className="text-[9px] text-muted-foreground w-full text-center">+{dayEvents.length - 2}</span>}
              </div>
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
    const slots = getHourSlots()
    const currentHour = now.getHours()

    return (
      <div className="space-y-1">
        {slots.map(({ hour, label }) => {
          const slotEvents = dayEvents.filter(e => {
            if (!e.start_time) return false
            const h = parseInt(e.start_time.split(':')[0], 10)
            return h === hour
          })
          const isNow = dailyStr === todayStr && currentHour === hour

          return (
            <div key={hour} className="flex gap-3">
              <span className={`text-xs tabular-nums w-12 pt-2 shrink-0 text-right ${isNow ? 'text-primary-400 font-semibold' : 'text-muted-foreground/60'}`}>
                {label}
              </span>
              <button onClick={() => setEventModal({ date: dailyDate, hour })}
                className={`flex-1 min-h-[40px] rounded-lg border text-left px-3 py-1.5 transition-all hover:border-primary-600/50 hover:bg-primary-600/5 group ${
                  isNow ? 'bg-primary-600/10 border-primary-600/30' : 'bg-[#1a2133] border-[#2d3748]'
                }`}>
                {slotEvents.length > 0 ? (
                  <div className="space-y-0.5">
                    {slotEvents.map(e => (
                      <div key={e.id} onClick={ev => { ev.stopPropagation(); setDetailEvent(e) }}
                        className="flex items-center gap-2 cursor-pointer">
                        <span className="w-2 h-2 rounded-sm shrink-0" style={{ backgroundColor: e.color }} />
                        <span className="text-xs font-medium text-foreground">{e.title}</span>
                        <span className="text-[10px] text-muted-foreground">{EVENT_TYPE_LABELS[e.type]}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <span className="text-xs text-muted-foreground/0 group-hover:text-muted-foreground/40 transition-colors">
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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <button onClick={() => navigate(-1)}
                className="p-1.5 rounded-lg hover:bg-[#1e2533] text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </button>
              <span className="text-sm font-semibold text-foreground">{breadcrumb()}</span>
              <button onClick={() => navigate(1)}
                className="p-1.5 rounded-lg hover:bg-[#1e2533] text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </button>
            </div>
            <div className="flex gap-1 flex-wrap">
              {(['daily','weekly','monthly','annual'] as CalendarView[]).map(v => (
                <button key={v} onClick={() => setView(v)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                    view === v ? 'bg-primary-600 text-white shadow-glow-sm' : 'bg-[#1a2133] text-muted-foreground border border-[#2d3748] hover:border-primary-600'
                  }`}>
                  {v === 'daily' ? 'Diário' : v === 'weekly' ? 'Semanal' : v === 'monthly' ? 'Mensal' : 'Anual'}
                </button>
              ))}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {view === 'annual'  && <AnnualView />}
          {view === 'monthly' && <MonthlyView />}
          {view === 'weekly'  && <WeeklyView />}
          {view === 'daily'   && <DailyView />}
        </CardContent>
      </Card>

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
    </>
  )
}

// ─── Main HallClient ──────────────────────────────────────────────────────────

export function HallClient({ initialActivities, initialNotices, userName, userRole, userId }: Props) {
  const [activeTab, setActiveTab]     = useState<Tab>('activities')
  const [activities, setActivities]   = useState<Activity[]>(initialActivities)
  const [notices, setNotices]         = useState<Notice[]>(initialNotices)
  const [greeting, setGreeting]       = useState('')
  const [today, setToday]             = useState('')
  const [onlineCount, setOnlineCount] = useState(1)
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [noticeForm, setNoticeForm]   = useState({ title: '', content: '', priority: 'info' as 'info' | 'warning' | 'urgent' })
  const [savingNotice, setSavingNotice] = useState(false)
  const [calEvents, setCalEvents]     = useState<CalendarEvent[]>([])

  const canPostNotice = userRole === 'admin' || userRole === 'financeiro'

  useEffect(() => {
    setGreeting(computeGreeting())
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  }, [])

  useEffect(() => {
    const supabase = createClient()

    supabase.from('calendar_events').select('*').eq('user_id', userId).order('date').then(({ data }) => {
      if (data) setCalEvents(data as CalendarEvent[])
    })

    const dataChannel = supabase.channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        p => setActivities(prev => [p.new as Activity, ...prev.slice(0, 19)]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' },
        p => setNotices(prev => [p.new as Notice, ...prev.slice(0, 9)]))
      .subscribe()

    const presenceChannel = supabase.channel('hall-presence', { config: { presence: { key: userId } } })
    presenceChannel
      .on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(presenceChannel.presenceState()).length))
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

  const TABS = [
    {
      id: 'activities' as Tab, label: 'Atividades',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>,
    },
    {
      id: 'agent' as Tab, label: 'Agente',
      icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
    },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground tracking-tight">
            {greeting ? `${greeting}, ${userName}` : userName}
          </h1>
          <p className="text-muted-foreground mt-0.5 capitalize text-sm">{today}</p>
        </div>
        <div className="flex items-center gap-2 border border-green-800/50 bg-green-900/20 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-400">{onlineCount} online</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-[#2d3748]">
        {TABS.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id ? 'border-primary-600 text-primary-400' : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}>
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'activities' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Atividades Recentes
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-[#2d3748]/60">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma atividade ainda.</p>
              ) : activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>
                    {ACTIVITY_ICONS[a.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{a.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {a.user_name && <><p className="text-xs text-muted-foreground">{a.user_name}</p><span className="text-muted-foreground/50 text-xs">·</span></>}
                      <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Mural de Avisos</CardTitle>
                {canPostNotice && (
                  <button onClick={() => setShowNoticeForm(!showNoticeForm)}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium flex items-center gap-1">
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Postar
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {showNoticeForm && (
                <div className="bg-[#1e2533] border border-[#2d3748] rounded-xl p-3 space-y-2 mb-3">
                  <input value={noticeForm.title} onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Título" className="w-full bg-[#161b22] border border-[#2d3748] rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600" />
                  <textarea value={noticeForm.content} onChange={e => setNoticeForm(p => ({ ...p, content: e.target.value }))}
                    placeholder="Mensagem..." rows={2}
                    className="w-full bg-[#161b22] border border-[#2d3748] rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600 resize-none" />
                  <div className="flex gap-1.5">
                    {(['info','warning','urgent'] as const).map(p => (
                      <button key={p} onClick={() => setNoticeForm(prev => ({ ...prev, priority: p }))}
                        className={`flex-1 py-1 rounded-md text-xs font-medium border transition-all ${
                          noticeForm.priority === p
                            ? p === 'info' ? 'bg-blue-900/40 text-blue-400 border-blue-800/50'
                              : p === 'warning' ? 'bg-amber-900/40 text-amber-400 border-amber-800/50'
                              : 'bg-red-900/40 text-red-400 border-red-800/50'
                            : 'bg-transparent text-muted-foreground border-[#2d3748]'
                        }`}>
                        {p === 'info' ? 'Info' : p === 'warning' ? 'Atenção' : 'Urgente'}
                      </button>
                    ))}
                    <button onClick={handlePostNotice} disabled={savingNotice || !noticeForm.title.trim()}
                      className="px-3 py-1 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-500 disabled:opacity-50 transition-colors">
                      {savingNotice ? '...' : 'OK'}
                    </button>
                  </div>
                </div>
              )}
              {notices.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum aviso.</p>
                : notices.map(n => (
                  <div key={n.id} className={`rounded-xl border p-3 ${NOTICE_BORDER[n.priority] ?? 'border-[#2d3748]'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <Badge variant={n.priority === 'info' ? 'default' : n.priority === 'warning' ? 'warning' : 'destructive'} className="text-[10px]">
                        {n.priority === 'info' ? 'Info' : n.priority === 'warning' ? 'Atenção' : 'Urgente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.content}</p>
                    {n.author_name && <p className="text-xs text-muted-foreground/60 mt-1">— {n.author_name} · {timeAgo(n.created_at)}</p>}
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'agent' && (
        <div className="h-[600px] rounded-lg border border-[#2d3748] bg-[#0d1117] overflow-hidden">
          <AgentChat />
        </div>
      )}

      <Calendar userId={userId} events={calEvents} onEventsChange={setCalEvents} />
    </div>
  )
}
