'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase/client'
import { updateClient } from '@/lib/commission/actions'
import { useSave } from '@/lib/useSave'
import { FUSO_OPTIONS } from '../comercial/types'
import { US_STATES, sanitizeAreaCode } from '@/lib/usStates'
import type { Client } from './ClientesClient'

interface Plan { id: string; nome: string; valor_semanal: number }
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// Modal de edição de cliente — COMPARTILHADO entre a aba Clientes e a aba Contatos. Salva na
// tabela clients pelo MESMO caminho (updateClient). O telefone auto-preenche DDD/estado/cidade
// pela MESMA regra do mapa (src/data/us-map.json > areaCodes), carregado sob demanda (lazy).
export function ClienteModal({ client, onClose, onSaved }: {
  client: Client
  onClose: () => void
  onSaved: (updated: Client) => void
}) {
  const supabase = createClient()
  const save = useSave()
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({
    name: client.name, company: client.company ?? '', email: client.email ?? '', phone: client.phone ?? '',
    plano_id: client.plano_id ?? '', fuso: client.fuso ?? '', nicho: client.nicho ?? '',
    city: client.city ?? '', state: client.state ?? '', area_code: client.area_code ?? '',
  })

  useEffect(() => {
    supabase.from('plans').select('id, nome, valor_semanal').eq('ativo', true).order('ordem')
      .then(({ data }) => setPlans((data ?? []) as Plan[]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Telefone (EUA) → DDD/estado/cidade. 11+ díg. começando com 1 → DDD = [1..3]; 10 díg. → DDD = [0..2].
  // DDD no us-map.json: preenche st+city+area_code. Fora dele: só area_code (estado/cidade ficam p/ ajuste).
  const onPhoneChange = async (phone: string) => {
    setForm(p => ({ ...p, phone }))
    const digits = phone.replace(/\D/g, '')
    let ddd = ''
    if (digits.length >= 11 && digits[0] === '1') ddd = digits.slice(1, 4)
    else if (digits.length === 10) ddd = digits.slice(0, 3)
    if (!ddd) return
    const mod = await import('@/data/us-map.json')
    const ac = (mod.default as { areaCodes: Record<string, { st: string; city: string }> }).areaCodes[ddd]
    setForm(p => p.phone !== phone ? p : (ac
      ? { ...p, area_code: ddd, state: ac.st, city: ac.city }
      : { ...p, area_code: ddd }))
  }

  const handleSave = async () => {
    setLoading(true)
    const editPlan = plans.find(p => p.id === form.plano_id)
    const patch = {
      name: form.name || client.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      plano_id: form.plano_id || client.plano_id || null,
      plan_weekly: editPlan?.valor_semanal ?? client.plan_weekly,
      nicho: form.nicho.trim() || null,
      fuso: form.fuso || null,
      city: form.city.trim() || null,
      state: form.state || null,
      area_code: form.area_code || null,
    }
    const { ok } = await save({
      run: () => updateClient(supabase, client.id, patch),
      success: 'Cliente atualizado.',
      error: 'Não foi possível salvar o cliente',
    })
    setLoading(false)
    if (ok) { onSaved({ ...client, ...patch } as Client); onClose() }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4">
      <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md max-h-[92vh] overflow-y-auto animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-bento-border">
          <h2 className="font-display font-bold text-bento-text">Editar Cliente</h2>
          <button onClick={onClose} className="text-bento-muted hover:text-bento-text transition-colors">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Nome</label>
            <input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder={client.name} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Empresa</label>
            <input value={form.company} onChange={e => setForm(p => ({ ...p, company: e.target.value }))} placeholder={client.company ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Email</label>
            <input value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} placeholder={client.email ?? ''} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Telefone</label>
            <input value={form.phone} onChange={e => onPhoneChange(e.target.value)} placeholder={client.phone ?? '+1 (555) 123-4567'} className={inputCls} />
            <p className="font-tech text-[10px] text-bento-muted/70 mt-1">Telefone dos EUA preenche DDD/estado/cidade automaticamente.</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Plano</label>
            <select value={form.plano_id} onChange={e => setForm(p => ({ ...p, plano_id: e.target.value }))} className={inputCls}>
              {plans.length === 0 && <option value="">Carregando…</option>}
              {plans.map(p => <option key={p.id} value={p.id}>{p.nome} — ${p.valor_semanal}/sem</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Nicho</label>
            <input value={form.nicho} onChange={e => setForm(p => ({ ...p, nicho: e.target.value }))} placeholder="Ex: Roofing, HVAC..." className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Fuso horário</label>
            <select value={form.fuso} onChange={e => setForm(p => ({ ...p, fuso: e.target.value }))} className={inputCls}>
              <option value="">Sem fuso</option>
              {FUSO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
          {/* Localização (EUA) — alimenta o Mapa (city/state/area_code). Editável após o auto-preenchimento. */}
          <div>
            <label className="block text-xs font-medium text-bento-dim mb-1">Cidade (EUA)</label>
            <input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="Ex.: New York City" className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">Estado</label>
              <select value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))} className={inputCls}>
                <option value="">Selecione...</option>
                {US_STATES.map(s => <option key={s.code} value={s.code}>{s.code} — {s.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-bento-dim mb-1">DDD (area code)</label>
              <input inputMode="numeric" maxLength={3} value={form.area_code} onChange={e => setForm(p => ({ ...p, area_code: sanitizeAreaCode(e.target.value) }))} placeholder="Ex.: 212" className={inputCls} />
            </div>
          </div>
          <div className="flex gap-3 pt-1">
            <button onClick={onClose} className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors">Cancelar</button>
            <button onClick={handleSave} disabled={loading} className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50">{loading ? 'Salvando...' : 'Salvar'}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
