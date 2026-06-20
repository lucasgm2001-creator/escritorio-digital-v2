'use client'

import { cn } from '@/lib/utils'
import type { Task } from '../tarefas/types'
import { type CalendarEvent, useEscape } from './calendarShared'

// Detalhe do DIA (tarefas + eventos). Fecha por X, ESC, clique fora — e o toggle (clicar
// de novo no mesmo dia) é tratado no onClick do dia. Read-only.
export function DayDetailModal({ dateStr, events, tasks, todayStr, onClose }: {
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
