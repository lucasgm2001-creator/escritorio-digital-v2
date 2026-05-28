'use client'

import type { Lead } from '../KanbanBoard'
import { MAIN_FLOW, SECONDARY_FLOW } from '../KanbanBoard'

interface Props { leads: Lead[] }

function fmt(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`
  if (v > 0)          return `R$ ${v.toLocaleString('pt-BR')}`
  return 'R$ 0'
}

const ALL_STAGES = [...MAIN_FLOW, ...SECONDARY_FLOW]

export function PipelineTab({ leads }: Props) {
  const totalPipeline = leads.reduce((sum, l) => sum + (l.value || 0), 0)
  const avgTicket     = leads.length > 0 ? totalPipeline / leads.length : 0

  const byStage = ALL_STAGES
    .map(col => {
      const stageLeads = leads.filter(l => l.status === col.key)
      return { ...col, count: stageLeads.length, value: stageLeads.reduce((s, l) => s + (l.value || 0), 0) }
    })
    .filter(s => s.count > 0)

  const maxStageValue = Math.max(...byStage.map(s => s.value), 1)

  const sellers: Record<string, { name: string; value: number; count: number }> = {}
  leads.forEach(l => {
    const key = l.assigned_name ?? 'Sem responsável'
    if (!sellers[key]) sellers[key] = { name: key, value: 0, count: 0 }
    sellers[key].value += l.value || 0
    sellers[key].count++
  })
  const bySeller = Object.values(sellers).sort((a, b) => b.value - a.value)
  const maxSellerValue = Math.max(...bySeller.map(s => s.value), 1)

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      {/* KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pipeline Total', value: fmt(totalPipeline), sub: `${leads.length} leads` },
          { label: 'Ticket Médio',   value: fmt(avgTicket),     sub: 'por lead' },
          { label: 'Vendas Feitas',  value: fmt(leads.filter(l => l.status === 'fechado').reduce((s, l) => s + (l.value || 0), 0)), sub: `${leads.filter(l => l.status === 'fechado').length} contratos` },
        ].map(kpi => (
          <div key={kpi.label} className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
            <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
            <p className="text-2xl font-bold text-slate-900 mt-1">{kpi.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* By stage */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Valor por Estágio</h3>
          <div className="space-y-3">
            {byStage.map(stage => (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                    <span className={`text-xs font-medium ${stage.textColor}`}>{stage.label}</span>
                    <span className="text-[10px] text-slate-400">({stage.count})</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmt(stage.value)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stage.dotColor}`}
                    style={{ width: `${(stage.value / maxStageValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {byStage.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum dado disponível</p>
            )}
          </div>
        </div>

        {/* By seller */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Valor por Vendedor</h3>
          <div className="space-y-3">
            {bySeller.map(seller => (
              <div key={seller.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center flex-none">
                      <span className="text-[9px] font-bold text-primary-700">
                        {seller.name.split(' ')[0][0]}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-slate-700">{seller.name}</span>
                    <span className="text-[10px] text-slate-400">({seller.count})</span>
                  </div>
                  <span className="text-xs font-semibold text-slate-700 tabular-nums">{fmt(seller.value)}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-primary-400 transition-all"
                    style={{ width: `${(seller.value / maxSellerValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {bySeller.length === 0 && (
              <p className="text-sm text-slate-400 text-center py-4">Nenhum dado disponível</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
