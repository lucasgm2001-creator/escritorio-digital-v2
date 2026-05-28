'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { LeadCard } from './LeadCard'
import type { Lead, ColumnConfig } from './KanbanBoard'

interface Props {
  column: ColumnConfig
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `R$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `R$ ${val.toLocaleString('pt-BR')}`
  return ''
}

export function KanbanColumn({ column, leads, onLeadClick }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: column.key })

  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0)
  const displayValue = formatValue(totalValue)

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header */}
      <div className={cn(
        'flex items-start justify-between px-3 py-2.5 rounded-t-xl border border-b-0',
        column.bgColor,
        column.borderColor,
      )}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <div className={cn('w-2 h-2 rounded-full flex-none', column.dotColor)} />
            <span className={cn('text-xs font-semibold truncate', column.textColor)}>
              {column.label}
            </span>
            <span className={cn(
              'text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-white/80 tabular-nums',
              column.textColor,
            )}>
              {leads.length}
            </span>
          </div>
          {displayValue && (
            <p className="text-[10px] text-slate-400 mt-0.5 pl-3.5 truncate font-medium tabular-nums">
              {displayValue}
            </p>
          )}
        </div>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-b-xl p-2 space-y-2 overflow-y-auto transition-all border border-t-0',
          'min-h-[180px]',
          isOver
            ? cn('border-dashed', column.borderColor, column.bgColor)
            : 'bg-white/60 border-slate-200/80 backdrop-blur-sm',
        )}
        style={{ maxHeight: 'calc(55vh - 130px)' }}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <div className={cn(
              'flex items-center justify-center h-16 text-xs rounded-lg border border-dashed',
              isOver ? cn(column.textColor, column.borderColor) : 'text-slate-300 border-slate-200',
            )}>
              {isOver ? 'Soltar aqui' : 'Vazio'}
            </div>
          ) : (
            leads.map(lead => (
              <LeadCard key={lead.id} lead={lead} onClick={() => onLeadClick(lead)} />
            ))
          )}
        </SortableContext>
      </div>
    </div>
  )
}
