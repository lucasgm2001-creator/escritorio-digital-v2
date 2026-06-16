'use client'

import { useState } from 'react'
import { useDroppable } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { ChevronRight, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FunnelLeadCard } from './FunnelLeadCard'
import { heatLevel } from './leadSignals'
import type { Lead, ColumnConfig, ColumnTone, LeadStatus } from './types'

function fmtUSD(val: number): string {
  if (val >= 1_000_000) return `US$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `US$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `US$ ${val.toLocaleString('pt-BR')}`
  return 'US$ 0'
}

// Acento quando a fase está ABERTA. Lime fixo (#C2F73A) p/ aparecer no light também;
// gradiente mais forte no light via [html.light_&]. Exceções: ganho=verde, perda=vermelho.
const ACCENT: Record<ColumnTone, { box: string; name: string }> = {
  neutral: {
    box: 'border-[rgba(194,247,58,0.30)] border-l-[3px] border-l-[#C2F73A] shadow-[0_0_12px_rgba(194,247,58,0.12)] bg-gradient-to-br from-[rgba(194,247,58,0.04)] [html.light_&]:from-[rgba(194,247,58,0.09)] to-transparent',
    name: 'text-lime-fg',
  },
  win: {
    box: 'border-[rgba(34,197,94,0.30)] border-l-[3px] border-l-[#22C55E] shadow-[0_0_12px_rgba(34,197,94,0.14)] bg-gradient-to-br from-[rgba(34,197,94,0.05)] [html.light_&]:from-[rgba(34,197,94,0.10)] to-transparent',
    name: 'text-[#22C55E]',
  },
  loss: {
    box: 'border-[rgba(239,68,68,0.30)] border-l-[3px] border-l-[#EF4444] shadow-[0_0_12px_rgba(239,68,68,0.14)] bg-gradient-to-br from-[rgba(239,68,68,0.05)] [html.light_&]:from-[rgba(239,68,68,0.10)] to-transparent',
    name: 'text-[#EF4444]',
  },
}

// Nome da fase: neutro por padrão. Cor SÓ em resultado terminal (ganho/perda) — é
// significado, não decoração. Dots ficam neutros pra todas as fases.
const NAME_COLOR: Record<ColumnTone, string> = {
  neutral: 'text-bento-text',
  win:     'text-[#22C55E]',
  loss:    'text-[#EF4444]',
}

export function KanbanColumn({ column, leads, onMove, onOpenDiary, onLog }: {
  column: ColumnConfig
  leads: Lead[]
  onMove: (lead: Lead, status: LeadStatus) => void
  onOpenDiary: (lead: Lead) => void
  onLog: (lead: Lead, type: string) => void
}) {
  const { isOver, setNodeRef } = useDroppable({ id: column.key })
  const [collapsed, setCollapsed] = useState(true)
  const total = leads.reduce((s, l) => s + (l.value || 0), 0)
  const terminal = column.tone !== 'neutral' || column.key === 'lixeira'
  const accent = ACCENT[column.tone]

  // Heat dots — só nas fases de trabalho (terminais não têm deal rotting).
  const heat = { hot: 0, warm: 0, cold: 0 }
  if (!terminal) for (const l of leads) heat[heatLevel(l)]++

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'w-60 flex-none rounded-[10px] border bg-bento-panel overflow-hidden transition-colors',
        collapsed ? 'border-bento-border' : accent.box,
        isOver && 'border-dashed border-lime/60 bg-lime/5',
      )}
    >
      {collapsed ? (
        <button onClick={() => setCollapsed(false)} className="w-full text-left p-3">
          <div className="flex items-center gap-2">
            <span className="w-[7px] h-[7px] rounded-full flex-none bg-bento-muted" />
            <span className={cn('text-xs font-semibold flex-1 truncate', NAME_COLOR[column.tone])}>{column.label}</span>
            <ChevronRight className="w-4 h-4 text-bento-muted flex-none" />
          </div>
          <div className="mt-2 flex items-end justify-between">
            <span className="font-display text-3xl font-bold text-bento-text tabular-nums leading-none">{leads.length}</span>
            <span className="font-tech text-[11px] font-semibold text-bento-dim tabular-nums">{fmtUSD(total)}</span>
          </div>
          {!terminal && leads.length > 0 && (
            <div className="mt-2.5 flex items-center gap-2.5">
              {heat.hot > 0 && <HeatDot cls="bg-lime" n={heat.hot} />}
              {heat.warm > 0 && <HeatDot cls="bg-amber-500" n={heat.warm} />}
              {heat.cold > 0 && <HeatDot cls="bg-red-500" n={heat.cold} />}
            </div>
          )}
        </button>
      ) : (
        <>
          {/* Header inteiro é o toggle (fecha a fase). O corpo abaixo fica independente. */}
          <button type="button" onClick={() => setCollapsed(c => !c)} aria-label="Fechar fase"
            className="w-full flex items-center gap-2 px-3 py-2.5 border-b border-bento-border/60 text-left hover:bg-bento-bg/40 transition-colors">
            <span className="w-[7px] h-[7px] rounded-full flex-none bg-bento-muted" />
            <span className={cn('text-xs font-semibold flex-1 truncate', NAME_COLOR[column.tone])}>{column.label}</span>
            <span className="font-tech text-[11px] text-bento-muted tabular-nums">{leads.length}</span>
            <X className="w-3.5 h-3.5 flex-none text-bento-muted" />
          </button>
          <div className="p-2 space-y-2 overflow-y-auto max-h-[340px]">
            <SortableContext items={leads.map(l => l.id)} strategy={verticalListSortingStrategy}>
              {leads.length === 0 ? (
                <div className={cn('flex items-center justify-center h-14 text-xs rounded-lg border border-dashed font-tech',
                  isOver ? 'text-lime-fg border-lime/50' : 'text-bento-muted/50 border-bento-border/50')}>
                  {isOver ? 'Soltar aqui' : 'vazio'}
                </div>
              ) : (
                leads.map(l => (
                  <FunnelLeadCard key={l.id} lead={l} onMove={(s) => onMove(l, s)} onOpenDiary={() => onOpenDiary(l)} onLog={(t) => onLog(l, t)} />
                ))
              )}
            </SortableContext>
          </div>
        </>
      )}
    </div>
  )
}

function HeatDot({ cls, n }: { cls: string; n: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('w-2 h-2 rounded-full', cls)} />
      <span className="font-tech text-[10px] text-bento-dim tabular-nums">{n}</span>
    </span>
  )
}
