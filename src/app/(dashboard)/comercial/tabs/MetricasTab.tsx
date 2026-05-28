'use client'

import type { Lead } from '../KanbanBoard'

interface Props { leads: Lead[] }

function fmt(v: number): string {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `R$ ${(v / 1_000).toFixed(0)}k`
  if (v > 0)          return `R$ ${v.toLocaleString('pt-BR')}`
  return 'R$ 0'
}

const FUNNEL_STAGES = [
  { key: 'novo',      label: 'Novo Lead',      dotClass: 'bg-blue-500' },
  { key: 'interagiu', label: 'Interagiu',      dotClass: 'bg-indigo-500' },
  { key: 'reuniao',   label: 'Reunião',        dotClass: 'bg-purple-500' },
  { key: 'proposta',  label: 'Proposta',       dotClass: 'bg-amber-500' },
  { key: 'fechado',   label: 'Venda Feita',    dotClass: 'bg-emerald-500' },
]

export function MetricasTab({ leads }: Props) {
  const total    = leads.length
  const fechados = leads.filter(l => l.status === 'fechado').length
  const perdidos = leads.filter(l => l.status === 'perdido').length
  const brasil   = leads.filter(l => l.operation === 'brasil').length
  const eua      = leads.filter(l => l.operation === 'eua').length

  const closedValue  = leads.filter(l => l.status === 'fechado').reduce((s, l) => s + (l.value || 0), 0)
  const avgTicket    = fechados > 0 ? closedValue / fechados : 0
  const convRate     = total > 0 ? (fechados / total) * 100 : 0
  const lossRate     = total > 0 ? (perdidos / total) * 100 : 0

  const hot  = leads.filter(l => l.score > 650).length
  const warm = leads.filter(l => l.score > 400 && l.score <= 650).length
  const cold = leads.filter(l => l.score <= 400).length

  const maxCount = Math.max(...FUNNEL_STAGES.map(s => leads.filter(l => l.status === s.key).length), 1)

  return (
    <div className="p-6 space-y-5 overflow-auto h-full">
      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4">
        {[
          {
            label: 'Taxa de Conversão',
            value: `${convRate.toFixed(1)}%`,
            sub:   `${fechados} de ${total} leads`,
            cardClass: 'bg-emerald-50 border-emerald-200',
            valueClass: 'text-emerald-700',
          },
          {
            label: 'Taxa de Perda',
            value: `${lossRate.toFixed(1)}%`,
            sub:   `${perdidos} leads perdidos`,
            cardClass: 'bg-rose-50 border-rose-200',
            valueClass: 'text-rose-600',
          },
          {
            label: 'Ticket Médio',
            value: fmt(avgTicket),
            sub:   'vendas fechadas',
            cardClass: 'bg-blue-50 border-blue-200',
            valueClass: 'text-blue-700',
          },
          {
            label: 'Receita Fechada',
            value: fmt(closedValue),
            sub:   `${fechados} contratos`,
            cardClass: 'bg-primary-50 border-primary-200',
            valueClass: 'text-primary-800',
          },
        ].map(kpi => (
          <div key={kpi.label} className={`rounded-xl border p-5 ${kpi.cardClass}`}>
            <p className="text-xs text-slate-500 font-medium">{kpi.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${kpi.valueClass}`}>{kpi.value}</p>
            <p className="text-xs text-slate-400 mt-0.5">{kpi.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-5">
        {/* Funil resumido */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Funil por Etapa</h3>
          <div className="space-y-2.5">
            {FUNNEL_STAGES.map(stage => {
              const count = leads.filter(l => l.status === stage.key).length
              const pct   = maxCount > 0 ? (count / maxCount) * 100 : 0
              return (
                <div key={stage.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-1.5">
                      <div className={`w-2 h-2 rounded-full ${stage.dotClass}`} />
                      <span className="text-xs text-slate-600">{stage.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-slate-700 tabular-nums">{count}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${stage.dotClass}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Origem */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Leads por Origem</h3>
          <div className="space-y-3">
            {[
              { label: '🇧🇷 Brasil', count: brasil, barClass: 'bg-green-400' },
              { label: '🇺🇸 EUA',    count: eua,    barClass: 'bg-blue-400' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs text-slate-600">{item.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-slate-700">{item.count}</span>
                    <span className="text-[10px] text-slate-400">
                      {total > 0 ? `${((item.count / total) * 100).toFixed(0)}%` : '0%'}
                    </span>
                  </div>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${item.barClass}`}
                    style={{ width: total > 0 ? `${(item.count / total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {total > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100">
              <div className="flex justify-between">
                <div className="text-center">
                  <p className="text-xs text-slate-400">Total Leads</p>
                  <p className="text-lg font-bold text-slate-800">{total}</p>
                </div>
                <div className="text-center">
                  <p className="text-xs text-slate-400">Ativos</p>
                  <p className="text-lg font-bold text-slate-800">
                    {leads.filter(l => l.status !== 'fechado' && l.status !== 'perdido').length}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Temperatura */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-sm">
          <h3 className="font-semibold text-slate-800 mb-4 text-sm">Temperatura dos Leads</h3>
          <div className="space-y-3">
            {[
              { label: 'Quente / Fechando', count: hot,  barClass: 'bg-orange-400', textClass: 'text-orange-600' },
              { label: 'Morno / Frio',      count: warm, barClass: 'bg-yellow-400', textClass: 'text-yellow-600' },
              { label: 'Muito Frio',        count: cold, barClass: 'bg-slate-300',  textClass: 'text-slate-500' },
            ].map(item => (
              <div key={item.label}>
                <div className="flex items-center justify-between mb-1.5">
                  <span className={`text-xs font-medium ${item.textClass}`}>{item.label}</span>
                  <span className="text-xs font-semibold text-slate-700">{item.count}</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${item.barClass}`}
                    style={{ width: total > 0 ? `${(item.count / total) * 100}%` : '0%' }}
                  />
                </div>
              </div>
            ))}
          </div>

          {total > 0 && (
            <div className="mt-5 pt-4 border-t border-slate-100 grid grid-cols-3 gap-1 text-center">
              {[
                { v: hot,  label: 'Quentes', cls: 'text-orange-600' },
                { v: warm, label: 'Mornos',  cls: 'text-yellow-600' },
                { v: cold, label: 'Frios',   cls: 'text-slate-500' },
              ].map(item => (
                <div key={item.label}>
                  <p className={`text-base font-bold ${item.cls}`}>{item.v}</p>
                  <p className="text-[10px] text-slate-400">{item.label}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
