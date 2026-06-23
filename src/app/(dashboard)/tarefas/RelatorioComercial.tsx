'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Download, ChevronDown } from 'lucide-react'
import { rangeFor, type Mode, type Range } from '@/lib/period'

// ── Relatório — Movimentação do Funil. Fonte = stage_events (histórico de mudança de fase),
//    com JOIN em leads p/ empresa e p/ excluir Lixeira. Tema = global do app (sem botão de tema).
//    Dinheiro NÃO entra aqui (só movimentação). ────────────────────────────────────────────────

type SectionKey = 'entrou' | 'interagiu' | 'naoint' | 'reuniao' | 'noshow' | 'reag' | 'proposta' | 'futuro' | 'fechou' | 'perdido'

// Ordem dos cards de detalhe + mapeamento slug do funil → seção do relatório.
const SECTIONS: { key: SectionKey; slug: string; t: string; ac: string }[] = [
  { key: 'entrou',   slug: 'novo',           t: 'Entraram (Novos)',          ac: '#64748b' },
  { key: 'interagiu',slug: 'interagiu',      t: 'Interagiram',               ac: '#9bc91f' },
  { key: 'naoint',   slug: 'nao_interagiu',  t: 'Não interagiram',           ac: '#94a3b8' },
  { key: 'reuniao',  slug: 'reuniao',        t: 'Reunião marcada',           ac: '#3b82f6' },
  { key: 'noshow',   slug: 'no_show',        t: 'No-show',                   ac: '#ef4444' },
  { key: 'reag',     slug: 'reagendamento',  t: 'Reagendamento',             ac: '#f59e0b' },
  { key: 'proposta', slug: 'proposta',       t: 'Proposta em análise',       ac: '#8b5cf6' },
  { key: 'futuro',   slug: 'negocio_futuro', t: 'Negócio futuro',            ac: '#14b8a6' },
  { key: 'fechou',   slug: 'fechado',        t: 'Fechou (Venda Concluída)',  ac: '#22c55e' },
  { key: 'perdido',  slug: 'perdido',        t: 'Não fechou (Venda Perdida)',ac: '#ef4444' },
]
const SLUG_TO_KEY: Record<string, SectionKey> = Object.fromEntries(SECTIONS.map(s => [s.slug, s.key]))
const REPORT_MODES: [Mode, string][] = [['semana', 'Semana'], ['mes', 'Mês'], ['semestre', 'Semestre'], ['ano', 'Ano']]

const MONTHS_ABBR = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']
const fmtDay = (iso: string) => { const d = new Date(iso); return `${String(d.getDate()).padStart(2, '0')}/${MONTHS_ABBR[d.getMonth()]}` }

interface LeadRow { nm: string; co: string; date: string }
interface StageEventRow {
  lead_name: string | null
  to_stage: string
  changed_at: string
  seller_name: string | null
  leads: { company: string | null; status: string | null } | { company: string | null; status: string | null }[] | null
}

