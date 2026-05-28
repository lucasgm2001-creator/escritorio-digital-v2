'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getScoreInfo } from '@/lib/utils/score'
import { timeAgo } from '@/lib/utils'
import type { Lead } from './KanbanBoard'

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
  currentUser: { id: string; name: string }
}

const INTERACTION_BUTTONS: { type: string; label: string; icon: React.ReactNode; delta: number; color: string }[] = [
  {
    type: 'atendeu', label: 'Atendeu', delta: 80, color: 'bg-green-50 text-green-700 border-green-200 hover:bg-green-100',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>,
  },
  {
    type: 'nao_atendeu', label: 'Não Atendeu', delta: -30, color: 'bg-red-50 text-red-700 border-red-200 hover:bg-red-100',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18.364 18.364A9 9 0 005.636 5.636m12.728 12.728A9 9 0 015.636 5.636m12.728 12.728L5.636 5.636" /></svg>,
  },
  {
    type: 'mensagem', label: 'Mensagem', delta: 20, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" /></svg>,
  },
  {
    type: 'nota', label: 'Nota', delta: 0, color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100',
    icon: <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>,
  },
]

export function LeadDiary({ lead, onClose, onUpdated, currentUser }: Props) {
  const [interactions, setInteractions] = useState<Interaction[]>([])
  const [currentLead, setCurrentLead] = useState<Lead>(lead)
  const [noteText, setNoteText] = useState('')
  const [activeBtn, setActiveBtn] = useState<string | null>(null)
  const [loadingInteraction, setLoadingInteraction] = useState(false)
  const [aiSuggestion, setAiSuggestion] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const supabase = createClient()
  const scoreInfo = getScoreInfo(currentLead.score)

  useEffect(() => {
    supabase
      .from('lead_interactions')
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: false })
      .then(({ data }) => setInteractions(data ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id])

  const handleInteraction = async (type: string, delta: number) => {
    if (type === 'nota' && !noteText.trim()) { setActiveBtn('nota'); return }
    setLoadingInteraction(true)

    const newScore = Math.max(0, Math.min(1000, currentLead.score + delta))
    const updatedLead = { ...currentLead, score: newScore, last_contact_at: new Date().toISOString() }

    const { data: interaction } = await supabase
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

    await supabase
      .from('leads')
      .update({ score: newScore, last_contact_at: updatedLead.last_contact_at })
      .eq('id', lead.id)

    if (interaction) setInteractions(prev => [interaction, ...prev])
    setCurrentLead(updatedLead)
    onUpdated(updatedLead)
    setNoteText('')
    setActiveBtn(null)
    setLoadingInteraction(false)
  }

  const handleAiAnalysis = async () => {
    setAiLoading(true)
    try {
      const res = await fetch('/api/lead-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: currentLead, interactions: interactions.slice(0, 10) }),
      })
      const data = await res.json()
      setAiSuggestion(data.suggestion ?? '')
    } finally {
      setAiLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay */}
      <div className="flex-1 bg-black/30" onClick={onClose} />

      {/* Painel lateral */}
      <div className="w-full max-w-md bg-white flex flex-col shadow-2xl overflow-hidden">
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
                className="w-full border border-border rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:border-primary-400"
                placeholder="Escreva uma nota..."
                autoFocus
              />
              <div className="flex gap-2">
                <button onClick={() => setActiveBtn(null)} className="flex-1 border border-border text-sm py-1.5 rounded-lg hover:bg-muted transition-colors">Cancelar</button>
                <button onClick={() => handleInteraction('nota', 0)} disabled={!noteText.trim()} className="flex-1 bg-primary-900 text-white text-sm py-1.5 rounded-lg hover:bg-primary-800 transition-colors disabled:opacity-50">Salvar</button>
              </div>
            </div>
          )}
        </div>

        {/* IA */}
        <div className="px-5 py-3 border-b border-border">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-medium text-muted-foreground">Análise com IA</p>
            <button onClick={handleAiAnalysis} disabled={aiLoading}
              className="text-xs text-indigo-600 hover:text-indigo-800 disabled:opacity-50">
              {aiLoading ? 'Analisando...' : 'Gerar análise'}
            </button>
          </div>
          {aiSuggestion && (
            <p className="text-xs text-foreground bg-indigo-50 rounded-lg p-3 leading-relaxed">{aiSuggestion}</p>
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
                      <span className="text-xs font-medium text-foreground capitalize">{i.type.replace('_', ' ')}</span>
                      {i.score_delta !== 0 && (
                        <span className={`text-xs font-mono ${i.score_delta > 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {i.score_delta > 0 ? '+' : ''}{i.score_delta}
                        </span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">{timeAgo(i.created_at)}</span>
                    </div>
                    {i.note && <p className="text-xs text-muted-foreground mt-0.5">{i.note}</p>}
                    {i.created_by_name && <p className="text-xs text-muted-foreground mt-0.5">— {i.created_by_name}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
