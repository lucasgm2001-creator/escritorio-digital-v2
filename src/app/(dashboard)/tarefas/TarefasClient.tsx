'use client'

import { useState, useMemo, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useRealtimeRows } from '@/lib/hooks/useRealtimeRows'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { TaskModal, type TaskPrefill } from './TaskModal'
import { ymd } from '@/lib/format'
import type { Task, LinkOption, ParsedTask } from './types'
import { useToast } from '@/components/ui/toast'

// Título a partir do texto digitado (rede de segurança local — espelha o servidor).
// Garante que o título NUNCA fique vazio mesmo se a IA falhar/não responder.
function cleanTitle(text: string): string {
  let t = text
    .replace(/\b(urgente|urgência|asap|importante|prioridade(?:\s+alta)?|pra ontem)\b/gi, '')
    .replace(/\b(hoje|amanh[ãa]|depois de amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|semana que vem|pr[óo]xima semana)(?:-feira)?\b/gi, '')
    .replace(/\b[àás]?\s*\d{1,2}\s*(?:h|hs|horas?|:\d{2})\b/gi, '')
    .replace(/\b(de\s+)?(manh[ãa]|tarde|noite|meio-dia)\b/gi, '')
    .replace(/[,;]+/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
  if (!t) t = text.trim()
  return t.charAt(0).toUpperCase() + t.slice(1)
}

// Casa o nome solto que a IA extraiu com um lead/cliente existente.
function matchContact(name: string, options: LinkOption[]): LinkOption | null {
  const q = name.trim().toLowerCase()
  if (!q) return null
  const lc = options.map(o => ({ o, n: o.name.toLowerCase() }))
  return (
    lc.find(x => x.n === q) ??
    lc.find(x => x.n.startsWith(q)) ??
    lc.find(x => x.n.includes(q)) ??
    lc.find(x => { const first = x.n.split(' ')[0]; return first === q || q.startsWith(first) })
  )?.o ?? null
}

interface Props {
  initialTasks: Task[]
  linkOptions: LinkOption[]
  currentUser: { id: string; name: string }
}

// ── Datas (local) ── (ymd vem de format.ts — dedup do antigo toISO, MESMA saída local)
function isoPlus(days: number): string {
  const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + days)
  return ymd(d)
}
function fmtDate(iso?: string | null): string {
  if (!iso) return ''
  const [, m, d] = iso.split('-')
  return `${d}/${m}`
}

type SectionId = 'atrasadas' | 'hoje' | 'amanha' | 'semana' | 'depois'
// Celular + iPad (<1280, xl): menu HORIZONTAL de abas (Hoje · Próximas · Atrasadas · Concluídas).
// Computador (≥1280) segue com as SECTIONS (acordeão) abaixo.
type MobileChip = 'hoje' | 'proximas' | 'atrasadas' | 'concluidas'

const SECTIONS: { id: SectionId; label: string; danger?: boolean }[] = [
  { id: 'atrasadas', label: 'Atrasadas', danger: true },
  { id: 'hoje',      label: 'Hoje' },
  { id: 'amanha',    label: 'Amanhã' },
  { id: 'semana',    label: 'Esta semana' },
  { id: 'depois',    label: 'Depois / sem data' },
]

const PRIO_ORDER: Record<string, number> = { urgente: 3, alta: 2, normal: 1 }
const PRIORITY_TAG: Record<string, string> = {
  alta:    'text-amber-400 bg-amber-900/30',
  urgente: 'text-red-400 bg-red-900/30',
}

function sectionOf(t: Task, today: string, tomorrow: string, weekEnd: string): SectionId {
  if (!t.due_date) return 'depois'
  if (t.due_date < today)    return 'atrasadas'
  if (t.due_date === today)  return 'hoje'
  if (t.due_date === tomorrow) return 'amanha'
  if (t.due_date <= weekEnd) return 'semana'
  return 'depois'
}

