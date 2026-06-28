'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { FUSO_OPTIONS, type Lead } from './types'
import { US_STATES, sanitizeAreaCode } from '@/lib/usStates'
import { logStageEvent } from '@/lib/stageEvents'
import { useToast } from '@/components/ui/toast'
import { ymd } from '@/lib/format'
import { wonSlug, type FunnelStage } from '@/lib/funnelStages'
import type { Client } from '../clientes/ClientesClient'
import { Portal } from '@/components/ui/Portal'

interface Seller { id: string; name: string }

interface Props {
  onClose: () => void
  onCreated: (lead: Lead) => void
  currentUser: { id: string; name: string }
  stages: FunnelStage[]   // fases do funil (p/ o seletor no modo "Já é cliente")
  clients: Client[]       // clientes existentes (p/ a busca no modo "Já é cliente")
}

const EMPTY_FORM = {
  name: '', company: '', email: '', phone: '',
  value: '', notes: '',
  nicho: '', origem: '', prioridade: 'media',
  next_contact: '', assigned_to: '', assigned_name: '', received_at: '', fuso: '',
  city: '', state: '', area_code: '',
}

const ORIGENS = [
  { value: 'instagram', label: 'Instagram' },
  { value: 'google',    label: 'Google Ads' },
  { value: 'indicacao', label: 'Indicação' },
  { value: 'tiktok',    label: 'TikTok' },
  { value: 'site',      label: 'Site' },
  { value: 'outro',     label: 'Outro' },
]

const NICHOS = [
  'Construction', 'House Cleaning', 'Home Remodeling', 'General Contracting',
  'Painting', 'Flooring', 'Tile', 'Junk Removal', 'Roofing', 'Landscaping',
  'HVAC', 'Plumbing', 'Electrical', 'Pool Service', 'Pressure Washing', 'Pest Control',
]

// Cores SEMÂNTICAS de prioridade (translúcidas dark; o tema claro é resolvido
// pela camada de compatibilidade em globals.css). Não são o acento.
const PRIORIDADES = [
  { value: 'baixa',   label: 'Baixa',   color: 'text-slate-400 bg-slate-800/40 border-slate-700/50' },
  { value: 'media',   label: 'Média',   color: 'text-blue-400  bg-blue-900/30  border-blue-800/50' },
  { value: 'alta',    label: 'Alta',    color: 'text-amber-400 bg-amber-900/30 border-amber-800/50' },
  { value: 'urgente', label: 'Urgente', color: 'text-red-400   bg-red-900/30   border-red-800/50' },
]

// Tokens bento, theme-aware (dark: fundo escuro + texto claro; light: o inverso).
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// IMPORTANTE: Field fica em escopo de MÓDULO, não dentro do componente. Definido
// dentro do render, seria recriado a cada keystroke → o input remonta e perde o
// foco (bug "só entra 1 letra"). Fora, o nó do input é estável.
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-bento-dim mb-1">{label}</label>
      {children}
    </div>
  )
}

