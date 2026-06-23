'use client'

import { useMemo, useState } from 'react'
import { Search, ChevronDown, Check, Trash2, SlidersHorizontal } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { CollapsibleSection } from '@/components/mobile/CollapsibleSection'
import { PeriodChips } from '../PeriodChips'
import { rangeFor, inPeriodByActivity, type Range } from '@/lib/period'
import { ALL_COLUMNS, FUSO_LABELS, type Lead } from '../types'
import type { Client } from '../../clientes/ClientesClient'
import { ClienteModal } from '../../clientes/ClienteModal'

// Lista UNIFICADA de contatos (leads + clientes), deduplicada por telefone/email. Cliente prevalece.
// Só leitura/navegação — clicar abre o perfil existente (LeadDiary p/ lead, aba Clientes p/ cliente).

interface Props {
  leads: Lead[]
  clients: Client[]
  onOpenLead: (lead: Lead) => void
  onClientUpdated: (c: Client) => void   // clique em cliente abre o ClienteModal aqui mesmo; salva e reflete no mapa
}

type Row = {
  id: string
  origem: 'lead' | 'client'
  name: string
  company: string
  phone: string
  email: string
  faseKey: string     // slug do status (lead) ou 'cliente'
  faseLabel: string
  faseDot: string     // classe de cor do ponto
  nicho: string
  fuso: string        // '' = sem fuso
  chegada: string     // received_at (lead) | start_date (cliente)
}

const onlyDigits = (s?: string | null) => (s ?? '').replace(/\D/g, '')
const lower = (s?: string | null) => (s ?? '').trim().toLowerCase()
const STATUS_STYLE = Object.fromEntries(ALL_COLUMNS.map(c => [c.key, c]))

function fmtChegada(s: string): string {
  if (!s) return ''
  const d = new Date(s.length === 10 ? `${s}T12:00:00` : s)
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
}

