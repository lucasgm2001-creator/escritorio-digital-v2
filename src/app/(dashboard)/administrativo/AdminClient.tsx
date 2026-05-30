'use client'

import { useState, useRef } from 'react'
import { timeAgo, formatDate } from '@/lib/utils'
import { ThemeSelector } from '@/components/ThemeSelector'
import { DraggableTabs } from '@/components/DraggableTabs'

interface Profile { id: string; name: string; role: string; email?: string; created_at: string }
interface Activity { id: string; type: string; description: string; user_name?: string; created_at: string }
interface Stats { totalLeads: number; totalClients: number; totalSellers: number }
interface DocFile { id: string; name: string; size: number; type: string; url: string; uploaded_at: string }

interface Props {
  profiles: Profile[]
  stats: Stats
  recentActivities: Activity[]
  userRole?: string
}

type Tab = 'equipe' | 'atividades' | 'documentos' | 'financeiro' | 'configuracoes'

const ROLE_LABEL: Record<string, string> = {
  admin: 'Administrador', comercial: 'Comercial',
  trafego: 'Tráfego', financeiro: 'Financeiro',
}
const ROLE_COLOR: Record<string, string> = {
  admin:     'bg-violet-900/30 text-violet-400 border-violet-800/50',
  comercial: 'bg-blue-900/30   text-blue-400   border-blue-800/50',
  trafego:   'bg-indigo-900/30 text-indigo-400 border-indigo-800/50',
  financeiro:'bg-green-900/30  text-green-400  border-green-800/50',
}
const ACT_COLOR: Record<string, string> = {
  lead: 'bg-blue-900/40 text-blue-400', client: 'bg-indigo-900/40 text-indigo-400',
  payment: 'bg-green-900/40 text-green-400', task: 'bg-amber-900/40 text-amber-400',
  campaign: 'bg-purple-900/40 text-purple-400', system: 'bg-slate-800/60 text-slate-400',
}

