'use client'

import { useState, useEffect, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { Download } from 'lucide-react'
import { rangeFor, type Mode, type Range } from '@/lib/period'

// ── Relatório — Resumo. Fonte: lead_milestones (marcos FIXOS interagiu/reuniao/fechou) + leads.status
//    + funnel_stages. Eixo = leads.received_at (chegada). Conta SÓ leads com incluir_no_relatorio=true
//    e fora da Lixeira. NÃO é dinheiro (received_at/incluir não afetam comissão). ─────────────────────

const REPORT_MODES: [Mode, string][] = [['semana', 'Semana'], ['mes', 'Mês'], ['semestre', 'Semestre'], ['ano', 'Ano']]

interface LeadRow { id: string; name: string; company: string | null; status: string; received_at: string | null; created_at: string | null; incluir_no_relatorio: boolean | null; origem: string | null }
interface MsRow { lead_id: string; marco: string }
interface ClientRow { id: string; name: string; company: string | null; status: string }
interface StageRow { slug: string; nome: string; posicao: number }

export function RelatorioComercial() {
  const supabase = createClient()
  const [range, setRange] = useState<Range>(() => rangeFor('semana'))   // padrão: semana
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [leads, setLeads] = useState<LeadRow[]>([])
  const [ms, setMs] = useState<MsRow[]>([])
  const [clients, setClients] = useState<ClientRow[]>([])
  const [stages, setStages] = useState<StageRow[]>([])
  const [pdfBusy, setPdfBusy] = useState(false)
  // Janela PERSONALIZADA (de–até). Quando aplicada, vira o período (mode 'custom') — mesma contagem,
  // só troca o intervalo. O PDF e o cabeçalho leem range.label, então refletem o personalizado também.
  const [customOpen, setCustomOpen] = useState(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const toYmd = (d: Date) => { const p = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}` }
  const fmtBR = (ymd: string) => { const [y, m, d] = ymd.split('-'); return `${d}/${m}/${y}` }
  const selectPreset = (m: Mode) => { setCustomOpen(false); setRange(rangeFor(m)) }
  const openCustom = () => { setFromDate(toYmd(range.start)); setToDate(toYmd(range.end)); setCustomOpen(true) }
  const customInvalid = !fromDate || !toDate || fromDate > toDate
  const applyCustom = () => {
    if (customInvalid) return
    // Datas no fuso LOCAL, inclusive nas duas pontas (00:00 do De até 23:59:59.999 do Até).
    setRange({ mode: 'custom', start: new Date(`${fromDate}T00:00:00`), end: new Date(`${toDate}T23:59:59.999`), label: `de ${fmtBR(fromDate)} a ${fmtBR(toDate)}` })
  }

  useEffect(() => {
    let active = true
    ;(async () => {
      setLoading(true)
      const [lr, mr, cr, sr] = await Promise.all([
        supabase.from('leads').select('id, name, company, status, received_at, created_at, incluir_no_relatorio, origem'),
        supabase.from('lead_milestones').select('lead_id, marco'),
        supabase.from('clients').select('id, name, company, status').order('name'),
        supabase.from('funnel_stages').select('slug, nome, posicao').order('posicao'),
      ])
      if (!active) return
      if (lr.error) { setError(`Erro ao carregar o relatório: ${lr.error.message}`); setLoading(false); return }
      setLeads((lr.data ?? []) as LeadRow[])
      setMs((mr.data ?? []) as MsRow[])
      setClients((cr.data ?? []) as ClientRow[])
      setStages((sr.data ?? []) as StageRow[])
      setError(null); setLoading(false)
    })()
    return () => { active = false }
  }, [supabase])

  // Métricas + agrupamento por desfecho. Filtro: incluir_no_relatorio≠false, fora da Lixeira,
  // received_at dentro do período (parse como meia-noite LOCAL p/ não escorregar de dia por fuso).
  const r = useMemo(() => {
    // Eixo = received_at; se null (lead manual/antigo), cai em created_at (como o MetricasTab) p/ não
    // sumir do relatório. slice(0,10) = defensivo caso venha timestamp completo.
    const inPeriod = (d?: string | null) => {
      if (!d) return false
      const t = new Date(`${String(d).slice(0, 10)}T00:00:00`).getTime()
      if (Number.isNaN(t)) return false
      return t >= range.start.getTime() && t <= range.end.getTime()
    }
    const byLead = new Map<string, Set<string>>()
    for (const m of ms) { if (!byLead.has(m.lead_id)) byLead.set(m.lead_id, new Set()); byLead.get(m.lead_id)!.add(m.marco) }
    const has = (id: string, marco: string) => byLead.get(id)?.has(marco) ?? false

    // origem='cliente_existente' = cliente já existente jogado no funil: NÃO conta no relatório (não é venda/lead novo).
    const inc = leads.filter(l => l.incluir_no_relatorio !== false && l.status !== 'lixeira' && l.origem !== 'cliente_existente' && inPeriod(l.received_at || l.created_at))
    const chegaram = inc.length
    const reunioes = inc.filter(l => has(l.id, 'reuniao')).length
    const vendas = inc.filter(l => has(l.id, 'fechou')).length
    const interagiu = inc.filter(l => has(l.id, 'interagiu')).length
    const naoInteragiu = inc.filter(l => !has(l.id, 'interagiu')).length
    const noShow = inc.filter(l => l.status === 'no_show').length
    const perdido = inc.filter(l => l.status === 'perdido').length

    const nomeBySlug = new Map(stages.map(s => [s.slug, s.nome]))
    const posBySlug = new Map(stages.map(s => [s.slug, s.posicao]))
    const gmap = new Map<string, LeadRow[]>()
    for (const l of inc) { if (!gmap.has(l.status)) gmap.set(l.status, []); gmap.get(l.status)!.push(l) }
    const groups = Array.from(gmap.entries())
      .map(([slug, items]) => ({ slug, label: nomeBySlug.get(slug) ?? slug, pos: posBySlug.get(slug) ?? 999, items: [...items].sort((a, b) => a.name.localeCompare(b.name)) }))
      .sort((a, b) => a.pos - b.pos)

    return { chegaram, reunioes, vendas, interagiu, naoInteragiu, noShow, perdido, groups }
  }, [leads, ms, stages, range])

  const principais: { t: string; v: number }[] = [
    { t: 'Chegaram', v: r.chegaram },
    { t: 'Reuniões marcadas', v: r.reunioes },
    { t: 'Vendas concluídas', v: r.vendas },
  ]
  const sub: { t: string; v: number }[] = [
    { t: 'Interagiu', v: r.interagiu },
    { t: 'Não interagiu', v: r.naoInteragiu },
    { t: 'No-show', v: r.noShow },
    { t: 'Venda perdida', v: r.perdido },
  ]

  // PDF limpo p/ o chefe: cabeçalho + 3 principais em destaque + 4 sub + lista agrupada + clientes.
  const gerarPdf = async () => {
    setPdfBusy(true)
    try {
      const { jsPDF } = await import('jspdf')
      const autoTable = (await import('jspdf-autotable')).default
      const green: [number, number, number] = [101, 163, 13]
      const dark: [number, number, number] = [25, 25, 25]
      const doc = new jsPDF()

      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor(...green); doc.text('DR Growth', 14, 18)
      doc.setFontSize(13); doc.setTextColor(...dark); doc.text('Relatório — Resumo', 14, 26)
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(110, 110, 110)
      doc.text(`Período: ${range.label}`, 14, 33)
      doc.text(`Gerado em ${new Date().toLocaleDateString('pt-BR')}`, 14, 38)
      doc.setDrawColor(...green); doc.setLineWidth(0.5); doc.line(14, 42, 196, 42)

      let x = 14; const y = 56
      for (const k of principais) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(26); doc.setTextColor(...green); doc.text(String(k.v), x, y)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(90, 90, 90); doc.text(k.t, x, y + 7)
        x += 62
      }
      x = 14; const y2 = y + 22
      for (const k of sub) {
        doc.setFont('helvetica', 'bold'); doc.setFontSize(15); doc.setTextColor(...dark); doc.text(String(k.v), x, y2)
        doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(110, 110, 110); doc.text(k.t, x, y2 + 5)
        x += 47
      }

      const body: string[][] = []
      for (const g of r.groups) for (const l of g.items) body.push([g.label, l.name, l.company || '—'])
      autoTable(doc, {
        startY: y2 + 14,
        head: [['Desfecho', 'Lead', 'Empresa']],
        body: body.length ? body : [['—', 'Sem leads no período', '']],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: green, textColor: [20, 20, 20] },
        alternateRowStyles: { fillColor: [245, 247, 240] },
      })
      const afterLeads = (doc as unknown as { lastAutoTable?: { finalY: number } }).lastAutoTable?.finalY ?? y2 + 14
      doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...dark); doc.text('Clientes', 14, afterLeads + 10)
      autoTable(doc, {
        startY: afterLeads + 14,
        head: [['Cliente', 'Empresa', 'Status']],
        body: clients.length ? clients.map(c => [c.name, c.company || '—', c.status]) : [['—', 'Sem clientes', '']],
        styles: { fontSize: 9, cellPadding: 2 },
        headStyles: { fillColor: green, textColor: [20, 20, 20] },
        alternateRowStyles: { fillColor: [245, 247, 240] },
      })
      doc.save(`relatorio-resumo-${range.label.replace(/[^0-9a-zA-Z]+/g, '-').toLowerCase()}.pdf`)
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
          <h2 className="font-display font-bold text-bento-text text-lg mt-1">Relatório — Resumo</h2>
        </div>
        <button onClick={gerarPdf} disabled={pdfBusy || loading}
          className="flex items-center gap-2 px-3 py-2 min-h-[40px] rounded-btn text-sm font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50">
          <Download className="w-4 h-4" />{pdfBusy ? 'Gerando...' : 'Baixar PDF'}
        </button>
      </div>

      {/* Período: presets + Personalizado (de–até). O personalizado vira o período (mesma contagem). */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex bg-bento-bg border border-bento-border rounded-btn p-1 gap-1 max-w-full overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {REPORT_MODES.map(([m, label]) => (
              <button key={m} onClick={() => selectPreset(m)}
                className={cn('px-3.5 py-1.5 rounded-[8px] text-xs font-medium shrink-0 whitespace-nowrap transition-colors',
                  range.mode === m && !customOpen ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
                {label}
              </button>
            ))}
            <button onClick={openCustom}
              className={cn('px-3.5 py-1.5 rounded-[8px] text-xs font-medium shrink-0 whitespace-nowrap transition-colors',
                (customOpen || range.mode === 'custom') ? 'bg-lime text-lime-ink' : 'text-bento-muted hover:text-bento-text')}>
              Personalizado
            </button>
          </div>
          <span className="font-tech text-xs text-bento-muted whitespace-nowrap">{range.label}</span>
        </div>

        {/* De / Até — empilham no celular. Aplicar só com De ≤ Até. */}
        {customOpen && (
          <div className="flex items-end gap-2 flex-wrap bento-fx p-3">
            <label className="flex flex-col gap-1">
              <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">De</span>
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)}
                className="bg-bento-bg border border-bento-border rounded-btn px-2.5 py-1.5 text-xs text-bento-text focus:outline-none focus:border-lime min-h-[40px]" />
            </label>
            <label className="flex flex-col gap-1">
              <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Até</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)}
                className="bg-bento-bg border border-bento-border rounded-btn px-2.5 py-1.5 text-xs text-bento-text focus:outline-none focus:border-lime min-h-[40px]" />
            </label>
            <button onClick={applyCustom} disabled={customInvalid}
              className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[40px]">
              Aplicar
            </button>
            {fromDate && toDate && fromDate > toDate && (
              <span className="font-tech text-[11px] text-amber-400/90 self-center">&quot;De&quot; precisa ser ≤ &quot;Até&quot;.</span>
            )}
          </div>
        )}
      </div>

      {error && <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{error}</div>}

      {/* 3 PRINCIPAIS */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {principais.map(k => (
          <div key={k.t} className="bento-fx p-5">
            <div className="font-display font-bold text-lime-fg tabular-nums leading-none text-5xl">{loading ? '—' : k.v}</div>
            <div className="font-tech text-[11px] uppercase tracking-wide text-bento-muted mt-3">{k.t}</div>
          </div>
        ))}
      </div>

      {/* 4 SUB */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {sub.map(k => (
          <div key={k.t} className="bento-fx p-4">
            <div className="font-display font-bold text-bento-text tabular-nums leading-none text-2xl">{loading ? '—' : k.v}</div>
            <div className="font-tech text-[10px] uppercase tracking-wide text-bento-muted mt-2">{k.t}</div>
          </div>
        ))}
      </div>

      {/* Leads agrupados por desfecho */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.18em] text-bento-muted mb-2.5 px-0.5">Leads do período por desfecho</p>
        {loading ? (
          <p className="text-sm text-bento-muted">Carregando...</p>
        ) : r.groups.length === 0 ? (
          <p className="font-tech text-[11px] text-bento-muted/70">Nenhum lead no período.</p>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            {r.groups.map(g => (
              <div key={g.slug} className="bento-fx overflow-hidden">
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-bento-border/60">
                  <span className="font-display font-semibold text-bento-text text-sm">{g.label}</span>
                  <span className="font-tech text-xs font-semibold tabular-nums px-2 py-0.5 rounded-full bg-bento-bg text-bento-muted min-w-[26px] text-center">{g.items.length}</span>
                </div>
                <div className="px-4 py-2">
                  {g.items.map(l => (
                    <div key={l.id} className="flex items-center justify-between gap-3 py-1.5 border-b border-dashed border-bento-border/50 last:border-0">
                      <span className="text-sm text-bento-text truncate">{l.name}</span>
                      {l.company && <span className="font-tech text-[10px] text-bento-muted truncate">{l.company}</span>}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Clientes */}
      <div>
        <p className="font-tech text-[10px] uppercase tracking-[0.18em] text-bento-muted mb-2.5 px-0.5">Clientes <span className="text-bento-muted/60">· {clients.length}</span></p>
        {loading ? (
          <p className="text-sm text-bento-muted">Carregando...</p>
        ) : clients.length === 0 ? (
          <p className="font-tech text-[11px] text-bento-muted/70">Nenhum cliente.</p>
        ) : (
          <div className="bento-fx overflow-hidden divide-y divide-bento-border/60">
            {clients.map(c => (
              <div key={c.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-sm text-bento-text truncate">{c.name}</p>
                  {c.company && <p className="font-tech text-[10px] text-bento-muted truncate">{c.company}</p>}
                </div>
                <span className={cn('font-tech text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full border flex-none',
                  c.status === 'ativo' ? 'text-green-400 border-green-800/50' : 'text-bento-muted border-bento-border')}>{c.status}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <p className="font-tech text-[10.5px] text-bento-muted/70 text-center">Conta leads com “Incluir no relatório” ligado, fora da Lixeira, pela data de chegada no período.</p>
    </div>
  )
}
