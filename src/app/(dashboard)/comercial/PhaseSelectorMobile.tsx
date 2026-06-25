'use client'

import { useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usdCompact } from '@/lib/format'
import { StaticLeadCard } from './LeadCard'
import { type ColumnConfig, type Lead } from './types'

/**
 * Funil no MOBILE (<1024px): ACORDEÃO VERTICAL agrupado por `grupo` (faixa/cabeçalho de seção, igual
 * ao desktop, DINÂMICO de funnel_stages → grupo novo ganha faixa). Todas as fases começam FECHADAS.
 * COR POR FASE = a cor da própria fase (`cor` do banco); fallback p/ a identidade fixa por slug e,
 * por fim, neutro. SEM arrastar: tocar no card abre o LeadDiary. (Desktop intocado.)
 */

// Fallback de cor por slug (identidade visual antiga) — usado só quando a fase não tem `cor` própria.
const PHASE_COLOR: Record<string, string> = {
  novo: '#5B93C7',
  interagiu: '#54B981',
  nao_interagiu: '#E9B23A',
  reuniao: '#54B981',
  no_show: '#EF6A4D',
  reagendamento: '#E9B23A',
  proposta: '#E9B23A',
  negocio_futuro: '#E9B23A',
  fechado: '#22C55E',
  perdido: '#E23B30',
  lixeira: '#717784',
}
// Cor da fase: `cor` do banco vence; senão a identidade fixa por slug; senão neutro.
const colorOf = (col: ColumnConfig) => col.cor || PHASE_COLOR[col.key] || '#717784'

export function PhaseSelectorMobile({ columns, leads, onOpenDiary }: {
  columns: ColumnConfig[]
  leads: Lead[]
  onOpenDiary: (l: Lead) => void
}) {
  const [open, setOpen] = useState<Set<string>>(new Set())   // todas FECHADAS por padrão
  const toggle = (k: string) =>
    setOpen(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  // Faixas = valores DISTINTOS de `grupo` (ordem da menor posicao, pois columns já vem por posicao);
  // grupo null → "Sem grupo". Nada hardcoded → grupo novo ganha faixa automaticamente.
  const groups = useMemo(() => {
    const map = new Map<string, ColumnConfig[]>()
    for (const col of columns) {
      const g = (col.grupo && col.grupo.trim()) || 'Sem grupo'
      if (!map.has(g)) map.set(g, [])
      map.get(g)!.push(col)
    }
    return Array.from(map.entries()).map(([name, cols]) => ({ name, cols }))
  }, [columns])

  return (
    <div className="space-y-4 max-w-2xl mx-auto">
      {groups.map(g => (
        <div key={g.name} className="space-y-2">
          {/* Faixa/cabeçalho do grupo (nome atual) */}
          <div className="px-1">
            <span className="font-tech text-[10px] uppercase tracking-[0.14em] text-bento-muted">{g.name}</span>
          </div>
          {g.cols.map(col => {
            const phaseLeads = leads.filter(l => l.status === col.key)
            const total = phaseLeads.reduce((s, l) => s + (l.value || 0), 0)
            const color = colorOf(col)
            const isOpen = open.has(col.key)
            return (
              <div key={col.key} className="bento-fx overflow-hidden" style={{ borderLeft: `3px solid ${color}` }}>
                {/* Cabeçalho INTEIRO clicável (a seta é só indicador). */}
                <button type="button" onClick={() => toggle(col.key)} aria-expanded={isOpen}
                  className="w-full flex items-center gap-2.5 px-3 py-3 min-h-[56px] text-left">
                  <span className="w-2 h-2 rounded-full flex-none" style={{ backgroundColor: color }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-display font-bold text-bento-text text-sm truncate">{col.label}</span>
                      <span className="font-tech text-[11px] text-bento-muted tabular-nums flex-none">({phaseLeads.length})</span>
                    </div>
                    {total > 0 && <span className="font-tech text-[11px] text-bento-dim tabular-nums">{usdCompact(total)}</span>}
                  </div>
                  <ChevronDown className={cn('w-4 h-4 text-bento-muted flex-none transition-transform', isOpen && 'rotate-180')} />
                </button>

                {/* Leads (empilhados). SEM arrastar — StaticLeadCard; tocar abre o LeadDiary. */}
                {isOpen && (
                  <div className="px-2 pb-2 pt-1 space-y-2 border-t border-bento-border/60">
                    {phaseLeads.length === 0
                      ? <p className="text-center text-xs text-bento-muted/60 py-3 font-tech">Nenhum lead nesta fase.</p>
                      : phaseLeads.map(l => <StaticLeadCard key={l.id} lead={l} onClick={() => onOpenDiary(l)} />)}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      ))}
      <p className="font-tech text-[10px] text-bento-muted/70 text-center px-2 pt-1">
        Toque numa fase para abrir · toque num card para abrir e mover de fase
      </p>
    </div>
  )
}
