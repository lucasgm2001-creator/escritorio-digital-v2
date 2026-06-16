'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Inbox, MessageCircle, Calendar, Download } from 'lucide-react'

type Mode = 'dia' | 'semana' | 'mes' | 'semestre' | 'ano'

interface Range { mode: string; start: Date; end: Date; label: string }
interface Item { kind: 'recebido' | 'engajou' | 'reuniao'; date: string; label: string; sub?: string }

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const ddmm = (d: Date) => `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`
const ymd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
const startOfDay = (d: Date) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x }
const endOfDay = (d: Date) => { const x = new Date(d); x.setHours(23, 59, 59, 999); return x }
// Semana começa na SEGUNDA.
const mondayOf = (d: Date) => { const x = startOfDay(d); const wd = x.getDay(); x.setDate(x.getDate() + (wd === 0 ? -6 : 1 - wd)); return x }

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
  const [engajados, setEngajados] = useState(0)
  const [reunioes, setReunioes] = useState(0)
  const [items, setItems] = useState<Item[]>([])
  const [pdfBusy, setPdfBusy] = useState(false)

  const startISO = range.start.toISOString()
  const endISO = range.end.toISOString()

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      const startYMD = ymd(range.start)
      const endYMD = ymd(range.end)
      const [leadRes, engRes, mtgRes] = await Promise.all([
        // Leads recebidos: criados no período.
        supabase.from('leads').select('id, name, created_at')
          .gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false }),
        // Engajados: interações em que o lead RESPONDEU (atendeu/mensagem/reuniao). "nao_atendeu"/"nota" não contam.
        supabase.from('lead_interactions').select('id, type, created_at, lead_id, leads(name)')
          .in('type', ['atendeu', 'mensagem', 'reuniao']).gte('created_at', startISO).lte('created_at', endISO).order('created_at', { ascending: false }),
        // Reuniões agendadas: pela DATA da reunião (met_on) no período.
        supabase.from('meetings').select('id, met_on, client_name')
          .gte('met_on', startYMD).lte('met_on', endYMD).order('met_on', { ascending: false }),
      ])
      const err = leadRes.error || engRes.error || mtgRes.error
      setError(err ? `Erro ao carregar o relatório: ${err.message}` : null)

      const leads = leadRes.data ?? []
      const eng = engRes.data ?? []
      const mtg = mtgRes.data ?? []

      setRecebidos(leads.length)
      setEngajados(new Set(eng.map(e => e.lead_id)).size)   // leads distintos que responderam
      setReunioes(mtg.length)

      const merged: Item[] = [
        ...leads.map(l => ({ kind: 'recebido' as const, date: l.created_at as string, label: (l.name as string) || 'Lead' })),
        ...eng.map(e => ({ kind: 'engajou' as const, date: e.created_at as string, label: leadNameOf(e.leads), sub: e.type === 'atendeu' ? 'Atendeu' : 'Mensagem' })),
        ...mtg.map(m => ({ kind: 'reuniao' as const, date: `${m.met_on as string}T12:00:00`, label: (m.client_name as string) || 'Reunião' })),
      ].sort((a, b) => (a.date < b.date ? 1 : -1))
      setItems(merged)
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO])

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

      const kpis: [string, number][] = [['Leads recebidos', recebidos], ['Leads engajados', engajados], ['Reuniões agendadas', reunioes]]
      let x = 14
      for (const [label, val] of kpis) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...dark); doc.text(String(val), x, 60)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(110, 110, 110); doc.text(label, x, 66)
        x += 64
      }

      if (items.length) {
        autoTable(doc, {
          startY: 76,
          head: [['Data', 'Tipo', 'Detalhe']],
          body: items.map(i => [
            new Date(i.date).toLocaleDateString('pt-BR'),
            i.kind === 'recebido' ? 'Lead recebido' : i.kind === 'engajou' ? 'Engajou' : 'Reunião agendada',
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
    { label: 'Leads engajados', value: engajados, Icon: MessageCircle, sub: 'responderam' },
    { label: 'Reuniões agendadas', value: reunioes, Icon: Calendar, sub: 'no período' },
  ]

  return (
    <div className="space-y-5">
      {/* Cabeçalho + ações */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Calendar className="w-4 h-4 text-lime-fg" />
          <h2 className="font-display font-bold text-bento-text text-base">Relatório de Atividades</h2>
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
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
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
            const Icon = i.kind === 'recebido' ? Inbox : i.kind === 'engajou' ? MessageCircle : Calendar
            const tipo = i.kind === 'recebido' ? 'Lead recebido' : i.kind === 'engajou' ? 'Engajou' : 'Reunião agendada'
            return (
              <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                <Icon className="w-4 h-4 text-bento-muted flex-none" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-bento-text truncate">{i.label}{i.sub ? <span className="text-bento-muted"> · {i.sub}</span> : null}</p>
                  <p className="font-tech text-[10px] text-bento-muted">{tipo}</p>
                </div>
                <span className="font-tech text-[11px] text-bento-muted tabular-nums flex-none">
                  {new Date(i.date).toLocaleDateString('pt-BR')}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