export function RelatorioComercial() {
  const supabase = createClient()
  const [range, setRange] = useState<Range>(() => rangeFor('semana'))
  const [seller, setSeller] = useState<'todos' | 'lucas'>('todos')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<StageEventRow[]>([])
  const [open, setOpen] = useState<Set<SectionKey>>(() => new Set(SECTIONS.map(s => s.key)))
  const [pdfBusy, setPdfBusy] = useState(false)

  const startISO = range.start.toISOString()
  const endISO = range.end.toISOString()

  // Busca os eventos do período (+ seller). Exclui Lixeira (status atual do lead) e leads de teste.
  useEffect(() => {
    let active = true
    const load = async () => {
      setLoading(true)
      let q = supabase.from('stage_events')
        .select('lead_name, to_stage, changed_at, seller_name, leads(company, status)')
        .gte('changed_at', startISO).lte('changed_at', endISO)
        .order('changed_at', { ascending: false })
      if (seller === 'lucas') q = q.ilike('seller_name', '%lucas%')
      const { data, error } = await q
      if (!active) return
      if (error) { setError(`Erro ao carregar o relatório: ${error.message}`); setRows([]); setLoading(false); return }
      const clean = ((data ?? []) as unknown as StageEventRow[]).filter(r => {
        const name = (r.lead_name ?? '').toLowerCase()
        if (name.includes('teste') || name.includes('test')) return false   // leads de teste fora
        const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads
        if (lead?.status === 'lixeira') return false                        // Lixeira fora
        return true
      })
      setError(null); setRows(clean); setLoading(false)
    }
    load()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startISO, endISO, seller])

  // Cards: ABERTOS na Semana; FECHADOS em Mês/Semestre/Ano. Reavalia ao trocar o período.
  useEffect(() => {
    setOpen(range.mode === 'semana' ? new Set(SECTIONS.map(s => s.key)) : new Set())
  }, [range.mode])

  const bySection = useMemo(() => {
    const m = new Map<SectionKey, LeadRow[]>()
    for (const s of SECTIONS) m.set(s.key, [])
    for (const r of rows) {
      const key = SLUG_TO_KEY[r.to_stage]
      if (!key) continue
      const lead = Array.isArray(r.leads) ? r.leads[0] : r.leads
      m.get(key)!.push({ nm: r.lead_name ?? 'Lead', co: lead?.company || '—', date: r.changed_at })
    }
    return m
  }, [rows])

  const count = (k: SectionKey) => bySection.get(k)?.length ?? 0
  const entraram = count('entrou')
  const reunioes = count('reuniao')
  const pct = (n: number, base: number) => (base > 0 ? Math.round((n / base) * 100) : 0)

  // Boxes de conversão (% sempre sobre Entraram).
  const steps: { t: string; n: number; sub: number | null }[] = [
    { t: 'Entraram',        n: entraram,          sub: null },
    { t: 'Interagiram',     n: count('interagiu'),sub: pct(count('interagiu'), entraram) },
    { t: 'Reunião marcada', n: reunioes,          sub: pct(reunioes, entraram) },
    { t: 'Proposta',        n: count('proposta'), sub: pct(count('proposta'), entraram) },
    { t: 'Fechou',          n: count('fechou'),   sub: pct(count('fechou'), entraram) },
  ]
  // Secundárias.
  const rates: { t: string; v: string; bad?: boolean }[] = [
    { t: 'No-show (sobre reuniões)', v: `${pct(count('noshow'), reunioes)}%`, bad: true },
    { t: 'Reagendamento',           v: String(count('reag')) },
    { t: 'Negócio futuro',          v: String(count('futuro')) },
    { t: 'Não fechou',              v: String(count('perdido')), bad: true },
  ]

  const toggle = (k: SectionKey) => setOpen(prev => { const n = new Set(prev); if (n.has(k)) n.delete(k); else n.add(k); return n })

  // PDF limpo e paginado (tema claro), com TODOS os eventos do período expandidos.
  const gerarPdf = async () => {
    setPdfBusy(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const green: [number, number, number] = [101, 163, 13]
      const dark: [number, number, number] = [25, 25, 25]
      const doc = new jsPDF()

      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...green); doc.text('DR Growth', 14, 18)
      doc.setFontSize(13); doc.setTextColor(...dark); doc.text('Relatório — Movimentação do Funil', 14, 26)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110, 110, 110)
      doc.text(`${range.label}  ·  Vendedor: ${seller === 'lucas' ? 'Lucas' : 'Todos'}`, 14, 33)
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 38)
      doc.setDrawColor(...green); doc.setLineWidth(0.5); doc.line(14, 42, 196, 42)

      let x = 14
      const y = 56
      for (const s of steps) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(20); doc.setTextColor(...dark)
        doc.text(s.sub != null ? `${s.n} (${s.sub}%)` : String(s.n), x, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 110); doc.text(s.t, x, y + 6)
        x += 38
      }

      const body: string[][] = []
      for (const s of SECTIONS) for (const it of (bySection.get(s.key) ?? [])) body.push([s.t, it.nm, it.co, fmtDay(it.date)])
      autoTable(doc, {
        startY: y + 16,
        head: [['Evento', 'Lead', 'Empresa', 'Data']],
        body: body.length ? body : [['—', 'Sem movimentação no período', '', '']],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: green, textColor: [20, 20, 20] },
        alternateRowStyles: { fillColor: [245, 247, 240] },
      })
      doc.save(`relatorio-funil-${range.label.replace(/[^0-9a-zA-Z]+/g, '-').toLowerCase()}.pdf`)
    } finally {
      setPdfBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <p className="font-tech text-[10px] uppercase tracking-[0.22em] text-bento-muted">DR Growth · Comercial</p>
          <h2 className="font-display font-bold text-bento-text text-lg mt-1">Relatório — Movimentação do Funil</h2>
        </div>
        <button onClick={gerarPdf} disabled={pdfBusy || loading}
          className="flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-btn text-sm font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
          <Download className="w-4 h-4" />{pdfBusy ? 'Gerando...' : 'Gerar PDF'}
        </button>
      </div>

      {/* Controles: período + vendedor */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {REPORT_MODES.map(([m, label]) => (
            <button key={m} onClick={() => setRange(rangeFor(m))}
              className={cn('px-3.5 py-1.5 rounded-[8px] text-xs font-medium shrink-0 whitespace-nowrap transition-colors',
                range.mode === m ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 font-tech text-xs text-bento-muted">
          <span className="whitespace-nowrap">{range.label}</span>
          <select value={seller} onChange={e => setSeller(e.target.value as 'todos' | 'lucas')}
            className="bg-bento-bg border border-bento-border rounded-btn px-2.5 py-1.5 text-bento-text focus:outline-none focus:border-lime">
            <option value="todos">Vendedor: Todos</option>
            <option value="lucas">Vendedor: Lucas</option>
          </select>
        </div>
      </div>

      {error && <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{error}</div>}

      {/* Conversão no período */}
      <div className="bento-fx p-5">
        <p className="font-tech text-[10px] uppercase tracking-[0.18em] text-bento-muted mb-4">Conversão no período</p>
        <div className="flex items-stretch gap-2 flex-wrap">
          {steps.map(s => (
            <div key={s.t} className="flex-1 min-w-[100px] flex flex-col gap-1 px-1">
              <span className="font-display text-3xl font-bold text-bento-text tabular-nums leading-none">{loading ? '—' : s.n}</span>
              <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">
                {s.t}{s.sub != null && <span className="text-bento-dim"> · {s.sub}%</span>}
              </span>
              <div className="h-1.5 rounded-full bg-bento-bg overflow-hidden mt-1.5">
                <div className="h-full rounded-full bg-lime" style={{ width: `${entraram > 0 ? Math.round((s.n / entraram) * 100) : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-dashed border-bento-border/60">
          {rates.map(r => (
            <span key={r.t} className="font-tech text-[11px] text-bento-muted border border-bento-border rounded-lg px-3 py-1.5 inline-flex gap-2 items-baseline">
              <b className={cn('text-sm font-bold', r.bad ? 'text-red-400' : 'text-bento-text')}>{loading ? '—' : r.v}</b>{r.t}
            </span>
          ))}
        </div>
      </div>

      {/* Detalhe por evento (cards colapsáveis) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {SECTIONS.map(s => {
          const list = bySection.get(s.key) ?? []
          const isOpen = open.has(s.key)
          return (
            <div key={s.key} className="bento-fx overflow-hidden" style={{ borderLeft: `3px solid ${s.ac}` }}>
              <button type="button" onClick={() => toggle(s.key)}
                className="w-full flex items-center justify-between gap-2 px-4 py-3 text-left">
                <span className="font-display font-semibold text-bento-text text-sm">{s.t}</span>
                <span className="flex items-center gap-2 flex-none">
                  <span className="font-tech text-xs font-bold tabular-nums px-2 py-0.5 rounded-full"
                    style={{ color: s.ac, background: `${s.ac}1f` }}>{loading ? '—' : list.length}</span>
                  <ChevronDown className={cn('w-4 h-4 text-bento-muted transition-transform', isOpen && 'rotate-180')} />
                </span>
              </button>
              {isOpen && (
                <div className="px-4 pb-2 border-t border-bento-border/60">
                  {list.length === 0 ? (
                    <p className="font-tech text-[11px] text-bento-muted/70 py-3">Ninguém no período</p>
                  ) : list.map((it, i) => (
                    <div key={i} className="flex items-center justify-between gap-3 py-2 border-b border-dashed border-bento-border/50 last:border-0">
                      <div className="min-w-0">
                        <p className="text-sm text-bento-text truncate">{it.nm}</p>
                        {it.co !== '—' && <p className="font-tech text-[10px] text-bento-muted truncate">{it.co}</p>}
                      </div>
                      <span className="font-tech text-[10.5px] text-bento-muted tabular-nums flex-none">{fmtDay(it.date)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      <p className="font-tech text-[10.5px] text-bento-muted/70 text-center">Leads de teste e da Lixeira não entram no relatório.</p>
      <p className="font-tech text-[10px] text-bento-muted/50 text-center max-w-2xl mx-auto">
        O histórico completo de movimentação passa a ser gravado a partir de agora; as próximas semanas vêm 100% precisas.
      </p>
    </div>
  )
}
