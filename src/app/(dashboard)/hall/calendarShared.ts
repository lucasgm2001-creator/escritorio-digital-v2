// Tipos/consts/helpers compartilhados da Agenda do Hall — extraídos do HallClient (refactor puro,
// sem mudança de comportamento). Importado por Calendar/EventModal/DayDetailModal e pelo HallClient.
import { useEffect } from 'react'
import { dayBR } from './dateBR'

export interface CalendarEvent {
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

export type CalendarView = 'annual' | 'monthly' | 'weekly' | 'daily'

export const EVENT_TYPE_LABELS: Record<string, string> = {
  reuniao: 'Reunião',
  ligacao: 'Ligação',
  tarefa: 'Tarefa',
  outro: 'Outro',
}

export const MONTH_NAMES = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro']
export const MONTH_ABBR  = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']

// Campos de formulário no estilo Bento (superfícies theme-aware + foco no acento).
export const bentoInput = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// Fecha modal no ESC (além do X e do clique fora). Reusado pelos modais da Agenda.
export function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}

export function getWeekDays(referenceDate: Date): { label: string; date: Date; dateStr: string }[] {
  const jsDay = referenceDate.getDay()
  const daysToMonday = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(referenceDate)
  monday.setDate(monday.getDate() + daysToMonday)
  const labels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sab', 'Dom']
  return labels.map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { label, date: d, dateStr: dayBR(d) }
  })
}

export function getMonthDays(year: number, month: number): { date: Date; dateStr: string; isCurrentMonth: boolean }[] {
  const firstDay = new Date(year, month, 1)
  const startDate = new Date(firstDay)
  const jsDay = firstDay.getDay()
  const daysToMonday = jsDay === 0 ? -6 : 1 - jsDay
  startDate.setDate(startDate.getDate() + daysToMonday)

  const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(startDate)
    d.setDate(startDate.getDate() + i)
    days.push({ date: d, dateStr: dayBR(d), isCurrentMonth: d.getMonth() === month })
  }
  return days
}

export function getHourSlots(): { hour: number; label: string }[] {
  return Array.from({ length: 18 }, (_, i) => ({
    hour: i + 6,
    label: `${String(i + 6).padStart(2, '0')}:00`,
  }))
}
