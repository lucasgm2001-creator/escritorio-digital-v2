'use client'

import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Phone, MessageCircle, FileText, ArrowRight, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { nextActionLabel } from './leadSignals'
import { LeadTasks } from './LeadTasks'
import { type Lead, type LeadStatus } from './types'

const onlyDigits = (s?: string) => (s ?? '').replace(/\D/g, '')

export function FunnelLeadCard({ lead, moveTargets, onMove, onOpenDiary, onLog, userId }: {
  lead: Lead
  coldDays?: number | null   // aceito p/ compat do KanbanColumn; NÃO usado (temperatura saiu do card)
  moveTargets: { key: LeadStatus; label: string }[]   // fases REAIS (funnel_stages) p/ o "Mover para"
  onMove: (status: LeadStatus) => void
  onOpenDiary: () => void
  onLog: (type: string) => void
  userId: string
}) {
  const [open, setOpen] = useState(false)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: lead.id })
  const style = { transform: CSS.Transform.toString(transform), transition, opacity: isDragging ? 0.3 : 1 }

  // Bolinha = marcador de DESFECHO apenas: fechado=verde, perdido=vermelho; demais status sem bolinha (sem temperatura).
  const dotClass = lead.status === 'fechado' ? 'bg-green-500'
    : lead.status === 'perdido' ? 'bg-red-500'
    : null
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
        {dotClass && <span className={cn('w-2 h-2 rounded-full flex-none', dotClass)} />}
        <div className="min-w-0 flex-1">
          <p className="font-semibold text-bento-text text-xs leading-snug truncate">{lead.name}</p>
          {(lead.company || lead.nicho) && (
            <p className="font-tech text-[10px] text-bento-muted truncate">{lead.company || lead.nicho}</p>
          )}
        </div>
        <ChevronDown className={cn('w-3.5 h-3.5 text-bento-muted flex-none transition-transform', open && 'rotate-180')} />
      </div>

      {/* Expandido */}
      {open && (
        <div className="mt-2.5 pt-2.5 border-t border-bento-border/60 space-y-2.5" onClick={stop}>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 font-tech text-[10px]">
            <Info label="Responsável" value={lead.assigned_name || '—'} />
            <Info label="Nicho" value={lead.nicho || '—'} />
            <div className="min-w-0">
              <p className="text-bento-muted">Próxima ação</p>
              <p className="font-semibold text-bento-text flex items-center gap-1 truncate">
                {next ? <><ArrowRight className="w-3 h-3 text-lime-fg flex-none" />{next}</> : '—'}
              </p>
            </div>
          </div>

          {/* Mover de fase — caixinha compacta agrupada (era pills espalhados).
              Grid de 2 colunas contido na largura de 240px; fase atual marcada. */}
          <div className="rounded-lg border border-bento-border bg-bento-bg p-2">
            <p className="font-tech text-[10px] text-bento-muted mb-1.5">Mover para</p>
            <div className="grid grid-cols-2 gap-1">
              {moveTargets.map(c => {
                const current = c.key === lead.status
                return (
                  <button
                    key={c.key}
                    onClick={() => onMove(c.key)}
                    disabled={current}
                    aria-current={current}
                    title={c.label}
                    className={cn('flex items-center gap-1 min-w-0 rounded-md border px-1.5 py-1 font-tech text-[10px] leading-tight transition-colors',
                      current
                        ? 'border-lime/50 bg-lime/15 text-lime-fg font-semibold cursor-default'
                        : 'border-bento-border/70 text-bento-dim hover:border-lime hover:text-lime-fg')}
                  >
                    {current && <Check className="w-3 h-3 flex-none" />}
                    <span className="flex-1 min-w-0 truncate text-left">{c.label}</span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Tarefas vinculadas a este lead (tasks.linked_type='lead') */}
          <LeadTasks leadId={lead.id} leadName={lead.name} userId={userId} />

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
