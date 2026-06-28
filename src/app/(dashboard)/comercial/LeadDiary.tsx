'use client'

import { useState, useEffect, useRef, useMemo, memo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { getScoreInfo } from '@/lib/utils/score'
import { markMilestones } from '@/lib/leadMilestones'
import { cn } from '@/lib/utils'
import { TimeAgo } from '@/components/system/TimeAgo'
import { ALL_COLUMNS, FUSO_OPTIONS, type Lead, type LeadStatus, type ColumnTone } from './types'
import { type FunnelStage } from '@/lib/funnelStages'
import { usdCompact } from '@/lib/format'
import { waNumber } from '@/lib/phone'
import { LeadTasks } from './LeadTasks'
import { Portal } from '@/components/ui/Portal'
import { copyText } from '@/lib/clipboard'
import { Sparkles, MessageCircle, MessageSquare, Copy, ChevronDown } from 'lucide-react'

// Saudação pré-preenchida do WhatsApp (leads são US → inglês). Editável aqui.
const WA_GREETING = (first: string) => `Hi ${first}! This is Lucas from DR Growth.`

interface Interaction {
  id: string
  lead_id: string
  type: string
  note?: string
  score_delta: number
  created_by_name?: string
  created_at: string
}

interface Props {
  lead: Lead
  onClose: () => void
  onUpdated: (lead: Lead) => void
  /** Move o lead de fase (persiste + rollback + toast no board). Retorna se persistiu. */
  onMoveStage?: (newStatus: LeadStatus) => Promise<boolean>
  /** Remove o lead do funil após exclusão definitiva. */
  onDeleted?: (id: string) => void
  currentUser: { id: string; name: string }
  /** Fases do funil — usadas p/ liberar o campo "valor" só DEPOIS de Reunião (por posicao). */
  stages?: FunnelStage[]
}

// Cor do ponto da fase por tom (neutro / ganho / perda) — alinhado ao funil.
const PHASE_DOT: Record<ColumnTone, string> = {
  neutral: 'bg-bento-muted',
  win:     'bg-lime',
  loss:    'bg-red-400',
}

const INTERACTION_BUTTONS: { type: string; label: string; icon: React.ReactNode; delta: number; color: string }[] = [
  {
    type: 'atendeu', label: 'Atendeu', delta: 80, color: 'bg-green-900/20 text-green-400 border-green-800/50 hover:bg-green-900/30',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  },
  {
    type: 'nao_atendeu', label: 'Não Atendeu', delta: -30, color: 'bg-red-900/20 text-red-400 border-red-800/50 hover:bg-red-900/30',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  },
  {
    type: 'mensagem', label: 'Mensagem', delta: 20, color: 'bg-blue-900/20 text-blue-400 border-blue-800/50 hover:bg-blue-900/30',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  },
  {
    type: 'nota', label: 'Nota', delta: 0, color: 'bg-amber-900/20 text-amber-400 border-amber-800/50 hover:bg-amber-900/30',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  },
]

interface BriefingResult { resumo: string; pontos_chave: string[]; proximo_passo: string; status_sugerido: string; justificativa_status: string }

// Rótulos legíveis dos tipos de interação no histórico (inclui ligação/briefing); fallback = tipo cru.
const INTERACTION_LABEL: Record<string, string> = {
  atendeu: 'Atendeu', nao_atendeu: 'Não atendeu', mensagem: 'Mensagem', nota: 'Nota',
  ligacao: 'Ligação', reuniao: 'Reunião', proposta: 'Proposta', reagendamento: 'Reagendamento',
  briefing: 'Briefing IA', sistema: 'Sistema',
}

// Linha "rótulo: valor" do perfil. Vazio → "—" discreto (deixa claro o que falta, não some).
const InfoRow = memo(function InfoRow({ label, value }: { label: string; value?: string | number | null }) {
  const v = value == null || String(value).trim() === '' ? '' : String(value)
  return (
    <div className="flex items-baseline justify-between gap-3 min-w-0">
      <span className="text-xs text-muted-foreground flex-none">{label}</span>
      <span className={cn('text-sm text-right break-all min-w-0', v ? 'text-bento-text' : 'text-bento-muted/50')}>{v || '—'}</span>
    </div>
  )
})

// Chaves do raw_payload que JÁ aparecem como campo dedicado → não repetir em "Mais informações".
const PAYLOAD_SKIP = new Set([
  'name', 'full_name', 'first_name', 'last_name', 'email', 'phone',
  'company', 'company_name', 'empresa', 'business', 'business_name', 'nome_da_empresa', 'negocio', 'negócio', 'razao_social',
  'nicho', 'service', 'servico', 'serviço', 'tipo', 'tipo_de_negocio', 'business_type', 'niche', 'segmento', 'segment',
  'value', 'valor', 'orcamento', 'orçamento', 'budget', 'investimento', 'faturamento', 'revenue',
  'message', 'mensagem', 'observacao', 'observação', 'obs', 'comentario', 'comentário', 'comments', 'duvida', 'dúvida', 'nota',
  'state', 'estado', 'uf', 'city', 'cidade', 'municipio', 'município',
])

// Plumbing do GHL/Magnetic que NÃO é útil pro vendedor (IDs, objetos internos, metadados).
const NOISE_KEYS = new Set([
  'id', 'contactid', 'locationid', 'userid', 'companyid', 'accountid', 'calendarid',
  'location', 'user', 'workflow', 'triggerdata', 'trigger', 'contacttype', 'contactsource',
  'attributionsource', 'datecreated', 'dateupdated', 'dateadded', 'version', 'webhook', 'webhookid', 'timestamp',
])
const normKey = (k: string) => k.toLowerCase().replace(/[^a-z0-9]/g, '')
const isNoiseKey = (k: string) => {
  const n = normKey(k)
  return NOISE_KEYS.has(n) || n.endsWith('id') || n.includes('webhook') || n.includes('workflow') || n.includes('trigger')
}
// Valor que parece ID/token (UUID ou cadeia longa sem espaço) → ruído.
const isIdValue = (v: string) => /^[a-f0-9]{8}-[a-f0-9]{4}/i.test(v) || /^[A-Za-z0-9_-]{18,}$/.test(v)

// "Mais informações" = só os campos ÚTEIS do raw_payload. Tira IDs/plumbing e objetos internos
// (location/user/workflow/triggerData…); de customData/customFields, puxa os campos legíveis.
function usefulPayloadEntries(raw: Record<string, unknown>): [string, string][] {
  const out: [string, string][] = []
  const consider = (k: string, v: unknown) => {
    if (isNoiseKey(k) || PAYLOAD_SKIP.has(k.toLowerCase())) return
    let val = ''
    if (v == null) return
    if (Array.isArray(v)) val = v.filter(x => typeof x !== 'object').join(', ')   // tags etc.
    else if (typeof v === 'object') return                                        // objeto interno → fora
    else val = String(v)
    val = val.trim()
    if (!val || val === '[object Object]' || isIdValue(val)) return
    out.push([k, val])
  }
  for (const [k, v] of Object.entries(raw)) {
    const nk = normKey(k)
    if ((nk === 'customdata' || nk === 'customfields' || nk === 'customfield') && v && typeof v === 'object' && !Array.isArray(v)) {
      for (const [k2, v2] of Object.entries(v as Record<string, unknown>)) consider(k2, v2)
    } else {
      consider(k, v)
    }
  }
  return out
}

export function LeadDiary({ lead, onClose, onUpdated, onMoveStage, onDeleted, currentUser, stages }: Props) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [currentLead, setCurrentLead] = useState<Lead>(lead)
  const [noteText, setNoteText] = useState('')
  const [activeBtn, setActiveBtn] = useState<string | null>(null)
  const [loadingInteraction, setLoadingInteraction] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)
  const [phaseOpen, setPhaseOpen] = useState(false)
  const [movingPhase, setMovingPhase] = useState(false)
  const [sellers, setSellers] = useState<{ id: string; name: string }[]>([])
  const [respOpen, setRespOpen] = useState(false)
  const [savingResp, setSavingResp] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [briefing, setBriefing] = useState<BriefingResult | null>(null)
  const [briefingLoading, setBriefingLoading] = useState(false)
  const [valueDraft, setValueDraft] = useState(String(lead.value || ''))
  const [confirmingRestore, setConfirmingRestore] = useState(false)   // lixeira → restaurar p/ Novo Lead

  const supabase = createClient()
  const { toast } = useToast()
  const scoreInfo = getScoreInfo(currentLead.score)
  const currentPhase = ALL_COLUMNS.find(c => c.key === currentLead.status)

  // Trava o scroll do fundo (body) enquanto o perfil está aberto; restaura ao fechar (preserva posição).
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  // Layout do perfil: UM scroll só + swipe-pra-baixo no cabeçalho fecha. Timeline incremental.
  const dragStartY = useRef<number | null>(null)
  const onHeaderTouchStart = (e: React.TouchEvent) => { dragStartY.current = e.touches[0].clientY }
  const onHeaderTouchEnd = (e: React.TouchEvent) => {
    const s = dragStartY.current; dragStartY.current = null
    if (s != null && e.changedTouches[0].clientY - s > 60) onClose()
  }
  const [visibleInteractions, setVisibleInteractions] = useState(15)
  const [moreOpen, setMoreOpen] = useState(false)   // "Mais informações" FECHADA por padrão
  const shownInteractions = useMemo(() => interactions.slice(0, visibleInteractions), [interactions, visibleInteractions])
  // Extras do raw_payload (sem coluna própria) — calculado fora do corpo do render (só muda com o payload).
  const payloadExtras = useMemo(
    () => (currentLead.raw_payload ? usefulPayloadEntries(currentLead.raw_payload) : []),
    [currentLead.raw_payload],
  )

  // Valor (leads.value) editável só DEPOIS de "Reunião Agendada" — comparando POSICAO da fase atual
  // com a da fase slug 'reuniao' (NÃO hardcode o 4; sobrevive a reordenações). Fallback: ordem de ALL_COLUMNS.
  const posOf = (slug: string) => {
    const st = stages?.find(s => s.slug === slug)
    if (st) return st.posicao
    const idx = ALL_COLUMNS.findIndex(c => c.key === slug)
    return idx >= 0 ? idx : -1
  }
  const reuniaoPos = posOf('reuniao')
  const valueEditable = reuniaoPos >= 0 && posOf(currentLead.status) > reuniaoPos

  // Move o lead de fase pelo seletor: otimista no painel; delega persistência ao
  // board (onMoveStage = mesmo fluxo do arrastar, inclui "ganhou"); rollback se falhar.
  const changePhase = async (newStatus: LeadStatus) => {
    setPhaseOpen(false)
    if (!onMoveStage || newStatus === currentLead.status) return
    const prev = currentLead.status
    const destLabel = ALL_COLUMNS.find(c => c.key === newStatus)?.label ?? newStatus
    setMovingPhase(true)
    setCurrentLead(c => ({ ...c, status: newStatus }))
    // onMoveStage = MESMO fluxo do arrastar. Ao escolher "Venda Fechada" ele retorna false aqui e
    // abre o WonPlanModal (idêntico a soltar na coluna) — por isso o "Movido para" só dispara quando ok.
    const ok = await onMoveStage(newStatus)
    if (!ok) setCurrentLead(c => ({ ...c, status: prev }))
    else toast({ type: 'success', message: `Movido para ${destLabel}` })
    setMovingPhase(false)
  }

  // Troca o responsável de um lead já criado. MESMA lógica corrigida da criação
  // (bug do Lucas): só o usuário logado tem linha em profiles → grava o id real;
  // vendedor sem conta → assigned_to null + nome em assigned_name (evita a FK).
  const changeResponsavel = async (id: string, name: string) => {
    setRespOpen(false)
    const assignedTo = id === currentUser.id ? currentUser.id : null
    if (name === (currentLead.assigned_name ?? '') && (assignedTo ?? null) === (currentLead.assigned_to ?? null)) return
    const prev = { to: currentLead.assigned_to, name: currentLead.assigned_name }
    const updated = { ...currentLead, assigned_to: assignedTo ?? undefined, assigned_name: name }
    setSavingResp(true)
    setCurrentLead(updated)
    const { error } = await supabase.from('leads').update({ assigned_to: assignedTo, assigned_name: name }).eq('id', lead.id)
    if (error) {
      setCurrentLead(c => ({ ...c, assigned_to: prev.to, assigned_name: prev.name }))
      toast({ type: 'error', message: `Não foi possível trocar o responsável: ${error.message}` })
    } else {
      onUpdated(updated)
      toast({ type: 'success', message: `Responsável: ${name}.` })
    }
    setSavingResp(false)
  }

  // Copia o telefone ORIGINAL formatado (não o normalizado) p/ a área de transferência.
  const copyPhone = async () => {
    const p = currentLead.phone
    if (!p) return
    if (await copyText(p)) toast({ type: 'success', message: 'Telefone copiado.' })
    else toast({ type: 'error', message: 'Não foi possível copiar.' })
  }

  // Edita a "data de chegada" (received_at) — dado de lead/relatório, não dinheiro. Otimista + rollback.
  const changeReceivedAt = async (value: string) => {
    const next = value || null   // vazio → LIMPA (null), em vez de ignorar
    if ((next ?? '') === (currentLead.received_at ?? '').slice(0, 10)) return
    const prev = currentLead.received_at
    const updated = { ...currentLead, received_at: next ?? undefined }
    setCurrentLead(updated)
    const { error } = await supabase.from('leads').update({ received_at: next }).eq('id', lead.id)
    if (error) {
      setCurrentLead(c => ({ ...c, received_at: prev }))
      toast({ type: 'error', message: `Não foi possível mudar a data de chegada: ${error.message}` })
    } else {
      onUpdated(updated)
      toast({ type: 'success', message: next ? 'Data de chegada atualizada.' : 'Data de chegada removida.' })
    }
  }

  // Liga/desliga o lead nas contas do Relatório — Resumo (incluir_no_relatorio). NÃO apaga o lead
  // nem afeta comissão (relatório usa received_at; comissão usa o mês do cliente). Otimista + rollback.
  const toggleIncluir = async () => {
    const next = currentLead.incluir_no_relatorio === false   // estava off → liga; senão desliga
    const updated = { ...currentLead, incluir_no_relatorio: next }
    setCurrentLead(updated)
    const { error } = await supabase.from('leads').update({ incluir_no_relatorio: next }).eq('id', lead.id)
    if (error) {
      setCurrentLead(c => ({ ...c, incluir_no_relatorio: !next }))
      toast({ type: 'error', message: `Não foi possível mudar: ${error.message}` })
    } else {
      onUpdated(updated)
      toast({ type: 'success', message: next ? 'Incluído no relatório.' : 'Fora do relatório.' })
    }
  }

  // Edita o fuso horário (EUA) — dado de contato, não dinheiro. Otimista + rollback.
  const changeFuso = async (value: string) => {
    const next = (value || null) as Lead['fuso']
    if (next === (currentLead.fuso ?? null)) return
    const prev = currentLead.fuso
    const updated = { ...currentLead, fuso: next }
    setCurrentLead(updated)
    const { error } = await supabase.from('leads').update({ fuso: next }).eq('id', lead.id)
    if (error) {
      setCurrentLead(c => ({ ...c, fuso: prev }))
      toast({ type: 'error', message: `Não foi possível mudar o fuso: ${error.message}` })
    } else {
      onUpdated(updated)
      toast({ type: 'success', message: 'Fuso atualizado.' })
    }
  }

  // Salva o valor do plano (leads.value). NÃO muda como é salvo/usado em cálculo — só um update do
  // número. Otimista + rollback. Só é chamado quando o campo está liberado (valueEditable).
  const changeValue = async () => {
    const num = parseFloat(valueDraft)
    const next = Number.isFinite(num) && num > 0 ? num : 0
    if (next === (currentLead.value || 0)) return
    const prev = currentLead.value
    const updated = { ...currentLead, value: next }
    setCurrentLead(updated)
    const { error } = await supabase.from('leads').update({ value: next }).eq('id', lead.id)
    if (error) {
      setCurrentLead(c => ({ ...c, value: prev }))
      toast({ type: 'error', message: `Não foi possível salvar o valor: ${error.message}` })
    } else {
      onUpdated(updated)
      toast({ type: 'success', message: 'Valor atualizado.' })
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('leads').delete().eq('id', lead.id)
    if (error) {
      toast({ type: 'error', message: `Não foi possível excluir o lead: ${error.message}` })
      setDeleting(false)
      return
    }
    toast({ type: 'success', message: 'Lead excluído.' })
    onDeleted?.(lead.id)
    onClose()
  }

  useEffect(() => {
    supabase
      .from('lead_interactions')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setInteractions(data ?? []))
    supabase.from('sellers').select('id, name').eq('status', 'ativo').order('name')
      .then(({ data }) => setSellers(data ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  const handleInteraction = async (type: string, delta: number) => {
    if (type === 'nota' && !noteText.trim()) { setActiveBtn('nota'); return }
    setLoadingInteraction(true)

    const newScore = Math.max(0, Math.min(1000, currentLead.score + delta))
    const updatedLead = { ...currentLead, score: newScore, last_contact_at: new Date().toISOString() }

    const { data: interaction, error: interErr } = await supabase
      .from('lead_interactions')
      .insert({
        lead_id: lead.id,
        type,
        note: noteText || null,
        score_delta: delta,
        created_by: currentUser.id,
        created_by_name: currentUser.name,
      })
      .select()
      .single()

    if (interErr) {
      toast({ type: 'error', message: `Não foi possível registrar a interação: ${interErr.message}` })
      setLoadingInteraction(false)
      return
    }

    // Marco do relatório: contato real = interagiu (nao_atendeu/nota não contam). Idempotente.
    if (type === 'atendeu' || type === 'mensagem') await markMilestones(supabase, lead.id, ['interagiu'])

    const { error: scoreErr } = await supabase
      .from('leads')
      .update({ score: newScore, last_contact_at: updatedLead.last_contact_at })
      .eq('id', lead.id)

    if (scoreErr) {
      toast({ type: 'error', message: `Interação salva, mas falhou ao atualizar o score: ${scoreErr.message}` })
      setLoadingInteraction(false)
      return
    }

    // Persistiu tudo → aplica no estado local.
    if (interaction) setInteractions(prev => [interaction, ...prev])
    setCurrentLead(updatedLead)
    onUpdated(updatedLead)
    setNoteText('')
    setActiveBtn(null)
    setLoadingInteraction(false)
  }

  const handleBriefing = async () => {
    setBriefingLoading(true)
    try {
      const res = await fetch('/api/leads/briefing', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ leadId: lead.id }),
      })
      const data = await res.json().catch(() => null)
      if (data?.ok && data.briefing) {
        setBriefing(data.briefing as BriefingResult)
        // Recarrega o histórico pra o briefing recém-salvo aparecer na timeline.
        const { data: ints } = await supabase.from('lead_interactions').select('*').eq('lead_id', lead.id).order('created_at', { ascending: false })
        setInteractions(ints ?? [])
      } else if (data?.reason === 'sem_dados') {
        toast({ type: 'error', message: 'Sem ligações ou notas suficientes para gerar briefing.' })
      } else {
        toast({ type: 'error', message: data?.message || 'Não foi possível gerar o briefing. Tente de novo.' })
      }
    } catch {
      toast({ type: 'error', message: 'Não foi possível gerar o briefing. Tente de novo.' })
    } finally {
      setBriefingLoading(false)
    }
  }

  const handleAiAnalysis = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/lead-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: currentLead, interactions: interactions.slice(0, 10) }),
      })
      const data = await res.json().catch(() => null)
      if (!res.ok || !data) {
        toast({ type: 'error', message: data?.error || 'A IA demorou para responder. Tente a análise novamente.' })
        return
      }
      setAiSuggestion(data.suggestion ?? '')
    } catch {
      toast({ type: 'error', message: 'A IA demorou para responder. Tente a análise novamente.' })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-[300] flex h-[100dvh]">
      {/* Overlay */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Painel lateral */}
      <div className="w-full max-w-md h-[100dvh] bg-bento-panel border-l border-bento-border flex flex-col shadow-card-hover overflow-hidden">
        {/* Header — FIXO no topo (fora do scroll); swipe-pra-baixo fecha no celular. */}
        <div onTouchStart={onHeaderTouchStart} onTouchEnd={onHeaderTouchEnd}
          className="shrink-0 flex items-start justify-between px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-base">{currentLead.name}</h2>
            {currentLead.company && <p className="text-sm text-muted-foreground">{currentLead.company}</p>}
          </div>
          <button onClick={onClose} aria-label="Fechar" className="text-muted-foreground hover:text-foreground mt-0.5 p-1 -m-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* UM scroll só: todo o perfil rola como UMA coluna (sem caixas internas prendendo no toque). */}
        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden pb-safe">

        {/* Informações do lead (cadastro/formulário) — somente leitura; campo vazio = "—". */}
        <div className="px-5 py-3 border-b border-border space-y-1.5">
          <InfoRow label="Empresa" value={currentLead.company} />
          <InfoRow label="E-mail" value={currentLead.email} />
          <InfoRow label="Telefone" value={currentLead.phone} />
          <InfoRow label="Nicho" value={currentLead.nicho} />
          <InfoRow label="Cidade" value={currentLead.city} />
          <InfoRow label="Estado" value={currentLead.state} />
          <InfoRow label="DDD" value={currentLead.area_code} />
          <InfoRow label="Origem" value={currentLead.origem} />
          <InfoRow label="Mensagem" value={currentLead.notes} />
        </div>

        {/* Contato rápido — WhatsApp / SMS / Copiar (só com telefone utilizável). */}
        {(() => {
          const num = waNumber(currentLead.phone)
          if (!num) return null
          const first = (currentLead.name || '').trim().split(/\s+/)[0] || ''
          const greeting = first ? WA_GREETING(first) : ''
          const waUrl = `https://wa.me/${num}${greeting ? `?text=${encodeURIComponent(greeting)}` : ''}`
          return (
            <div className="px-5 py-3 border-b border-border">
              <span className="text-xs text-muted-foreground">Contato rápido</span>
              <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                <a href={waUrl} target="_blank" rel="noopener noreferrer"
                  className="bento-btn flex items-center gap-1.5 px-3 py-2 rounded-btn text-sm font-semibold min-h-[44px]">
                  <MessageCircle className="w-4 h-4" />WhatsApp
                </a>
                <a href={`sms:+${num}`}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-btn text-sm font-medium border border-bento-border text-bento-dim hover:border-lime hover:text-bento-text transition-colors min-h-[44px]">
                  <MessageSquare className="w-4 h-4" />SMS
                </a>
                <button type="button" onClick={copyPhone} aria-label="Copiar telefone" title="Copiar telefone"
                  className="flex items-center gap-1.5 px-2.5 py-2 rounded-btn text-sm font-medium text-bento-muted hover:text-bento-text transition-colors min-h-[44px]">
                  <Copy className="w-4 h-4" />Copiar
                </button>
              </div>
              <p className="font-mono text-[11px] text-bento-muted mt-1.5 break-all">{currentLead.phone}</p>
            </div>
          )
        })()}

        {/* Mais informações — campos ÚTEIS do raw_payload (sem IDs/plumbing). Sanfona FECHADA por padrão. */}
        {payloadExtras.length > 0 && (
          <div className="px-5 py-3 border-b border-border">
            <button type="button" onClick={() => setMoreOpen(o => !o)} aria-expanded={moreOpen}
              className="w-full flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Mais informações</span>
              <ChevronDown className={cn('w-4 h-4 text-bento-muted transition-transform flex-none', moreOpen && 'rotate-180')} />
            </button>
            {moreOpen && (
              <div className="mt-2 space-y-1.5">
                {payloadExtras.map(([k, v]) => <InfoRow key={k} label={k} value={v} />)}
              </div>
            )}
          </div>
        )}

        {/* Fase — seletor (alternativa ao arrastar; vale mobile e desktop) */}
        <div className="px-5 py-3 border-b border-border relative">
          <span className="text-xs text-muted-foreground">Fase</span>
          <button
            type="button"
            onClick={() => setPhaseOpen(o => !o)}
            disabled={movingPhase || !onMoveStage}
            className="mt-1 w-full flex items-center justify-between gap-2 bg-bento-bg border border-bento-border rounded-btn px-3 py-2 hover:border-lime transition-colors disabled:opacity-60 min-h-[44px]"
          >
            <span className="flex items-center gap-2 min-w-0">
              <span className={cn('w-2 h-2 rounded-full flex-none', PHASE_DOT[currentPhase?.tone ?? 'neutral'])} />
              <span className="text-sm font-medium text-bento-text truncate">{currentPhase?.label ?? currentLead.status}</span>
            </span>
            {movingPhase ? (
              <span className="w-4 h-4 border-2 border-bento-muted/30 border-t-bento-muted rounded-full animate-spin flex-none" />
            ) : (
              <svg className={cn('w-4 h-4 text-bento-muted transition-transform flex-none', phaseOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
          {phaseOpen && (
            <div className="absolute left-5 right-5 z-20 mt-1 bg-bento-panel border border-bento-border rounded-btn shadow-card-hover overflow-hidden">
              {/* Topo do aberto: rótulo + X pra recolher de volta pro estado fechado. */}
              <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-bento-border/60">
                <span className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted">Mover para</span>
                <button type="button" onClick={() => setPhaseOpen(false)} aria-label="Fechar seletor de fase"
                  className="-mr-1 p-1 rounded text-bento-muted hover:text-bento-text">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                </button>
              </div>
              {ALL_COLUMNS.map(c => (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => changePhase(c.key)}
                  className={cn('w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bento-bg transition-colors',
                    c.key === currentLead.status && 'bg-bento-bg')}
                >
                  <span className={cn('w-2 h-2 rounded-full flex-none', PHASE_DOT[c.tone])} />
                  <span className="text-sm text-bento-text flex-1 truncate">{c.label}</span>
                  {c.key === currentLead.status && (
                    <svg className="w-3.5 h-3.5 text-lime-fg flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Responsável — trocar em lead já criado (mesma lógica corrigida da criação) */}
        <div className="px-5 py-3 border-b border-border relative">
          <span className="text-xs text-muted-foreground">Responsável</span>
          <button
            type="button"
            onClick={() => setRespOpen(o => !o)}
            disabled={savingResp}
            className="mt-1 w-full flex items-center justify-between gap-2 bg-bento-bg border border-bento-border rounded-btn px-3 py-2 hover:border-lime transition-colors disabled:opacity-60 min-h-[44px]"
          >
            <span className="text-sm font-medium text-bento-text truncate">{currentLead.assigned_name ?? 'Sem responsável'}</span>
            {savingResp ? (
              <span className="w-4 h-4 border-2 border-bento-muted/30 border-t-bento-muted rounded-full animate-spin flex-none" />
            ) : (
              <svg className={cn('w-4 h-4 text-bento-muted transition-transform flex-none', respOpen && 'rotate-180')} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            )}
          </button>
          {respOpen && (
            <div className="absolute left-5 right-5 z-20 mt-1 bg-bento-panel border border-bento-border rounded-btn shadow-card-hover overflow-hidden max-h-60 overflow-y-auto">
              <button type="button" onClick={() => changeResponsavel(currentUser.id, currentUser.name)}
                className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bento-bg transition-colors">
                <span className="text-sm text-bento-text flex-1 truncate">{currentUser.name} (eu)</span>
                {currentLead.assigned_to === currentUser.id && (
                  <svg className="w-3.5 h-3.5 text-lime-fg flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                )}
              </button>
              {sellers.filter(s => s.id !== currentUser.id).map(s => (
                <button key={s.id} type="button" onClick={() => changeResponsavel(s.id, s.name)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bento-bg transition-colors">
                  <span className="text-sm text-bento-text flex-1 truncate">{s.name}</span>
                  {currentLead.assigned_to == null && currentLead.assigned_name === s.name && (
                    <svg className="w-3.5 h-3.5 text-lime-fg flex-none" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Restaurar lead da Lixeira → volta pra "Novo Lead" (slug 'novo') reusando o move (changePhase
            → onMoveStage → moveLead), que já registra a atividade. Só aparece quando está na Lixeira. */}
        {currentLead.status === 'lixeira' && (
          <div className="px-5 py-3 border-b border-border">
            {confirmingRestore ? (
              <div className="flex items-center gap-2">
                <span className="text-sm text-bento-dim flex-1">Restaurar este lead para Novo Lead?</span>
                <button onClick={() => { setConfirmingRestore(false); changePhase('novo') }} disabled={movingPhase}
                  className="bento-btn px-3 py-1.5 rounded-btn text-xs font-semibold disabled:opacity-50">Restaurar</button>
                <button onClick={() => setConfirmingRestore(false)} className="text-xs text-bento-muted px-2 hover:text-bento-text">não</button>
              </div>
            ) : (
              <button onClick={() => setConfirmingRestore(true)}
                className="w-full flex items-center justify-center gap-2 border border-bento-border rounded-btn py-2 min-h-[44px] text-sm font-medium text-bento-dim hover:border-lime hover:text-lime-fg transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                Restaurar lead
              </button>
            )}
          </div>
        )}

        {/* Data de chegada — editável (separa de quando foi cadastrado; usada no relatório por período) */}
        <div className="px-5 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground">Data de chegada</span>
          <input type="date" value={(currentLead.received_at ?? '').slice(0, 10)}
            onChange={e => changeReceivedAt(e.target.value)}
            className="mt-1 w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime min-h-[44px]" />
          {/* Incluir no Relatório — Resumo (default ligado). Desligar tira das contas, NÃO apaga o lead. */}
          <button type="button" onClick={toggleIncluir} className="mt-3 flex items-center justify-between w-full text-sm text-bento-text">
            <span className="flex flex-col items-start">
              Incluir no relatório
              <span className="text-[11px] text-muted-foreground">{currentLead.incluir_no_relatorio === false ? 'Fora das contas do relatório' : 'Conta no Relatório — Resumo'}</span>
            </span>
            <span className={cn('relative w-10 h-6 rounded-full flex-none transition-colors', currentLead.incluir_no_relatorio === false ? 'bg-bento-border' : 'bg-lime')}>
              <span className={cn('absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform', currentLead.incluir_no_relatorio !== false && 'translate-x-4')} />
            </span>
          </button>
        </div>

        {/* Fuso horário (EUA) — editável */}
        <div className="px-5 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground">Fuso horário</span>
          <select value={currentLead.fuso ?? ''} onChange={e => changeFuso(e.target.value)}
            className="mt-1 w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime min-h-[44px]">
            <option value="">Sem fuso</option>
            {FUSO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>

        {/* Valor do plano (leads.value) — editável SÓ depois de "Reunião Agendada" (por posicao).
            Fases bloqueadas: input some; se já houver valor salvo, mostra só leitura (NUNCA apaga). */}
        <div className="px-5 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground">Valor do plano</span>
          {valueEditable ? (
            <input type="number" min="0" step="1" inputMode="decimal"
              value={valueDraft} onChange={e => setValueDraft(e.target.value)} onBlur={changeValue}
              placeholder="0"
              className="mt-1 w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime min-h-[44px]" />
          ) : (currentLead.value || 0) > 0 ? (
            <p className="mt-1 font-tech text-sm text-bento-text tabular-nums">{usdCompact(currentLead.value || 0)} <span className="text-[10px] text-bento-muted">· somente leitura</span></p>
          ) : (
            <p className="mt-1 text-xs text-bento-muted/70">Disponível após Reunião Agendada</p>
          )}
        </div>

        {/* Score */}
        <div className="px-5 py-4 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <span className={`text-sm font-semibold ${scoreInfo.color}`}>{scoreInfo.faixa}</span>
            <span className="text-2xl font-bold text-foreground tabular-nums">{currentLead.score}</span>
          </div>
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full transition-all ${scoreInfo.dot}`}
              style={{ width: `${(currentLead.score / 1000) * 100}%` }}
            />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground mt-1">
            <span>0</span><span>500</span><span>1000</span>
          </div>
        </div>

        {/* Botões de interação */}
        <div className="px-5 py-4 border-b border-border">
          <p className="text-xs font-medium text-muted-foreground mb-2">Registrar contato</p>
          <div className="grid grid-cols-2 gap-2">
            {INTERACTION_BUTTONS.map(btn => (
              <button
                key={btn.type}
                onClick={() => btn.type === 'nota' ? setActiveBtn('nota') : handleInteraction(btn.type, btn.delta)}
                disabled={loadingInteraction}
                className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-colors ${btn.color} disabled:opacity-50`}
              >
                {btn.icon}
                {btn.label}
                {btn.delta !== 0 && (
                  <span className="ml-auto font-mono">{btn.delta > 0 ? '+' : ''}{btn.delta}</span>
                )}
              </button>
            ))}
          </div>

          {/* Campo de nota */}
          {activeBtn === 'nota' && (
            <div className="mt-2 space-y-2">
              <textarea
                value={noteText}
                onChange={e => setNoteText(e.target.value)}
                rows={2}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-lime"
                placeholder="Escreva uma nota..."
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setActiveBtn(null)} className="flex-1 border border-border text-sm py-1.5 rounded-lg hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={() => handleInteraction('nota', 0)} disabled={!noteText.trim()} className="bento-btn flex-1 text-sm py-1.5 rounded-btn disabled:opacity-50">Salvar</button>
              </div>
            </div>
          )}
        </div>

        {/* Tarefas vinculadas a este lead (tasks.linked_type='lead') */}
        <div className="px-5 py-3 border-b border-border">
          <LeadTasks leadId={currentLead.id} leadName={currentLead.name} userId={currentUser.id} compact={false} />
        </div>

        {/* Briefing IA — resumo das conversas + próximo passo + status SUGERIDO (não move o lead). */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-xs font-medium text-muted-foreground">Briefing IA</p>
            <button onClick={handleBriefing} disabled={briefingLoading}
              className="bento-btn flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-xs font-semibold disabled:opacity-50 min-h-0">
              <Sparkles className="w-3.5 h-3.5" />
              {briefingLoading ? 'Gerando...' : 'Gerar briefing'}
            </button>
          </div>
          {briefing && (
            <div className="rounded-btn border border-lime/30 bg-lime/5 p-3 space-y-2">
              {briefing.resumo && <p className="text-xs text-bento-dim leading-relaxed whitespace-pre-wrap break-words">{briefing.resumo}</p>}
              {Array.isArray(briefing.pontos_chave) && briefing.pontos_chave.length > 0 && (
                <ul className="text-xs text-bento-dim list-disc pl-4 space-y-0.5">
                  {briefing.pontos_chave.map((p, i) => <li key={i} className="break-words">{p}</li>)}
                </ul>
              )}
              {briefing.proximo_passo && (
                <p className="text-xs text-bento-text break-words"><span className="font-semibold">Próximo passo:</span> {briefing.proximo_passo}</p>
              )}
              {briefing.status_sugerido && (
                <p className="text-xs text-bento-muted leading-relaxed break-words">
                  <span className="font-tech uppercase tracking-wide text-[10px]">Status sugerido:</span>{' '}
                  <span className="text-bento-text font-semibold">{ALL_COLUMNS.find(c => c.key === briefing.status_sugerido)?.label ?? briefing.status_sugerido}</span>
                  {briefing.justificativa_status ? ` — ${briefing.justificativa_status}` : ''}
                  <span className="text-bento-muted/70"> (sugestão — não muda o status sozinho)</span>
                </p>
              )}
            </div>
          )}
        </div>

        {/* IA */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Análise com IA</p>
            <button onClick={handleAiAnalysis} disabled={aiLoading}
              className="font-tech text-xs text-lime-fg hover:text-lime disabled:opacity-50">
              {aiLoading ? 'Analisando...' : 'Gerar análise'}
            </button>
          </div>
          {aiSuggestion && (
            <p className="text-xs text-bento-dim bg-bento-bg border border-bento-border rounded-btn p-3 leading-relaxed">{aiSuggestion}</p>
          )}
        </div>

        {/* Timeline — SEM scroll próprio (flui no scroll único). Renderiza incremental: 15 + "ver mais". */}
        <div className="px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Timeline de interações</p>
          {interactions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma interação ainda.</p>
          ) : (
            <>
            <div className="space-y-3">
              {shownInteractions.map(i => (
                <div key={i.id} className="flex gap-3">
                  <div className="w-1 shrink-0 bg-border rounded-full" />
                  <div className="flex-1 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{INTERACTION_LABEL[i.type] ?? i.type.replace('_', ' ')}</span>
                      {i.score_delta !== 0 && (
                        <span className={`text-xs font-mono ${i.score_delta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {i.score_delta > 0 ? '+' : ''}{i.score_delta}
                        </span>
                      )}
                      <TimeAgo className="ml-auto text-xs text-muted-foreground" date={i.created_at} />
                    </div>
                    {i.note && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{i.note}</p>}
                    {i.created_by_name && <p className="text-xs text-muted-foreground mt-0.5">— {i.created_by_name}</p>}
                  </div>
                </div>
              ))}
            </div>
            {interactions.length > visibleInteractions && (
              <button onClick={() => setVisibleInteractions(n => n + 15)}
                className="mt-3 w-full text-center font-tech text-xs text-lime-fg hover:text-lime py-2 min-h-[44px]">
                Ver mais ({interactions.length - visibleInteractions})
              </button>
            )}
            </>
          )}
        </div>

        {/* Excluir lead — ação destrutiva, confirmação em 2 passos */}
        <div className="px-5 py-3 border-t border-border">
          {confirmingDelete ? (
            <div className="space-y-2">
              <p className="text-xs text-red-400">Tem certeza? Esta ação não pode ser desfeita.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmingDelete(false)} disabled={deleting}
                  className="flex-1 border border-bento-border text-bento-dim py-2 rounded-btn text-sm hover:border-bento-text transition-colors min-h-[44px]">Cancelar</button>
                <button onClick={handleDelete} disabled={deleting}
                  className="flex-1 bg-red-500/90 hover:bg-red-500 text-white py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">{deleting ? 'Excluindo...' : 'Excluir'}</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmingDelete(true)}
              className="w-full py-2.5 rounded-btn text-sm font-semibold border border-bento-border text-bento-dim hover:border-red-400/50 hover:text-red-400 transition-colors min-h-[44px]">
              Excluir lead
            </button>
          )}
        </div>
        </div>{/* fim do scroll único */}
      </div>
    </div>
    </Portal>
  )
}
