'use client'

import { useState, useCallback } from 'react'
import {
  DndContext, DragOverlay, PointerSensor, useSensor, useSensors,
  type DragStartEvent, type DragEndEvent,
} from '@dnd-kit/core'
import { createClient } from '@/lib/supabase/client'
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

export type LeadStatus = 'novo' | 'interagiu' | 'reuniao' | 'proposta' | 'fechado' | 'nao_interagiu' | 'perdido'

export interface Lead {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  value: number
  status: LeadStatus
  score: number
  operation: 'brasil' | 'eua'
  assigned_to?: string
  assigned_name?: string
  notes?: string
  last_contact_at?: string
  created_at: string
}

export interface ColumnConfig {
  key: LeadStatus
  label: string
  textColor: string
  bgColor: string
  dotColor: string
  borderColor: string
}

export const MAIN_FLOW: ColumnConfig[] = [
  { key: 'novo',      label: 'Novo Lead',   textColor: 'text-blue-600',    bgColor: 'bg-blue-50',    dotColor: 'bg-blue-500',    borderColor: 'border-blue-200' },
  { key: 'interagiu', label: 'Interagiu',   textColor: 'text-indigo-600',  bgColor: 'bg-indigo-50',  dotColor: 'bg-indigo-500',  borderColor: 'border-indigo-200' },
  { key: 'reuniao',   label: 'Reunião',     textColor: 'text-purple-600',  bgColor: 'bg-purple-50',  dotColor: 'bg-purple-500',  borderColor: 'border-purple-200' },
  { key: 'proposta',  label: 'Proposta',    textColor: 'text-amber-600',   bgColor: 'bg-amber-50',   dotColor: 'bg-amber-500',   borderColor: 'border-amber-200' },
  { key: 'fechado',   label: 'Venda Feita', textColor: 'text-emerald-700', bgColor: 'bg-emerald-50', dotColor: 'bg-emerald-500', borderColor: 'border-emerald-200' },
]

export const SECONDARY_FLOW: (ColumnConfig & { parentIndex: number })[] = [
  { key: 'nao_interagiu', label: 'Não Interagiu', textColor: 'text-slate-500',  bgColor: 'bg-slate-50',  dotColor: 'bg-slate-400',  borderColor: 'border-slate-200', parentIndex: 1 },
  { key: 'perdido',       label: 'Venda Perdida', textColor: 'text-rose-600',   bgColor: 'bg-rose-50',   dotColor: 'bg-rose-500',   borderColor: 'border-rose-200',  parentIndex: 3 },
]

export const ALL_COLUMNS: ColumnConfig[] = [...MAIN_FLOW, ...SECONDARY_FLOW]

type Tab = 'funil' | 'pipeline' | 'metricas' | 'agenda' | 'comissoes' | 'vendedores'
type OperationFilter = 'todos' | 'brasil' | 'eua'

interface CurrentUser { id: string; name: string; role: string }

export function KanbanBoard({ initialLeads, currentUser }: { initialLeads: Lead[], currentUser: CurrentUser }) {
  const [leads, setLeads] = useState<Lead[]>(initialLeads)
  const [activeId, setActiveId] = useState<string | null>(null)
  const [filter, setFilter] = useState<OperationFilter>('todos')
  const [newLeadOpen, setNewLeadOpen] = useState(false)
  const [selectedLead, setSelectedLead] = useState<Lead | null>(null)
  const [tab, setTab] = useState<Tab>('funil')
  const [commissionLead, setCommissionLead] = useState<Lead | null>(null)

  const supabase = createClient()

  const canSeeVendedores = currentUser.role === 'admin' || currentUser.role === 'financeiro'

  const TABS: { key: Tab; label: string }[] = [
    { key: 'funil',      label: 'Funil' },
    { key: 'pipeline',   label: 'Pipeline' },
    { key: 'metricas',   label: 'Métricas' },
    { key: 'agenda',     label: 'Agenda' },
    { key: 'comissoes',  label: 'Comissões' },
    ...(canSeeVendedores ? [{ key: 'vendedores' as Tab, label: 'Vendedores' }] : []),
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
    }
  }, [leads, supabase, currentUser.name])

  const handleLeadCreated = (lead: Lead) => setLeads(prev => [lead, ...prev])
  const handleLeadUpdated = (lead: Lead) => setLeads(prev => prev.map(l => l.id === lead.id ? lead : l))

  const activeLead = activeId ? leads.find(l => l.id === activeId) : null

  return (
    <div className="flex flex-col h-full" style={{ background: 'linear-gradient(180deg, #f8fafc 0%, #f1f5f9 100%)' }}>
      {/* Header */}
      <div className="flex-none bg-white border-b border-slate-200 shadow-sm">
        <div className="flex items-center justify-between px-6 pt-5 pb-3">
          <div className="flex items-center gap-3">
            <h1 className="font-bold text-slate-900 text-xl tracking-tight">Comercial</h1>
            <div className="flex gap-0.5 bg-slate-100 rounded-lg p-1 border border-slate-200">
              {(['todos', 'brasil', 'eua'] as OperationFilter[]).map(op => (
                <button
                  key={op}
                  onClick={() => setFilter(op)}
                  className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                    filter === op
                      ? 'bg-white text-slate-900 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {op === 'todos' ? 'Todos' : op === 'brasil' ? '🇧🇷 Brasil' : '🇺🇸 EUA'}
                </button>
              ))}
            </div>
            <span className="text-sm text-slate-400 font-medium">{filteredLeads.length} leads</span>
          </div>

          <button
            onClick={() => setNewLeadOpen(true)}
            className="flex items-center gap-2 bg-primary-900 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-800 active:bg-primary-950 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            Novo Lead
          </button>
        </div>

        {/* Tabs */}
        <div className="flex px-6 gap-0 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
                tab === t.key
                  ? 'border-primary-700 text-primary-700'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {tab === 'funil' && (
          <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
            <div className="h-full overflow-auto p-5">
              <div className="grid grid-cols-5 gap-3 relative" style={{ minWidth: 900 }}>
                {/* Row 1: Main flow */}
                {MAIN_FLOW.map((col, idx) => (
                  <div key={col.key} className="relative">
                    {/* Horizontal right-arrow connector */}
                    {idx < MAIN_FLOW.length - 1 && (
                      <div className="absolute top-[22px] -right-2 z-20 flex items-center gap-0">
                        <div className="w-1.5 h-px bg-slate-300" />
                        <svg className="w-2.5 h-2.5 text-slate-300" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                      </div>
                    )}
                    {/* Vertical down-arrow connector for Interagiu and Proposta */}
                    {(idx === 1 || idx === 3) && (
                      <div className="absolute -bottom-3.5 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center">
                        <div className="w-px h-2 bg-slate-300" />
                        <svg className="w-2.5 h-2.5 text-slate-300 -mt-0.5" fill="currentColor" viewBox="0 0 20 20">
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
                    className="relative mt-4"
                    style={{ gridColumnStart: col.parentIndex + 1 }}
                  >
                    {/* Vertical connector line up */}
                    <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 w-px h-3.5 bg-slate-300" />
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

        {tab === 'pipeline'  && <PipelineTab leads={filteredLeads} />}
        {tab === 'metricas'  && <MetricasTab leads={filteredLeads} />}
        {tab === 'agenda'    && <AgendaTab leads={filteredLeads} />}
        {tab === 'comissoes' && <ComissoesTab currentUser={currentUser} />}
        {tab === 'vendedores' && canSeeVendedores && <VendedoresTab />}
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
    </div>
  )
}
