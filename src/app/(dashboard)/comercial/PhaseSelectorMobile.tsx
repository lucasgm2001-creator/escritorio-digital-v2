'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usdCompact } from '@/lib/format'
import { StaticLeadCard } from './LeadCard'
import { heatLevel, type Heat } from './leadSignals'
import { type ColumnConfig, type Lead } from './types'

/**
 * Funil no MOBILE (<1024px): ACORDEÃO VERTICAL — todas as fases como caixas empilhadas (todas
 * visíveis). Caixa fechada mostra nome, contagem, total (soma de leads.value) e os pontinhos de
 * temperatura (mesma lógica do funil: heatLevel); borda esquerda = pior temperatura da fase. Clicar
 * no cabeçalho inteiro abre/fecha (várias podem ficar abertas). SEM arrastar: tocar no card abre o
 * LeadDiary (onde se move de fase). Desktop continua com colunas + arrastar.
 */

const HEAT_DOT: Record<Heat, string> = { hot: 'bg-lime', warm: 'bg-amber-500', cold: 'bg-red-500' }
const HEAT_BORDER: Record<Heat, string> = { hot: 'border-l-lime', warm: 'border-l-amber-500', cold: 'border-l-red-500' }

function HeatDot({ cls, n }: { cls: string; n: number }) {
  return (
    <span className="flex items-center gap-1">
      <span className={cn('w-1.5 h-1.5 rounded-full', cls)} />
      <span className="font-tech text-[10px] text-bento-dim tabular-nums">{n}</span>
    </span>
  )
}

export function PhaseSelectorMobile({ columns, leads, onOpenDiary }: {
  columns: ColumnConfig[]
  leads: Lead[]
  onOpenDiary: (l: Lead) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())
  const toggle = (k: string) =>
    setOpen(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  return (
    <div className="space-y-2 max-w-2xl mx-auto">
      {columns.map(col => {
        const phaseLeads = leads.filter(l => l.status === col.key)
        const count = phaseLeads.length
        const total = phaseLeads.reduce((s, l) => s + (l.value || 0), 0)
        // "Pausadas" não têm temperatura: terminais (ganho/perda), lixeira e Negócio Futuro (imune ao esfriando).
        const paused = col.tone !== 'neutral' || col.key === 'lixeira' || col.key === 'negocio_futuro'
        const heat = { hot: 0, warm: 0, cold: 0 }
        if (!paused) for (const l of phaseLeads) heat[heatLevel(l)]++
        const worst: Heat | null = heat.cold > 0 ? 'cold' : heat.warm > 0 ? 'warm' : heat.hot > 0 ? 'hot' : null
        const isOpen = open.has(col.key)
        return (
          <div key={col.key} className={cn('bento-fx overflow-hidden border-l-[3px]', worst ? HEAT_BORDER[worst] : 'border-l-bento-border')}>
            {/* Cabeçalho INTEIRO clicável (a seta é só indicador). */}
            <button type="button" onClick={() => toggle(col.key)} aria-expanded={isOpen}
              className="w-full flex items-center gap-2.5 px-3 py-3 min-h-[56px] text-left">
              <span className={cn('w-2 h-2 rounded-full flex-none', col.dotColor)} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold text-bento-text text-sm truncate">{col.label}</span>
                  <span className="font-tech text-[11px] text-bento-muted tabular-nums flex-none">({count})</span>
                </div>
                <div className="flex items-center gap-2.5 mt-0.5">
                  {total > 0 && <span className="font-tech text-[11px] text-bento-dim tabular-nums">{usdCompact(total)}</span>}
                  {!paused && worst && (
                    <span className="flex items-center gap-2.5">
                      {heat.hot > 0 && <HeatDot cls={HEAT_DOT.hot} n={heat.hot} />}
                      {heat.warm > 0 && <HeatDot cls={HEAT_DOT.warm} n={heat.warm} />}
                      {heat.cold > 0 && <HeatDot cls={HEAT_DOT.cold} n={heat.cold} />}
                    </span>
                  )}
                </div>
              </div>
              <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', isOpen && 'rotate-180')} />
            </button>

            {/* Leads da fase (empilhados). SEM arrastar — StaticLeadCard; tocar abre o LeadDiary. */}
            {isOpen && (
              <div className="px-2 pb-2 pt-1 space-y-2 border-t border-bento-border/60">
                {count === 0
                  ? <p className="text-center text-xs text-bento-muted/60 py-3 font-tech">Nenhum lead nesta fase.</p>
                  : phaseLeads.map(l => <StaticLeadCard key={l.id} lead={l} onClick={() => onOpenDiary(l)} />)}
              </div>
            )}
          </div>
        )
      })}
      <p className="font-tech text-[10px] text-bento-muted/70 text-center px-2 pt-1">
        Toque numa fase para abrir · toque num card para abrir e mover de fase
      </p>
    </div>
  )
}
