'use client'

import { useState, useEffect, useMemo } from 'react'
import { TrendingUp } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { MetricCard, type MetricTone } from '@/components/ui/MetricCard'
import type { Lead } from '../types'
import { ALL_COLUMNS } from '../types'
import { usdCompact as fmt, ymd } from '@/lib/format'
import { rangeFor, type Mode, type Range } from '@/lib/period'

// Períodos da Métricas (default = Este mês). 'tudo' usa janela ampla (pega tudo).
const METRICAS_MODES: [Mode, string][] = [['semana', 'Esta semana'], ['mes', 'Este mês'], ['trimestre', 'Este trimestre'], ['tudo', 'Tudo']]

interface Props { leads: Lead[] }

type Milestone = { lead_id: string; marco: string; achieved_on: string }

const isTerminal = (s: string) => s === 'fechado' || s === 'perdido' || s === 'lixeira'
const card = 'bento-fx p-5'

export function MetricasTab({ leads: allLeads }: Props) {
  const [range, setRange] = useState<Range>(() => rangeFor('mes'))
  // Clientes existentes adicionados ao funil (origem='cliente_existente') NÃO entram nas métricas
  // (não são venda/lead novo). Filtra a base inteira — todos os contadores abaixo já os ignoram.
  const leads = useMemo(() => allLeads.filter(l => l.origem !== 'cliente_existente'), [allLeads])

  // Marcos do ciclo (lead_milestones) com a DATA do marco — fonte das métricas por período.
  const [milestones, setMilestones] = useState<Milestone[] | null>(null)
  useEffect(() => {
    let active = true
    createClient().from('lead_milestones').select('lead_id, marco, achieved_on').in('marco', ['reuniao', 'fechou'])
      .then(({ data, error }) => { if (active) setMilestones(error ? null : (data ?? []) as Milestone[]) })
    return () => { active = false }
  }, [])

  // RECEITA real (client_payments) + vendedor do cliente — base do card "Receita por Vendedor".
  const [revenue, setRevenue] = useState<{
    payments: { client_id: string; valor_usd: number; paid_on: string; anulado?: boolean }[]
    sellerOf: Map<string, string>
  } | null>(null)
  useEffect(() => {
    let active = true
    const supabase = createClient()
    Promise.all([
      supabase.from('client_payments').select('client_id, valor_usd, paid_on, anulado'),
      supabase.from('clients').select('id, assigned_name'),
    ]).then(([pRes, cRes]) => {
      if (!active) return
      const sellerOf = new Map<string, string>(((cRes.data ?? []) as { id: string; assigned_name: string | null }[])
        .map(c => [c.id, c.assigned_name || 'Sem responsável']))
      setRevenue({ payments: (pRes.data ?? []) as { client_id: string; valor_usd: number; paid_on: string; anulado?: boolean }[], sellerOf })
    })
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Métricas que RESPEITAM o período. Fontes reusadas: leads.created_at + lead_milestones. ──
  const m = useMemo(() => {
    const s = range.start.getTime(), e = range.end.getTime()
    const inRange = (iso?: string | null) => { if (!iso) return false; const t = new Date(iso).getTime(); return t >= s && t <= e }

    // Recebidos pela DATA DE CHEGADA (received_at, civil): compara YMD (sem fuso); fallback created_at.
    const startYMD = ymd(range.start), endYMD = ymd(range.end)
    const dayChegada = (l: Lead) => (l.received_at ?? l.created_at ?? '').slice(0, 10)
    const recebidosLeads = leads.filter(l => { const d = dayChegada(l); return d >= startYMD && d <= endYMD })
    const recebidos = recebidosLeads.length
    const pipeline = recebidosLeads.filter(l => !isTerminal(l.status)).reduce((acc, l) => acc + (l.value || 0), 0)

    const ms = (milestones ?? []).filter(x => inRange(x.achieved_on))
    const fechouIds = new Set(ms.filter(x => x.marco === 'fechou').map(x => x.lead_id))
    const reuniaoIds = new Set(ms.filter(x => x.marco === 'reuniao').map(x => x.lead_id))
    const fechados = fechouIds.size
    const closedValue = leads.filter(l => fechouIds.has(l.id)).reduce((acc, l) => acc + (l.value || 0), 0)
    const avgTicket = fechados > 0 ? closedValue / fechados : 0
    const convRate = recebidos > 0 ? (fechados / recebidos) * 100 : 0
    const convReuniao = reuniaoIds.size > 0 ? (fechouIds.size / reuniaoIds.size) * 100 : 0

    return { recebidos, fechados, pipeline, closedValue, avgTicket, convRate, convReuniao, reuniaoBase: reuniaoIds.size, fechouBase: fechouIds.size }
  }, [leads, milestones, range])

  // ── Estado ATUAL do funil (snapshot) — SÓ pelo status atual, SEM filtro nenhum (nem período, nem
  //    origem). Usa allLeads (inclui os 'cliente_existente') p/ BATER com a aba Funil e o estado real.
  //    As métricas DO PERÍODO acima (m) seguem usando `leads`, que exclui cliente_existente.
  // useMemo: recomputa só quando allLeads muda (não a cada render).
  const { total, ativos, fechadosTotal, hot, warm, cold, byStage, maxCount, stageWithValue, maxStageValue } = useMemo(() => {
    const total = allLeads.length
    const ativos = allLeads.filter(l => !isTerminal(l.status))
    const fechadosTotal = allLeads.filter(l => l.status === 'fechado').length
    const hot  = allLeads.filter(l => l.score > 650).length
    const warm = allLeads.filter(l => l.score > 400 && l.score <= 650).length
    const cold = allLeads.filter(l => l.score <= 400).length
    const byStage = ALL_COLUMNS.map(col => {
      const ls = allLeads.filter(l => l.status === col.key)
      return { ...col, count: ls.length, value: ls.reduce((acc, l) => acc + (l.value || 0), 0) }
    })
    const maxCount = Math.max(...byStage.map(x => x.count), 1)
    const stageWithValue = byStage.filter(x => x.count > 0)
    const maxStageValue = Math.max(...stageWithValue.map(x => x.value), 1)
    return { total, ativos, fechadosTotal, hot, warm, cold, byStage, maxCount, stageWithValue, maxStageValue }
  }, [allLeads])

  // Receita por vendedor = SOMA de client_payments.valor_usd (não-anulado) no PERÍODO (por paid_on),
  // agrupada pelo vendedor do cliente (clients.assigned_name). Acumula por semana (plano×4 no mês cheio).
  const { bySeller, maxSellerValue } = useMemo(() => {
    const startYMD = ymd(range.start), endYMD = ymd(range.end)
    const agg: Record<string, { name: string; value: number; clients: Set<string> }> = {}
    for (const p of (revenue?.payments ?? [])) {
      if (p.anulado) continue
      const d = (p.paid_on ?? '').slice(0, 10)
      if (d < startYMD || d > endYMD) continue
      const name = revenue?.sellerOf.get(p.client_id) ?? 'Sem responsável'
      if (!agg[name]) agg[name] = { name, value: 0, clients: new Set() }
      agg[name].value += Number(p.valor_usd) || 0
      agg[name].clients.add(p.client_id)
    }
    const list = Object.values(agg).map(x => ({ name: x.name, value: x.value, count: x.clients.size })).sort((a, b) => b.value - a.value)
    return { bySeller: list, maxSellerValue: Math.max(...list.map(x => x.value), 1) }
  }, [revenue, range])

  const KPIS: { label: string; value: string; sub: string; tone: MetricTone }[] = [
    { label: 'Recebidos',         value: String(m.recebidos),         sub: 'novos no período',                          tone: 'default' },
    { label: 'Fechados',          value: String(m.fechados),          sub: 'no período',                                tone: 'positive' },
    { label: 'Taxa de Conversão', value: `${m.convRate.toFixed(0)}%`,  sub: `${m.fechados} de ${m.recebidos} recebidos`, tone: 'emerald' },
    { label: 'Pipeline',          value: fmt(m.pipeline),             sub: 'ativos criados no período',                 tone: 'default' },
    { label: 'Ticket Médio',      value: fmt(m.avgTicket),            sub: 'vendas no período',                         tone: 'blue' },
    { label: 'Receita Fechada',   value: fmt(m.closedValue),          sub: `${m.fechados} no período`,                  tone: 'positive' },
  ]

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-background">
      {/* Seletor de período. Padrão = Este mês. Filtra os números pelo período (created_at/received_at + marcos). */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {METRICAS_MODES.map(([mode, label]) => (
            <button key={mode} onClick={() => setRange(rangeFor(mode))}
              className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium shrink-0 whitespace-nowrap transition-colors',
                range.mode === mode ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
              {label}
            </button>
          ))}
        </div>
        <p className="font-tech text-xs text-bento-muted">Período: <span className="text-bento-text font-semibold">{range.label}</span></p>
      </div>

      {/* Topo: KPIs do PERÍODO */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {KPIS.map(kpi => (
          <MetricCard key={kpi.label} size="lg" tone={kpi.tone} title={kpi.label} value={kpi.value} subtitle={kpi.sub} />
        ))}
      </div>

      {/* Conversão Reunião → Venda (no período) — base: marcos do ciclo (lead_milestones) */}
      <div className={`${card} flex items-center justify-between gap-4`}>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-muted-foreground">
            <TrendingUp className="w-4 h-4 flex-none" />
            <p className="text-xs font-medium">Conversão Reunião → Venda</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 tabular-nums">{m.fechouBase} de {m.reuniaoBase} reuniões viraram venda</p>
        </div>
        <p className="font-display text-4xl font-bold tabular-nums text-lime-fg flex-none">{m.convReuniao.toFixed(0)}%</p>
      </div>

      <p className="font-tech text-[11px] text-bento-muted">Estado atual do funil (não filtra por período):</p>

      {/* Meio: Funil por Etapa | Valor por Estágio | Valor por Vendedor (snapshot) */}
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
          <h3 className="font-semibold text-foreground mb-4 text-sm">Receita por Vendedor <span className="font-tech text-[10px] text-muted-foreground">· no período</span></h3>
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

      {/* Embaixo: Resumo | Temperatura (snapshot) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className={card}>
          <h3 className="font-semibold text-foreground mb-4 text-sm">Resumo</h3>
          <div className="flex justify-around">
            <div className="text-center"><p className="text-xs text-muted-foreground">Total</p><p className="text-lg font-bold text-foreground tabular-nums">{total}</p></div>
            <div className="text-center"><p className="text-xs text-muted-foreground">Ativos</p><p className="text-lg font-bold text-foreground tabular-nums">{ativos.length}</p></div>
            <div className="text-center"><p className="text-xs text-muted-foreground">Fechados</p><p className="text-lg font-bold text-lime-fg tabular-nums">{fechadosTotal}</p></div>
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
