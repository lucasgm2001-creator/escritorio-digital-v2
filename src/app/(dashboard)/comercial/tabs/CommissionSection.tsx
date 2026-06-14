'use client'

// Módulo de Comissão — Tela (perfil do vendedor, sub-tab "Comissão").
// Bloco 1: Resumo do mês + Configuração (salário c/ vigência, cotação global).
// Bloco 2: Lançamentos — venda (deals), semanas recebidas (weekly_payments),
//          reunião (meetings), status/rescisão e pendências na tela.
// Usa SÓ as tabelas/funções da migration 017. Moeda real = USD; BRL é exibição.
// Cada lançamento congela a cotação vigente no momento.

import { useState, useEffect, useCallback } from 'react'
import {
  ChevronLeft, ChevronRight, Plus, Lock, Unlock, Wallet, DollarSign, RefreshCw,
  Receipt, Handshake, Trash2, Check, Pencil, CalendarDays, Download,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { useSave } from '@/lib/useSave'
import { useToast } from '@/components/ui/toast'
import { cn } from '@/lib/utils'
import { monthlySummary, resolveRate } from '@/lib/commission/calc'
import type { SalaryPeriod, Meeting, WeeklyPayment, FxConfig, Deal, DealStatus } from '@/lib/commission/types'

const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'
const inputSm = 'bg-bento-bg border border-bento-border rounded-btn px-2 py-1 text-[11px] text-bento-text focus:outline-none focus:border-lime'

const pad2 = (n: number) => String(n).padStart(2, '0')
const usd = (n: number) => `US$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const brl = (n: number) => `R$ ${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
const monthName = (y: number, m: number) => new Date(y, m - 1, 1).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })
const fmtMonthYear = (iso: string) => { const [y, m] = iso.split('-'); return `${m}/${y}` }
const fmtDayMonth = (iso: string) => { const [, m, d] = iso.split('-'); return `${d}/${m}` }
const fmtDayMonthYear = (iso: string) => { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}` }
const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}` }
// Soma dias a uma data 'YYYY-MM-DD' (aritmética local, segura p/ data pura).
const addDaysISO = (iso: string, days: number) => {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(y, m - 1, d); dt.setDate(dt.getDate() + days)
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`
}

const STATUS_CLS: Record<DealStatus, string> = {
  em_andamento: 'bg-bento-panel text-bento-dim border-bento-border',
  interrompido: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
  concluido:    'bg-lime/15 text-lime-fg border-lime/30',
}

type DealUI = Deal & { clientName: string | null }
type MeetingUI = Meeting & { clientName: string | null }

// ── mapeadores DB (snake) → tipos do cálculo (camel) ──────────────────────────
const toDealUI = (r: { id: string; seller_id: string; client_name: string | null; valor_total_usd: number; teto_semanas: number; valor_por_semana_usd: number; status: DealStatus; data_fechamento: string }): DealUI => ({
  id: r.id, sellerId: r.seller_id, clientName: r.client_name,
  valorTotalUsd: Number(r.valor_total_usd), tetoSemanas: r.teto_semanas,
  valorPorSemanaUsd: Number(r.valor_por_semana_usd), status: r.status, dataFechamento: r.data_fechamento,
})
const toWeek = (r: { id: string; deal_id: string; numero_semana: number; valor_usd: number; paid_on: string; cotacao_usd_brl: number }): WeeklyPayment => ({
  id: r.id, dealId: r.deal_id, numeroSemana: r.numero_semana, valorUsd: Number(r.valor_usd), paidOn: r.paid_on, cotacaoUsdBrl: Number(r.cotacao_usd_brl),
})
const toMeeting = (r: { id: string; seller_id: string; met_on: string; valor_usd: number; cotacao_usd_brl: number; client_name: string | null }): MeetingUI => ({
  id: r.id, sellerId: r.seller_id, metOn: r.met_on, valorUsd: Number(r.valor_usd), cotacaoUsdBrl: Number(r.cotacao_usd_brl), clientName: r.client_name,
})
type DealRow = Parameters<typeof toDealUI>[0]
type WeekRow = Parameters<typeof toWeek>[0]
type MeetingRow = Parameters<typeof toMeeting>[0]

// ── Card de uma venda: semanas (marcar/desmarcar) + status ────────────────────
function DealCard({ deal, weeks, statusBusy, onMark, onUnmark, onEditDate, onChangeStatus, onEditDeal, onDeleteDeal }: {
  deal: DealUI
  weeks: WeeklyPayment[]
  statusBusy: boolean
  onMark: (numero: number, paidOn: string) => Promise<boolean>
  onUnmark: (week: WeeklyPayment) => Promise<void>
  onEditDate: (week: WeeklyPayment, newDate: string) => Promise<boolean>
  onChangeStatus: (status: DealStatus) => void
  onEditDeal: (patch: { client: string; valorTotal: string; semanas: string; dataFechamento: string }) => Promise<boolean>
  onDeleteDeal: () => Promise<void>
}) {
  const [active, setActive] = useState<number | null>(null)
  const [date, setDate] = useState(todayISO())
  const [busy, setBusy] = useState(false)
  const [editing, setEditing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [savingEdit, setSavingEdit] = useState(false)
  const [editForm, setEditForm] = useState({ client: deal.clientName ?? '', valorTotal: String(deal.valorTotalUsd), semanas: String(deal.tetoSemanas), dataFechamento: deal.dataFechamento })

  const paidByNum = new Map(weeks.map(w => [w.numeroSemana, w]))
  const congelado = deal.status !== 'em_andamento'
  const pagas = weeks.length
  const pendentes = congelado ? 0 : Math.max(0, deal.tetoSemanas - pagas)
  const editVps = (() => { const t = parseFloat(editForm.valorTotal); const s = parseInt(editForm.semanas); return t > 0 && s > 0 ? Math.round((t / s) * 100) / 100 : 0 })()

  const handleMark = async (n: number) => {
    setBusy(true); const ok = await onMark(n, date); setBusy(false); if (ok) setActive(null)
  }
  const handleUnmark = async (w: WeeklyPayment) => {
    setBusy(true); await onUnmark(w); setBusy(false); setActive(null)
  }
  const handleEdit = async (w: WeeklyPayment) => {
    setBusy(true); const ok = await onEditDate(w, date); setBusy(false); if (ok) setActive(null)
  }
  const openEditDeal = () => {
    setEditForm({ client: deal.clientName ?? '', valorTotal: String(deal.valorTotalUsd), semanas: String(deal.tetoSemanas), dataFechamento: deal.dataFechamento })
    setConfirmDelete(false); setActive(null); setEditing(true)
  }
  const handleSaveEditDeal = async () => {
    setSavingEdit(true); const ok = await onEditDeal(editForm); setSavingEdit(false); if (ok) setEditing(false)
  }
  const handleDeleteDeal = async () => {
    setBusy(true); await onDeleteDeal(); setBusy(false)
  }

  return (
    <div className="bg-bento-bg border border-bento-border/60 rounded-btn p-3 space-y-2.5">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium text-bento-text truncate">{deal.clientName || 'Venda sem cliente'}</p>
          <p className="text-[11px] text-bento-muted tabular-nums">{usd(deal.valorTotalUsd)} · {deal.tetoSemanas} sem · {usd(deal.valorPorSemanaUsd)}/sem · fech. {fmtDayMonthYear(deal.dataFechamento)}</p>
        </div>
        <div className="flex items-center gap-1 flex-none">
          <select value={deal.status} disabled={statusBusy} onChange={e => onChangeStatus(e.target.value as DealStatus)}
            className={cn('text-[11px] px-2 py-1 rounded-full border font-medium focus:outline-none focus:border-lime', STATUS_CLS[deal.status])}>
            <option value="em_andamento">Em andamento</option>
            <option value="interrompido">Interrompido</option>
            <option value="concluido">Concluído</option>
          </select>
          <button onClick={openEditDeal} className="p-1 text-bento-muted hover:text-bento-text" aria-label="Editar venda"><Pencil className="w-3.5 h-3.5" /></button>
          <button onClick={() => { setEditing(false); setActive(null); setConfirmDelete(true) }} className="p-1 text-bento-muted hover:text-red-400" aria-label="Excluir venda"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>

      {editing && (
        <div className="bg-bento-panel border border-bento-border rounded-btn p-2.5 space-y-2">
          <input list="commission-clients" value={editForm.client} onChange={e => setEditForm(p => ({ ...p, client: e.target.value }))} className={`w-full ${inputSm} py-1.5`} placeholder="Cliente" />
          <div className="grid grid-cols-2 gap-2">
            <input type="number" value={editForm.valorTotal} onChange={e => setEditForm(p => ({ ...p, valorTotal: e.target.value }))} className={`${inputSm} py-1.5`} min="0" step="10" placeholder="Valor total" />
            <input type="number" value={editForm.semanas} onChange={e => setEditForm(p => ({ ...p, semanas: e.target.value }))} className={`${inputSm} py-1.5`} min="1" step="1" placeholder="Semanas" />
          </div>
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-bento-muted">Valor por semana</span><span className="font-medium text-bento-text tabular-nums">{usd(editVps)}</span>
          </div>
          <input type="date" value={editForm.dataFechamento} onChange={e => setEditForm(p => ({ ...p, dataFechamento: e.target.value }))} className={`w-full ${inputSm} py-1.5`} />
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-lime transition-colors">Cancelar</button>
            <button onClick={handleSaveEditDeal} disabled={savingEdit} className="flex-1 bento-btn py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{savingEdit ? 'Salvando...' : 'Salvar venda'}</button>
          </div>
        </div>
      )}

      {confirmDelete && (
        <div className="bg-bento-panel border border-bento-border rounded-btn p-2.5 space-y-2">
          <p className="text-[11px] text-red-400">Tem certeza? Apaga a venda e as semanas dela. Esta ação não pode ser desfeita.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirmDelete(false)} disabled={busy} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-bento-text transition-colors">Cancelar</button>
            <button onClick={handleDeleteDeal} disabled={busy} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? 'Excluindo...' : 'Excluir venda'}</button>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5">
        {Array.from({ length: deal.tetoSemanas }, (_, i) => i + 1).map(n => {
          const w = paidByNum.get(n)
          const prevDate = addDaysISO(deal.dataFechamento, (n - 1) * 7)   // data prevista (não significa paga)
          return (
            <button key={n} type="button" onClick={() => { if (active === n) { setActive(null) } else { setActive(n); setDate(w ? w.paidOn : prevDate) } }}
              className={cn('flex items-center gap-1 text-[11px] px-2 py-1 rounded-btn border transition-colors',
                w ? 'bg-lime/15 text-lime-fg border-lime/30' : 'bg-bento-panel text-bento-muted border-bento-border hover:border-lime/50')}>
              {w ? <Check className="w-3 h-3" /> : <CalendarDays className="w-3 h-3 opacity-60" />}
              S{n}{w ? ` · ${fmtDayMonth(w.paidOn)}` : ` · prev. ${fmtDayMonth(prevDate)}`}
            </button>
          )
        })}
      </div>
      <p className="flex items-center gap-3 text-[10px] text-bento-muted">
        <span className="flex items-center gap-1"><Check className="w-2.5 h-2.5 text-lime-fg" /> paga (data real)</span>
        <span className="flex items-center gap-1"><CalendarDays className="w-2.5 h-2.5" /> prevista</span>
      </p>

      {active !== null && (
        paidByNum.get(active)
          ? (
            <div className="bg-bento-panel border border-bento-border rounded-btn p-2 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-bento-muted whitespace-nowrap">S{active} recebida em</span>
                <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`flex-1 ${inputSm}`} />
                <button onClick={() => handleEdit(paidByNum.get(active)!)} disabled={busy} className="bento-btn px-2.5 py-1 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? '...' : 'Salvar'}</button>
              </div>
              <button onClick={() => handleUnmark(paidByNum.get(active)!)} disabled={busy} className="flex items-center gap-1 text-[11px] text-red-400 hover:text-red-300 disabled:opacity-50">
                <Trash2 className="w-3.5 h-3.5" /> Desmarcar semana {active}
              </button>
            </div>
          )
          : (
            <div className="flex items-center gap-2 bg-bento-panel border border-bento-border rounded-btn p-2">
              <span className="text-[11px] text-bento-muted whitespace-nowrap">Recebi a S{active} em</span>
              <input type="date" value={date} onChange={e => setDate(e.target.value)} className={`flex-1 ${inputSm}`} />
              <button onClick={() => handleMark(active)} disabled={busy} className="bento-btn px-2.5 py-1 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? '...' : 'Marcar'}</button>
            </div>
          )
      )}

      {congelado
        ? <p className="text-[11px] text-amber-400">Congelado em {usd(pagas * deal.valorPorSemanaUsd)} ({pagas} de {deal.tetoSemanas} semanas).</p>
        : pendentes > 0
          ? <p className="text-[11px] text-bento-muted">{pendentes} semana(s) pendente(s) · {usd(pendentes * deal.valorPorSemanaUsd)} a receber.</p>
          : <p className="text-[11px] text-lime-fg">Todas as semanas recebidas.</p>}
    </div>
  )
}

// ── Linha de reunião: editar (data/valor) + excluir com confirmação ───────────
function MeetingRow({ meeting, onEdit, onDelete }: {
  meeting: MeetingUI
  onEdit: (patch: { metOn: string; valor: string; client: string }) => Promise<boolean>
  onDelete: () => Promise<void>
}) {
  const [editing, setEditing] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [form, setForm] = useState({ metOn: meeting.metOn, valor: String(meeting.valorUsd), client: meeting.clientName ?? '' })
  const [busy, setBusy] = useState(false)

  const openEdit = () => { setForm({ metOn: meeting.metOn, valor: String(meeting.valorUsd), client: meeting.clientName ?? '' }); setConfirming(false); setEditing(true) }
  const handleSave = async () => { setBusy(true); const ok = await onEdit(form); setBusy(false); if (ok) setEditing(false) }
  const handleDelete = async () => { setBusy(true); await onDelete(); setBusy(false) }

  return (
    <div className="bg-bento-bg border border-bento-border/60 rounded-btn px-3 py-2 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm text-bento-text truncate">{meeting.clientName ? `Reunião · ${meeting.clientName}` : 'Reunião'}</p>
          <p className="text-[11px] text-bento-muted tabular-nums">{fmtDayMonthYear(meeting.metOn)} · {usd(meeting.valorUsd)} · {brl(meeting.valorUsd * meeting.cotacaoUsdBrl)}</p>
        </div>
        <div className="flex items-center gap-1 flex-none">
          <button onClick={() => { setConfirming(false); openEdit() }} className="p-1 text-bento-muted hover:text-bento-text" aria-label="Editar reunião"><Pencil className="w-4 h-4" /></button>
          <button onClick={() => { setEditing(false); setConfirming(true) }} className="p-1 text-bento-muted hover:text-red-400" aria-label="Excluir reunião"><Trash2 className="w-4 h-4" /></button>
        </div>
      </div>
      {editing && (
        <div className="space-y-2">
          <input list="commission-clients" value={form.client} onChange={e => setForm(p => ({ ...p, client: e.target.value }))} className={`w-full ${inputSm} py-1.5`} placeholder="Cliente" />
          <div className="grid grid-cols-2 gap-2">
            <input type="date" value={form.metOn} onChange={e => setForm(p => ({ ...p, metOn: e.target.value }))} className={`${inputSm} py-1.5`} />
            <input type="number" value={form.valor} onChange={e => setForm(p => ({ ...p, valor: e.target.value }))} className={`${inputSm} py-1.5`} min="0" step="5" />
          </div>
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-lime transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={busy} className="flex-1 bento-btn py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? '...' : 'Salvar'}</button>
          </div>
        </div>
      )}
      {confirming && (
        <div className="space-y-2">
          <p className="text-[11px] text-red-400">Excluir esta reunião? Não pode ser desfeito.</p>
          <div className="flex gap-2">
            <button onClick={() => setConfirming(false)} disabled={busy} className="flex-1 border border-bento-border text-bento-dim py-1.5 rounded-btn text-[11px] hover:border-bento-text transition-colors">Cancelar</button>
            <button onClick={handleDelete} disabled={busy} className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-1.5 rounded-btn text-[11px] font-semibold disabled:opacity-50">{busy ? 'Excluindo...' : 'Excluir'}</button>
          </div>
        </div>
      )}
    </div>
  )
}

export function CommissionSection({ sellerId, sellerName }: { sellerId: string; sellerName: string }) {
  const save = useSave()
  const { toast } = useToast()
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [salaries, setSalaries] = useState<SalaryPeriod[]>([])
  const [meetings, setMeetings] = useState<MeetingUI[]>([])
  const [weeks, setWeeks] = useState<WeeklyPayment[]>([])
  const [deals, setDeals] = useState<DealUI[]>([])
  const [clients, setClients] = useState<{ id: string; name: string }[]>([])

  // Cotação (global)
  const [fxManual, setFxManual] = useState<number | null>(null)
  const [fxTravada, setFxTravada] = useState(false)
  const [fxManualInput, setFxManualInput] = useState('')
  const [fxTravadaInput, setFxTravadaInput] = useState(false)
  const [savingFx, setSavingFx] = useState(false)
  const [fxError, setFxError] = useState('')

  // Mês em foco
  const now = new Date()
  const [refDate, setRefDate] = useState({ year: now.getFullYear(), month: now.getMonth() + 1 })
  const prevMonth = () => setRefDate(r => r.month === 1 ? { year: r.year - 1, month: 12 } : { year: r.year, month: r.month - 1 })
  const nextMonth = () => setRefDate(r => r.month === 12 ? { year: r.year + 1, month: 1 } : { year: r.year, month: r.month + 1 })

  // Form salário
  const [salValor, setSalValor] = useState('')
  const [salMonth, setSalMonth] = useState(`${now.getFullYear()}-${pad2(now.getMonth() + 1)}`)
  const [savingSal, setSavingSal] = useState(false)
  const [salError, setSalError] = useState('')

  // Form venda
  const [showNewDeal, setShowNewDeal] = useState(false)
  const [dealForm, setDealForm] = useState({ client: '', valorTotal: '100', semanas: '4', dataFechamento: todayISO() })
  const [savingDeal, setSavingDeal] = useState(false)
  const [dealError, setDealError] = useState('')
  const [statusBusyId, setStatusBusyId] = useState<string | null>(null)

  // Form reunião
  const [showNewMeeting, setShowNewMeeting] = useState(false)
  const [meetingForm, setMeetingForm] = useState({ metOn: todayISO(), valor: '15', client: '', note: '' })
  const [savingMeeting, setSavingMeeting] = useState(false)
  const [meetingError, setMeetingError] = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const [salRes, mtgRes, dealRes, fxRes, cliRes] = await Promise.all([
      supabase.from('seller_salaries').select('seller_id, valor_usd, effective_from').eq('seller_id', sellerId).order('effective_from', { ascending: false }),
      supabase.from('meetings').select('id, seller_id, met_on, valor_usd, cotacao_usd_brl, client_name').eq('seller_id', sellerId).order('met_on', { ascending: false }),
      supabase.from('deals').select('id, seller_id, client_name, valor_total_usd, teto_semanas, valor_por_semana_usd, status, data_fechamento').eq('seller_id', sellerId).order('data_fechamento', { ascending: false }),
      supabase.from('fx_config').select('cotacao_manual, cotacao_travada').eq('id', 1).maybeSingle(),
      supabase.from('clients').select('id, name').order('name'),
    ])

    setSalaries((salRes.data ?? []).map(s => ({ sellerId: s.seller_id, valorUsd: Number(s.valor_usd), effectiveFrom: s.effective_from })))
    setMeetings((mtgRes.data ?? []).map(toMeeting))
    const ds = (dealRes.data ?? []).map(toDealUI)
    setDeals(ds)
    setClients((cliRes.data ?? []) as { id: string; name: string }[])

    const dealIds = ds.map(d => d.id)
    if (dealIds.length) {
      const { data: wk } = await supabase.from('weekly_payments').select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').in('deal_id', dealIds)
      setWeeks((wk ?? []).map(toWeek))
    } else {
      setWeeks([])
    }

    const m = fxRes.data?.cotacao_manual != null ? Number(fxRes.data.cotacao_manual) : null
    const t = !!fxRes.data?.cotacao_travada
    setFxManual(m); setFxTravada(t)
    setFxManualInput(m != null ? String(m) : ''); setFxTravadaInput(t)

    setLoading(false)
  }, [sellerId, supabase])

  useEffect(() => { load() }, [load])

  // ── Cálculos ──────────────────────────────────────────────────────────────
  const fx: FxConfig = { cotacaoManual: fxManual, cotacaoTravada: fxTravada }
  const automaticRate = fxManual ?? 0 // busca automática do dólar vem depois
  const currentRate = resolveRate(fx, automaticRate)
  const summary = monthlySummary({ year: refDate.year, month: refDate.month, salaries, meetings, weeks, fx, automaticRate })
  const appliedEff = (() => {
    const firstDay = `${refDate.year}-${pad2(refDate.month)}-01`
    return salaries.filter(s => s.effectiveFrom <= firstDay).sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1))[0]?.effectiveFrom
  })()
  const vazio = summary.totalUsd === 0
  const semanasPendentes = deals.reduce((acc, d) => d.status === 'em_andamento'
    ? acc + Math.max(0, d.tetoSemanas - weeks.filter(w => w.dealId === d.id).length) : acc, 0)
  const monthPrefix = `${refDate.year}-${pad2(refDate.month)}`
  const meetingsDoMes = meetings.filter(m => m.metOn.slice(0, 7) === monthPrefix)
  const dealVps = (() => { const t = parseFloat(dealForm.valorTotal); const s = parseInt(dealForm.semanas); return t > 0 && s > 0 ? Math.round((t / s) * 100) / 100 : 0 })()

  // ── Salvar cotação ──────────────────────────────────────────────────────────
  const saveFx = async () => {
    setFxError('')
    const manualNum = fxManualInput.trim() === '' ? null : parseFloat(fxManualInput)
    if (fxManualInput.trim() !== '' && (isNaN(manualNum as number) || (manualNum as number) <= 0)) { setFxError('Cotação manual inválida.'); return }
    if (fxTravadaInput && manualNum == null) { setFxError('Pra travar, defina um valor manual.'); return }
    setSavingFx(true)
    const prevM = fxManual, prevT = fxTravada
    await save({
      optimistic: () => { setFxManual(manualNum); setFxTravada(fxTravadaInput) },
      run: () => supabase.from('fx_config').update({ cotacao_manual: manualNum, cotacao_travada: fxTravadaInput, updated_at: new Date().toISOString() }).eq('id', 1),
      rollback: () => { setFxManual(prevM); setFxTravada(prevT) },
      success: 'Cotação atualizada.',
      error: 'Não foi possível salvar a cotação',
    })
    setSavingFx(false)
  }

  // ── Salário (novo período; nunca reescreve o passado) ─────────────────────────
  const addSalary = async () => {
    setSalError('')
    const v = parseFloat(salValor)
    if (!salValor.trim() || isNaN(v) || v < 0) { setSalError('Informe um salário válido em USD.'); return }
    if (!salMonth) { setSalError('Escolha o mês de vigência.'); return }
    const effFrom = `${salMonth}-01`
    if (salaries.some(s => s.effectiveFrom === effFrom)) { setSalError('Já existe um salário com vigência nesse mês.'); return }
    setSavingSal(true)
    const { ok, data } = await save<{ seller_id: string; valor_usd: number; effective_from: string }>({
      run: () => supabase.from('seller_salaries').insert({ seller_id: sellerId, valor_usd: v, effective_from: effFrom }).select('seller_id, valor_usd, effective_from').single(),
      success: `Salário de ${usd(v)} a partir de ${fmtMonthYear(effFrom)}.`,
      error: 'Não foi possível salvar o salário',
    })
    if (ok && data) {
      setSalaries(prev => [{ sellerId: data.seller_id, valorUsd: Number(data.valor_usd), effectiveFrom: data.effective_from }, ...prev]
        .sort((a, b) => (a.effectiveFrom < b.effectiveFrom ? 1 : -1)))
      setSalValor('')
    }
    setSavingSal(false)
  }

  // ── Lançar venda ──────────────────────────────────────────────────────────────
  const addDeal = async () => {
    setDealError('')
    const total = parseFloat(dealForm.valorTotal)
    const semanas = parseInt(dealForm.semanas)
    if (isNaN(total) || total <= 0) { setDealError('Valor total inválido.'); return }
    if (isNaN(semanas) || semanas <= 0) { setDealError('Número de semanas inválido.'); return }
    if (!dealForm.dataFechamento) { setDealError('Informe a data de fechamento.'); return }
    const vps = Math.round((total / semanas) * 100) / 100
    const matched = clients.find(c => c.name.toLowerCase() === dealForm.client.trim().toLowerCase())
    setSavingDeal(true)
    const { ok, data } = await save<DealRow>({
      run: () => supabase.from('deals').insert({
        seller_id: sellerId, client_id: matched?.id ?? null, client_name: dealForm.client.trim() || null,
        valor_total_usd: total, teto_semanas: semanas, valor_por_semana_usd: vps,
        status: 'em_andamento', data_fechamento: dealForm.dataFechamento,
      }).select('id, seller_id, client_name, valor_total_usd, teto_semanas, valor_por_semana_usd, status, data_fechamento').single(),
      success: 'Venda lançada.',
      error: 'Não foi possível lançar a venda',
    })
    if (ok && data) {
      setDeals(prev => [toDealUI(data), ...prev])
      setShowNewDeal(false)
      setDealForm({ client: '', valorTotal: '100', semanas: '4', dataFechamento: todayISO() })
    }
    setSavingDeal(false)
  }

  // ── Marcar / desmarcar semana ─────────────────────────────────────────────────
  const markWeek = async (deal: DealUI, numero: number, paidOn: string): Promise<boolean> => {
    if (!paidOn) { toast({ type: 'error', message: 'Informe a data do recebimento.' }); return false }
    if (currentRate <= 0) { toast({ type: 'error', message: 'Defina a cotação USD→BRL antes de lançar.' }); return false }
    const { ok, data } = await save<WeekRow>({
      run: () => supabase.from('weekly_payments').insert({
        deal_id: deal.id, numero_semana: numero, valor_usd: deal.valorPorSemanaUsd,
        paid_on: paidOn, cotacao_usd_brl: currentRate,
      }).select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').single(),
      success: `Semana ${numero} recebida em ${fmtDayMonthYear(paidOn)}.`,
      error: 'Não foi possível marcar a semana',
    })
    if (ok && data) { setWeeks(prev => [...prev, toWeek(data)]); return true }
    return false
  }

  const unmarkWeek = async (week: WeeklyPayment) => {
    await save({
      optimistic: () => setWeeks(prev => prev.filter(w => w.id !== week.id)),
      run: () => supabase.from('weekly_payments').delete().eq('id', week.id),
      rollback: () => setWeeks(prev => [...prev, week]),
      success: 'Semana desmarcada.',
      error: 'Não foi possível desmarcar a semana',
    })
  }

  // Editar/corrigir a data de recebimento de uma semana já paga (UPDATE paid_on).
  const editWeekDate = async (week: WeeklyPayment, newDate: string): Promise<boolean> => {
    if (!newDate) { toast({ type: 'error', message: 'Informe a data.' }); return false }
    if (newDate === week.paidOn) return true
    const prevDate = week.paidOn
    const { ok } = await save({
      optimistic: () => setWeeks(ws => ws.map(w => w.id === week.id ? { ...w, paidOn: newDate } : w)),
      run: () => supabase.from('weekly_payments').update({ paid_on: newDate }).eq('id', week.id),
      rollback: () => setWeeks(ws => ws.map(w => w.id === week.id ? { ...w, paidOn: prevDate } : w)),
      success: `Data da semana ${week.numeroSemana} atualizada.`,
      error: 'Não foi possível atualizar a data',
    })
    return ok
  }

  const changeDealStatus = async (deal: DealUI, status: DealStatus) => {
    const prev = deal.status
    setStatusBusyId(deal.id)
    await save({
      optimistic: () => setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, status } : d)),
      run: () => supabase.from('deals').update({ status }).eq('id', deal.id),
      rollback: () => setDeals(ds => ds.map(d => d.id === deal.id ? { ...d, status: prev } : d)),
      success: 'Status da venda atualizado.',
      error: 'Não foi possível mudar o status',
    })
    setStatusBusyId(null)
  }

  // Excluir venda — as semanas caem por cascade (FK on delete cascade).
  const deleteDeal = async (deal: DealUI) => {
    await save({
      optimistic: () => { setDeals(ds => ds.filter(d => d.id !== deal.id)); setWeeks(ws => ws.filter(w => w.dealId !== deal.id)) },
      run: () => supabase.from('deals').delete().eq('id', deal.id),
      rollback: () => { void load() },
      success: 'Venda excluída.',
      error: 'Não foi possível excluir a venda',
    })
  }

  // Editar venda. Bloqueia reduzir o nº de semanas abaixo das já pagas. Recalcula
  // o valor/semana só p/ o futuro; semanas já pagas mantêm o valor congelado.
  const editDeal = async (deal: DealUI, patch: { client: string; valorTotal: string; semanas: string; dataFechamento: string }): Promise<boolean> => {
    const total = parseFloat(patch.valorTotal)
    const semanas = parseInt(patch.semanas)
    if (isNaN(total) || total <= 0) { toast({ type: 'error', message: 'Valor total inválido.' }); return false }
    if (isNaN(semanas) || semanas <= 0) { toast({ type: 'error', message: 'Número de semanas inválido.' }); return false }
    if (!patch.dataFechamento) { toast({ type: 'error', message: 'Informe a data de fechamento.' }); return false }
    const paidCount = weeks.filter(w => w.dealId === deal.id).length
    if (semanas < paidCount) { toast({ type: 'error', message: `Já há ${paidCount} semana(s) paga(s). Desmarque antes de reduzir o número de semanas.` }); return false }
    const vps = Math.round((total / semanas) * 100) / 100
    const matched = clients.find(c => c.name.toLowerCase() === patch.client.trim().toLowerCase())
    const prev = deal
    const updated: DealUI = { ...deal, clientName: patch.client.trim() || null, valorTotalUsd: total, tetoSemanas: semanas, valorPorSemanaUsd: vps, dataFechamento: patch.dataFechamento }
    const { ok } = await save({
      optimistic: () => setDeals(ds => ds.map(d => d.id === deal.id ? updated : d)),
      run: () => supabase.from('deals').update({
        client_id: matched?.id ?? null, client_name: patch.client.trim() || null,
        valor_total_usd: total, teto_semanas: semanas, valor_por_semana_usd: vps, data_fechamento: patch.dataFechamento,
      }).eq('id', deal.id),
      rollback: () => setDeals(ds => ds.map(d => d.id === deal.id ? prev : d)),
      success: 'Venda atualizada.',
      error: 'Não foi possível atualizar a venda',
    })
    return ok
  }

  // ── Lançar / remover reunião ───────────────────────────────────────────────────
  const addMeeting = async () => {
    setMeetingError('')
    const valor = parseFloat(meetingForm.valor)
    if (isNaN(valor) || valor < 0) { setMeetingError('Valor inválido.'); return }
    if (!meetingForm.metOn) { setMeetingError('Informe a data da reunião.'); return }
    if (currentRate <= 0) { setMeetingError('Defina a cotação USD→BRL antes de lançar.'); return }
    const matched = clients.find(c => c.name.toLowerCase() === meetingForm.client.trim().toLowerCase())
    setSavingMeeting(true)
    const { ok, data } = await save<MeetingRow>({
      run: () => supabase.from('meetings').insert({
        seller_id: sellerId, met_on: meetingForm.metOn, valor_usd: valor, cotacao_usd_brl: currentRate,
        client_id: matched?.id ?? null, client_name: meetingForm.client.trim() || null, note: meetingForm.note.trim() || null,
      }).select('id, seller_id, met_on, valor_usd, cotacao_usd_brl, client_name').single(),
      success: 'Reunião lançada.',
      error: 'Não foi possível lançar a reunião',
    })
    if (ok && data) {
      setMeetings(prev => [toMeeting(data), ...prev])
      setShowNewMeeting(false)
      setMeetingForm({ metOn: todayISO(), valor: '15', client: '', note: '' })
    }
    setSavingMeeting(false)
  }

  const deleteMeeting = async (m: MeetingUI) => {
    await save({
      optimistic: () => setMeetings(prev => prev.filter(x => x.id !== m.id)),
      run: () => supabase.from('meetings').delete().eq('id', m.id),
      rollback: () => setMeetings(prev => [...prev, m]),
      success: 'Reunião removida.',
      error: 'Não foi possível remover a reunião',
    })
  }

  // Editar reunião (data/valor). A cotação congelada da reunião permanece.
  const editMeeting = async (m: MeetingUI, patch: { metOn: string; valor: string; client: string }): Promise<boolean> => {
    const valor = parseFloat(patch.valor)
    if (isNaN(valor) || valor < 0) { toast({ type: 'error', message: 'Valor inválido.' }); return false }
    if (!patch.metOn) { toast({ type: 'error', message: 'Informe a data.' }); return false }
    const matched = clients.find(c => c.name.toLowerCase() === patch.client.trim().toLowerCase())
    const prev = m
    const updated: MeetingUI = { ...m, metOn: patch.metOn, valorUsd: valor, clientName: patch.client.trim() || null }
    const { ok } = await save({
      optimistic: () => setMeetings(ms => ms.map(x => x.id === m.id ? updated : x)),
      run: () => supabase.from('meetings').update({ met_on: patch.metOn, valor_usd: valor, client_id: matched?.id ?? null, client_name: patch.client.trim() || null }).eq('id', m.id),
      rollback: () => setMeetings(ms => ms.map(x => x.id === m.id ? prev : x)),
      success: 'Reunião atualizada.',
      error: 'Não foi possível atualizar a reunião',
    })
    return ok
  }

  // ── PDF do mês (jsPDF) — só o recebido/realizado no mês, nada de previsão ──────
  const gerarPdf = async () => {
    const { jsPDF } = await import('jspdf')          // carrega sob demanda (fora do bundle)
    const autoTable = (await import('jspdf-autotable')).default
    const y = refDate.year, mo = refDate.month
    const mp = `${y}-${pad2(mo)}`
    const dealById = new Map(deals.map(d => [d.id, d]))
    const rows: { sort: string; dia: string; acao: string; cliente: string; usd: number }[] = []
    if (summary.salaryUsd > 0) rows.push({ sort: `${mp}-01`, dia: `01/${pad2(mo)}`, acao: 'Salário fixo', cliente: '—', usd: summary.salaryUsd })
    meetings.filter(m => m.metOn.slice(0, 7) === mp).forEach(m =>
      rows.push({ sort: m.metOn, dia: fmtDayMonth(m.metOn), acao: 'Reunião', cliente: m.clientName || '—', usd: m.valorUsd }))
    weeks.filter(w => w.paidOn.slice(0, 7) === mp).forEach(w => {
      const d = dealById.get(w.dealId)
      rows.push({ sort: w.paidOn, dia: fmtDayMonth(w.paidOn), acao: `Semana ${w.numeroSemana} (venda)`, cliente: d?.clientName || '—', usd: w.valorUsd })
    })
    rows.sort((a, b) => (a.sort < b.sort ? -1 : 1))

    const lime: [number, number, number] = [79, 133, 0]
    const dark: [number, number, number] = [23, 35, 27]
    const rateStr = summary.rateUsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
    const doc = new jsPDF()

    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(...lime)
    doc.text('DR Growth', 14, 18)
    doc.setFontSize(13); doc.setTextColor(...dark); doc.text('Relatório de Comissão', 14, 26)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(90, 90, 90)
    doc.text(`Vendedor: ${sellerName}`, 14, 34)
    doc.text(`Mês de referência: ${monthName(y, mo)}`, 14, 39)
    doc.text(`Gerado em: ${fmtDayMonthYear(todayISO())}`, 14, 44)

    doc.setDrawColor(...lime); doc.setLineWidth(0.5); doc.line(14, 49, 196, 49)
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...dark); doc.text('TOTAL A PAGAR', 14, 58)
    doc.setFontSize(17); doc.setTextColor(...lime); doc.text(usd(summary.totalUsd), 14, 67)
    doc.setFont('helvetica', 'normal'); doc.setFontSize(11); doc.setTextColor(90, 90, 90)
    doc.text(`${brl(summary.totalBrl)}  (cotação R$ ${rateStr})`, 14, 74)
    doc.setFontSize(10); doc.setTextColor(...dark)
    doc.text(`Salário fixo: ${usd(summary.salaryUsd)}    Reuniões: ${usd(summary.meetingsUsd)}    Vendas: ${usd(summary.weeksUsd)}`, 14, 82)

    autoTable(doc, {
      startY: 88,
      head: [['Dia', 'Ação', 'Cliente', 'Valor (USD)']],
      body: rows.length ? rows.map(r => [r.dia, r.acao, r.cliente, usd(r.usd)]) : [['—', 'Sem lançamentos no mês', '—', usd(0)]],
      foot: [['', '', 'Total', usd(summary.totalUsd)]],
      theme: 'striped',
      headStyles: { fillColor: lime, textColor: 255, fontStyle: 'bold' },
      footStyles: { fillColor: [240, 244, 238], textColor: dark, fontStyle: 'bold' },
      styles: { fontSize: 9, cellPadding: 2.5 },
      columnStyles: { 3: { halign: 'right' } },
    })

    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY + 10
    doc.setFontSize(9); doc.setTextColor(120, 120, 120)
    doc.text(`Cotação USD->BRL usada: R$ ${rateStr} (${fxTravada ? 'travada' : 'automática'}).`, 14, finalY)
    doc.text('Valores referentes apenas ao que foi recebido/realizado no mês.', 14, finalY + 5)

    doc.save(`comissao-${sellerName.replace(/\s+/g, '-').toLowerCase()}-${mp}.pdf`)
  }

  if (loading) {
    return <div className="flex items-center justify-center py-10 text-bento-muted text-sm gap-2"><span className="w-4 h-4 border-2 border-bento-muted/20 border-t-lime rounded-full animate-spin" />Carregando comissão...</div>
  }

  return (
    <div className="space-y-5">
      {/* lista compartilhada de clientes p/ os campos de cliente */}
      <datalist id="commission-clients">{clients.map(c => <option key={c.id} value={c.name} />)}</datalist>

      {/* ── RESUMO DO MÊS ─────────────────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><Wallet className="w-4 h-4 text-lime-fg" /> Resumo do mês</h4>
          <div className="flex items-center gap-1">
            <button onClick={prevMonth} className="p-1 rounded-btn text-bento-muted hover:text-bento-text hover:bg-bento-bg" aria-label="Mês anterior"><ChevronLeft className="w-4 h-4" /></button>
            <span className="text-xs font-medium text-bento-text capitalize min-w-[7.5rem] text-center tabular-nums">{monthName(refDate.year, refDate.month)}</span>
            <button onClick={nextMonth} className="p-1 rounded-btn text-bento-muted hover:text-bento-text hover:bg-bento-bg" aria-label="Próximo mês"><ChevronRight className="w-4 h-4" /></button>
          </div>
        </div>

        <div className="space-y-0.5">
          {[
            { label: 'Salário fixo', u: summary.salaryUsd, b: summary.salaryBrl },
            { label: `Reuniões (${summary.meetingsCount})`, u: summary.meetingsUsd, b: summary.meetingsBrl },
            { label: `Vendas (${summary.weeksCount} sem.)`, u: summary.weeksUsd, b: summary.weeksBrl },
          ].map(r => (
            <div key={r.label} className="flex items-center justify-between py-2 border-b border-bento-border/40">
              <span className="text-xs text-bento-muted">{r.label}</span>
              <div className="text-right">
                <p className="text-sm font-medium text-bento-text tabular-nums">{usd(r.u)}</p>
                <p className="text-[11px] text-bento-muted tabular-nums">{brl(r.b)}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center justify-between pt-2.5">
            <span className="text-sm font-semibold text-bento-text">Total</span>
            <div className="text-right">
              <p className="text-base font-bold text-lime-fg tabular-nums">{usd(summary.totalUsd)}</p>
              <p className="text-xs text-bento-muted tabular-nums">{brl(summary.totalBrl)}</p>
            </div>
          </div>
        </div>

        <p className="text-[11px] text-bento-muted pt-1 border-t border-bento-border/40">
          {vazio
            ? 'Sem lançamentos neste mês ainda — lance vendas, semanas e reuniões abaixo.'
            : `Convertido a R$ ${summary.rateUsed.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} (${fxTravada ? 'travada' : 'automática'}). Reuniões e vendas usam a cotação congelada de cada lançamento.`}
        </p>

        <button onClick={gerarPdf} className="flex items-center justify-center gap-1.5 w-full border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text py-2 rounded-btn text-sm font-medium transition-colors min-h-[44px]">
          <Download className="w-4 h-4" /> Gerar PDF do mês
        </button>
      </section>

      {/* ── VENDAS ────────────────────────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><Receipt className="w-4 h-4 text-lime-fg" /> Vendas</h4>
          {semanasPendentes > 0 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-amber-900/30 text-amber-400 border border-amber-800/50">{semanasPendentes} semana(s) pendente(s)</span>
          )}
        </div>

        {!showNewDeal && (
          <button onClick={() => setShowNewDeal(true)} className="flex items-center justify-center gap-1.5 w-full bento-btn py-2.5 rounded-btn text-sm font-semibold min-h-[44px]">
            <Plus className="w-4 h-4" /> Nova venda
          </button>
        )}

        {showNewDeal && (
          <div className="bg-bento-bg border border-bento-border/60 rounded-btn p-3 space-y-3">
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Cliente</label>
              <input list="commission-clients" value={dealForm.client} onChange={e => setDealForm(p => ({ ...p, client: e.target.value }))} className={inputCls} placeholder="Nome do cliente (livre ou existente)" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Valor total (USD)</label>
                <input type="number" value={dealForm.valorTotal} onChange={e => setDealForm(p => ({ ...p, valorTotal: e.target.value }))} className={inputCls} min="0" step="10" />
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Nº de semanas</label>
                <input type="number" value={dealForm.semanas} onChange={e => setDealForm(p => ({ ...p, semanas: e.target.value }))} className={inputCls} min="1" step="1" />
              </div>
            </div>
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-bento-muted">Valor por semana (auto)</span>
              <span className="font-medium text-bento-text tabular-nums">{usd(dealVps)}</span>
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Data de fechamento</label>
              <input type="date" value={dealForm.dataFechamento} onChange={e => setDealForm(p => ({ ...p, dataFechamento: e.target.value }))} className={inputCls} />
            </div>
            {dealError && <p className="text-xs text-red-400">{dealError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowNewDeal(false); setDealError('') }} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors min-h-[44px]">Cancelar</button>
              <button onClick={addDeal} disabled={savingDeal} className="flex-1 bento-btn py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">{savingDeal ? 'Salvando...' : 'Lançar venda'}</button>
            </div>
          </div>
        )}

        {deals.length === 0
          ? <p className="text-xs text-bento-muted py-2">Nenhuma venda lançada ainda.</p>
          : <div className="space-y-2">
              {deals.map(d => (
                <DealCard key={d.id} deal={d} weeks={weeks.filter(w => w.dealId === d.id)} statusBusy={statusBusyId === d.id}
                  onMark={(n, paidOn) => markWeek(d, n, paidOn)} onUnmark={unmarkWeek} onEditDate={editWeekDate} onChangeStatus={(s) => changeDealStatus(d, s)}
                  onEditDeal={(patch) => editDeal(d, patch)} onDeleteDeal={() => deleteDeal(d)} />
              ))}
            </div>}
      </section>

      {/* ── REUNIÕES (do mês em foco) ─────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><Handshake className="w-4 h-4 text-lime-fg" /> Reuniões de <span className="capitalize">{monthName(refDate.year, refDate.month)}</span></h4>

        {!showNewMeeting && (
          <button onClick={() => setShowNewMeeting(true)} className="flex items-center justify-center gap-1.5 w-full bento-btn py-2.5 rounded-btn text-sm font-semibold min-h-[44px]">
            <Plus className="w-4 h-4" /> Nova reunião
          </button>
        )}

        {showNewMeeting && (
          <div className="bg-bento-bg border border-bento-border/60 rounded-btn p-3 space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Data</label>
                <input type="date" value={meetingForm.metOn} onChange={e => setMeetingForm(p => ({ ...p, metOn: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1">Valor (USD)</label>
                <input type="number" value={meetingForm.valor} onChange={e => setMeetingForm(p => ({ ...p, valor: e.target.value }))} className={inputCls} min="0" step="5" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Cliente (opcional)</label>
              <input list="commission-clients" value={meetingForm.client} onChange={e => setMeetingForm(p => ({ ...p, client: e.target.value }))} className={inputCls} placeholder="Com quem foi" />
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Nota (opcional)</label>
              <input value={meetingForm.note} onChange={e => setMeetingForm(p => ({ ...p, note: e.target.value }))} className={inputCls} placeholder="Ex: call de descoberta" />
            </div>
            {meetingError && <p className="text-xs text-red-400">{meetingError}</p>}
            <div className="flex gap-2">
              <button onClick={() => { setShowNewMeeting(false); setMeetingError('') }} className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-lime transition-colors min-h-[44px]">Cancelar</button>
              <button onClick={addMeeting} disabled={savingMeeting} className="flex-1 bento-btn py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">{savingMeeting ? 'Salvando...' : 'Lançar reunião'}</button>
            </div>
          </div>
        )}

        {meetingsDoMes.length === 0
          ? <p className="text-xs text-bento-muted py-2">Nenhuma reunião neste mês.</p>
          : <div className="space-y-1.5">
              {meetingsDoMes.map(m => (
                <MeetingRow key={m.id} meeting={m} onEdit={(patch) => editMeeting(m, patch)} onDelete={() => deleteMeeting(m)} />
              ))}
            </div>}
      </section>

      {/* ── CONFIGURAÇÃO: SALÁRIO ─────────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><DollarSign className="w-4 h-4 text-lime-fg" /> Salário fixo (USD)</h4>
        <p className="text-[11px] text-bento-muted -mt-1">Cada mudança vira um novo registro com data de vigência. Aumento vale só pra frente — meses passados não são reescritos.</p>

        {salaries.length > 0 ? (
          <div className="space-y-1.5">
            {salaries.map(s => (
              <div key={s.effectiveFrom} className="flex items-center justify-between bg-bento-bg border border-bento-border/60 rounded-btn px-3 py-2">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-bento-muted tabular-nums">a partir de {fmtMonthYear(s.effectiveFrom)}</span>
                  {s.effectiveFrom === appliedEff && <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-lime/15 text-lime-fg border border-lime/30">vigente neste mês</span>}
                </div>
                <span className="text-sm font-medium text-bento-text tabular-nums">{usd(s.valorUsd)}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-bento-muted py-2">Nenhum salário definido ainda.</p>
        )}

        <div className="grid grid-cols-2 gap-2 pt-1">
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Valor (USD)</label>
            <input type="number" value={salValor} onChange={e => setSalValor(e.target.value)} className={inputCls} placeholder="500.00" min="0" step="50" />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">A partir de</label>
            <input type="month" value={salMonth} onChange={e => setSalMonth(e.target.value)} className={inputCls} />
          </div>
        </div>
        {salError && <p className="text-xs text-red-400">{salError}</p>}
        <button onClick={addSalary} disabled={savingSal} className="flex items-center justify-center gap-1.5 w-full bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          <Plus className="w-4 h-4" /> {savingSal ? 'Salvando...' : 'Definir salário'}
        </button>
      </section>

      {/* ── CONFIGURAÇÃO: COTAÇÃO ─────────────────────────────────────── */}
      <section className="bento-fx p-4 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h4 className="flex items-center gap-1.5 text-sm font-semibold text-bento-text"><RefreshCw className="w-4 h-4 text-lime-fg" /> Cotação USD → BRL</h4>
          <span className="text-[10px] text-bento-muted">global · vale pra todos</span>
        </div>

        <div className="flex items-center justify-between bg-bento-bg border border-bento-border/60 rounded-btn px-3 py-2.5">
          <span className="text-xs text-bento-muted">Cotação em uso</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-bento-text tabular-nums">R$ {currentRate.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            <span className={cn('text-[10px] px-1.5 py-0.5 rounded-full border', fxTravada ? 'bg-amber-900/30 text-amber-400 border-amber-800/50' : 'bg-lime/15 text-lime-fg border-lime/30')}>
              {fxTravada ? 'Travada' : 'Automática'}
            </span>
          </div>
        </div>

        <button onClick={() => setFxTravadaInput(v => !v)}
          className={cn('flex items-center gap-2 w-full px-3 py-2.5 rounded-btn text-sm font-medium border transition-colors min-h-[44px]',
            fxTravadaInput ? 'border-amber-800/50 text-amber-400' : 'border-bento-border text-bento-dim hover:border-lime')}>
          {fxTravadaInput ? <Lock className="w-4 h-4" /> : <Unlock className="w-4 h-4" />}
          {fxTravadaInput ? 'Valor manual travado' : 'Automática (usa o valor manual por enquanto)'}
        </button>

        <div>
          <label className="block text-xs font-medium text-bento-dim mb-1">Valor manual (R$ por US$1)</label>
          <input type="number" value={fxManualInput} onChange={e => setFxManualInput(e.target.value)} className={inputCls} placeholder="5.40" min="0" step="0.01" />
        </div>
        {fxError && <p className="text-xs text-red-400">{fxError}</p>}
        <p className="text-[11px] text-bento-muted">A busca do dólar do dia entra numa fase futura. Por ora, defina o valor manual e escolha travar ou deixar automática.</p>
        <button onClick={saveFx} disabled={savingFx} className="w-full bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
          {savingFx ? 'Salvando...' : 'Salvar cotação'}
        </button>
      </section>
    </div>
  )
}
