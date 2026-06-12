'use client'

import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { cn } from '@/lib/utils'
import { LeadCard } from './LeadCard'
import type { Lead, ColumnConfig, ColumnTone } from './types'

interface Props {
  column: ColumnConfig
  leads: Lead[]
  onLeadClick: (lead: Lead) => void
}

function formatValue(val: number): string {
  if (val >= 1_000_000) return `R$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `R$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `R$ ${val.toLocaleString('pt-BR')}`
  return 'R$ 0'
}

// Estilo do header por tom. Meio do funil = neutro; só ganho/perda têm cor suave.
const TONE: Record<ColumnTone, { headBg: string; dot: string; name: string }> = {
  neutral: { headBg: '',                                                  dot: 'bg-bento-muted',                                              name: 'text-bento-dim' },
  win:     { headBg: 'bg-gradient-to-b from-lime/[0.08] to-transparent',  dot: 'bg-lime shadow-[0_0_6px_rgba(182,255,59,0.5)]',               name: 'text-lime-fg' },
  loss:    { headBg: 'bg-gradient-to-b from-red-500/[0.07] to-transparent', dot: 'bg-red-400',                                                name: 'text-red-400' },
}

export function KanbanColumn({ column, leads, onLeadClick }: Props) {
  const { isOver, setNodeRef } = useDroppable({ id: column.key })
  const totalValue = leads.reduce((sum, l) => sum + (l.value || 0), 0)
  const tone = TONE[column.tone]

  return (
    <div className="flex flex-col min-w-0">
      {/* Column header — neutro; contagem + soma à direita (mono) */}
      <div className={cn(
        'flex items-center gap-2 px-3 py-2.5 rounded-t-xl border border-b-0 border-bento-border bg-bento-panel',
        tone.headBg,
      )}>
        <span className={cn('w-[7px] h-[7px] rounded-full flex-none', tone.dot)} />
        <span className={cn('text-xs font-semibold truncate flex-1', tone.name)}>
          {column.label}
        </span>
        <span className="text-right leading-tight flex-none">
          <span className="block font-tech text-[11px] text-bento-muted tabular-nums">{leads.length}</span>
          <span className="block font-tech text-[10px] font-semibold text-bento-dim tabular-nums">{formatValue(totalValue)}</span>
        </span>
      </div>

      {/* Drop zone */}
      <div
        ref={setNodeRef}
        className={cn(
          'flex-1 rounded-b-xl p-2 space-y-2 overflow-y-auto transition-all border border-t-0 min-h-[180px]',
          isOver
            ? 'border-dashed border-lime/50 bg-lime/5'
            : 'bg-bento-panel border-bento-border/60',
        )}
        style={{ maxHeight: 'calc(55vh - 130px)' }}
      >
        <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
          {leads.length === 0 ? (
            <div className={cn(
              'flex items-center justify-center h-16 text-xs rounded-lg border border-dashed font-tech',
              isOver ? 'text-lime-fg border-lime/50' : 'text-bento-muted/50 border-bento-border/50',
            )}>
              {isOver ? 'Soltar aqui' : 'vazio'}
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
