'use client'

import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { cn } from '@/lib/utils'
import { getLeadSignal, daysStopped, nextActionLabel, type LeadSignal } from './leadSignals'
import type { Lead } from './types'

interface Props {
  lead: Lead
  isDragging?: boolean
  onClick?: () => void
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `R$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `R$ ${val.toLocaleString('pt-BR')}`
  return ''
}

// Borda-esquerda do card por sinal (só quando há alerta).
const SIGNAL_BORDER: Record<LeadSignal, string> = {
  hot:  'border-l-2 border-l-lime',
  cold: 'border-l-2 border-l-red-400',
  warm: 'border-l-2 border-l-amber-400',
  none: '',
}

// Tag do rodapé por sinal (translúcida — funciona nos dois temas).
const SIGNAL_TAG: Record<Exclude<LeadSignal, 'none'>, string> = {
  hot:  'text-lime-fg bg-lime/15',
  cold: 'text-red-400 bg-red-400/[0.12]',
  warm: 'text-amber-400 bg-amber-400/[0.12]',
}

export function LeadCard({ lead, isDragging, onClick }: Props) {
  const {
    attributes, listeners, setNodeRef,
    transform, transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: lead.id })

  const isClosed = lead.status === 'fechado'
  const signal = getLeadSignal(lead)
  const sub = lead.nicho || lead.company
  const formattedValue = formatValue(lead.value || 0)
  const nextAction = signal === 'none' ? nextActionLabel(lead) : null

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isSortableDragging ? 0.3 : (isClosed ? 0.6 : 1),
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={onClick}
      className={cn(
        'bento-fx p-2.5 cursor-pointer select-none',
        'hover:border-lime/50 transition-colors duration-150',
        SIGNAL_BORDER[signal],
        isDragging && 'shadow-card-hover rotate-1 scale-105 border-lime',
      )}
    >
      <p className="font-semibold text-bento-text text-xs leading-snug truncate">{lead.name}</p>
      {sub && (
        <p className="font-tech text-[10px] text-bento-muted truncate mt-0.5">{sub}</p>
      )}

      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="font-tech text-[11px] font-semibold text-bento-dim tabular-nums">
          {formattedValue || '—'}
        </span>

        {signal !== 'none' ? (
          <span className={cn(
            'inline-flex items-center gap-1 px-1.5 py-px rounded font-tech text-[9px] font-bold uppercase tracking-wide',
            SIGNAL_TAG[signal],
          )}>
            <span className="w-1 h-1 rounded-full bg-current flex-none" />
            {signal === 'hot' ? 'Quente' : `${daysStopped(lead)}d`}
          </span>
        ) : nextAction ? (
          <span className="inline-flex items-center gap-1.5 font-tech text-[9px] text-bento-muted truncate">
            <span className="w-1 h-1 rounded-full bg-bento-muted flex-none" />
            {nextAction}
          </span>
        ) : null}
      </div>
    </div>
  )
}
