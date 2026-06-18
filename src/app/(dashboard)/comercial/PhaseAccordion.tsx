'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { StaticLeadCard } from './LeadCard'
import { ALL_COLUMNS, type ColumnTone, type Lead } from './types'

const TONE: Record<ColumnTone, { dot: string; name: string }> = {
  neutral: { dot: 'bg-bento-muted', name: 'text-bento-dim' },
  win:     { dot: 'bg-lime shadow-[0_0_6px_rgba(182,255,59,0.5)]', name: 'text-lime-fg' },
  loss:    { dot: 'bg-red-400', name: 'text-red-400' },
}

/**
 * Funil compacto p/ mobile: cada fase é uma linha pequena; tocar expande os leads
 * daquela etapa (visão focada). Sem drag (no celular usa-se o seletor de fase no
 * detalhe do lead). Desktop continua com as colunas/dnd.
 */
export function PhaseAccordion({ leads, onLeadClick }: { leads: Lead[]; onLeadClick: (l: Lead) => void }) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) =>
    setOpen(prev => {
      const n = new Set(prev)
      if (n.has(k)) n.delete(k); else n.add(k)
      return n
    })

  return (
    <div className="space-y-2">
      {ALL_COLUMNS.map(col => {
        const items = leads.filter(l => l.status === col.key)
        const tone = TONE[col.tone]
        const isOpen = open.has(col.key)
        return (
          <div key={col.key} className="bento-fx overflow-hidden">
            <button
              type="button"
              onClick={() => toggle(col.key)}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 min-h-[44px]"
            >
              <span className={cn('w-[7px] h-[7px] rounded-full flex-none', tone.dot)} />
              <span className={cn('text-sm font-semibold flex-1 text-left truncate', tone.name)}>{col.label}</span>
              <span className="flex items-baseline gap-1 flex-none">
                <span className="font-display text-3xl font-bold text-bento-text tabular-nums leading-none">{items.length}</span>
                <span className="font-tech text-[10px] text-bento-muted">leads</span>
              </span>
              <svg className={cn('w-4 h-4 text-bento-muted transition-transform flex-none', isOpen && 'rotate-90')}
                fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>

            {isOpen && (
              <div className="px-2 pb-2 pt-2 space-y-2 border-t border-bento-border/60">
                {items.length === 0
                  ? <p className="text-center text-xs text-bento-muted/60 py-3 font-tech">vazio</p>
                  : items.map(l => <StaticLeadCard key={l.id} lead={l} onClick={() => onLeadClick(l)} />)}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
