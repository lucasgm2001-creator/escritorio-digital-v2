'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, MessageCircle, FileText, ArrowRight, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { daysInStage, heatLevel, nextActionLabel, type Heat } from './leadSignals'
import { ALL_COLUMNS, type Lead, type LeadStatus } from './types'

const HEAT: Record<Heat, { dot: string; text: string; label: string }> = {
  hot:  { dot: 'bg-lime',      text: 'text-lime-fg',   label: 'Quente' },
  warm: { dot: 'bg-amber-500', text: 'text-amber-400', label: 'Atenção' },
  cold: { dot: 'bg-red-500',   text: 'text-red-400',   label: 'Esfriando' },
}

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '')

export function FunnelLeadCard({ lead, onMove, onOpenDiary, onLog }: {
  lead: Lead
  onMove: (status: LeadStatus) => void
  onOpenDiary: () => void
  onLog: (type: string) => void
}) {
  const [open, setOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  const terminal = lead.status === 'fechado' || lead.status === 'perdido' || lead.status === 'lixeira'
  const heat = heatLevel(lead)
  const dotClass = lead.status === 'fechado' ? 'bg-green-500'
    : lead.status === 'perdido' ? 'bg-red-500'
    : lead.status === 'lixeira' ? 'bg-bento-muted'
    : HEAT[heat].dot
  const days = daysInStage(lead)
  const next = nextActionLabel(lead)
  const phone = onlyDigits(lead.phone)
  const stop = (e: React.MouseEvent) => e.stopPropagation()

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      onClick={() => setOpen(o => !o)}
      className={cn('bento-fx p-2.5 cursor-pointer select-none transition-colors', open && 'border-lime/40')}
    >
      {/* Topo (sempre visível) */}
      <div className="flex items-center gap-2">
        <span className={cn('w-2 h-2 rounded-full flex-none', dotClass)} />
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-bento-text text-xs leading-snug truncate">{lead.name}</p>
          {(lead.company || lead.nicho) && (
            <p className="font-tech text-[10px] text-bento-muted truncate">{lead.company || lead.nicho}</p>
          )}
        </div>
        {!terminal && (
          <span className={cn('font-tech text-[10px] font-bold tabular-nums px-1 py-px rounded flex-none',
            heat === 'hot' ? 'text-lime-fg bg-lime/15'
              : heat === 'warm' ? 'text-amber-400 bg-amber-400/[0.12]'
              : 'text-red-400 bg-red-400/[0.12]')}>
            {days}D
          </span>
        )}
        <ChevronDown className={cn('w-3.5 h-3.5 text-bento-muted flex-none transition-transform', open && 'rotate-180')} />
      </div>

      {/* Expandido */}
      {open && (
        <div className="mt-2.5 pt-2.5 border-t border-bento-border/60 space-y-2.5" onClick={stop}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-tech text-[10px]">
            <Info label="Responsável" value={lead.assigned_name || '—'} />
            <Info label="Nicho" value={lead.nicho || '—'} />
            <div className="min-w-0">
              <p className="text-bento-muted">Temperatura</p>
              <p className={cn('font-semibold', terminal ? 'text-bento-dim' : HEAT[heat].text)}>
                {terminal ? '—' : HEAT[heat].label}
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-bento-muted">Próxima ação</p>
              <p className="font-semibold text-bento-text flex items-center gap-1 truncate">
                {next ? <><ArrowRight className="w-3 h-3 text-lime-fg flex-none" />{next}</> : '—'}
              </p>
            </div>
          </div>

          {/* Mover de fase (pills) */}
          <div>
            <p className="font-tech text-[10px] text-bento-muted mb-1">Mover para</p>
            <div className="flex flex-wrap gap-1">
              {ALL_COLUMNS.map(c => (
                <button
                  key={c.key}
                  onClick={() => onMove(c.key)}
                  disabled={c.key === lead.status}
                  className={cn('font-tech text-[10px] px-1.5 py-0.5 rounded border transition-colors',
                    c.key === lead.status
                      ? 'border-lime/40 bg-lime/15 text-lime-fg cursor-default'
                      : 'border-bento-border text-bento-dim hover:border-lime hover:text-lime-fg')}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </div>

          {/* Registrar contato (alimenta o relatório de engajamento) */}
          <div>
            <p className="font-tech text-[10px] text-bento-muted mb-1">Registrar contato</p>
            <div className="grid grid-cols-3 gap-1.5">
              <button onClick={(e) => { stop(e); onLog('atendeu') }}
                className="py-1.5 rounded-md border font-tech text-[10px] transition-colors text-lime-fg bg-lime/10 border-lime/30 hover:bg-lime/20">Atendeu</button>
              <button onClick={(e) => { stop(e); onLog('mensagem') }}
                className="py-1.5 rounded-md border font-tech text-[10px] transition-colors text-blue-400 bg-blue-400/10 border-blue-400/30 hover:bg-blue-400/20">Mensagem</button>
              <button onClick={(e) => { stop(e); onLog('nao_atendeu') }}
                className="py-1.5 rounded-md border font-tech text-[10px] transition-colors text-red-400 bg-red-400/10 border-red-400/30 hover:bg-red-400/20">Não atend.</button>
            </div>
          </div>

          {/* Ações rápidas */}
          <div className="grid grid-cols-3 gap-1.5">
            <a
              href={phone ? `tel:${phone}` : undefined}
              onClick={stop}
              className={cn('flex items-center justify-center gap-1 py-1.5 rounded-md border font-tech text-[10px] transition-colors',
                phone ? 'border-bento-border text-bento-dim hover:border-lime hover:text-lime-fg' : 'border-bento-border/50 text-bento-muted/40 pointer-events-none')}
            >
              <Phone className="w-3 h-3" /> Ligar
            </a>
            <a
              href={phone ? `https://wa.me/${phone}` : undefined}
              target="_blank"
              rel="noopener noreferrer"
              onClick={stop}
              className={cn('flex items-center justify-center gap-1 py-1.5 rounded-md border font-tech text-[10px] transition-colors',
                phone ? 'border-bento-border text-bento-dim hover:border-lime hover:text-lime-fg' : 'border-bento-border/50 text-bento-muted/40 pointer-events-none')}
            >
              <MessageCircle className="w-3 h-3" /> WhatsApp
            </a>
            <button
              onClick={(e) => { stop(e); onOpenDiary() }}
              className="flex items-center justify-center gap-1 py-1.5 rounded-md border border-bento-border text-bento-dim hover:border-lime hover:text-lime-fg font-tech text-[10px] transition-colors"
            >
              <FileText className="w-3 h-3" /> Nota
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <p className="text-bento-muted">{label}</p>
      <p className="font-semibold text-bento-text truncate">{value}</p>
    </div>
  )
}
