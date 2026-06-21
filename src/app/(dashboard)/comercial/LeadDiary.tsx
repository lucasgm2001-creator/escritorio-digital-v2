'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { getScoreInfo } from '@/lib/utils/score'
import { markMilestones } from '@/lib/leadMilestones'
import { cn, timeAgo } from '@/lib/utils'
import { ALL_COLUMNS, FUSO_OPTIONS, type Lead, type LeadStatus, type ColumnTone } from './types'
import { type FunnelStage } from '@/lib/funnelStages'
import { usdCompact } from '@/lib/format'
import { LeadTasks } from './LeadTasks'
import { Sparkles } from 'lucide-react'

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

  const supabase = createClient()
  const { toast } = useToast()
  const scoreInfo = getScoreInfo(currentLead.score)
  const currentPhase = ALL_COLUMNS.find(c => c.key === currentLead.status)

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
    setMovingPhase(true)
    setCurrentLead(c => ({ ...c, status: newStatus }))
    const ok = await onMoveStage(newStatus)
    if (!ok) setCurrentLead(c => ({ ...c, status: prev }))
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

  // Edita a "data de chegada" (received_at) — dado de lead/relatório, não dinheiro. Otimista + rollback.
  const changeReceivedAt = async (value: string) => {
    if (!value || value === (currentLead.received_at ?? '').slice(0, 10)) return
    const prev = currentLead.received_at
    const updated = { ...currentLead, received_at: value }
    setCurrentLead(updated)
    const { error } = await supabase.from('leads').update({ received_at: value }).eq('id', lead.id)
    if (error) {
      setCurrentLead(c => ({ ...c, received_at: prev }))
      toast({ type: 'error', message: `Não foi possível mudar a data de chegada: ${error.message}` })
    } else {
      onUpdated(updated)
      toast({ type: 'success', message: 'Data de chegada atualizada.' })
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
        toast({ type: 'error', message: 'Não foi possível gerar o briefing. Tente de novo.' })
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
      if (!res.ok) throw new Error('falha')
      const data = await res.json()
      setAiSuggestion(data.suggestion ?? '')
    } catch {
      toast({ type: 'error', message: 'A IA demorou para responder. Tente a análise novamente.' })
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Painel lateral */}
      <div className="w-full max-w-md bg-bento-panel border-l border-bento-border flex flex-col shadow-card-hover overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-border">
          <div>
            <h2 className="font-bold text-foreground text-base">{currentLead.name}</h2>
            {currentLead.company && <p className="text-sm text-muted-foreground">{currentLead.company}</p>}
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground mt-0.5">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

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

        {/* Data de chegada — editável (separa de quando foi cadastrado; usada no relatório por período) */}
        <div className="px-5 py-3 border-b border-border">
          <span className="text-xs text-muted-foreground">Data de chegada</span>
          <input type="date" value={(currentLead.received_at ?? '').slice(0, 10)}
            onChange={e => changeReceivedAt(e.target.value)}
            className="mt-1 w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text focus:outline-none focus:border-lime min-h-[44px]" />
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
              {briefing.pontos_chave.length > 0 && (
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

        {/* Timeline */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          <p className="text-xs font-medium text-muted-foreground mb-3">Timeline de interações</p>
          {interactions.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">Nenhuma interação ainda.</p>
          ) : (
            <div className="space-y-3">
              {interactions.map(i => (
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
                      <span className="ml-auto text-xs text-muted-foreground">{timeAgo(i.created_at)}</span>
                    </div>
                    {i.note && <p className="text-xs text-muted-foreground mt-0.5 whitespace-pre-wrap break-words">{i.note}</p>}
                    {i.created_by_name && <p className="text-xs text-muted-foreground mt-0.5">— {i.created_by_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Excluir lead — ação destrutiva, confirmação em 2 passos */}
        <div className="px-5 py-3 border-t border-border shrink-0">
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
      </div>
    </div>
  )
}
