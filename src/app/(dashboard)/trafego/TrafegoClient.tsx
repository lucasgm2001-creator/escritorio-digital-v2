'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

interface Campaign {
  id: string
  name: string
  platform: 'google' | 'meta' | 'instagram' | 'tiktok' | 'outro'
  status: 'ativa' | 'pausada' | 'encerrada'
  budget: number
  spent: number
  leads: number
  conversions: number
  start_date: string
  end_date?: string
  managed_by_name?: string
  created_at: string
}

const PLATFORM_LABELS: Record<string, string> = {
  google: 'Google Ads', meta: 'Meta Ads', instagram: 'Instagram', tiktok: 'TikTok', outro: 'Outro',
}
const PLATFORM_COLORS: Record<string, string> = {
  google:    'bg-blue-900/30 text-blue-400 border-blue-800/50',
  meta:      'bg-indigo-900/30 text-indigo-400 border-indigo-800/50',
  instagram: 'bg-pink-900/30 text-pink-400 border-pink-800/50',
  tiktok:    'bg-slate-800/60 text-slate-300 border-slate-700/50',
  outro:     'bg-slate-800/40 text-slate-400 border-slate-700/50',
}
const STATUS_COLORS: Record<string, string> = {
  ativa:     'bg-green-900/30 text-green-400 border-green-800/50',
  pausada:   'bg-amber-900/30 text-amber-400 border-amber-800/50',
  encerrada: 'bg-slate-800/40 text-slate-400 border-slate-700/50',
}

function fmtBRL(v: number) {
  if (v >= 1_000_000) return `R$ ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000) return `R$ ${(v / 1_000).toFixed(1)}k`
  return `R$ ${v.toLocaleString('pt-BR')}`
}

const PLATFORMS = ['google', 'meta', 'instagram', 'tiktok', 'outro'] as const

export function TrafegoClient({ initialCampaigns }: { initialCampaigns: Campaign[] }) {
  const [campaigns, setCampaigns] = useState<Campaign[]>(initialCampaigns)
  const [newOpen, setNewOpen]     = useState(false)
  const [loading, setLoading]     = useState(false)
  const [form, setForm] = useState({
    name: '', platform: 'meta' as Campaign['platform'],
    budget: '', start_date: new Date().toISOString().slice(0, 10),
  })

  const supabase = createClient()

  const ativas    = campaigns.filter(c => c.status === 'ativa')
  const totalSpent  = ativas.reduce((s, c) => s + c.spent, 0)
  const totalLeads  = ativas.reduce((s, c) => s + c.leads, 0)
  const cpl = totalLeads > 0 ? totalSpent / totalLeads : 0

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setLoading(true)
    const { data, error } = await supabase.from('campaigns').insert({
      name: form.name,
      platform: form.platform,
      budget: parseFloat(form.budget) || 0,
      start_date: form.start_date,
      status: 'ativa',
      spent: 0, leads: 0, conversions: 0,
    }).select().single()
    if (!error && data) {
      setCampaigns(prev => [data as Campaign, ...prev])
      setForm({ name: '', platform: 'meta', budget: '', start_date: new Date().toISOString().slice(0, 10) })
      setNewOpen(false)
    }
    setLoading(false)
  }

  const handleToggleStatus = async (c: Campaign) => {
    const next = c.status === 'ativa' ? 'pausada' : 'ativa'
    await supabase.from('campaigns').update({ status: next }).eq('id', c.id)
    setCampaigns(prev => prev.map(x => x.id === c.id ? { ...x, status: next } : x))
  }

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))
  const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">Tráfego</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Campanhas de mídia paga</p>
        </div>
        <button
          onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-glow-sm"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Nova Campanha
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Campanhas Ativas',    value: ativas.length.toString(),       color: 'text-blue-400',   bar: 'before:bg-blue-500' },
          { label: 'Leads Gerados',       value: totalLeads.toString(),           color: 'text-indigo-400', bar: 'before:bg-indigo-500' },
          { label: 'Custo por Lead',      value: totalLeads > 0 ? fmtBRL(cpl) : '—', color: 'text-green-400', bar: 'before:bg-green-500' },
          { label: 'Investimento Total',  value: fmtBRL(totalSpent),             color: 'text-amber-400',  bar: 'before:bg-amber-500' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.bar}`}>
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Campaigns table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Todas as Campanhas</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {campaigns.length === 0 ? (
            <div className="py-16 text-center text-muted-foreground text-sm">
              <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
              </svg>
              Nenhuma campanha cadastrada
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d3748] bg-[#0d1117]/50">
                    {['Campanha', 'Plataforma', 'Status', 'Budget', 'Investido', 'Leads', 'CPL', 'Ações'].map(h => (
                      <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3748]/60">
                  {campaigns.map(c => {
                    const cplVal = c.leads > 0 ? c.spent / c.leads : 0
                    return (
                      <tr key={c.id} className={`hover:bg-[#1a2133]/60 transition-colors ${c.status === 'encerrada' ? 'opacity-50' : ''}`}>
                        <td className="px-4 py-3 font-medium text-foreground">{c.name}</td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${PLATFORM_COLORS[c.platform]}`}>
                            {PLATFORM_LABELS[c.platform]}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`text-xs px-2 py-0.5 rounded-full border font-medium capitalize ${STATUS_COLORS[c.status]}`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{fmtBRL(c.budget)}</td>
                        <td className="px-4 py-3 text-foreground tabular-nums font-medium">{fmtBRL(c.spent)}</td>
                        <td className="px-4 py-3 text-foreground tabular-nums">{c.leads}</td>
                        <td className="px-4 py-3 text-muted-foreground tabular-nums">{c.leads > 0 ? fmtBRL(cplVal) : '—'}</td>
                        <td className="px-4 py-3">
                          {c.status !== 'encerrada' && (
                            <button
                              onClick={() => handleToggleStatus(c)}
                              className={`text-xs font-medium px-2.5 py-1 rounded-lg border transition-colors ${
                                c.status === 'ativa'
                                  ? 'border-amber-800/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/40'
                                  : 'border-green-800/50 bg-green-900/20 text-green-400 hover:bg-green-900/40'
                              }`}
                            >
                              {c.status === 'ativa' ? 'Pausar' : 'Ativar'}
                            </button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Modal */}
      {newOpen && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-2xl shadow-card-hover w-full max-w-md animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground">Nova Campanha</h2>
              <button onClick={() => setNewOpen(false)} className="text-muted-foreground hover:text-foreground transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Nome da campanha *</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} placeholder="Ex: Leads Q1 - Meta" />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1.5">Plataforma</label>
                <select value={form.platform} onChange={e => set('platform', e.target.value)} className={inputCls}>
                  {PLATFORMS.map(p => <option key={p} value={p}>{PLATFORM_LABELS[p]}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Budget (R$)</label>
                  <input type="number" value={form.budget} onChange={e => set('budget', e.target.value)} className={inputCls} placeholder="0" min="0" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Data de início</label>
                  <input type="date" value={form.start_date} onChange={e => set('start_date', e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button type="button" onClick={() => setNewOpen(false)}
                  className="flex-1 border border-[#2d3748] text-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors">
                  Cancelar
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Criar Campanha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
