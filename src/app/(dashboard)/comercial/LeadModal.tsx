'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from './types'
import { useToast } from '@/components/ui/toast'

interface Seller { id: string; name: string }

interface Props {
  onClose: () => void
  onCreated: (lead: Lead) => void
  currentUser: { id: string; name: string }
}

const EMPTY_FORM = {
  name: '', company: '', email: '', phone: '',
  value: '', operation: 'brasil', notes: '',
  nicho: '', origem: '', prioridade: 'media',
  next_contact: '', assigned_to: '', assigned_name: '',
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

export function LeadModal({ onClose, onCreated, currentUser }: Props) {
  const { toast } = useToast()
  const [form, setForm] = useState({ ...EMPTY_FORM, assigned_to: currentUser.id, assigned_name: currentUser.name })
  const [loading, setLoading] = useState(false)
  const [aiPaste, setAiPaste] = useState(false)
  const [rawText, setRawText] = useState('')
  const [nichoOutro, setNichoOutro] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const [sellers, setSellers] = useState<Seller[]>([])
  const [submitError, setSubmitError] = useState('')

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

  const handleSubmit = async (e: React.FormEvent) => {
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
      operation: form.operation || 'brasil',
      notes: form.notes.trim() || null,
      nicho: form.nicho.trim() || null,
      origem: form.origem || null,
      prioridade: form.prioridade || 'media',
      next_contact: form.next_contact || null,
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
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
      <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-2xl max-h-[92vh] flex flex-col animate-slide-up">

        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-bento-border shrink-0">
          <h2 className="font-display font-bold text-bento-text text-base">Novo Lead</h2>
          <div className="flex items-center gap-2">
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
                className={inputCls} placeholder="+55 (11) 99999-9999" />
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
            <Field label="Valor estimado (R$)">
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
            <button type="submit" disabled={loading}
              className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
