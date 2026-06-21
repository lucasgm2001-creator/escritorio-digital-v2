'use client'

import { useEffect, useMemo, useState } from 'react'
import { ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { StaticLeadCard } from './LeadCard'
import { type ColumnConfig, type Lead } from './types'

/**
 * Funil no MOBILE (<1024px): seletor de fase LIMPO (dropdown com a fase atual + contagem) e os cards
 * da fase escolhida empilhados, largura cheia. SEM arrastar no mobile — rolar a lista nunca agarra um
 * card. Para mover, toca-se no card → abre o LeadDiary, que tem o seletor de fase (MESMA função de
 * mover, MESMO disparo de comissão). Desktop continua com as colunas + arrastar (KanbanColumn/dnd).
 */
export function PhaseSelectorMobile({ columns, leads, onOpenDiary }: {
  columns: ColumnConfig[]
  leads: Lead[]
  onOpenDiary: (l: Lead) => void
}) {
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const c of columns) m[c.key] = 0
    for (const l of leads) if (l.status in m) m[l.status]++
    return m
  }, [columns, leads])

  // Default: primeira fase COM leads (senão a primeira). Só no mount.
  const firstWithLeads = columns.find(c => counts[c.key] > 0)?.key ?? columns[0]?.key ?? ''
  const [selected, setSelected] = useState<string>(firstWithLeads)
  const [open, setOpen] = useState(false)

  // Se a fase selecionada deixar de existir (configuração mudou), reescolhe — sem sobrescrever a
  // escolha do usuário em refresh de dados.
  useEffect(() => {
    if (!columns.some(c => c.key === selected)) setSelected(firstWithLeads)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns])

  const selectedCol = columns.find(c => c.key === selected) ?? columns[0]
  const phaseLeads = leads.filter(l => l.status === selected)

  return (
    <div className="space-y-3 max-w-2xl mx-auto">
      {/* Seletor de fase (dropdown): fase atual + contagem → abre a lista de fases pra escolher. */}
      <div className="relative">
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          className="w-full flex items-center gap-2.5 rounded-btn border border-bento-border bg-bento-panel px-3 min-h-[48px] text-left hover:border-lime/40 transition-colors">
          <span className={cn('w-2 h-2 rounded-full flex-none', selectedCol?.dotColor ?? 'bg-bento-muted')} />
          <span className="font-display font-bold text-bento-text text-sm flex-1 min-w-0 truncate">{selectedCol?.label ?? 'Fase'}</span>
          <span className="font-tech text-xs text-bento-muted tabular-nums flex-none">({phaseLeads.length})</span>
          <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', open && 'rotate-180')} />
        </button>
        {open && (
          <>
            <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
            <div className="absolute z-30 mt-1 left-0 right-0 max-h-[60vh] overflow-y-auto bg-bento-panel border border-bento-border rounded-btn shadow-card-hover p-1">
              {columns.map(col => {
                const active = col.key === selected
                return (
                  <button key={col.key} type="button"
                    onClick={() => { setSelected(col.key); setOpen(false) }}
                    className={cn('w-full flex items-center gap-2.5 px-2.5 min-h-[44px] rounded-md text-left transition-colors',
                      active ? 'bg-lime/10' : 'hover:bg-bento-bg')}>
                    <span className={cn('w-2 h-2 rounded-full flex-none', col.dotColor)} />
                    <span className={cn('text-sm flex-1 min-w-0 truncate', active ? 'text-lime-fg font-semibold' : 'text-bento-text')}>{col.label}</span>
                    <span className="font-tech text-xs text-bento-muted tabular-nums flex-none">{counts[col.key] ?? 0}</span>
                    {active && <Check className="w-3.5 h-3.5 text-lime-fg flex-none" />}
                  </button>
                )
              })}
            </div>
          </>
        )}
      </div>

      {/* Cards da fase selecionada — empilhados, largura cheia, SEM arrastar (StaticLeadCard). */}
      {phaseLeads.length === 0 ? (
        <p className="text-center text-xs text-bento-muted/60 py-8 font-tech">Nenhum lead nesta fase.</p>
      ) : (
        <div className="space-y-2">
          {phaseLeads.map(l => <StaticLeadCard key={l.id} lead={l} onClick={() => onOpenDiary(l)} />)}
        </div>
      )}

      <p className="font-tech text-[10px] text-bento-muted/70 text-center px-2">
        Toque num card para abrir e mover de fase
      </p>
    </div>
  )
}
