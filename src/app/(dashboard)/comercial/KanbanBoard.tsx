'use client'

import { useState, useCallback, useEffect } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { DraggableTabs } from '@/components/DraggableTabs'
import { KanbanColumn } from './KanbanColumn'
import { PhaseAccordion } from './PhaseAccordion'
import { LeadCard } from './LeadCard'
import { LeadModal } from './LeadModal'
import { LeadDiary } from './LeadDiary'
import { CommissionModal } from './CommissionModal'
import { MetricasTab } from './tabs/MetricasTab'
import { VendedoresTab } from './tabs/VendedoresTab'
import { ApresentacaoTab } from './tabs/ApresentacaoTab'
import { TIERS, ALL_COLUMNS } from './types'
import type { Lead, LeadStatus } from './types'
export type { LeadStatus, Lead, ColumnConfig } from './types'

type Tab = 'funil' | 'metricas' | 'vendedores' | 'apresentacao'

interface CurrentUser { id: string; name: string }

// ── Barra de resumo do funil (rodapé) ──────────────────────────────────────────
function fmtUSDc(val: number): string {
  if (val >= 1_000_000) return `US$ ${(val / 1_000_000).toFixed(1)}M`
  if (val >= 1_000)     return `US$ ${(val / 1_000).toFixed(0)}k`
  if (val > 0)          return `US$ ${val.toLocaleString('pt-BR')}`
  return 'US$ 0'
}
const isTerminal = (s: LeadStatus) => s === 'fechado' || s === 'perdido' || s === 'lixeira'

function FunnelSummary({ leads }: { leads: Lead[] }) {
  const ativos = leads.filter(l => !isTerminal(l.status))
  const fechados = leads.filter(l => l.status === 'fechado').length
  const perdidos = leads.filter(l => l.status === 'perdido').length
  const pipeline = ativos.reduce((s, l) => s + (l.value || 0), 0)
  // Conversão = fechados / (fechados + perdidos + ativos) — sobre tudo, não só os terminais.
  const denom = fechados + perdidos + ativos.length
  const conv = denom > 0 ? ((fechados / denom) * 100).toFixed(1) : '0'
  return (
    <div className="flex-none border-t border-bento-border bg-bento-panel px-4 sm:px-6 py-2.5 flex items-center gap-x-6 gap-y-1 flex-wrap">
      <SummaryStat label="Pipeline" value={fmtUSDc(pipeline)} />
      <SummaryStat label="Conversão" value={`${conv}%`} />
      <SummaryStat label="Ativos" value={String(ativos.length)} />
      <SummaryStat label="Fechados" value={String(fechados)} accent="text-green-500" />
      <SummaryStat label="Perdidos" value={String(perdidos)} accent="text-red-400" />
      <div className="ml-auto flex items-center gap-3 font-tech text-[10px] text-bento-muted">
        <SummaryLegend cls="bg-lime" t="Quente" />
        <SummaryLegend cls="bg-amber-500" t="Atenção" />
        <SummaryLegend cls="bg-red-500" t="Esfriando" />
      </div>
    </div>
  )
}
function SummaryStat({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline gap-1.5">
      <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">{label}</span>
      <span className={cn('font-display text-sm font-bold tabular-nums', accent ?? 'text-bento-text')}>{value}</span>
    </div>
  )
}
function SummaryLegend({ cls, t }: { cls: string; t: string }) {
  return <span className="flex items-center gap-1"><span className={cn('w-2 h-2 rounded-full', cls)} />{t}</span>
}

