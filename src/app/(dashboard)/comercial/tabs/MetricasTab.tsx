'use client'

import type { Lead } from '../types'
import { ALL_COLUMNS } from '../types'

interface Props { leads: Lead[] }

function fmt(v: number): string {
  if (v >= 1_000_000) return `US$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `US$ ${(v / 1_000).toFixed(0)}k`
  if (v > 0)          return `US$ ${v.toLocaleString('pt-BR')}`
  return 'US$ 0'
}

const isTerminal = (s: string) => s === 'fechado' || s === 'perdido' || s === 'lixeira'
const card = 'bento-fx p-5'

export function MetricasTab({ leads }: Props) {
  const total    = leads.length
  const fechados = leads.filter(l => l.status === 'fechado').length
  const perdidos = leads.filter(l => l.status === 'perdido').length
  const ativos   = leads.filter(l => !isTerminal(l.status))

  const closedValue = leads.filter(l => l.status === 'fechado').reduce((s, l) => s + (l.value || 0), 0)
  const pipeline    = ativos.reduce((s, l) => s + (l.value || 0), 0)
  const avgTicket   = fechados > 0 ? closedValue / fechados : 0
  const denom       = fechados + perdidos + ativos.length
  const convRate    = denom > 0 ? (fechados / denom) * 100 : 0

  const hot  = leads.filter(l => l.score > 650).length
  const warm = leads.filter(l => l.score > 400 && l.score <= 650).length
  const cold = leads.filter(l => l.score <= 400).length

  // Por estágio (contagem + valor) — usa as fases reais do funil.
  const byStage = ALL_COLUMNS.map(col => {
    const ls = leads.filter(l => l.status === col.key)
    return { ...col, count: ls.length, value: ls.reduce((s, l) => s + (l.value || 0), 0) }
  })
  const maxCount = Math.max(...byStage.map(s => s.count), 1)
  const stageWithValue = byStage.filter(s => s.count > 0)
  const maxStageValue = Math.max(...stageWithValue.map(s => s.value), 1)

  // Por vendedor.
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
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-background">
      {/* Topo: KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Pipeline Total',    value: fmt(pipeline),            sub: `${ativos.length} ativos`,        cls: 'text-foreground' },
          { label: 'Taxa de Conversão', value: `${convRate.toFixed(1)}%`, sub: `${fechados} de ${denom}`,       cls: 'text-emerald-400' },
          { label: 'Ticket Médio',      value: fmt(avgTicket),           sub: 'vendas fechadas',                cls: 'text-blue-400' },
          { label: 'Receita Fechada',   value: fmt(closedValue),         sub: `${fechados} contratos`,          cls: 'text-lime-fg' },
        ].map(kpi => (
          <div key={kpi.label} className={card}>
            <p className="text-xs text-muted-foreground font-medium">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${kpi.cls}`}>{kpi.value}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      {/* Meio: Funil por Etapa | Valor por Estágio | Valor por Vendedor */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Funil por Etapa</h3>
          <div className="space-y-2.5">
            {byStage.map(stage => (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-1.5 h-1.5 rounded-full flex-none ${stage.dotColor}`} />
                    <span className="text-xs text-muted-foreground truncate">{stage.label}</span>
                  </div>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{stage.count}</span>
                </div>
                <div className="h-1.5 bg-bento-bg rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${stage.dotColor}`} style={{ width: `${(stage.count / maxCount) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Valor por Estágio</h3>
          <div className="space-y-3">
            {stageWithValue.map(stage => (
              <div key={stage.key}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className={`w-2 h-2 rounded-full flex-none ${stage.dotColor}`} />
                    <span className={`text-xs font-medium truncate ${stage.textColor}`}>{stage.label}</span>
                    <span className="text-[10px] text-muted-foreground flex-none">({stage.count})</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(stage.value)}</span>
                </div>
                <div className="h-2 bg-bento-bg rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${stage.dotColor}`} style={{ width: `${(stage.value / maxStageValue) * 100}%` }} />
                </div>
              </div>
            ))}
            {stageWithValue.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>}
          </div>
        </div>

        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Valor por Vendedor</h3>
          <div className="space-y-3">
            {bySeller.map(seller => (
              <div key={seller.name}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-lime/15 flex items-center justify-center flex-none">
                      <span className="text-[9px] font-bold text-lime-fg">{seller.name.split(' ')[0]?.[0] ?? '?'}</span>
                    </div>
                    <span className="text-xs font-medium text-muted-foreground truncate">{seller.name}</span>
                    <span className="text-[10px] text-muted-foreground flex-none">({seller.count})</span>
                  </div>
                  <span className="text-xs font-semibold text-muted-foreground tabular-nums">{fmt(seller.value)}</span>
                </div>
                <div className="h-2 bg-bento-bg rounded-full overflow-hidden">
                  <div className="h-full rounded-full bg-lime" style={{ width: `${(seller.value / maxSellerValue) * 100}%` }} />
                </div>
              </div>
            ))}
            {bySeller.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">Nenhum dado disponível</p>}
          </div>
        </div>
      </div>

      {/* Embaixo: Resumo | Temperatura */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Resumo</h3>
          <div className="flex justify-around">
            <div className="text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold text-foreground tabular-nums">{total}</p></div>
            <div className="text-center"><p className="text-xs text-muted-foreground">Ativos</p><p className="text-lg font-bold text-foreground tabular-nums">{ativos.length}</p></div>
            <div className="text-center"><p className="text-xs text-muted-foreground">Fechados</p><p className="text-lg font-bold text-lime-fg tabular-nums">{fechados}</p></div>
          </div>
        </div>

        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Temperatura dos Leads</h3>
          <div className="space-y-3">
            {[
              { label: 'Quente', count: hot,  barClass: 'bg-orange-500', textClass: 'text-orange-400' },
              { label: 'Morno',  count: warm, barClass: 'bg-yellow-500', textClass: 'text-yellow-400' },
              { label: 'Frio',   count: cold, barClass: 'bg-slate-500',  textClass: 'text-slate-400' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${item.textClass}`}>{item.label}</span>
                  <span className="text-xs font-semibold text-foreground tabular-nums">{item.count}</span>
                </div>
                <div className="h-1.5 bg-bento-bg rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${item.barClass}`} style={{ width: total > 0 ? `${(item.count / total) * 100}%` : '0%' }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
