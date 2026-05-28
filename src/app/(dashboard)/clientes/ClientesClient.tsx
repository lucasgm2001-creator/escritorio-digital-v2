'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'

interface Client {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  plan_weekly: number
  status: 'ativo' | 'inativo' | 'prospect'
  start_date?: string
  end_date?: string
  assigned_name?: string
  created_at: string
}

interface Props {
  initialClients: Client[]
  currentUser: { id: string; name: string; role: string }
}

const PLANS = [140, 190, 250]

export function ClientesClient({ initialClients, currentUser }: Props) {
  const [clients, setClients] = useState<Client[]>(initialClients)
  const [newOpen, setNewOpen] = useState(false)
  const [form, setForm] = useState({ name: '', company: '', email: '', phone: '', plan_weekly: '140' })
  const [loading, setLoading] = useState(false)

  const supabase = createClient()

  const ativos = clients.filter(c => c.status === 'ativo')
  const inativos = clients.filter(c => c.status === 'inativo')
  const mrr = ativos.reduce((sum, c) => sum + c.plan_weekly * 4, 0)

  const set = (k: string, v: string) => setForm(prev => ({ ...prev, [k]: v }))

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    const { data, error } = await supabase.from('clients').insert({
      name: form.name,
      company: form.company || null,
      email: form.email || null,
      phone: form.phone || null,
      plan_weekly: parseFloat(form.plan_weekly),
      status: 'ativo',
      start_date: new Date().toISOString().slice(0, 10),
      assigned_name: currentUser.name,
    }).select().single()

    if (!error && data) {
      setClients(prev => [data as Client, ...prev])
      await supabase.from('activities').insert({
        type: 'client',
        description: `Novo cliente ativo: ${form.name}`,
        user_name: currentUser.name,
        entity_id: data.id,
      })
      setNewOpen(false)
      setForm({ name: '', company: '', email: '', phone: '', plan_weekly: '140' })
    }
    setLoading(false)
  }

  const handleInativar = async (client: Client) => {
    const reason = window.prompt(`Motivo para inativar ${client.name}?`)
    if (reason === null) return

    await supabase.from('clients').update({
      status: 'inativo', end_date: new Date().toISOString().slice(0, 10), end_reason: reason,
    }).eq('id', client.id)

    setClients(prev => prev.map(c => c.id === client.id ? { ...c, status: 'inativo' as const } : c))

    await supabase.from('activities').insert({
      type: 'client',
      description: `Cliente inativado: ${client.name}. Motivo: ${reason}`,
      user_name: currentUser.name,
      entity_id: client.id,
    })
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Stats */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-primary-900">Clientes</h1>
        <button onClick={() => setNewOpen(true)}
          className="flex items-center gap-2 bg-primary-900 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Novo Cliente
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card className="shadow-card">
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Contratos Ativos</p>
            <p className="text-3xl font-bold text-green-600 mt-1">{ativos.length}</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">MRR Total</p>
            <p className="text-3xl font-bold text-primary-700 mt-1">{formatCurrency(mrr, 'en-US', 'USD')}</p>
            <p className="text-xs text-muted-foreground mt-1">semanal × 4</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground">Contratos Inativos</p>
            <p className="text-3xl font-bold text-slate-500 mt-1">{inativos.length}</p>
          </CardContent>
        </Card>
      </div>

      {/* Ativos */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-base text-primary-900 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500" />
            Contratos Ativos
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {ativos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum cliente ativo.</p>
            )}
            {ativos.map(client => (
              <div key={client.id} className="flex items-center gap-4 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors">
                <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center shrink-0">
                  <span className="text-sm font-bold text-primary-700">{client.name[0]}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-foreground text-sm">{client.name}</p>
                  {client.company && <p className="text-xs text-muted-foreground">{client.company}</p>}
                </div>
                <Badge variant="success" className="text-xs shrink-0">
                  {formatCurrency(client.plan_weekly, 'en-US', 'USD')}/sem
                </Badge>
                {client.start_date && (
                  <span className="text-xs text-muted-foreground shrink-0 hidden md:block">
                    desde {formatDate(client.start_date)}
                  </span>
                )}
                <button onClick={() => handleInativar(client)}
                  className="text-xs text-red-500 hover:text-red-700 transition-colors shrink-0">
                  Inativar
                </button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Inativos */}
      {inativos.length > 0 && (
        <Card className="shadow-card opacity-80">
          <CardHeader className="pb-3">
            <CardTitle className="text-base text-muted-foreground flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Contratos Inativos
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {inativos.map(client => (
                <div key={client.id} className="flex items-center gap-4 p-3 rounded-lg bg-muted/30">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <span className="text-sm font-bold text-muted-foreground">{client.name[0]}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-muted-foreground text-sm">{client.name}</p>
                    {client.company && <p className="text-xs text-muted-foreground">{client.company}</p>}
                  </div>
                  <span className="text-xs text-muted-foreground">
                    {formatCurrency(client.plan_weekly, 'en-US', 'USD')}/sem
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Modal novo cliente */}
      {newOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            <div className="flex items-center justify-between p-6 border-b border-border">
              <h2 className="font-bold text-foreground">Novo Cliente</h2>
              <button onClick={() => setNewOpen(false)} className="text-muted-foreground hover:text-foreground">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Nome *</label>
                <input required value={form.name} onChange={e => set('name', e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Empresa</label>
                <input value={form.company} onChange={e => set('company', e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400" />
              </div>
              <div>
                <label className="block text-xs font-medium text-foreground mb-1">Plano semanal</label>
                <div className="flex gap-2">
                  {PLANS.map(p => (
                    <button key={p} type="button" onClick={() => set('plan_weekly', String(p))}
                      className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${
                        form.plan_weekly === String(p)
                          ? 'bg-primary-900 text-white border-primary-900'
                          : 'border-border text-muted-foreground hover:border-primary-300'
                      }`}>
                      ${p}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => setNewOpen(false)}
                  className="flex-1 border border-border text-foreground py-2.5 rounded-lg text-sm hover:bg-muted transition-colors">Cancelar</button>
                <button type="submit" disabled={loading}
                  className="flex-1 bg-primary-900 text-white py-2.5 rounded-lg text-sm font-medium hover:bg-primary-800 transition-colors disabled:opacity-50">
                  {loading ? 'Salvando...' : 'Criar Cliente'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
