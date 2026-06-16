'use client'

import type { Lead } from '../types'
import { ALL_COLUMNS } from '../types'

interface Props { leads: Lead[] }

function fmt(v: number): string {
  if (v >= 1_000_000) return `US$${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `US$${(v / 1_000).toFixed(0)}k`
  if (v > 0)          return `US$${v.toLocaleString('pt-BR')}`
  return 'US$0'
}

const ALL_STAGES = ALL_COLUMNS

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
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full">
      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[
          { label: 'Pipeline Total', value: fmt(totalPipeline), sub: `${leads.length} leads` },
          { label: 'Ticket Médio',   value: fmt(avgTicket),     sub: 'por lead' },
          { label: 'Vendas Feitas',  value: fmt(leads.filter(l => l.status === 'fechado').reduce((s, l) => s + (l.value || 0), 0)), sub: `${leads.filter(l => l.status === 'fechado').length} contratos` },
        ].map(kpi => (
          <div key={kpi.label} className="bento-fx p-5">
            <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
            <p className="text-2xl font-bold text-foreground mt-1">{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-2 gap-5">
        {/* By stage */}
        <div className="bento-fx p-5">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Valor por Estágio</h3>
          <div className="space-y-3">
            {byStage.map(stage => (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                    <span className={`text-xs font-medium ${stage.textColor}`}>{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground">({stage.count})</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(stage.value)}</span>
                </div>
                <div className="h-2 bg-[#1e2533] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${stage.dotColor}`}
                    style={{ width: `${(stage.value / maxStageValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {byStage.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
            )}
          </div>
        </div>

        {/* By seller */}
        <div className="bento-fx p-5">
          <h3 className="font-semibold text-foreground mb-4 text-sm">Valor por Vendedor</h3>
          <div className="space-y-3">
            {bySeller.map(seller => (
              <div key={seller.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-lime/15 flex items-center justify-center flex-none">
                      <span className="text-[9px] font-bold text-lime-fg">
                        {seller.name.split(' ')[0][0]}
                      </span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground">{seller.name}</span>
                    <span className="text-[10px] text-muted-foreground">({seller.count})</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(seller.value)}</span>
                </div>
                <div className="h-2 bg-[#1e2533] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full bg-lime transition-all"
                    style={{ width: `${(seller.value / maxSellerValue) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {bySeller.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
