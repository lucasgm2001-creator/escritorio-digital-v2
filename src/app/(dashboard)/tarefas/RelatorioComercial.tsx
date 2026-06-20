'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Inbox, MessageCircle, Calendar, Trophy, Download, User, DollarSign, ListChecks } from 'lucide-react'
import { ddmm, ymd, usd } from '@/lib/format'
import { ALL_COLUMNS } from '../comercial/types'

type Mode = 'dia' | 'semana' | 'mes' | 'semestre' | 'ano'

interface Range { mode: string; start: Date; end: Date; label: string }
interface Item { kind: 'recebido' | 'interagiu' | 'reuniao' | 'fechou'; date: string; label: string; sub?: string }

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
// Semana começa na SEGUNDA.
const mondayOf = (d: Date) => { const x = startOfDay(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return x }
// Parse seguro: 'YYYY-MM-DD' (received_at) ganha hora local (T12) p/ não cair no dia anterior por fuso.
const localDate = (s: string) => new Date(s.length === 10 ? `${s}T12:00:00` : s)

function rangeFor(mode: Mode, now = new Date()): Range {
  if (mode === 'dia') return { mode, start: startOfDay(now), end: endOfDay(now), label: `Dia ${ddmm(now)}` }
  if (mode === 'semana') {
    const start = mondayOf(now)
    const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6))
    return { mode, start, end, label: `Semana de ${ddmm(start)} a ${ddmm(end)}` }
  }
  if (mode === 'mes') {
    const start = startOfDay(new Date(now.getFullYear(), now.getMonth(), 1))
    const end = endOfDay(new Date(now.getFullYear(), now.getMonth() + 1, 0))
    return { mode, start, end, label: `${MONTHS[now.getMonth()]} de ${now.getFullYear()}` }
  }
  if (mode === 'semestre') {
    const h1 = now.getMonth() < 6
    const start = startOfDay(new Date(now.getFullYear(), h1 ? 0 : 6, 1))
    const end = endOfDay(new Date(now.getFullYear(), h1 ? 6 : 12, 0))
    return { mode, start, end, label: `${h1 ? '1º' : '2º'} semestre de ${now.getFullYear()}` }
  }
  const start = startOfDay(new Date(now.getFullYear(), 0, 1))
  const end = endOfDay(new Date(now.getFullYear(), 11, 31))
  return { mode, start, end, label: `Ano de ${now.getFullYear()}` }
}

// Semana ANTERIOR completa (segunda passada → domingo passado).
function lastWeek(now = new Date()): Range {
  const thisMon = mondayOf(now)
  const start = new Date(thisMon.getFullYear(), thisMon.getMonth(), thisMon.getDate() - 7)
  const end = endOfDay(new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6))
  return { mode: 'ultima_semana', start, end, label: `Semana de ${ddmm(start)} a ${ddmm(end)}` }
}

const leadNameOf = (rel: unknown): string => {
  if (Array.isArray(rel)) return (rel[0] as { name?: string })?.name ?? 'Lead'
  return (rel as { name?: string } | null)?.name ?? 'Lead'
}

const MODES: [Mode, string][] = [['dia', 'Dia'], ['semana', 'Semana'], ['mes', 'Mês'], ['semestre', 'Semestre'], ['ano', 'Ano']]