export function LeadModal({ onClose, onCreated, currentUser, stages, clients }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({ ...EMPTY_FORM, assigned_to: currentUser.id, assigned_name: currentUser.name, received_at: ymd(new Date()) })
  const [loading, setLoading] = useState(false)
  const [aiPaste, setAiPaste] = useState(false)
  const [rawText, setRawText] = useState('')
  const [nichoOutro, setNichoOutro] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [submitError, setSubmitError] = useState('')

  // ── Modo "Já é cliente": adiciona ao funil um CLIENTE existente (INSERT simples, FORA do fluxo de
  //    fechamento — sem runWonFlow/WonPlanModal/registerMeeting/payWeek, sem comissão, sem novo cliente). ──
  const stageOptions = stages.filter(s => !s.arquivada).sort((a, b) => a.posicao - b.posicao)
  const [isClient, setIsClient] = useState(false)
  const [clientQuery, setClientQuery] = useState('')
  const [selectedClient, setSelectedClient] = useState<Client | null>(null)
  const [clientStageSlug, setClientStageSlug] = useState<string>(wonSlug(stages))   // default "Venda Concluída"
  const clientMatches = (() => {
    const q = clientQuery.trim().toLowerCase()
    if (!q) return []
    return clients.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.company?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
    ).slice(0, 8)
  })()

  const supabase = createClient()

  useEffect(() => {
    supabase.from('sellers').select('id, name').eq('status', 'ativo').order('name').then(({ data }) => {
      setSellers(data ?? [])
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleAiParse = async () => {
    if (!rawText.trim()) return
    setAiLoading(true)
    try {
      const res = await fetch('/api/parse-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: rawText }),
      })
      if (!res.ok) throw new Error('falha')
      const data = await res.json()
      if (data.lead) {
        setForm(prev => ({ ...prev, ...data.lead }))
        setAiPaste(false)
      } else {
        toast({ type: 'error', message: 'Não consegui extrair os dados. Preencha manualmente.' })
      }
    } catch {
      toast({ type: 'error', message: 'A IA demorou para responder. Tente novamente ou preencha manualmente.' })
    } finally {
      setAiLoading(false)
    }
  }

  // Modo "Já é cliente": UMA linha em leads com os dados do cliente. origem='cliente_existente'
  // (flag p/ relatórios não contarem como venda/comissão nova). Mesmo que a fase seja is_won, é só
  // um INSERT — NÃO chama runWonFlow/registerMeeting/payWeek (won-flow só dispara ao MOVER um lead).
  const handleSubmitClient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedClient) return
    setLoading(true)
    setSubmitError('')
    const c = selectedClient
    const stageSlug = clientStageSlug || wonSlug(stages)
    const { data, error } = await supabase.from('leads').insert({
      name: c.name,
      company: c.company || null,
      email: c.email || null,
      phone: c.phone || null,
      value: c.plan_weekly || 0,          // valor = mensalidade semanal do cliente (ou 0)
      operation: 'eua',
      fuso: c.fuso || null,
      city: c.city || null,
      state: c.state || null,
      area_code: c.area_code || null,
      origem: 'cliente_existente',        // FLAG: relatórios não contam como venda/comissão nova
      prioridade: 'media',
      received_at: ymd(new Date()),       // chegada = hoje
      assigned_to: currentUser.id,
      assigned_name: currentUser.name,    // Lucas
      score: 500,
      status: stageSlug,                  // fase escolhida (default Venda Concluída)
    }).select().single()

    if (error || !data) {
      // Se o CHECK de origem ainda não foi ampliado no banco, avisa de forma clara.
      const friendly = error?.message?.includes('leads_origem_check')
        ? 'Falta aplicar a migration 038 (origem cliente_existente) no banco.'
        : (error?.message ?? 'Não foi possível adicionar ao funil. Tente novamente.')
      setSubmitError(friendly)
      setLoading(false)
      return
    }
    // Feed de atividades (NÃO é dinheiro). NÃO loga "fechou"/stage-event nem dispara won-flow.
    await supabase.from('activities').insert({
      type: 'lead',
      description: `Cliente existente adicionado ao funil: ${c.name}`,
      user_name: currentUser.name,
      entity_id: data.id,
    })
    onCreated(data as Lead)
    onClose()
  }

  const handleSubmit = async (e: React.FormEvent) => {
    if (isClient) return handleSubmitClient(e)
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    setSubmitError('')

    // Só o nome é obrigatório. Os opcionais viram null; campos com NOT NULL/CHECK
    // recebem defaults sensatos. assigned_to é nullable → null evita violar a FK
    // de profiles quando não há vendedor escolhido.
    const { data, error: insertError } = await supabase.from('leads').insert({
      name: form.name.trim(),
      company: form.company.trim() || null,
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      value: parseFloat(form.value) || 0,
      operation: 'eua',   // segmentação Brasil/EUA removida — todo lead é EUA (sem escolha na UI)
      notes: form.notes.trim() || null,
      nicho: form.nicho.trim() || null,
      origem: form.origem || null,
      prioridade: form.prioridade || 'media',
      next_contact: form.next_contact || null,
      received_at: form.received_at || ymd(new Date()),   // data de CHEGADA (default hoje)
      fuso: form.fuso || null,
      city: form.city.trim() || null,
      state: form.state || null,
      area_code: form.area_code || null,
      // Só o usuário logado tem linha em profiles (alvo da FK). Vendedores sem conta
      // (ex.: Lucas) não — então grava só o nome e deixa a FK null, evitando o
      // "violates foreign key constraint". Correção plena (contas/FK) fica pra Fase 2.
      assigned_to: form.assigned_to === currentUser.id ? currentUser.id : null,
      assigned_name: form.assigned_name || currentUser.name || null,
      score: 500,
      status: 'novo',
    }).select().single()

    if (insertError || !data) {
      setSubmitError(insertError?.message ?? 'Não foi possível criar o lead. Tente novamente.')
      setLoading(false)
      return
    }

    // Histórico de movimentação: entrada no funil (fromStage=null → toStage='novo'). ADITIVO/best-effort.
    await logStageEvent(supabase, {
      leadId: data.id, leadName: data.name,
      fromStage: null, toStage: data.status ?? 'novo',
      sellerId: data.assigned_to ?? null, sellerName: data.assigned_name ?? null,
    })

    // Registrar atividade é best-effort: não bloqueia o sucesso do lead.
    await supabase.from('activities').insert({
      type: 'lead',
      description: `Novo lead cadastrado: ${form.name.trim()}`,
      user_name: currentUser.name,
      entity_id: data.id,
    })
    onCreated(data as Lead)
    onClose()
  }

  return (
    <Portal>
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[300] p-0 sm:p-4">
      <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-2xl max-h-[92dvh] flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bento-border shrink-0">
          <h2 className="font-display font-bold text-bento-text text-base">Novo Lead</h2>
          <div className="flex items-center gap-2">
            {!isClient && (
            <button
              onClick={() => setAiPaste(!aiPaste)}
              className={`text-xs px-3 py-1.5 rounded-btn border transition-colors ${
                aiPaste
                  ? 'bg-lime/15 text-lime-fg border-lime/40'
                  : 'bg-bento-bg text-bento-dim border-bento-border hover:border-lime'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Preencher com IA
              </span>
            </button>
            )}
            <button onClick={onClose} className="text-bento-muted hover:text-bento-text">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* AI paste area */}
        {aiPaste && (
          <div className="p-4 bg-bento-bg border-b border-bento-border shrink-0">
            <p className="text-xs text-bento-dim mb-2 font-medium">Cole o texto do WhatsApp, formulário ou qualquer texto com os dados do lead:</p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              className="w-full bg-bento-panel border border-bento-border rounded-btn p-3 text-sm text-bento-text placeholder:text-bento-muted resize-none focus:outline-none focus:border-lime"
              rows={3}
              placeholder="Nome: João Silva&#10;Empresa: ABC Ltda&#10;Telefone: (11) 99999-9999&#10;Nicho: E-commerce"
            />
            <button
              onClick={handleAiParse}
              disabled={aiLoading || !rawText.trim()}
              className="bento-btn mt-2 text-sm px-4 py-2 rounded-btn disabled:opacity-50 min-h-0"
            >
              {aiLoading ? 'Analisando...' : 'Extrair dados'}
            </button>
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 overflow-y-auto flex-1">

          {/* Toggle "Já é cliente" — adiciona ao funil um cliente existente (sem fluxo de fechamento). */}
          <div className="flex items-center justify-between gap-3 bento-fx px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-sm font-medium text-bento-text">Já é cliente</p>
              <p className="font-tech text-[10px] text-bento-muted/80">Adiciona um cliente existente ao funil — não cria venda nem comissão.</p>
            </div>
            <button type="button" role="switch" aria-checked={isClient} onClick={() => setIsClient(v => !v)}
              className={`relative w-11 h-6 rounded-full flex-none transition-colors ${isClient ? 'bg-lime' : 'bg-bento-border'}`}>
              <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${isClient ? 'translate-x-5' : ''}`} />
            </button>
          </div>

          {isClient && (
            <>
              {/* Busca do cliente existente (nome / empresa / e-mail) */}
              <Field label="Cliente *">
                {selectedClient ? (
                  <div className="flex items-center justify-between gap-2 bg-bento-bg border border-lime/40 rounded-btn px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-bento-text truncate">{selectedClient.name}</p>
                      {selectedClient.company && <p className="text-xs text-bento-muted truncate">{selectedClient.company}</p>}
                    </div>
                    <button type="button" onClick={() => { setSelectedClient(null); setClientQuery('') }}
                      className="text-bento-muted hover:text-bento-text shrink-0 font-tech text-xs">trocar</button>
                  </div>
                ) : (
                  <div className="relative">
                    <input value={clientQuery} onChange={e => setClientQuery(e.target.value)} autoFocus
                      className={inputCls} placeholder="Buscar por nome, empresa ou e-mail..." />
                    {clientMatches.length > 0 && (
                      <div className="absolute left-0 right-0 z-20 mt-1 bg-bento-panel border border-bento-border rounded-btn shadow-card-hover overflow-hidden max-h-60 overflow-y-auto">
                        {clientMatches.map(c => (
                          <button key={c.id} type="button" onClick={() => { setSelectedClient(c); setClientQuery('') }}
                            className="w-full text-left px-3 py-2 hover:bg-bento-bg/60 transition-colors border-b border-bento-border/50 last:border-0">
                            <p className="text-sm text-bento-text truncate">{c.name}</p>
                            <p className="text-xs text-bento-muted truncate">{[c.company || c.email, c.state].filter(Boolean).join(' · ') || '—'}</p>
                          </button>
                        ))}
                      </div>
                    )}
                    {clientQuery.trim() && clientMatches.length === 0 && (
                      <p className="font-tech text-[11px] text-bento-muted mt-1">Nenhum cliente encontrado.</p>
                    )}
                  </div>
                )}
              </Field>

              {/* Fase do funil (default = Venda Concluída) */}
              <Field label="Fase do funil">
                <select value={clientStageSlug} onChange={e => setClientStageSlug(e.target.value)} className={inputCls}>
                  {stageOptions.map(s => <option key={s.slug} value={s.slug}>{s.nome}</option>)}
                </select>
              </Field>

              {selectedClient && (
                <p className="font-tech text-[11px] text-bento-muted/80">
                  Entra como <span className="text-bento-text">{stageOptions.find(s => s.slug === clientStageSlug)?.nome ?? clientStageSlug}</span> · valor US$ {selectedClient.plan_weekly || 0}/sem · sem comissão.
                </p>
              )}
            </>
          )}

          {!isClient && (
          <>
          {/* Data de chegada — separa quando o lead CHEGOU de quando foi cadastrado (default hoje) */}
          <Field label="Data de chegada">
            <input type="date" value={form.received_at} onChange={e => set('received_at', e.target.value)}
              className={inputCls} />
          </Field>

          {/* Fuso horário (EUA) — opcional */}
          <Field label="Fuso horário">
            <select value={form.fuso} onChange={e => set('fuso', e.target.value)} className={inputCls}>
              <option value="">Sem fuso</option>
              {FUSO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </Field>

          {/* Localização (EUA) — opcional; alimenta o Mapa de Clientes (city/state/area_code) */}
          <Field label="Cidade">
            <input value={form.city} onChange={e => set('city', e.target.value)}
              className={inputCls} placeholder="Ex.: New York City" />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Estado (EUA)">
              <select value={form.state} onChange={e => set('state', e.target.value)} className={inputCls}>
                <option value="">Selecione...</option>
                {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </Field>
            <Field label="DDD (area code)">
              <input inputMode="numeric" value={form.area_code} maxLength={3}
                onChange={e => set('area_code', sanitizeAreaCode(e.target.value))}
                className={inputCls} placeholder="Ex.: 212" />
            </Field>
          </div>

          {/* Linha 1: Nome + Empresa */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nome *">
              <input required value={form.name} onChange={e => set('name', e.target.value)}
                className={inputCls} placeholder="Nome completo" />
            </Field>
            <Field label="Empresa">
              <input value={form.company} onChange={e => set('company', e.target.value)}
                className={inputCls} placeholder="Nome da empresa" />
            </Field>
          </div>

          {/* Linha 2: Telefone + Email */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Telefone">
              <input value={form.phone} onChange={e => set('phone', e.target.value)}
                className={inputCls} placeholder="+1 (555) 123-4567" />
            </Field>
            <Field label="E-mail">
              <input type="email" value={form.email} onChange={e => set('email', e.target.value)}
                className={inputCls} placeholder="email@exemplo.com" />
            </Field>
          </div>

          {/* Linha 3: Nicho + Valor */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Nicho / Segmento">
              <select
                value={nichoOutro ? '__outro__' : form.nicho}
                onChange={e => {
                  if (e.target.value === '__outro__') { setNichoOutro(true); set('nicho', '') }
                  else { setNichoOutro(false); set('nicho', e.target.value) }
                }}
                className={inputCls}>
                <option value="">Selecione...</option>
                {NICHOS.map(n => <option key={n} value={n}>{n}</option>)}
                <option value="__outro__">Outro</option>
              </select>
              {nichoOutro && (
                <input value={form.nicho} onChange={e => set('nicho', e.target.value)}
                  className={`${inputCls} mt-2`} placeholder="Qual nicho?" autoFocus />
              )}
            </Field>
            <Field label="Valor estimado (US$)">
              <input type="number" value={form.value} onChange={e => set('value', e.target.value)}
                className={inputCls} placeholder="0" min="0" />
            </Field>
          </div>

          {/* Linha 4: Origem + Próximo contato */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Origem">
              <select value={form.origem} onChange={e => set('origem', e.target.value)} className={inputCls}>
                <option value="">— Selecionar —</option>
                {ORIGENS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Próximo contato">
              <input type="date" value={form.next_contact} onChange={e => set('next_contact', e.target.value)}
                className={inputCls} />
            </Field>
          </div>

          {/* Linha 5: Prioridade */}
          <Field label="Prioridade">
            <div className="flex gap-2">
              {PRIORIDADES.map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => set('prioridade', p.value)}
                  className={`flex-1 py-1.5 rounded-btn text-xs font-semibold border transition-all ${
                    form.prioridade === p.value ? p.color : 'text-bento-muted bg-bento-bg border-bento-border hover:border-lime'
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </Field>

          {/* Responsável */}
          <Field label="Responsável">
            <select
              value={form.assigned_to}
              onChange={e => {
                const sel = sellers.find(s => s.id === e.target.value)
                setForm(prev => ({
                  ...prev,
                  assigned_to: e.target.value || currentUser.id,
                  assigned_name: sel?.name || currentUser.name,
                }))
              }}
              className={inputCls}
            >
              <option value={currentUser.id}>{currentUser.name} (eu)</option>
              {sellers.filter(s => s.id !== currentUser.id).map(s => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </Field>

          {/* Observações */}
          <Field label="Observações">
            <textarea
              value={form.notes}
              onChange={e => set('notes', e.target.value)}
              rows={2}
              className={`${inputCls} resize-none`}
              placeholder="Contexto, dores, próximos passos..."
            />
          </Field>
          </>
          )}

          {/* Erro do salvamento (não falha mais em silêncio) */}
          {submitError && (
            <div className="flex items-start gap-2 text-sm text-red-400 bg-red-900/20 border border-red-800/40 rounded-btn px-3 py-2">
              <svg className="w-4 h-4 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
              </svg>
              <span><strong className="font-semibold">Não foi possível criar o lead.</strong> {submitError}</span>
            </div>
          )}

          {/* Botões */}
          <div className="flex gap-3 pt-1">
            <button type="button" onClick={onClose}
              className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading || (isClient && !selectedClient)}
              className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50">
              {loading ? 'Salvando...' : isClient ? 'Adicionar ao funil' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  )
}
