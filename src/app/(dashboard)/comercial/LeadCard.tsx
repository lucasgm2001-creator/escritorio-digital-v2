'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { getScoreInfo } from '@/lib/utils/score'
import type { Lead } from './KanbanBoard'

interface Props {
  lead: Lead
  isDragging?: boolean
  onClick?: () => void
}

function getInitials(name: string): string {
  return name.split(' ').slice(0, 2).map(n => n[0]).join('').toUpperCase()
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `R$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `R$ ${val.toLocaleString('pt-BR')}`
  return ''
}

export function LeadCard({ lead, isDragging, onClick }: Props) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id })

  const scoreInfo = getScoreInfo(lead.score)
  const scorePct  = Math.min(100, (lead.score / 1000) * 100)
  const isClient  = lead.status === 'fechado'
  const formattedValue = formatValue(lead.value || 0)

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : (isClient ? 0.55 : 1),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bg-white rounded-xl border border-slate-200 p-3 cursor-pointer select-none',
        'shadow-sm hover:shadow-md hover:border-slate-300 transition-all duration-150',
        isDragging && 'shadow-xl rotate-1 scale-105',
      )}
    >
      {/* Top row: score badge + value + client badge */}
      <div className="flex items-center gap-1.5 mb-2 flex-wrap">
        <span className={cn(
          'inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border',
          scoreInfo.bg, scoreInfo.color, scoreInfo.border,
        )}>
          <span className={cn('w-1 h-1 rounded-full flex-none', scoreInfo.dot)} />
          {scoreInfo.faixa}
        </span>

        {isClient && (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 border border-emerald-200 text-[10px] font-bold">
            <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
            </svg>
            Cliente
          </span>
        )}

        {formattedValue && (
          <span className="ml-auto text-[10px] font-bold text-slate-600 tabular-nums">
            {formattedValue}
          </span>
        )}
      </div>

      {/* Name + company */}
      <p className="font-semibold text-slate-800 text-sm leading-snug truncate">{lead.name}</p>
      {lead.company && (
        <p className="text-[11px] text-slate-400 truncate mt-0.5">{lead.company}</p>
      )}

      {/* Score bar */}
      <div className="mt-2.5">
        <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all', scoreInfo.dot)}
            style={{ width: `${scorePct}%` }}
          />
        </div>
        <div className="flex items-center justify-between mt-1">
          <span className="text-[10px] text-slate-400">
            {lead.operation === 'eua' ? '🇺🇸 EUA' : '🇧🇷 BR'}
          </span>
          <span className="text-[10px] text-slate-400 tabular-nums font-medium">{lead.score}</span>
        </div>
      </div>

      {/* Assigned avatar */}
      {lead.assigned_name && (
        <div className="flex items-center gap-1.5 mt-2 pt-2 border-t border-slate-100">
          <div className="w-5 h-5 rounded-full bg-primary-100 flex items-center justify-center flex-none shadow-sm">
            <span className="text-[9px] font-bold text-primary-700">{getInitials(lead.assigned_name)}</span>
          </div>
          <span className="text-[10px] text-slate-400 truncate">{lead.assigned_name}</span>
        </div>
      )}
    </div>
  )
}