// ── Dropdown de filtro multi-seleção (checkboxes) ──────────────────────────────
function FilterDropdown({ label, options, selected, onToggle }: {
  label: string; options: { value: string; label: string }[]; selected: Set<string>; onToggle: (v: string) => void
}) {
  const [open, setOpen] = useState(false)
  return (
    <div className="relative">
      <button onClick={() => setOpen(o => !o)}
        className={cn('flex items-center gap-1.5 px-3 py-2 rounded-btn border text-xs font-medium transition-colors min-h-[40px]',
          selected.size ? 'border-lime/40 text-lime-fg bg-lime/10' : 'border-bento-border text-bento-dim hover:text-bento-text')}>
        {label}{selected.size ? ` (${selected.size})` : ''}
        <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', open && 'rotate-180')} />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute z-30 mt-1 w-56 max-h-72 overflow-y-auto bg-bento-panel border border-bento-border rounded-btn shadow-card-hover p-1">
            {options.length === 0 ? (
              <p className="text-xs text-bento-muted px-2 py-1.5">Nenhuma opção.</p>
            ) : options.map(o => (
              <button key={o.value} onClick={() => onToggle(o.value)}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-xs text-left hover:bg-bento-bg transition-colors">
                <span className={cn('w-3.5 h-3.5 rounded border flex items-center justify-center flex-none',
                  selected.has(o.value) ? 'bg-lime border-lime' : 'border-bento-border')}>
                  {selected.has(o.value) && <Check className="w-2.5 h-2.5 text-lime-ink" />}
                </span>
                <span className="text-bento-text truncate">{o.label}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}

export function ContatosTab({ leads, clients, onOpenLead, onClientUpdated }: Props) {
  const [search, setSearch] = useState('')
  const [editClient, setEditClient] = useState<Client | null>(null)
  const [range, setRange] = useState<Range>(() => rangeFor('tudo'))   // período (em memória; reload = "Tudo")
  const [faseSel, setFaseSel] = useState<Set<string>>(new Set())
  const [nichoSel, setNichoSel] = useState<Set<string>>(new Set())
  const [fusoSel, setFusoSel] = useState<Set<string>>(new Set())
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set())   // exclusão otimista (ids de lead apagados)
  const [confirm, setConfirm] = useState<Row | null>(null)               // linha aguardando confirmação de exclusão
  const [deleting, setDeleting] = useState(false)
  const { toast } = useToast()
  const supabase = createClient()

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void) => (v: string) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    setSet(next)
  }

  // Lista unificada + dedup (cliente prevalece sobre lead com mesmo phone/email).
  const rows = useMemo<Row[]>(() => {
    // Filtro de período: leads por updated_at||created_at; clientes por start_date||created_at.
    // "Tudo" não filtra. A dedup (clientKeys) usa TODOS os clientes p/ não duplicar lead que é cliente.
    const periodLeads = leads.filter(l => inPeriodByActivity(range, l.updated_at, l.created_at))
    const periodClients = clients.filter(c => inPeriodByActivity(range, undefined, c.start_date ?? c.created_at))
    const clientKeys = new Set<string>()
    for (const c of clients) {
      const p = onlyDigits(c.phone); if (p) clientKeys.add('p:' + p)
      const e = lower(c.email); if (e) clientKeys.add('e:' + e)
    }
    const out: Row[] = []
    for (const c of periodClients) {
      out.push({
        id: c.id, origem: 'client', name: c.name, company: c.company ?? '', phone: c.phone ?? '', email: c.email ?? '',
        faseKey: 'cliente', faseLabel: 'Cliente', faseDot: 'bg-lime',
        nicho: (c.nicho ?? '').trim(), fuso: (c.fuso ?? '') || '', chegada: c.start_date ?? '',
      })
    }
    for (const l of periodLeads) {
      const p = onlyDigits(l.phone), e = lower(l.email)
      const st = STATUS_STYLE[l.status]
      if (l.status === 'lixeira') {
        // Lixeira = GRUPO À PARTE: não funde com lead ativo nem com cliente; cada lixo é sua própria
        // linha. Só fica VISÍVEL quando o filtro "Lixeira" está ligado (ver `visible`).
        out.push({
          id: l.id, origem: 'lead', name: l.name, company: l.company ?? '', phone: l.phone ?? '', email: l.email ?? '',
          faseKey: 'lixeira', faseLabel: st?.label ?? 'Lixeira', faseDot: st?.dotColor ?? 'bg-bento-muted',
          nicho: (l.nicho ?? '').trim(), fuso: (l.fuso ?? '') || '', chegada: l.received_at ?? '',
        })
        continue
      }
      if ((p && clientKeys.has('p:' + p)) || (e && clientKeys.has('e:' + e))) continue   // já é cliente
      out.push({
        id: l.id, origem: 'lead', name: l.name, company: l.company ?? '', phone: l.phone ?? '', email: l.email ?? '',
        faseKey: l.status, faseLabel: st?.label ?? l.status, faseDot: st?.dotColor ?? 'bg-bento-muted',
        nicho: (l.nicho ?? '').trim(), fuso: (l.fuso ?? '') || '', chegada: l.received_at ?? '',
      })
    }
    return out
      .filter(r => !removedIds.has(r.id))
      .sort((a, b) => (b.chegada || '').localeCompare(a.chegada || ''))
  }, [leads, clients, removedIds, range])

  // Opções dos filtros.
  const faseOptions = useMemo(() => [
    ...ALL_COLUMNS.filter(c => c.key !== 'lixeira').map(c => ({ value: c.key, label: c.label })),
    { value: 'cliente', label: 'Cliente' },
  ], [])
  const nichoOptions = useMemo(() => Array.from(new Set(rows.map(r => r.nicho).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b)).map(n => ({ value: n, label: n })), [rows])
  const fusoOptions = [...Object.entries(FUSO_LABELS).map(([value, label]) => ({ value, label })), { value: '__none__', label: 'Sem fuso' }]

  // Lixeira é SEMPRE mostrada, como GRUPO À PARTE (abaixo), independente do filtro de Fase.
  // Os demais (ativos/cliente) seguem com busca + Fase + Nicho + Fuso (e a dedup de hoje).
  const { visibleMain, visibleLixeira } = useMemo(() => {
    const q = search.trim().toLowerCase()
    const matchText = (r: Row) => !q || [r.name, r.company, r.phone, r.email].some(v => v.toLowerCase().includes(q))
    const matchNichoFuso = (r: Row) =>
      (!nichoSel.size || nichoSel.has(r.nicho)) && (!fusoSel.size || fusoSel.has(r.fuso || '__none__'))
    const main: Row[] = []
    const lix: Row[] = []
    for (const r of rows) {
      if (!matchText(r) || !matchNichoFuso(r)) continue
      if (r.faseKey === 'lixeira') { lix.push(r); continue }     // grupo separado; NÃO usa filtro de Fase
      if (faseSel.size && !faseSel.has(r.faseKey)) continue
      main.push(r)
    }
    return { visibleMain: main, visibleLixeira: lix }
  }, [rows, search, faseSel, nichoSel, fusoSel])
  const totalVisible = visibleMain.length + visibleLixeira.length

  const open = (r: Row) => {
    if (r.origem === 'lead') { const l = leads.find(x => x.id === r.id); if (l) onOpenLead(l) }
    else { const c = clients.find(x => x.id === r.id); if (c) setEditClient(c) }   // cliente → modal editável
  }

  // Exclusão PERMANENTE — só leads. Junta o lead da linha + duplicados (mesmo phone/email
  // normalizado). GUARDA anti-cliente roda ANTES do delete (mesmo se a UI falhar). O banco tem
  // ON DELETE CASCADE em lead_interactions/lead_milestones → o histórico some junto. NÃO toca em
  // nenhuma tabela de cliente/dinheiro (clients/client_payments/weekly_payments/deals/meetings/presentations).
  const doDelete = async (r: Row) => {
    const p = onlyDigits(r.phone), e = lower(r.email)

    // GUARDA: reconfirma que o contato NÃO casa com nenhum cliente (mesmo phone/email normalizado).
    const clientKeys = new Set<string>()
    for (const c of clients) {
      const cp = onlyDigits(c.phone); if (cp) clientKeys.add('p:' + cp)
      const ce = lower(c.email); if (ce) clientKeys.add('e:' + ce)
    }
    if ((p && clientKeys.has('p:' + p)) || (e && clientKeys.has('e:' + e))) {
      toast({ type: 'error', message: 'Esse contato é cliente — desative em vez de excluir.' })
      setConfirm(null)
      return
    }

    // Ids a apagar: o da linha + leads duplicados (mesmo phone/email). Sem contato → só o da linha.
    // SEGURANÇA por grupo de status: lixo só apaga lixo; ativo só apaga ativo (não-lixeira).
    // Assim, excluir um lixo nunca apaga um lead ativo sem querer — e vice-versa.
    const isLixeira = r.faseKey === 'lixeira'
    const ids = new Set<string>([r.id])
    if (p || e) {
      for (const l of leads) {
        const sameGroup = isLixeira ? l.status === 'lixeira' : l.status !== 'lixeira'
        if (!sameGroup) continue
        if ((p && onlyDigits(l.phone) === p) || (e && lower(l.email) === e)) ids.add(l.id)
      }
    }
    const idArr = Array.from(ids)

    setDeleting(true)
    const { error } = await supabase.from('leads').delete().in('id', idArr)
    setDeleting(false)
    if (error) {
      toast({ type: 'error', message: `Não foi possível excluir: ${error.message}` })
      return
    }
    setRemovedIds(prev => { const n = new Set(prev); for (const id of idArr) n.add(id); return n })   // otimista: somem da lista
    setConfirm(null)
    toast({ type: 'success', message: 'Contato excluído' })
  }

  // Card de contato (reusado nos dois grupos: principais + lixeira). Lixeira = apagado (opacity).
  const renderRow = (r: Row) => (
    <div key={`${r.origem}-${r.id}`}
      onClick={() => open(r)}
      role="button" tabIndex={0}
      onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(r) } }}
      className={cn('w-full text-left bento-fx p-3 hover:border-lime/40 transition-colors cursor-pointer',
        r.faseKey === 'lixeira' && 'opacity-70')}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm font-semibold text-bento-text truncate">{r.name || 'Sem nome'}</p>
          {r.company && <p className="text-xs text-bento-muted truncate">{r.company}</p>}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {r.chegada && <span className="font-tech text-[10px] text-bento-muted tabular-nums">{fmtChegada(r.chegada)}</span>}
          {/* Excluir de vez — SÓ leads. Cliente nunca é excluído (só desativado). */}
          {r.origem === 'lead' && (
            <button type="button" aria-label="Excluir de vez" title="Excluir de vez"
              onClick={e => { e.stopPropagation(); setConfirm(r) }}
              className="p-1 -mr-1 rounded-md text-bento-muted/50 hover:text-red-400 hover:bg-red-500/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2">
        <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border border-bento-border text-bento-dim font-semibold">
          <span className={cn('w-1.5 h-1.5 rounded-full flex-none', r.faseDot)} />{r.faseLabel}
        </span>
        {r.nicho && <span className="text-[10px] px-2 py-0.5 rounded-full bg-bento-bg border border-bento-border text-bento-muted">{r.nicho}</span>}
        {r.fuso && <span className="font-tech text-[10px] px-2 py-0.5 rounded-full bg-bento-bg border border-bento-border text-bento-muted">{FUSO_LABELS[r.fuso] ?? r.fuso}</span>}
        {r.phone && <span className="font-tech text-[11px] text-bento-muted ml-auto tabular-nums">{r.phone}</span>}
      </div>
    </div>
  )

  return (
    <div className="h-full overflow-y-auto bg-bento-bg p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Cabeçalho + contador */}
        <div className="flex items-baseline gap-2">
          <h3 className="font-display font-bold text-bento-text text-lg">Contatos</h3>
          <span className="font-tech text-xs text-bento-muted tabular-nums">{totalVisible} contato{totalVisible === 1 ? '' : 's'}</span>
        </div>

        {/* Período (padrão "Tudo") — filtra leads por updated_at||created_at e clientes por start_date. */}
        <PeriodChips range={range} onChange={setRange} />

        {/* Busca + filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-bento-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome, empresa, telefone, e-mail..."
              className="w-full bg-bento-bg border border-bento-border rounded-btn pl-8 pr-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime min-h-[40px]" />
          </div>
          {/* Mobile: filtros dentro de "Filtros" (fechada por padrão). Desktop (lg:contents): os 3
              dropdowns voltam a ser itens diretos desta linha — layout idêntico ao de hoje. */}
          <CollapsibleSection title="Filtros" icon={SlidersHorizontal} className="w-full"
            badge={faseSel.size + nichoSel.size + fusoSel.size || undefined}>
            <div className="flex flex-wrap gap-2 lg:contents">
              <FilterDropdown label="Fase" options={faseOptions} selected={faseSel} onToggle={toggle(faseSel, setFaseSel)} />
              <FilterDropdown label="Nicho" options={nichoOptions} selected={nichoSel} onToggle={toggle(nichoSel, setNichoSel)} />
              <FilterDropdown label="Fuso" options={fusoOptions} selected={fusoSel} onToggle={toggle(fusoSel, setFusoSel)} />
            </div>
          </CollapsibleSection>
        </div>

        {/* Lista (cards empilhados; sem scroll horizontal). Lixeira = grupo separado abaixo. */}
        {totalVisible === 0 ? (
          <p className="text-sm text-bento-muted text-center py-10">Nenhum contato encontrado.</p>
        ) : (
          <div className="space-y-1.5">
            {visibleMain.map(renderRow)}
            {visibleLixeira.length > 0 && (
              <>
                <div className="flex items-center gap-2 pt-4 pb-1">
                  <span className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">Lixeira</span>
                  <span className="font-tech text-[10px] text-bento-muted/70 tabular-nums">{visibleLixeira.length}</span>
                  <div className="flex-1 border-t border-bento-border/60" />
                </div>
                {visibleLixeira.map(renderRow)}
              </>
            )}
          </div>
        )}
      </div>

      {/* Confirmação de exclusão PERMANENTE — só leads */}
      {confirm && (
        <div className="fixed inset-0 z-[90] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => { if (!deleting) setConfirm(null) }} />
          <div className="relative bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md animate-slide-up">
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <span className="w-9 h-9 rounded-full bg-red-500/15 flex items-center justify-center flex-none">
                  <Trash2 className="w-4 h-4 text-red-400" />
                </span>
                <div className="min-w-0">
                  <h2 className="font-display font-bold text-bento-text leading-tight">Excluir de vez</h2>
                  <p className="text-sm text-bento-dim truncate">{confirm.name || 'Sem nome'}</p>
                </div>
              </div>

              <div className="rounded-btn border border-red-800/50 bg-red-900/20 p-3">
                <p className="text-sm text-red-200">
                  Isso apaga o lead e todo o histórico dele (transcrições, briefings, notas) <span className="font-bold">PARA SEMPRE</span>. Não dá pra desfazer.
                </p>
              </div>

              <div className="flex flex-col gap-2 pt-1">
                <button type="button" onClick={() => setConfirm(null)} disabled={deleting}
                  className="w-full border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm font-medium hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50 min-h-[44px]">
                  Cancelar
                </button>
                <button type="button" onClick={() => doDelete(confirm)} disabled={deleting}
                  className="w-full mt-1 bg-red-600 text-white py-2.5 rounded-btn text-sm font-semibold hover:bg-red-700 transition-colors disabled:opacity-50 min-h-[44px]">
                  {deleting ? 'Excluindo...' : 'Excluir de vez'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edição de cliente na própria aba Contatos (modal compartilhado). Salva e reflete no mapa. */}
      {editClient && (
        <ClienteModal
          client={editClient}
          onClose={() => setEditClient(null)}
          onSaved={onClientUpdated}
        />
      )}
    </div>
  )
}