function fmtSize(b: number) {
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`
  if (b >= 1_024) return `${(b / 1_024).toFixed(0)} KB`
  return `${b} B`
}

const TABS: { key: Tab; label: string }[] = [
  { key: 'equipe',      label: 'Equipe' },
  { key: 'atividades',  label: 'Atividades' },
  { key: 'documentos',  label: 'Documentos' },
  { key: 'financeiro',  label: 'Financeiro Interno' },
  { key: 'configuracoes', label: 'Configurações' },
]

// Dummy financeiro data
const INCOME_ITEMS = [
  { desc: 'MRR Clientes', amount: 0, note: 'Calculado automaticamente' },
]
const EXPENSE_ITEMS = [
  { desc: 'Salários', amount: 0, note: 'Atualizar mensalmente' },
  { desc: 'Ferramentas SaaS', amount: 0, note: 'Supabase, Anthropic, Vercel...' },
  { desc: 'Outros', amount: 0, note: '' },
]

export function AdminClient({ profiles, stats, recentActivities, userRole }: Props) {
  const [tab, setTab] = useState<Tab>('equipe')
  const [docs, setDocs] = useState<DocFile[]>([])
  const fileRef = useRef<HTMLInputElement>(null)

  // Verificar se usuário é admin
  if (userRole !== 'admin') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-foreground mb-2">Acesso Negado</h1>
          <p className="text-muted-foreground">Você não tem permissão para acessar esta área.</p>
        </div>
      </div>
    )
  }

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    const newDocs: DocFile[] = Array.from(files).map(f => ({
      id: crypto.randomUUID(),
      name: f.name,
      size: f.size,
      type: f.type,
      url: URL.createObjectURL(f),
      uploaded_at: new Date().toISOString(),
    }))
    setDocs(prev => [...newDocs, ...prev])
  }

  const card = 'bg-[#161b22] rounded-xl border border-[#2d3748] overflow-hidden'

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex-none bg-[#0d1117] border-b border-[#2d3748] px-6 pt-4 pb-0">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold text-foreground tracking-tight">Administrativo</h1>
            <p className="text-xs text-muted-foreground mt-0.5">Gestão interna da empresa</p>
          </div>
          <div className="flex items-center gap-4 text-xs text-muted-foreground">
            {[
              { label: 'Leads', v: stats.totalLeads, color: 'text-blue-400' },
              { label: 'Clientes', v: stats.totalClients, color: 'text-green-400' },
              { label: 'Vendedores', v: stats.totalSellers, color: 'text-violet-400' },
            ].map(s => (
              <div key={s.label} className="text-center">
                <p className={`text-lg font-bold ${s.color}`}>{s.v}</p>
                <p className="text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
        <DraggableTabs tabs={TABS} activeTab={tab} onTabChange={(key) => setTab(key as Tab)} sectionKey="administrativo" />
      </div>

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {/* === EQUIPE === */}
        {tab === 'equipe' && (
          <div className="space-y-4 animate-fade-in">
            <div className={card}>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-[#2d3748] bg-[#0d1117]/50">
                    {['Membro', 'E-mail', 'Cargo / Perfil', 'Acesso desde'].map(h => (
                      <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#2d3748]/60">
                  {profiles.map(p => (
                    <tr key={p.id} className="hover:bg-[#1a2133]/60 transition-colors">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary-900/40 border border-primary-800/40 flex items-center justify-center shrink-0">
                            <span className="text-xs font-bold text-primary-400">{p.name?.[0] ?? '?'}</span>
                          </div>
                          <span className="font-medium text-foreground">{p.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">{p.email ?? '—'}</td>
                      <td className="px-4 py-3">
                        <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${ROLE_COLOR[p.role] ?? 'border-[#2d3748] bg-[#1e2533] text-muted-foreground'}`}>
                          {ROLE_LABEL[p.role] ?? p.role}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground text-xs">
                        {p.created_at ? formatDate(p.created_at) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* === ATIVIDADES === */}
        {tab === 'atividades' && (
          <div className={`${card} animate-fade-in`}>
            <div className="px-4 py-3 border-b border-[#2d3748] flex items-center gap-2">
              <h3 className="text-sm font-semibold text-foreground">Log de Atividades</h3>
              <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              <span className="text-xs text-muted-foreground ml-auto">{recentActivities.length} registros</span>
            </div>
            <div className="divide-y divide-[#2d3748]/60">
              {recentActivities.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-10">Nenhuma atividade registrada.</p>
              ) : recentActivities.map(a => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#1a2133]/40 transition-colors">
                  <div className={`w-6 h-6 rounded-md flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5 ${ACT_COLOR[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>
                    {a.type[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground">{a.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {a.user_name && <><span className="text-xs text-muted-foreground">{a.user_name}</span><span className="text-muted-foreground/50 text-xs">·</span></>}
                      <span className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* === DOCUMENTOS === */}
        {tab === 'documentos' && (
          <div className="space-y-4 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">Documentos internos — NF, contratos, relatórios</p>
              <button onClick={() => fileRef.current?.click()}
                className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-glow-sm">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Upload
              </button>
              <input ref={fileRef} type="file" multiple className="hidden" onChange={handleUpload} />
            </div>

            {docs.length === 0 ? (
              <div
                onClick={() => fileRef.current?.click()}
                className="border-2 border-dashed border-[#2d3748] rounded-2xl py-20 text-center hover:border-primary-700 hover:bg-primary-900/10 transition-all cursor-pointer"
              >
                <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <p className="text-sm text-muted-foreground font-medium">Arraste ou clique para fazer upload</p>
                <p className="text-xs text-muted-foreground mt-1">PDF, DOC, XLSX, PNG, JPG...</p>
              </div>
            ) : (
              <div className={card}>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-[#2d3748] bg-[#0d1117]/50">
                      {['Arquivo', 'Tipo', 'Tamanho', 'Upload', 'Ações'].map(h => (
                        <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2d3748]/60">
                    {docs.map(d => (
                      <tr key={d.id} className="hover:bg-[#1a2133]/60 transition-colors">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <svg className="w-4 h-4 text-primary-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <span className="text-foreground font-medium truncate max-w-[200px]">{d.name}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{d.type.split('/')[1]?.toUpperCase() || '—'}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{fmtSize(d.size)}</td>
                        <td className="px-4 py-3 text-muted-foreground text-xs">{timeAgo(d.uploaded_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <a href={d.url} download={d.name}
                              className="text-xs text-primary-400 hover:text-primary-300 transition-colors">
                              Baixar
                            </a>
                            <button onClick={() => setDocs(prev => prev.filter(x => x.id !== d.id))}
                              className="text-xs text-red-400 hover:text-red-300 transition-colors">
                              Remover
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* === FINANCEIRO INTERNO === */}
        {tab === 'financeiro' && (
          <div className="space-y-5 animate-fade-in">
            <p className="text-sm text-muted-foreground">Resumo financeiro interno da empresa (separado do financeiro de clientes)</p>

            <div className="grid grid-cols-3 gap-4">
              {[
                { label: 'Entradas (MRR)',  value: '—', note: 'Sincronizar com Clientes', color: 'text-green-400', accent: 'before:bg-green-500' },
                { label: 'Saídas previstas',value: '—', note: 'Atualizar manualmente', color: 'text-red-400', accent: 'before:bg-red-500' },
                { label: 'Saldo estimado',  value: '—', note: 'Entradas - Saídas', color: 'text-primary-400', accent: 'before:bg-primary-500' },
              ].map(s => (
                <div key={s.label} className={`stat-card ${s.accent}`}>
                  <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
                  <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{s.note}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-5">
              <div className={card}>
                <div className="px-4 py-3 border-b border-[#2d3748]">
                  <h3 className="text-sm font-semibold text-foreground">Entradas</h3>
                </div>
                <div className="divide-y divide-[#2d3748]/60">
                  {INCOME_ITEMS.map(i => (
                    <div key={i.desc} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm text-foreground">{i.desc}</p>
                        <p className="text-xs text-muted-foreground">{i.note}</p>
                      </div>
                      <span className="text-sm font-semibold text-green-400 tabular-nums">
                        {i.amount > 0 ? `R$ ${i.amount.toLocaleString('pt-BR')}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              <div className={card}>
                <div className="px-4 py-3 border-b border-[#2d3748]">
                  <h3 className="text-sm font-semibold text-foreground">Saídas previstas</h3>
                </div>
                <div className="divide-y divide-[#2d3748]/60">
                  {EXPENSE_ITEMS.map(e => (
                    <div key={e.desc} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm text-foreground">{e.desc}</p>
                        {e.note && <p className="text-xs text-muted-foreground">{e.note}</p>}
                      </div>
                      <span className="text-sm font-semibold text-red-400 tabular-nums">
                        {e.amount > 0 ? `R$ ${e.amount.toLocaleString('pt-BR')}` : '—'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-[#161b22] border border-[#2d3748] rounded-xl p-4 text-center">
              <p className="text-xs text-muted-foreground">
                Esta seção será expandida com integração ao módulo Financeiro e ao Supabase em versões futuras.
              </p>
            </div>
          </div>
        )}

        {/* === CONFIGURAÇÕES === */}
        {tab === 'configuracoes' && (
          <div className="space-y-6 animate-fade-in max-w-md">
            <div>
              <h3 className="text-sm font-semibold text-foreground mb-4">Aparência</h3>
              <ThemeSelector />
            </div>

            <div className={card}>
              <div className="px-4 py-3 border-b border-[#2d3748]">
                <h3 className="text-sm font-semibold text-foreground">Informações do Sistema</h3>
              </div>
              <div className="divide-y divide-[#2d3748]/60">
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Versão</p>
                  <p className="text-sm text-foreground font-medium mt-1">PATCH 0.1</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Ambiente</p>
                  <p className="text-sm text-foreground font-medium mt-1">{process.env.NODE_ENV === 'production' ? 'Produção' : 'Desenvolvimento'}</p>
                </div>
                <div className="px-4 py-3">
                  <p className="text-xs text-muted-foreground">Data</p>
                  <p className="text-sm text-foreground font-medium mt-1">{new Date().toLocaleDateString('pt-BR')}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