function sortPending(a: Task, b: Task): number {
  // 1) prioridade (urgente → normal)
  const p = (PRIO_ORDER[b.priority] ?? 1) - (PRIO_ORDER[a.priority] ?? 1)
  if (p) return p
  // 2) dia (relevante em seções multi-dia: Atrasadas/Esta semana/Depois)
  const da = a.due_date ?? '9999-99-99'
  const db = b.due_date ?? '9999-99-99'
  if (da !== db) return da < db ? -1 : 1
  // 3) dentro do dia: com hora (por horário) antes de sem hora ('~' > dígitos)
  const ta = a.due_time ? a.due_time.slice(0, 5) : '~'
  const tb = b.due_time ? b.due_time.slice(0, 5) : '~'
  if (ta !== tb) return ta < tb ? -1 : 1
  return a.created_at < b.created_at ? -1 : 1
}

export function TarefasClient({ initialTasks, linkOptions, currentUser }: Props) {
  const [tasks, setTasks] = useState<Task[]>(initialTasks)
  // Reflete dados frescos do servidor após router.refresh() (revalidação ao focar a aba).
  useEffect(() => { setTasks(initialTasks) }, [initialTasks])
  // Tempo real: criar/editar/concluir/excluir tarefa reflete ao vivo (merge por id).
  useRealtimeRows<Task>('tasks', setTasks)
  const view = 'tarefas' as const   // Relatório virou item próprio do menu do Hall (ao lado de Tarefas)
  const { toast } = useToast()
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [modalPrefill, setModalPrefill] = useState<TaskPrefill | null>(null)
  const [modalAiFilled, setModalAiFilled] = useState(false)
  const [modalKey, setModalKey] = useState(0)   // força remontagem por abertura
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<string | null>(null)
  const [showDone, setShowDone] = useState(false)
  // IA: criar por texto
  const [aiText, setAiText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [aiError, setAiError] = useState('')
  // IA: resumo do dia
  const [summary, setSummary] = useState<string | null>(null)
  const [summaryLoading, setSummaryLoading] = useState(false)
  const [summaryOpen, setSummaryOpen] = useState(false)
  // Erro de ação (concluir/excluir) — sem falha silenciosa
  const [actionError, setActionError] = useState('')
  // Filtro por responsável (vendedor). 'todos' = sem filtro.
  const [respFilter, setRespFilter] = useState<string>('todos')
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([])

  const supabase = createClient()
  const router = useRouter()

  // Vendedores p/ o filtro "Responsável" (extensível; hoje só Lucas).
  useEffect(() => {
    supabase.from('sellers').select('id, name').eq('status', 'ativo').order('name').then(({ data }) => setSellers((data ?? []) as { id: string; name: string }[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const phoneById = useMemo(() => {
    const m = new Map<string, string>()
    linkOptions.forEach(o => { if (o.phone) m.set(o.id, o.phone) })
    return m
  }, [linkOptions])

  const today = ymd(new Date()), tomorrow = isoPlus(1), weekEnd = isoPlus(7)

  const visibleTasks = useMemo(
    () => respFilter === 'todos' ? tasks : tasks.filter(t => t.responsavel_id === respFilter),
    [tasks, respFilter],
  )

  const { groups, done } = useMemo(() => {
    const groups: Record<SectionId, Task[]> = { atrasadas: [], hoje: [], amanha: [], semana: [], depois: [] }
    const done: Task[] = []
    for (const t of visibleTasks) {
      if (t.done) done.push(t)
      else groups[sectionOf(t, today, tomorrow, weekEnd)].push(t)
    }
    ;(Object.keys(groups) as SectionId[]).forEach(k => groups[k].sort(sortPending))
    done.sort((a, b) => (b.completed_at ?? b.updated_at) < (a.completed_at ?? a.updated_at) ? -1 : 1)
    return { groups, done }
  }, [visibleTasks, today, tomorrow, weekEnd])

  const pendingCount = visibleTasks.filter(t => !t.done).length

  // ── Celular + iPad (<1280): abas horizontais. Computador usa as SECTIONS acima (inalterado). ──
  const [mobileChip, setMobileChip] = useState<MobileChip>('hoje')
  const proximas = useMemo(() => [...groups.amanha, ...groups.semana, ...groups.depois]
    .sort((a, b) => (a.due_date ?? '9999-99-99') < (b.due_date ?? '9999-99-99') ? -1 : 1), [groups])
  const weekStartISO = useMemo(() => {
    const d = new Date(); const day = d.getDay(); const diff = day === 0 ? -6 : 1 - day
    d.setHours(0, 0, 0, 0); d.setDate(d.getDate() + diff); return d.toISOString()
  }, [])
  const doneWeek = useMemo(() => done.filter(t => (t.completed_at ?? t.updated_at ?? '') >= weekStartISO), [done, weekStartISO])
  const respLabel = respFilter === 'todos' ? 'Todos' : (sellers.find(s => s.id === respFilter)?.name ?? 'Todos')
  const cycleResp = () => { const opts = ['todos', ...sellers.map(s => s.id)]; setRespFilter(opts[(opts.indexOf(respFilter) + 1) % opts.length]) }

  // ── Ações ── (optimistic + await + rollback se o banco recusar)
  const toggleDone = async (t: Task) => {
    const nowDone = !t.done
    const completed_at = nowDone ? new Date().toISOString() : null
    setActionError('')
    setTasks(prev => prev.map(x => x.id === t.id ? { ...x, done: nowDone, completed_at } : x))
    const { error } = await supabase.from('tasks').update({ done: nowDone, completed_at }).eq('id', t.id)
    if (error) {
      setTasks(prev => prev.map(x => x.id === t.id ? t : x))   // rollback ao original
      setActionError(`Não foi possível ${nowDone ? 'concluir' : 'reabrir'} a tarefa: ${error.message}`)
    } else {
      router.refresh()                                          // reconcilia com o server
    }
  }
  // Criar/editar: update OTIMISTA (aparece na hora) + router.refresh() reconcilia com o server
  // (re-busca a lista; o efeito [initialTasks] aplica a verdade do banco). Sem reload manual.
  const handleSaved = (t: Task) => {
    setTasks(prev => prev.some(x => x.id === t.id) ? prev.map(x => x.id === t.id ? t : x) : [t, ...prev])
    router.refresh()
  }
  const handleDelete = async (t: Task) => {
    setConfirmId(null)
    setActionError('')
    // Apaga o evento no Google Agenda ANTES de remover a linha (best-effort, fire-and-forget). Usa o
    // id que já está no estado; o servidor cuida da credencial. Não bloqueia a exclusão.
    if (t.google_event_id) {
      fetch('/api/tasks/calendar-sync', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ deleteEventId: t.google_event_id }), keepalive: true,
      }).catch(() => {})
    }
    const snapshot = tasks
    setTasks(prev => prev.filter(x => x.id !== t.id))   // some da lista na hora
    const { error } = await supabase.from('tasks').delete().eq('id', t.id)
    if (error) {
      setTasks(snapshot)                                        // rollback (re-insere)
      setActionError(`Não foi possível excluir a tarefa: ${error.message}`)
    } else {
      router.refresh()                                          // reconcilia com o server
    }
  }
  const openNew  = () => { setModalKey(k => k + 1); setEditing(null); setModalPrefill(null); setModalAiFilled(false); setModalOpen(true) }
  const openEdit = (t: Task) => { setModalKey(k => k + 1); setEditing(t); setModalPrefill(null); setModalAiFilled(false); setModalOpen(true) }
  const openAI   = (prefill: TaskPrefill) => { setModalKey(k => k + 1); setEditing(null); setModalPrefill(prefill); setModalAiFilled(true); setModalOpen(true) }

  // IA: interpreta o texto e abre o modal já preenchido (preview editável).
  // NUNCA bloqueia: o modal sempre abre, e o título sempre vem preenchido —
  // da IA quando disponível, ou do próprio texto digitado (fallback local).
  const handleAiCreate = async () => {
    const text = aiText.trim()
    if (!text || aiLoading) return
    setAiLoading(true); setAiError('')

    const localTitle = cleanTitle(text)   // garantia: nunca vazio

    try {
      const now = new Date()
      const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })
      const res = await fetch('/api/tasks/parse', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, today: ymd(now), todayLabel }),
      })
      const data = await res.json().catch(() => null)
      const p = (data?.task ?? null) as ParsedTask | null
      const prefill: TaskPrefill = {
        title: (p?.title && p.title.trim()) ? p.title.trim() : localTitle,
        due_date: p?.due_date || '',
        due_time: p?.due_time || '',
        priority: p?.priority ?? 'normal',
        link: p?.contact_name ? matchContact(p.contact_name, linkOptions) : null,
      }
      setAiText('')
      openAI(prefill)
    } catch {
      // Offline/erro: ainda abre o modal com o título do texto digitado.
      toast({ type: 'error', message: 'A IA demorou para responder. Abri a tarefa com o texto que você digitou.' })
      setAiText('')
      openAI({ title: localTitle, due_date: '', due_time: '', priority: 'normal', link: null })
    } finally {
      setAiLoading(false)
    }
  }

  // IA: resumo do dia (hoje + atrasadas).
  const handleSummary = async () => {
    if (summaryLoading) return
    setSummaryOpen(true); setSummaryLoading(true); setSummary(null)
    try {
      const compact = [
        ...groups.atrasadas.map(t => ({ title: t.title, priority: t.priority, due_time: t.due_time, overdue: true })),
        ...groups.hoje.map(t => ({ title: t.title, priority: t.priority, due_time: t.due_time, overdue: false })),
      ]
      const res = await fetch('/api/tasks/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ tasks: compact }),
      })
      const data = await res.json()
      setSummary(res.ok ? (data.summary ?? '') : 'Não consegui gerar o resumo agora.')
    } catch {
      setSummary('Falha ao gerar o resumo.')
      toast({ type: 'error', message: 'A IA demorou para responder. Tente o resumo novamente.' })
    } finally {
      setSummaryLoading(false)
    }
  }

  // ── Linha de tarefa (função inline → sem componente aninhado, sem bug de foco) ──
  const renderRow = (t: Task) => {
    const phone = t.linked_id ? phoneById.get(t.linked_id) : undefined
    const isExpanded = expandedId === t.id
    const isConfirming = confirmId === t.id

    return (
      <div key={t.id} className="group bento-fx p-3">
        <div className="flex items-start gap-3">
          {/* Checkbox */}
          <button
            onClick={() => toggleDone(t)}
            aria-label={t.done ? 'Desmarcar' : 'Marcar como feita'}
            className={cn(
              'mt-0.5 w-[18px] h-[18px] rounded-md border flex items-center justify-center flex-none transition-colors',
              t.done ? 'bg-lime border-lime' : 'border-bento-border hover:border-lime',
            )}
          >
            {t.done && (
              <svg className="w-3 h-3 text-lime-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
              </svg>
            )}
          </button>

          {/* Conteúdo */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className={cn('text-sm leading-snug', t.done ? 'line-through text-bento-muted' : 'text-bento-text')}>
                {t.title}
              </span>
              {!t.done && t.priority !== 'normal' && (
                <span className={cn('text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded', PRIORITY_TAG[t.priority])}>
                  {t.priority}
                </span>
              )}
            </div>

            {/* Chip de lead/cliente + telefone */}
            {t.linked_id && t.linked_name && (
              <div className="flex items-center gap-1.5 mt-1.5">
                <Link
                  href={t.linked_type === 'lead' ? '/comercial' : '/clientes'}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-bento-bg border border-bento-border text-bento-dim hover:border-lime transition-colors max-w-[200px]"
                >
                  <span className={cn('w-1 h-1 rounded-full flex-none', t.linked_type === 'lead' ? 'bg-blue-400' : 'bg-lime')} />
                  <span className="truncate">{t.linked_name}</span>
                </Link>
                {phone && (
                  <a href={`tel:${phone}`} aria-label={`Ligar para ${t.linked_name}`}
                    className="inline-flex items-center justify-center w-5 h-5 rounded text-bento-muted hover:text-lime-fg transition-colors">
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                  </a>
                )}
              </div>
            )}

            {/* Briefing expandido */}
            {isExpanded && t.notes && (
              <p className="mt-2 text-xs text-bento-dim whitespace-pre-wrap bg-bento-bg border border-bento-border rounded-btn p-2.5">
                {t.notes}
              </p>
            )}
          </div>

          {/* Lado direito: data + ações */}
          <div className="flex items-center gap-1.5 flex-none">
            {t.notes && (
              <button
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
                aria-label="Ver briefing"
                className={cn('w-6 h-6 rounded-md flex items-center justify-center transition-colors',
                  isExpanded ? 'text-lime-fg' : 'text-bento-muted hover:text-bento-text')}
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h10" />
                </svg>
              </button>
            )}

            {t.due_date && !t.done && (
              <span className="font-tech text-[10px] text-bento-muted tabular-nums">
                {fmtDate(t.due_date)}{t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ''}
              </span>
            )}

            {isConfirming ? (
              <span className="flex items-center gap-1">
                <button onClick={() => handleDelete(t)} className="text-[10px] font-semibold text-red-400 px-1.5 py-0.5 rounded bg-red-900/30 hover:bg-red-900/50 transition-colors">Excluir</button>
                <button onClick={() => setConfirmId(null)} className="text-[10px] text-bento-muted px-1 hover:text-bento-text">não</button>
              </span>
            ) : (
              <span className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={() => openEdit(t)} aria-label="Editar"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-bento-muted hover:text-bento-text transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                  </svg>
                </button>
                <button onClick={() => setConfirmId(t.id)} aria-label="Excluir"
                  className="w-6 h-6 rounded-md flex items-center justify-center text-bento-muted hover:text-red-400 transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              </span>
            )}
          </div>
        </div>
      </div>
    )
  }

  // Cartão de tarefa no MOBILE: filete LIMA no TOPO p/ tarefas de HOJE (detalhe no topo, NÃO na lateral),
  // data vermelha p/ atrasadas. Bolinha conclui; tocar no corpo abre p/ editar.
  const renderMobileRow = (t: Task) => {
    const isToday = !t.done && t.due_date === today
    const isOverdue = !t.done && !!t.due_date && t.due_date < today
    const phone = t.linked_id ? phoneById.get(t.linked_id) : undefined
    return (
      <div key={t.id} className={cn('relative bento-fx p-3 overflow-hidden', isToday && 'bg-lime/[0.06]')}>
        {isToday && <span className="absolute top-0 inset-x-0 h-0.5 bg-lime" aria-hidden />}
        <div className="flex items-start gap-3">
          <button onClick={() => toggleDone(t)} aria-label={t.done ? 'Reabrir' : 'Concluir'}
            className={cn('mt-0.5 w-[22px] h-[22px] rounded-md border flex items-center justify-center flex-none transition-colors',
              t.done ? 'bg-lime border-lime' : 'border-bento-border')}>
            {t.done && <svg className="w-3.5 h-3.5 text-lime-ink" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>}
          </button>
          <div role="button" tabIndex={0} onClick={() => openEdit(t)}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openEdit(t) } }}
            className="min-w-0 flex-1 text-left cursor-pointer">
            <span className={cn('text-sm leading-snug', t.done ? 'line-through text-bento-muted' : 'text-bento-text')}>{t.title}</span>
            <div className="flex items-center gap-2 flex-wrap mt-1.5">
              {t.linked_id && t.linked_name && (
                <Link href={t.linked_type === 'lead' ? '/comercial' : '/clientes'} onClick={e => e.stopPropagation()}
                  className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded bg-bento-bg border border-bento-border text-bento-dim max-w-[180px]">
                  <span className={cn('w-1 h-1 rounded-full flex-none', t.linked_type === 'lead' ? 'bg-blue-400' : 'bg-lime')} />
                  <span className="truncate">{t.linked_name}</span>
                </Link>
              )}
              {phone && (
                <a href={`tel:${phone}`} onClick={e => e.stopPropagation()} aria-label={`Ligar para ${t.linked_name ?? ''}`}
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-bento-muted hover:text-lime-fg transition-colors">
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                </a>
              )}
              {t.due_date && (
                <span className={cn('font-tech text-[10px] tabular-nums ml-auto',
                  isToday ? 'text-lime-fg font-semibold' : isOverdue ? 'text-red-400 font-semibold' : 'text-bento-muted')}>
                  {isToday ? 'Hoje' : fmtDate(t.due_date)}{t.due_time ? ` · ${t.due_time.slice(0, 5)}` : ''}
                </span>
              )}
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalTasks = visibleTasks.length

  return (
    <div className="h-full overflow-auto bg-bento-bg font-body">
      {/* Header */}
      <div className="flex items-center justify-between gap-2 flex-wrap px-4 sm:px-6 pt-5 pb-3 sticky top-0 bg-bento-bg/95 backdrop-blur z-10 border-b border-bento-border">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-tech text-xs text-bento-muted tabular-nums">{pendingCount} pendentes</span>
          {view === 'tarefas' && sellers.length > 0 && (
            <label className="hidden xl:flex items-center gap-1.5 font-tech text-[10px] uppercase tracking-wide text-bento-muted">
              Responsável
              <select value={respFilter} onChange={e => setRespFilter(e.target.value)}
                className="bg-bento-bg border border-bento-border rounded-btn px-2 py-1.5 text-xs text-bento-text normal-case focus:outline-none focus:border-lime">
                <option value="todos">Todos</option>
                {sellers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </label>
          )}
        </div>
        {view === 'tarefas' && (
          <div className="hidden xl:flex items-center gap-2 w-full sm:w-auto">
            <button onClick={handleSummary} disabled={summaryLoading}
              className="flex items-center justify-center gap-2 px-3 py-2 min-h-[44px] rounded-btn text-sm font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors disabled:opacity-50 flex-1 sm:flex-none">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {summaryLoading ? 'Resumindo...' : 'Resumo do dia'}
            </button>
            <button onClick={openNew}
              className="bento-btn flex items-center justify-center gap-2 px-4 py-2 min-h-[44px] rounded-btn text-sm font-semibold flex-1 sm:flex-none">
              <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Nova tarefa
            </button>
          </div>
        )}
      </div>

      {/* ── MOBILE (<1024): Tarefas em caixas por tempo. Desktop usa o bloco abaixo (inalterado). ── */}
      {view === 'tarefas' && (
        <div className="xl:hidden px-4 py-4 space-y-3 pb-4">
          {actionError && (
            <div className="flex items-start gap-2 rounded-bento border border-red-800/40 bg-red-900/20 px-3 py-2.5 text-sm text-red-400">
              <span className="flex-1">{actionError}</span>
              <button onClick={() => setActionError('')} aria-label="Fechar" className="text-red-400/70 hover:text-red-400 shrink-0">✕</button>
            </div>
          )}

          {/* Responsável (minibox) + Resumo do dia */}
          <div className="flex items-center gap-2">
            {sellers.length > 0 && (
              <button type="button" onClick={cycleResp}
                className="flex items-center gap-2 rounded-btn border border-bento-border bg-bento-panel px-3 min-h-[44px] text-sm text-bento-text">
                <svg className="w-4 h-4 text-bento-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                <span className="font-medium">{respLabel}</span>
                <svg className="w-3.5 h-3.5 text-bento-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
              </button>
            )}
            <button type="button" onClick={handleSummary} disabled={summaryLoading}
              className="flex-1 flex items-center justify-center gap-2 rounded-btn border border-bento-border bg-bento-panel px-3 min-h-[44px] text-sm text-bento-dim disabled:opacity-50">
              <svg className="w-4 h-4 text-lime-fg shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              {summaryLoading ? 'Resumindo...' : 'Resumo do dia'}
            </button>
          </div>

          {summaryOpen && (
            <div className="bento-fx p-4 relative">
              <button onClick={() => setSummaryOpen(false)} aria-label="Fechar resumo" className="absolute top-3 right-3 text-bento-muted hover:text-bento-text">✕</button>
              <div className="flex items-center gap-2 mb-2">
                <svg className="w-3.5 h-3.5 text-lime-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                <span className="text-xs font-semibold uppercase tracking-wide text-lime-fg">Resumo do dia</span>
              </div>
              {summaryLoading
                ? <p className="text-sm text-bento-muted animate-pulse">Gerando resumo…</p>
                : <p className="text-sm text-bento-dim whitespace-pre-wrap leading-relaxed">{summary}</p>}
            </div>
          )}

          {/* Chips com contagem (Hoje = bolinha lima · Atrasadas = bolinha vermelha) */}
          <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden -mx-4 px-4">
            {([
              { id: 'hoje', label: 'Hoje', count: groups.hoje.length, dot: 'bg-lime' },
              { id: 'proximas', label: 'Próximas', count: proximas.length },
              { id: 'atrasadas', label: 'Atrasadas', count: groups.atrasadas.length, dot: 'bg-red-500' },
              { id: 'concluidas', label: 'Concluídas', count: doneWeek.length },
            ] as { id: MobileChip; label: string; count: number; dot?: string }[]).map(c => (
              <button key={c.id} type="button" onClick={() => setMobileChip(c.id)}
                className={cn('flex items-center gap-1.5 shrink-0 rounded-full border px-3 min-h-[38px] text-xs font-medium transition-colors',
                  mobileChip === c.id ? 'bg-lime/15 border-lime/50 text-lime-fg' : 'border-bento-border bg-bento-panel text-bento-dim')}>
                {c.dot && <span className={cn('w-1.5 h-1.5 rounded-full flex-none', c.dot)} />}
                {c.label}
                <span className="font-tech text-[10px] text-bento-muted tabular-nums">{c.count}</span>
              </button>
            ))}
          </div>

          {/* Conteúdo: lista direta da aba escolhida (Hoje · Próximas · Atrasadas · Concluídas). */}
          {totalTasks === 0 ? (
            <EmptyAll onNew={openNew} />
          ) : (() => {
            const items = mobileChip === 'hoje' ? groups.hoje : mobileChip === 'proximas' ? proximas : mobileChip === 'atrasadas' ? groups.atrasadas : doneWeek
            if (items.length === 0) return mobileChip === 'hoje' ? <EmptyToday /> : <p className="text-center text-xs text-bento-muted/60 py-8 font-tech">Nada aqui.</p>
            return <div className="space-y-2">{items.map(renderMobileRow)}</div>
          })()}
        </div>
      )}

      {/* Barra fixa do rodapé (mobile): criar por texto (IA) + Nova tarefa. Fica acima da BottomNav. */}
      {view === 'tarefas' && (
        <div className="xl:hidden sticky bottom-0 z-20 border-t border-bento-border bg-bento-panel/95 backdrop-blur px-3 py-2 flex items-center gap-2">
          <input value={aiText} onChange={e => { setAiText(e.target.value); if (aiError) setAiError('') }}
            onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAiCreate() } }} disabled={aiLoading}
            placeholder="Escreva uma tarefa…"
            className="flex-1 min-w-0 bg-bento-bg border border-bento-border rounded-btn px-3 min-h-[44px] text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime disabled:opacity-50" />
          <button onClick={handleAiCreate} disabled={aiLoading || !aiText.trim()}
            className="bento-btn px-3 min-h-[44px] rounded-btn text-sm font-semibold shrink-0 disabled:opacity-50">{aiLoading ? '…' : 'Criar'}</button>
          <button onClick={openNew} aria-label="Nova tarefa"
            className="bento-btn min-w-[44px] min-h-[44px] rounded-btn flex items-center justify-center shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          </button>
        </div>
      )}

      <div className={cn('max-w-3xl mx-auto px-4 sm:px-6 py-5 space-y-6 hidden', view === 'tarefas' && 'xl:block')}>
        {/* Erro de ação (concluir/excluir) */}
        {actionError && (
          <div className="flex items-start gap-2 rounded-bento border border-red-800/40 bg-red-900/20 px-3 py-2.5 text-sm text-red-400">
            <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
            </svg>
            <span className="flex-1">{actionError}</span>
            <button onClick={() => setActionError('')} aria-label="Fechar" className="text-red-400/70 hover:text-red-400 shrink-0">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}

        {/* Criar por texto (IA) */}
        <div className="bento-fx p-3">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 text-lime-fg shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
            <input
              value={aiText}
              onChange={e => { setAiText(e.target.value); if (aiError) setAiError('') }}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAiCreate() } }}
              disabled={aiLoading}
              placeholder="Escreva uma tarefa: “reunião com Flávio sexta 15h”…"
              className="flex-1 bg-transparent text-sm text-bento-text placeholder:text-bento-muted focus:outline-none disabled:opacity-50"
            />
            <button
              onClick={handleAiCreate}
              disabled={aiLoading || !aiText.trim()}
              className="bento-btn px-3 py-1.5 rounded-btn text-xs font-semibold shrink-0 disabled:opacity-50 min-h-0"
            >
              {aiLoading ? 'Interpretando…' : 'Criar'}
            </button>
          </div>
          {aiError && <p className="text-xs text-red-400 mt-2 pl-6">{aiError}</p>}
        </div>

        {/* Resumo do dia (IA) */}
        {summaryOpen && (
          <div className="bento-fx p-4 relative">
            <button onClick={() => setSummaryOpen(false)} aria-label="Fechar resumo"
              className="absolute top-3 right-3 text-bento-muted hover:text-bento-text">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            <div className="flex items-center gap-2 mb-2">
              <svg className="w-3.5 h-3.5 text-lime-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span className="text-xs font-semibold uppercase tracking-wide text-lime-fg">Resumo do dia</span>
            </div>
            {summaryLoading
              ? <p className="text-sm text-bento-muted animate-pulse">Gerando resumo…</p>
              : <p className="text-sm text-bento-dim whitespace-pre-wrap leading-relaxed">{summary}</p>}
          </div>
        )}

        {totalTasks === 0 ? (
          <EmptyAll onNew={openNew} />
        ) : (
          <>
            {SECTIONS.map(sec => {
              const items = groups[sec.id]
              if (items.length === 0 && sec.id !== 'hoje') return null
              return (
                <section key={sec.id}>
                  <div className="flex items-center gap-2 mb-2 px-1">
                    <h2 className={cn('text-xs font-semibold uppercase tracking-wide',
                      sec.danger ? 'text-red-400' : 'text-bento-dim')}>
                      {sec.label}
                    </h2>
                    {items.length > 0 && (
                      <span className="font-tech text-[10px] text-bento-muted tabular-nums">{items.length}</span>
                    )}
                  </div>
                  {items.length === 0 ? (
                    <EmptyToday />
                  ) : (
                    <div className="space-y-2">{items.map(renderRow)}</div>
                  )}
                </section>
              )
            })}

            {/* Concluídas (recolhível) */}
            {done.length > 0 && (
              <section>
                <button onClick={() => setShowDone(v => !v)}
                  className="flex items-center gap-2 mb-2 px-1 text-bento-dim hover:text-bento-text transition-colors">
                  <svg className={cn('w-3.5 h-3.5 transition-transform', showDone && 'rotate-90')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <span className="text-xs font-semibold uppercase tracking-wide">Concluídas</span>
                  <span className="font-tech text-[10px] text-bento-muted tabular-nums">{done.length}</span>
                </button>
                {showDone && (
                  <div className="space-y-2">{done.slice(0, 30).map(renderRow)}</div>
                )}
              </section>
            )}
          </>
        )}
      </div>

      {modalOpen && (
        <TaskModal
          key={modalKey}
          onClose={() => setModalOpen(false)}
          onSaved={handleSaved}
          currentUser={currentUser}
          linkOptions={linkOptions}
          task={editing}
          prefill={modalPrefill}
          aiFilled={modalAiFilled}
        />
      )}
    </div>
  )
}

// ── Estados vazios ──
function EmptyToday() {
  return (
    <div className="bento-fx p-6 flex flex-col items-center justify-center text-center">
      <svg className="w-8 h-8 text-bento-muted mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-sm text-bento-dim">Nenhuma tarefa pra hoje</p>
      <p className="text-xs text-bento-muted mt-0.5">Aproveite — ou puxe algo de outro dia.</p>
    </div>
  )
}

function EmptyAll({ onNew }: { onNew: () => void }) {
  return (
    <div className="bento-fx p-10 flex flex-col items-center justify-center text-center mt-6">
      <div className="w-14 h-14 rounded-2xl bg-lime/10 border border-lime/30 flex items-center justify-center mb-4">
        <svg className="w-7 h-7 text-lime-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
        </svg>
      </div>
      <p className="text-base font-semibold text-bento-text">Nenhuma tarefa ainda</p>
      <p className="text-sm text-bento-muted mt-1 max-w-xs">Crie sua primeira tarefa — solta ou conectada a um lead/cliente.</p>
      <button onClick={onNew} className="bento-btn mt-5 px-5 py-2.5 rounded-btn text-sm font-semibold">
        Nova tarefa
      </button>
    </div>
  )
}
