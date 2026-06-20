'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { CalendarDays } from 'lucide-react'
import type { Task } from '../tarefas/types'
import { dayBR } from './dateBR'
import {
  type CalendarEvent, type CalendarView, EVENT_TYPE_LABELS, MONTH_NAMES, MONTH_ABBR,
  useEscape, getWeekDays, getMonthDays, getHourSlots,
} from './calendarShared'
import { EventModal } from './EventModal'
import { DayDetailModal } from './DayDetailModal'

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

// ─── Calendar Component ───────────────────────────────────────────────────────

interface CalendarProps {
  userId: string
  events: CalendarEvent[]
  tasks: Task[]
  onEventsChange: (events: CalendarEvent[]) => void
  focusEvent?: CalendarEvent | null
  onFocusHandled?: () => void
}

export function Calendar({ userId, events, tasks, onEventsChange, focusEvent, onFocusHandled }: CalendarProps) {
  const now = new Date()
  const todayStr = dayBR(now)

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
    const dailyStr = dayBR(dailyDate)
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
