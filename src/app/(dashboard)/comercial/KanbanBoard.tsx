'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
import { DraggableTabs } from '@/components/DraggableTabs'
import { KanbanColumn } from './KanbanColumn'
import { LeadCard } from './LeadCard'
import { LeadModal } from './LeadModal'
import { LeadDiary } from './LeadDiary'
import { CommissionModal } from './CommissionModal'
import { PipelineTab } from './tabs/PipelineTab'
import { MetricasTab } from './tabs/MetricasTab'
import { AgendaTab } from './tabs/AgendaTab'
import { ComissoesTab } from './tabs/ComissoesTab'
import { VendedoresTab } from './tabs/VendedoresTab'
import { ApresentacaoTab } from './tabs/ApresentacaoTab'
import { MAIN_FLOW, SECONDARY_FLOW, ALL_COLUMNS } from './types'
import type { Lead, LeadStatus } from './types'
export type { LeadStatus, Lead, ColumnConfig } from './types'

type Tab = 'funil' | 'pipeline' | 'metricas' | 'agenda' | 'comissoes' | 'vendedores' | 'apresentacao'
type OperationFilter = 'todos' | 'brasil' | 'eua'

interface CurrentUser { id: string; name: string }

export function KanbanBoard({ initialLeads, currentUser }: { initialLeads: Lead[], currentUser: CurrentUser }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<OperationFilter>('todos')
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [tab, setTab] = useState<Tab>('funil')
  const [commissionLead, setCommissionLead] = useState<Lead | null>(null)
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null)

  const supabase = createClient()

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 4000)
  }

  const TABS: { key: Tab; label: string }[] = [
    { key: 'funil',        label: 'Funil' },
    { key: 'pipeline',     label: 'Pipeline' },
    { key: 'metricas',     label: 'Métricas' },
    { key: 'agenda',       label: 'Agenda' },
    { key: 'comissoes',    label: 'Comissões' },
    { key: 'apresentacao', label: 'Apresentação' },
    { key: 'vendedores',   label: 'Vendedores' },
  ]

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  )

  const filteredLeads = filter === 'todos' ? leads : leads.filter(l => l.operation === filter)

  const handleDragStart = (e: DragStartEvent) => setActiveId(e.active.id as string)

  const handleDragEnd = useCallback(async (e: DragEndEvent) => {
    setActiveId(null)
    const { active, over } = e
    if (!over) return

    const leadId = active.id as string
    const newStatus = over.id as LeadStatus

    if (!ALL_COLUMNS.find(c => c.key === newStatus)) return

    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.status === newStatus) return

    setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l))

    await supabase.from('leads').update({ status: newStatus, updated_at: new Date().toISOString() }).eq('id', leadId)

    if (newStatus === 'fechado') {
      await supabase.from('activities').insert({
        type: 'lead',
        description: `Lead ${lead.name} movido para Venda Feita`,
        user_name: currentUser.name,
        entity_id: leadId,
      })

      await supabase.from('clients').insert({
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

      setCommissionLead({ ...lead, status: 'fechado' })
      showToast(`Cliente ${lead.name} cadastrado automaticamente`)
    }
  }, [leads, supabase, currentUser.name])

  const handleLeadCreated = (lead: Lead) => setLeads(prev => [lead, ...prev])
  const handleLeadUpdated = (lead: Lead) => setLeads(prev => prev.map(l => l.id === lead.id ? lead : l))

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <div className="flex flex-col h-full bg-background relative">
      {/* Header */}
      <div className="flex-none bg-[#0d1117] border-b border-[#2d3748]">
        <div className="flex items-center justify-between gap-2 flex-wrap px-4 sm:px-6 pt-4 pb-3">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <h1 className="font-bold text-foreground text-lg tracking-tight">Comercial</h1>
            <div className="flex gap-0.5 bg-[#161b22] rounded-lg p-0.5 border border-[#2d3748]">
              {(['todos', 'brasil', 'eua'] as OperationFilter[]).map(op => (
                <button
                  key={op}
                  onClick={() => setFilter(op)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                    filter === op
                      ? 'bg-[#1e2533] text-foreground border border-[#3d4f6a]'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {op === 'todos' ? 'Todos' : op === 'brasil' ? 'Brasil' : 'EUA'}
                </button>
              ))}
            </div>
            <span className="text-xs text-muted-foreground font-medium">{filteredLeads.length} leads</span>
          </div>

          <button
            onClick={() => setNewLeadOpen(true)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 min-h-[44px] rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors shadow-glow-sm"
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
        {tab === 'funil' && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full overflow-auto p-3 sm:p-5 bg-[#0d1117] overscroll-x-contain snap-x snap-mandatory lg:snap-none">
              {/* Mobile: scroll horizontal com snap (flex). Desktop (lg+): funil em grade
                  posicional de 5 colunas com conectores. */}
              <div className="flex lg:grid lg:grid-cols-5 gap-3 relative lg:min-w-[860px]">
                {/* Row 1: Main flow */}
                {MAIN_FLOW.map((col, idx) => (
                  <div key={col.key} className="relative snap-start shrink-0 w-[82vw] max-w-[300px] lg:w-auto lg:max-w-none lg:shrink">
                    {/* Horizontal right-arrow connector (só no funil de desktop) */}
                    {idx < MAIN_FLOW.length - 1 && (
                      <div className="absolute top-[22px] -right-2 z-20 hidden lg:flex items-center gap-0">
                        <div className="w-1.5 h-px bg-[#3d4f6a]" />
                        <svg className="w-2.5 h-2.5 text-[#3d4f6a]" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* Vertical down-arrow connector for Interagiu and Proposta */}
                    {(idx === 1 || idx === 3) && (
                      <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 hidden lg:flex flex-col items-center">
                        <div className="w-px h-2 bg-[#3d4f6a]" />
                        <svg className="w-2.5 h-2.5 text-[#3d4f6a] -mt-0.5" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    <KanbanColumn
                      column={col}
                      leads={filteredLeads.filter(l => l.status === col.key)}
                      onLeadClick={setSelectedLead}
                    />
                  </div>
                ))}

                {/* Row 2: Secondary columns */}
                {SECONDARY_FLOW.map(col => (
                  <div
                    key={col.key}
                    className="relative snap-start shrink-0 w-[82vw] max-w-[300px] mt-0 lg:mt-4 lg:w-auto lg:max-w-none lg:shrink"
                    style={{ gridColumnStart: col.parentIndex + 1 }}
                  >
                    {/* Vertical connector line up (só no funil de desktop) */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-px h-3.5 bg-[#3d4f6a] hidden lg:block" />
                    <KanbanColumn
                      column={col}
                      leads={filteredLeads.filter(l => l.status === col.key)}
                      onLeadClick={setSelectedLead}
                    />
                  </div>
                ))}
              </div>
            </div>
            <DragOverlay>
              {activeLead ? <LeadCard lead={activeLead} isDragging /> : null}
            </DragOverlay>
          </DndContext>
        )}

        {tab === 'pipeline'     && <PipelineTab leads={filteredLeads} />}
        {tab === 'metricas'     && <MetricasTab leads={filteredLeads} />}
        {tab === 'agenda'       && <AgendaTab leads={filteredLeads} />}
        {tab === 'comissoes'    && <ComissoesTab currentUser={currentUser} />}
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
