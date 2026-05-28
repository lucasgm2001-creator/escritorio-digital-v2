'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from './KanbanBoard'

interface Props {
  onClose: () => void
  onCreated: (lead: Lead) => void
  currentUser: { id: string; name: string }
}

export function LeadModal({ onClose, onCreated, currentUser }: Props) {
  const [form, setForm] = useState({
    name: '', company: '', email: '', phone: '',
    value: '', operation: 'brasil', notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [aiPaste, setAiPaste] = useState(false)
  const [rawText, setRawText] = useState('')
  const [aiLoading, setAiLoading] = useState(false)

  const supabase = createClient()

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
      const data = await res.json()
      if (data.lead) {
        setForm(prev => ({ ...prev, ...data.lead }))
        setAiPaste(false)
      }
    } finally {
      setAiLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)

    const { data, error } = await supabase.from('leads').insert({
      name: form.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      value: parseFloat(form.value) || 0,
      operation: form.operation,
      notes: form.notes || null,
      assigned_to: currentUser.id,
      assigned_name: currentUser.name,
      score: 500,
      status: 'novo',
    }).select().single()

    if (!error && data) {
      await supabase.from('activities').insert({
        type: 'lead',
        description: `Novo lead cadastrado: ${form.name}`,
        user_name: currentUser.name,
        entity_id: data.id,
      })
      onCreated(data as Lead)
      onClose()
    }
    setLoading(false)
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="font-bold text-foreground">Novo Lead</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAiPaste(!aiPaste)}
              className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-200 px-3 py-1.5 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              Preencher com IA
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {aiPaste && (
          <div className="p-4 bg-indigo-50 border-b border-indigo-100">
            <p className="text-xs text-indigo-700 mb-2 font-medium">Cole o texto do formulário do WhatsApp ou qualquer texto com os dados do lead:</p>
            <textarea
              value={rawText}
              onChange={e => setRawText(e.target.value)}
              className="w-full border border-indigo-200 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-indigo-400"
              rows={4}
              placeholder="Nome: João Silva&#10;Empresa: ABC Ltda&#10;Telefone: (11) 99999-9999"
            />
            <button
              onClick={handleAiParse}
              disabled={aiLoading || !rawText.trim()}
              className="mt-2 text-sm bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition-colors disabled:opacity-50"
            >
              {aiLoading ? 'Analisando...' : 'Extrair dados'}
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Nome *</label>
              <input
                required
                value={form.name}
                onChange={e => set('name', e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                placeholder="Nome do lead"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Empresa</label>
              <input
                value={form.company}
                onChange={e => set('company', e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                placeholder="Empresa"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Telefone</label>
              <input
                value={form.phone}
                onChange={e => set('phone', e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                placeholder="+55 (11) 99999-9999"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">E-mail</label>
              <input
                type="email"
                value={form.email}
                onChange={e => set('email', e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                placeholder="email@exemplo.com"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-foreground mb-1">Valor estimado</label>
              <input
                type="number"
                value={form.value}
                onChange={e => set('value', e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400"
                placeholder="0"
              />
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Operação</label>
              <div className="flex gap-2">
                {(['brasil', 'eua'] as const).map(op => (
                  <button
                    key={op}
                    type="button"
                    onClick={() => set('operation', op)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium border transition-colors ${
                      form.operation === op
                        ? 'bg-primary-900 text-white border-primary-900'
                        : 'border-border text-muted-foreground hover:border-primary-300'
                    }`}
                  >
                    {op === 'brasil' ? '🇧🇷 Brasil' : '🇺🇸 EUA'}
                  </button>
                ))}
              </div>
            </div>
            <div className="col-span-2">
              <label className="block text-xs font-medium text-foreground mb-1">Observações</label>
              <textarea
                value={form.notes}
                onChange={e => set('notes', e.target.value)}
                rows={3}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 resize-none"
                placeholder="Contexto, origem, observações..."
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose}
              className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm hover:bg-muted transition-colors">
              Cancelar
            </button>
            <button type="submit" disabled={loading}
              className="flex-1 bg-primary-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50">
              {loading ? 'Salvando...' : 'Criar Lead'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