export function KanbanBoard({ initialLeads, currentUser }: { initialLeads: Lead[], currentUser: CurrentUser }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [tab, setTab] = useState<Tab>('funil')
  const [commissionLead, setCommissionLead] = useState<Lead | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)
  // Desktop = colunas com drag; mobile = acordeão de fases. Renderiza só UM
  // (evita ids duplicados no dnd-kit). Default desktop p/ o SSR; ajusta no mount.
  const [isDesktop, setIsDesktop] = useState(true)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1024px)')
    const sync = () => setIsDesktop(mq.matches)
    sync()
    mq.addEventListener('change', sync)
    return () => mq.removeEventListener('change', sync)
  }, [])

  const supabase = createClient()

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Deep-link vindo do Hall: /comercial?lead=<id> abre o lead no funil.
  useEffect(() => {
    const leadId = new URLSearchParams(window.location.search).get('lead')
    if (!leadId) return
    const lead = leads.find(l => l.id === leadId)
    if (lead) { setTab('funil'); setSelectedLead(lead) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const TABS: { key: Tab; label: string }[] = [
    { key: 'funil',        label: 'Funil' },
    { key: 'metricas',     label: 'Métricas' },
    { key: 'apresentacao', label: 'Studio de Apresentação' },
    { key: 'vendedores',   label: 'Equipe e Comissões' },
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filteredLeads = leads   // sem segmentação Brasil/EUA

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)

  // Fluxo de "ganhou": cria atividade + cliente e abre a comissão. Centralizado
  // para arrastar E o seletor de fase (LeadDiary) dispararem o MESMO comportamento.
  const runWonFlow = useCallback(async (lead: Lead) => {
    await supabase.from('activities').insert({
      type: 'lead',
      description: `Lead ${lead.name} movido para Venda Feita`,
      user_name: currentUser.name,
      entity_id: lead.id,
    })
    const { error: clientErr } = await supabase.from('clients').insert({
      name: lead.name,
      email: lead.email ?? null,
      phone: lead.phone ?? null,
      company: lead.company ?? null,
      plan_weekly: 0,
      status: 'ativo',
      assigned_to: lead.assigned_to ?? null,
      assigned_name: lead.assigned_name ?? null,
      start_date: new Date().toISOString(),
    })
    if (clientErr) {
      showToast(`Lead movido, mas falhou ao cadastrar o cliente: ${clientErr.message}`, 'error')
    } else {
      setCommissionLead({ ...lead, status: 'fechado' })
      showToast(`Cliente ${lead.name} cadastrado automaticamente`)
    }
  }, [supabase, currentUser.name])

  // Move um lead de fase: otimista → persiste → rollback+toast se falhar → won-flow.
  const moveLeadToStatus = useCallback(async (lead: Lead, newStatus: LeadStatus): Promise<boolean> => {
    if (lead.status === newStatus) return true
    const prevStatus = lead.status
    const prevStage = lead.stage_changed_at
    const nowIso = new Date().toISOString()
    // Marca a entrada na nova fase (deal rotting) ao mover.
    setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: newStatus, stage_changed_at: nowIso } : l))   // otimista

    const { error } = await supabase
      .from('leads').update({ status: newStatus, stage_changed_at: nowIso, updated_at: nowIso }).eq('id', lead.id)
    if (error) {
      setLeads(prev => prev.map(l => l.id === lead.id ? { ...l, status: prevStatus, stage_changed_at: prevStage } : l))   // rollback
      showToast(`Não foi possível mover o lead: ${error.message}`, 'error')
      return false
    }
    if (newStatus === 'fechado' && prevStatus !== 'fechado') await runWonFlow(lead)
    return true
  }, [supabase, runWonFlow])

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return
    const leadId = active.id as string
    const overId = over.id as string
    // "over" pode ser a coluna (droppable) ou outro card (soltou sobre um card).
    const newStatus = ALL_COLUMNS.find(c => c.key === overId)?.key
      ?? leads.find(l => l.id === overId)?.status
    if (!newStatus) return
    const lead = leads.find(l => l.id === leadId)
    if (!lead) return
    await moveLeadToStatus(lead, newStatus)
  }, [leads, moveLeadToStatus])

  const handleLeadCreated = (lead: Lead) => setLeads(prev => [lead, ...prev])
  const handleLeadUpdated = (lead: Lead) => setLeads(prev => prev.map(l => l.id === lead.id ? lead : l))

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <div className="flex flex-col h-full bg-bento-bg relative font-body">
      {/* Header */}
      <div className="flex-none bg-bento-bg border-b border-bento-border">
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 sm:px-6 pt-4 pb-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="font-display font-bold text-bento-text text-lg tracking-tight">Comercial</h1>
            <span className="font-tech text-xs text-bento-muted font-medium tabular-nums">{filteredLeads.length} leads</span>
          </div>

          <button
            onClick={() => setNewLeadOpen(true)}
            className="bento-btn flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold w-full sm:w-auto"
          >
            <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Lead
          </button>
        </div>

        {/* Tabs - Draggable */}
        <div className="px-6">
          <DraggableTabs tabs={TABS} activeTab={tab} onTabChange={(key) => setTab(key as Tab)} sectionKey="comercial" />
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {/* Funil — DESKTOP: tiers horizontais (esq→dir) com caixas colapsáveis */}
        {tab === 'funil' && isDesktop && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full flex flex-col bg-bento-bg">
              <div className="flex-1 overflow-x-auto overflow-y-hidden p-4 sm:p-5">
                <div className="flex items-stretch gap-3 min-w-max h-full">
                  {TIERS.map((tier, ti) => (
                    <div key={ti} className="flex items-center gap-3 h-full">
                      <div className="flex flex-col gap-3 self-start">
                        {tier.map(col => (
                          <KanbanColumn
                            key={col.key}
                            column={col}
                            leads={filteredLeads.filter(l => l.status === col.key)}
                            onMove={moveLeadToStatus}
                            onOpenDiary={setSelectedLead}
                          />
                        ))}
                      </div>
                      {ti < TIERS.length - 1 && (
                        <svg className="w-5 h-5 text-bento-border flex-none self-center" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <FunnelSummary leads={filteredLeads} />
            </div>
            <DragOverlay>
              {activeLead ? <LeadCard lead={activeLead} isDragging /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {/* Funil — MOBILE: acordeão compacto de fases (tocar p/ abrir) */}
        {tab === 'funil' && !isDesktop && (
          <div className="h-full overflow-auto p-3 bg-bento-bg">
            <PhaseAccordion leads={filteredLeads} onLeadClick={setSelectedLead} />
          </div>
        )}

        {tab === 'metricas'     && <MetricasTab leads={filteredLeads} />}
        {tab === 'apresentacao' && <ApresentacaoTab />}
        {tab === 'vendedores'   && <VendedoresTab />}
      </div>

      {/* Modals */}
      {newLeadOpen && (
        <LeadModal
          onClose={() => setNewLeadOpen(false)}
          onCreated={handleLeadCreated}
          currentUser={currentUser}
        />
      )}

      {selectedLead && (
        <LeadDiary
          lead={selectedLead}
          onClose={() => setSelectedLead(null)}
          onUpdated={handleLeadUpdated}
          onMoveStage={(newStatus) => {
            const fresh = leads.find(l => l.id === selectedLead.id) ?? selectedLead
            return moveLeadToStatus(fresh, newStatus)
          }}
          onDeleted={(id) => { setLeads(prev => prev.filter(l => l.id !== id)); setSelectedLead(null) }}
          currentUser={currentUser}
        />
      )}

      {commissionLead && (
        <CommissionModal
          lead={commissionLead}
          currentUser={currentUser}
          onClose={() => setCommissionLead(null)}
        />
      )}

      {/* Toast notification */}
      {toast && (
        <div className={`fixed bottom-6 right-6 z-[200] flex items-center gap-3 px-4 py-3 rounded-xl border shadow-card-hover animate-slide-up ${
          toast.type === 'success'
            ? 'bg-emerald-900/90 border-emerald-700/60 text-emerald-200'
            : 'bg-red-900/90 border-red-700/60 text-red-200'
        }`}>
          {toast.type === 'success' ? (
            <svg className="w-4 h-4 text-emerald-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          ) : (
            <svg className="w-4 h-4 text-red-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          <span className="text-sm font-medium">{toast.message}</span>
          <button onClick={() => setToast(null)} className="ml-1 opacity-60 hover:opacity-100 transition-opacity">
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      )}
    </div>
  )
}