export function RelatorioComercial() {
  const supabase = createClient()
  const [range, setRange] = useState<Range>(() => rangeFor('semana'))
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [recebidos, setRecebidos] = useState(0)
  const [interagiram, setInteragiram] = useState(0)
  const [reunioes, setReunioes] = useState(0)
  const [fecharam, setFecharam] = useState(0)
  const [porFase, setPorFase] = useState<{ key: string; label: string; count: number; dot: string }[]>([])
  const [comissaoUsd, setComissaoUsd] = useState(0)
  const [receitaUsd, setReceitaUsd] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const [pdfBusy, setPdfBusy] = useState(false)
  // Vendedor (responsável padrão) + tarefas concluídas no período por responsavel_id.
  const [sellerId, setSellerId] = useState<string | null>(null)
  const [sellerName, setSellerName] = useState('Lucas')
  const [tarefasFeitas, setTarefasFeitas] = useState(0)

  const startISO = range.start.toISOString()
  const endISO = range.end.toISOString()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const startYMD = ymd(range.start), endYMD = ymd(range.end)
      const [leadRes, msRes, allLeadsRes, wkRes, cpRes] = await Promise.all([
        // Recebidos: leads pela DATA DE CHEGADA (received_at) no período — NÃO pelo cadastro (created_at).
        supabase.from('leads').select('id, name, received_at')
          .gte('received_at', startYMD).lte('received_at', endYMD).order('received_at', { ascending: false }),
        // Interagiu / Reunião / Fechou: marcos do ciclo, pela DATA do marco (achieved_on).
        supabase.from('lead_milestones').select('id, marco, achieved_on, lead_id, leads(name)')
          .gte('achieved_on', startISO).lte('achieved_on', endISO).order('achieved_on', { ascending: false }),
        // Snapshot de leads por fase (status atual) — sem dinheiro.
        supabase.from('leads').select('status'),
        // SÓ EXIBIÇÃO (read-only): comissão/receita já registradas no período. NÃO escreve nem recalcula.
        supabase.from('weekly_payments').select('valor_usd, paid_on').gte('paid_on', startYMD).lte('paid_on', endYMD),
        supabase.from('client_payments').select('*').gte('paid_on', startYMD).lte('paid_on', endYMD),
      ])
      const err = leadRes.error || msRes.error
      setError(err ? `Erro ao carregar o relatório: ${err.message}` : null)

      const leads = leadRes.data ?? []
      const ms = msRes.data ?? []
      const distinctLeads = (marco: string) => new Set(ms.filter(x => x.marco === marco).map(x => x.lead_id)).size

      setRecebidos(leads.length)
      setInteragiram(distinctLeads('interagiu'))
      setReunioes(distinctLeads('reuniao'))
      setFecharam(distinctLeads('fechou'))

      const statusCount: Record<string, number> = {}
      for (const l of (allLeadsRes.data ?? []) as { status: string }[]) statusCount[l.status] = (statusCount[l.status] ?? 0) + 1
      setPorFase(ALL_COLUMNS.map(c => ({ key: c.key, label: c.label, count: statusCount[c.key] ?? 0, dot: c.dotColor })).filter(f => f.count > 0))
      setComissaoUsd(((wkRes.data ?? []) as { valor_usd: number }[]).reduce((s, w) => s + Number(w.valor_usd || 0), 0))
      setReceitaUsd(((cpRes.data ?? []) as { valor_usd: number; anulado?: boolean }[]).filter(r => !r.anulado).reduce((s, r) => s + Number(r.valor_usd || 0), 0))

      const merged: Item[] = [
        ...leads.map(l => ({ kind: 'recebido' as const, date: l.received_at as string, label: (l.name as string) || 'Lead' })),
        ...ms.map(x => ({ kind: x.marco as 'interagiu' | 'reuniao' | 'fechou', date: x.achieved_on as string, label: leadNameOf(x.leads) })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1))
      setItems(merged)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO])

  // Vendedor ativo (responsável padrão): nome p/ o cabeçalho + id p/ atribuir as tarefas.
  useEffect(() => {
    supabase.from('sellers').select('id, name').eq('status', 'ativo').order('created_at').limit(1)
      .then(({ data }) => { const s = data?.[0]; if (s) { setSellerId(s.id as string); setSellerName(s.name as string) } })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Tarefas CONCLUÍDAS no período, atribuídas pelo responsavel_id (alinhado ao vendedor).
  useEffect(() => {
    let q = supabase.from('tasks').select('id', { count: 'exact', head: true })
      .eq('done', true).gte('completed_at', startISO).lte('completed_at', endISO)
    if (sellerId) q = q.eq('responsavel_id', sellerId)
    q.then(({ count }) => setTarefasFeitas(count ?? 0))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO, sellerId])

  const applyCustom = () => {
    if (!customStart || !customEnd) return
    const start = startOfDay(new Date(`${customStart}T00:00:00`))
    const end = endOfDay(new Date(`${customEnd}T00:00:00`))
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return
    setRange({ mode: 'custom', start, end, label: `${ddmm(start)} a ${ddmm(end)}` })
  }

  const gerarPdf = async () => {
    setPdfBusy(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const green: [number, number, number] = [101, 163, 13]
      const dark: [number, number, number] = [25, 25, 25]
      const doc = new jsPDF()

      doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...green)
      doc.text('DR Growth', 14, 18)
      doc.setFontSize(13); doc.setTextColor(...dark); doc.text('Relatório de Atividades Comerciais', 14, 26)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110, 110, 110)
      doc.text(range.label, 14, 33)
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, 14, 38)
      doc.setDrawColor(...green); doc.setLineWidth(0.5); doc.line(14, 43, 196, 43)

      const kpis: [string, number][] = [['Leads recebidos', recebidos], ['Interagiram', interagiram], ['Reuniões', reunioes], ['Convertidos', fecharam]]
      let x = 14
      for (const [label, val] of kpis) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...dark); doc.text(String(val), x, 60)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110); doc.text(label, x, 66)
        x += 46
      }

      if (items.length) {
        autoTable(doc, {
          startY: 76,
          head: [['Data', 'Tipo', 'Detalhe']],
          body: items.map(i => [
            localDate(i.date).toLocaleDateString('pt-BR'),
            i.kind === 'recebido' ? 'Lead recebido' : i.kind === 'interagiu' ? 'Interagiu' : i.kind === 'reuniao' ? 'Reunião' : 'Fechou',
            i.label + (i.sub ? ` (${i.sub})` : ''),
          ]),
          styles: { fontSize: 9, cellPadding: 2 },
          headStyles: { fillColor: green, textColor: [20, 20, 20] },
          alternateRowStyles: { fillColor: [245, 247, 240] },
        })
      }
      doc.save(`relatorio-${range.label.replace(/[^0-9a-zA-Z]+/g, '-').toLowerCase()}.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }

  const KPIS = [
    { label: 'Leads recebidos', value: recebidos, Icon: Inbox, sub: 'novos no período' },
    { label: 'Interagiram', value: interagiram, Icon: MessageCircle, sub: 'engajaram' },
    { label: 'Reuniões', value: reunioes, Icon: Calendar, sub: 'reunião feita' },
    { label: 'Convertido em cliente', value: fecharam, Icon: Trophy, sub: 'viraram cliente' },
  ]

  return (
    <div className="space-y-5">
      {/* Cabeçalho + ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-lime-fg" />
          <h2 className="font-display font-bold text-bento-text text-base">Relatório do Vendedor</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setRange(lastWeek())}
            className="bento-btn flex items-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold">
            Gerar Relatório da Semana
          </button>
          <button onClick={gerarPdf} disabled={pdfBusy || loading}
            className="flex items-center gap-2 px-3 py-2 min-h-[44px] rounded-btn text-sm font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
            <Download className="w-4 h-4" />{pdfBusy ? 'Gerando...' : 'PDF'}
          </button>
        </div>
      </div>

      {/* Seletor de período */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1">
          {MODES.map(([m, label]) => (
            <button key={m} onClick={() => setRange(rangeFor(m))}
              className={cn('px-3 py-1.5 rounded-[8px] text-xs font-medium transition-colors',
                range.mode === m ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)}
            className="bg-bento-bg border border-bento-border rounded-btn px-2 py-1.5 text-xs text-bento-text focus:outline-none focus:border-lime" />
          <span className="text-bento-muted text-xs">→</span>
          <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)}
            className="bg-bento-bg border border-bento-border rounded-btn px-2 py-1.5 text-xs text-bento-text focus:outline-none focus:border-lime" />
          <button onClick={applyCustom} disabled={!customStart || !customEnd}
            className="px-3 py-1.5 rounded-btn text-xs font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-40">
            Aplicar
          </button>
        </div>
      </div>

      {/* Período em foco */}
      <p className="font-tech text-xs text-bento-muted">Período: <span className="text-bento-text font-semibold">{range.label}</span></p>

      {error && <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{error}</div>}

      {/* 3 números em destaque */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {KPIS.map(k => (
          <div key={k.label} className="bento-fx p-5">
            <div className="flex items-center gap-2 text-bento-muted">
              <k.Icon className="w-4 h-4" />
              <p className="text-xs font-medium">{k.label}</p>
            </div>
            <p className="font-display text-4xl font-bold text-bento-text tabular-nums mt-2 leading-none">
              {loading ? '—' : k.value}
            </p>
            <p className="font-tech text-[11px] text-bento-muted mt-1">{k.sub}</p>
          </div>
        ))}
      </div>

      {/* Vendedor responsável + leads por fase (snapshot) + receita/comissão (só exibição) */}
      <div className="bento-fx p-5">
        <div className="flex items-center gap-2 mb-3">
          <User className="w-4 h-4 text-lime-fg" />
          <h3 className="text-sm font-semibold text-bento-text">Vendedor: {sellerName}</h3>
          <span className="font-tech text-[11px] text-bento-muted">· responsável por todos os leads</span>
        </div>
        <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mb-2">Leads por fase (atual)</p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {porFase.length === 0 ? (
            <p className="text-xs text-bento-muted">{loading ? 'Carregando...' : 'Sem leads.'}</p>
          ) : porFase.map(f => (
            <div key={f.key} className="flex items-center gap-2 bg-bento-bg border border-bento-border rounded-btn px-2.5 py-1.5">
              <span className={cn('w-2 h-2 rounded-full flex-none', f.dot)} />
              <span className="text-xs text-bento-dim truncate flex-1">{f.label}</span>
              <span className="font-tech text-xs font-semibold text-bento-text tabular-nums">{f.count}</span>
            </div>
          ))}
        </div>
        {/* Receita/comissão JÁ existentes — leitura, sem recalcular nem escrever (dinheiro intocado) */}
        <div className="flex flex-wrap gap-x-6 gap-y-2 mt-4 pt-3 border-t border-bento-border/60">
          <span className="flex items-center gap-2 text-xs text-bento-muted"><DollarSign className="w-4 h-4" /> Comissão no período: <span className="font-tech text-sm font-semibold text-bento-text tabular-nums">{usd(comissaoUsd)}</span></span>
          <span className="flex items-center gap-2 text-xs text-bento-muted">Receita no período: <span className="font-tech text-sm font-semibold text-bento-text tabular-nums">{usd(receitaUsd)}</span></span>
          <span className="flex items-center gap-2 text-xs text-bento-muted"><ListChecks className="w-4 h-4" /> Tarefas concluídas: <span className="font-tech text-sm font-semibold text-bento-text tabular-nums">{tarefasFeitas}</span></span>
        </div>
      </div>

      {/* Lista detalhada */}
      <div className="bento-fx overflow-hidden">
        <div className="px-4 py-2.5 border-b border-bento-border flex items-center justify-between">
          <span className="text-sm font-semibold text-bento-text">Atividades do período</span>
          <span className="font-tech text-xs text-bento-muted">{items.length}</span>
        </div>
        <div className="divide-y divide-bento-border/60 max-h-[420px] overflow-y-auto">
          {loading ? (
            <p className="text-sm text-bento-muted text-center py-8">Carregando...</p>
          ) : items.length === 0 ? (
            <p className="text-sm text-bento-muted text-center py-8">Nenhuma atividade neste período.</p>
          ) : items.map((i, idx) => {
            const Icon = i.kind === 'recebido' ? Inbox : i.kind === 'interagiu' ? MessageCircle : i.kind === 'reuniao' ? Calendar : Trophy
            const tipo = i.kind === 'recebido' ? 'Lead recebido' : i.kind === 'interagiu' ? 'Interagiu' : i.kind === 'reuniao' ? 'Reunião' : 'Fechou'
            return (
              <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                <Icon className="w-4 h-4 text-bento-muted flex-none" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-bento-text truncate">{i.label}{i.sub ? <span className="text-bento-muted"> · {i.sub}</span> : null}</p>
                  <p className="font-tech text-[10px] text-bento-muted">{tipo}</p>
                </div>
                <span className="font-tech text-[11px] text-bento-muted tabular-nums flex-none">
                  {localDate(i.date).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
