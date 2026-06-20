'use client'

import { useMemo, useState } from 'react'
import { Search, ChevronDown, Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { ALL_COLUMNS, FUSO_LABELS, type Lead } from '../types'
import type { Client } from '../../clientes/ClientesClient'

// Lista UNIFICADA de contatos (leads + clientes), deduplicada por telefone/email. Cliente prevalece.
// Só leitura/navegação — clicar abre o perfil existente (LeadDiary p/ lead, aba Clientes p/ cliente).

interface Props {
  leads: Lead[]
  clients: Client[]
  onOpenLead: (lead: Lead) => void
  onOpenClient: (id: string) => void
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

export function ContatosTab({ leads, clients, onOpenLead, onOpenClient }: Props) {
  const [search, setSearch] = useState('')
  const [faseSel, setFaseSel] = useState<Set<string>>(new Set())
  const [nichoSel, setNichoSel] = useState<Set<string>>(new Set())
  const [fusoSel, setFusoSel] = useState<Set<string>>(new Set())

  const toggle = (set: Set<string>, setSet: (s: Set<string>) => void) => (v: string) => {
    const next = new Set(set)
    if (next.has(v)) next.delete(v)
    else next.add(v)
    setSet(next)
  }

  // Lista unificada + dedup (cliente prevalece sobre lead com mesmo phone/email).
  const rows = useMemo<Row[]>(() => {
    const clientKeys = new Set<string>()
    for (const c of clients) {
      const p = onlyDigits(c.phone); if (p) clientKeys.add('p:' + p)
      const e = lower(c.email); if (e) clientKeys.add('e:' + e)
    }
    const out: Row[] = []
    for (const c of clients) {
      out.push({
        id: c.id, origem: 'client', name: c.name, company: c.company ?? '', phone: c.phone ?? '', email: c.email ?? '',
        faseKey: 'cliente', faseLabel: 'Cliente', faseDot: 'bg-lime',
        nicho: (c.nicho ?? '').trim(), fuso: (c.fuso ?? '') || '', chegada: c.start_date ?? '',
      })
    }
    for (const l of leads) {
      if (l.status === 'lixeira') continue
      const p = onlyDigits(l.phone), e = lower(l.email)
      if ((p && clientKeys.has('p:' + p)) || (e && clientKeys.has('e:' + e))) continue   // já é cliente
      const st = STATUS_STYLE[l.status]
      out.push({
        id: l.id, origem: 'lead', name: l.name, company: l.company ?? '', phone: l.phone ?? '', email: l.email ?? '',
        faseKey: l.status, faseLabel: st?.label ?? l.status, faseDot: st?.dotColor ?? 'bg-bento-muted',
        nicho: (l.nicho ?? '').trim(), fuso: (l.fuso ?? '') || '', chegada: l.received_at ?? '',
      })
    }
    return out.sort((a, b) => (b.chegada || '').localeCompare(a.chegada || ''))
  }, [leads, clients])

  // Opções dos filtros.
  const faseOptions = useMemo(() => [
    ...ALL_COLUMNS.filter(c => c.key !== 'lixeira').map(c => ({ value: c.key, label: c.label })),
    { value: 'cliente', label: 'Cliente' },
  ], [])
  const nichoOptions = useMemo(() => Array.from(new Set(rows.map(r => r.nicho).filter(Boolean)))
    .sort((a, b) => a.localeCompare(b)).map(n => ({ value: n, label: n })), [rows])
  const fusoOptions = [...Object.entries(FUSO_LABELS).map(([value, label]) => ({ value, label })), { value: '__none__', label: 'Sem fuso' }]

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter(r => {
      if (q && ![r.name, r.company, r.phone, r.email].some(v => v.toLowerCase().includes(q))) return false
      if (faseSel.size && !faseSel.has(r.faseKey)) return false
      if (nichoSel.size && !nichoSel.has(r.nicho)) return false
      if (fusoSel.size && !fusoSel.has(r.fuso || '__none__')) return false
      return true
    })
  }, [rows, search, faseSel, nichoSel, fusoSel])

  const open = (r: Row) => {
    if (r.origem === 'lead') { const l = leads.find(x => x.id === r.id); if (l) onOpenLead(l) }
    else onOpenClient(r.id)
  }

  return (
    <div className="h-full overflow-y-auto bg-bento-bg p-4 sm:p-6">
      <div className="max-w-4xl mx-auto space-y-4">
        {/* Cabeçalho + contador */}
        <div className="flex items-baseline gap-2">
          <h3 className="font-display font-bold text-bento-text text-lg">Contatos</h3>
          <span className="font-tech text-xs text-bento-muted tabular-nums">{visible.length} contato{visible.length === 1 ? '' : 's'}</span>
        </div>

        {/* Busca + filtros */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-4 h-4 absolute left-2.5 top-1/2 -translate-y-1/2 text-bento-muted" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar nome, empresa, telefone, e-mail..."
              className="w-full bg-bento-bg border border-bento-border rounded-btn pl-8 pr-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime min-h-[40px]" />
          </div>
          <FilterDropdown label="Fase" options={faseOptions} selected={faseSel} onToggle={toggle(faseSel, setFaseSel)} />
          <FilterDropdown label="Nicho" options={nichoOptions} selected={nichoSel} onToggle={toggle(nichoSel, setNichoSel)} />
          <FilterDropdown label="Fuso" options={fusoOptions} selected={fusoSel} onToggle={toggle(fusoSel, setFusoSel)} />
        </div>

        {/* Lista (linhas responsivas; sem scroll horizontal) */}
        {visible.length === 0 ? (
          <p className="text-sm text-bento-muted text-center py-10">Nenhum contato encontrado.</p>
        ) : (
          <div className="space-y-1.5">
            {visible.map(r => (
              <button key={`${r.origem}-${r.id}`} onClick={() => open(r)}
                className="w-full text-left bento-fx p-3 hover:border-lime/40 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-bento-text truncate">{r.name || 'Sem nome'}</p>
                    {r.company && <p className="text-xs text-bento-muted truncate">{r.company}</p>}
                  </div>
                  {r.chegada && <span className="font-tech text-[10px] text-bento-muted shrink-0 tabular-nums">{fmtChegada(r.chegada)}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-[10px] px-2 py-0.5 rounded-full border border-bento-border text-bento-dim font-semibold">
                    <span className={cn('w-1.5 h-1.5 rounded-full flex-none', r.faseDot)} />{r.faseLabel}
                  </span>
                  {r.nicho && <span className="text-[10px] px-2 py-0.5 rounded-full bg-bento-bg border border-bento-border text-bento-muted">{r.nicho}</span>}
                  {r.fuso && <span className="font-tech text-[10px] px-2 py-0.5 rounded-full bg-bento-bg border border-bento-border text-bento-muted">{FUSO_LABELS[r.fuso] ?? r.fuso}</span>}
                  {r.phone && <span className="font-tech text-[11px] text-bento-muted ml-auto tabular-nums">{r.phone}</span>}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
