'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDate } from '@/lib/utils'

// Tipo local — não depende do Seller global que não tem cargo
interface SellerRow {
  id: string
  name: string
  email?: string
  cargo?: string
  monthly_goal?: number
  default_commission?: number
  status: 'ativo' | 'inativo'
  leads_assigned: number
  conversion_rate: number
  total_sales: number
  created_at: string
}

interface VendedorFile {
  id: string
  name: string
  url: string
  type: string
  size: number
  created_at: string
}

interface Props { currentUser: { id: string; name: string; role: string } }

function fmtSize(bytes: number): string {
  if (bytes >= 1_048_576) return `${(bytes / 1_048_576).toFixed(1)} MB`
  if (bytes >= 1_024) return `${(bytes / 1_024).toFixed(0)} KB`
  return `${bytes} B`
}

function FileIcon({ type }: { type: string }) {
  if (type.includes('pdf')) return (
    <svg className="w-5 h-5 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
  if (type.includes('sheet') || type.includes('spreadsheet')) return (
    <svg className="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
  if (type.includes('word') || type.includes('document')) return (
    <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  )
  if (type.includes('image')) return (
    <svg className="w-5 h-5 text-cyan-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  )
  return (
    <svg className="w-5 h-5 text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  )
}

export function VendedoresTab({ currentUser }: Props) {
  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState({ name: '', email: '', cargo: '', monthly_goal: '', default_commission: '' })
  const [saving, setSaving] = useState(false)
  const [files, setFiles] = useState<VendedorFile[]>([])
  const [uploading, setUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  // Aceita 'admin' ou 'administrador' (case-insensitive)
  const role = (currentUser.role ?? '').toLowerCase()
  const isAdmin = role === 'admin' || role === 'administrador'

  useEffect(() => {
    const load = async () => {
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('sellers')
          .select('id, name, email, cargo, monthly_goal, default_commission, status, leads_assigned, conversion_rate, total_sales, created_at')
          .order('name')

        if (error) {
          // Tabela não existe ou RLS bloqueia — mostra estado vazio, não trava
          console.warn('[VendedoresTab] query error:', error.message)
          setFetchError(error.code === '42P01'
            ? 'Tabela sellers não encontrada. Rode a migration 005 no Supabase.'
            : null)
          setSellers([])
        } else {
          setSellers((data ?? []) as SellerRow[])
          setFetchError(null)
        }

        // Carrega arquivos do Supabase Storage
        try {
          const { data: filesList } = await supabase
            .storage
            .from('vendedores')
            .list('', { limit: 1000 })

          if (filesList) {
            const filesWithUrls: VendedorFile[] = filesList.map(f => {
              const { data: urlData } = supabase
                .storage
                .from('vendedores')
                .getPublicUrl(f.name)
              return {
                id: f.name,
                name: f.name,
                url: urlData?.publicUrl || '',
                type: f.name.split('.').pop() || '',
                size: f.metadata?.size || 0,
                created_at: f.created_at || new Date().toISOString(),
              }
            })
            setFiles(filesWithUrls)
          }
        } catch (storageErr) {
          console.warn('[VendedoresTab] storage error:', storageErr)
        }
      } catch (err) {
        console.error('[VendedoresTab] unexpected error:', err)
        setSellers([])
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [])

  const handleAdd = async () => {
    if (!form.name.trim()) return

    const monthlyGoalNum = form.monthly_goal ? parseFloat(form.monthly_goal) : 0
    const commissionNum = form.default_commission ? parseFloat(form.default_commission) : 0

    if (form.monthly_goal && (isNaN(monthlyGoalNum) || monthlyGoalNum < 0)) {
      alert('Meta mensal deve ser um número válido e não negativo')
      return
    }

    if (form.default_commission && (isNaN(commissionNum) || commissionNum < 0 || commissionNum > 100)) {
      alert('Comissão padrão deve estar entre 0 e 100%')
      return
    }

    setSaving(true)
    try {
      const supabase = createClient()
      const { data, error } = await supabase.from('sellers').insert({
        name: form.name.trim(),
        email: form.email.trim() || null,
        cargo: form.cargo.trim() || null,
        monthly_goal: monthlyGoalNum,
        default_commission: commissionNum,
        status: 'ativo',
        total_sales: 0,
        total_commissions: 0,
        leads_assigned: 0,
        conversion_rate: 0,
      }).select('id, name, email, cargo, monthly_goal, default_commission, status, leads_assigned, conversion_rate, total_sales, created_at').single()

      if (!error && data) setSellers(prev => [...prev, data as SellerRow])
    } catch (err) {
      console.error('[VendedoresTab] insert error:', err)
    } finally {
      setForm({ name: '', email: '', cargo: '', monthly_goal: '', default_commission: '' })
      setAddOpen(false)
      setSaving(false)
    }
  }

  const handleToggle = async (id: string, current: 'ativo' | 'inativo') => {
    const next = current === 'ativo' ? 'inativo' : 'ativo'
    const supabase = createClient()
    await supabase.from('sellers').update({ status: next }).eq('id', id)
    setSellers(prev => prev.map(s => s.id === id ? { ...s, status: next } : s))
  }

  const handleFileUpload = async (fileList: FileList) => {
    if (fileList.length === 0) return

    setUploading(true)
    const supabase = createClient()

    try {
      for (const file of Array.from(fileList)) {
        const fileName = `${Date.now()}-${file.name}`
        const { error } = await supabase.storage
          .from('vendedores')
          .upload(fileName, file, { upsert: false })

        if (error) {
          console.error('[VendedoresTab] upload error:', error)
          continue
        }

        const { data: urlData } = supabase.storage
          .from('vendedores')
          .getPublicUrl(fileName)

        setFiles(prev => [...prev, {
          id: fileName,
          name: file.name,
          url: urlData?.publicUrl || '',
          type: file.type,
          size: file.size,
          created_at: new Date().toISOString(),
        }])
      }
    } catch (err) {
      console.error('[VendedoresTab] upload unexpected error:', err)
    } finally {
      setUploading(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  const handleRemoveFile = async (id: string) => {
    const supabase = createClient()
    try {
      await supabase.storage.from('vendedores').remove([id])
      setFiles(prev => prev.filter(f => f.id !== id))
    } catch (err) {
      console.error('[VendedoresTab] remove error:', err)
    }
  }

  const active   = sellers.filter(s => s.status === 'ativo').length
  const inactive = sellers.filter(s => s.status === 'inativo').length
  const inputCls = 'w-full bg-[#1e2533] border border-[#2d3748] rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600'

  return (
    <div className="p-6 space-y-5 overflow-auto h-full bg-background animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-foreground">Vendedores</h3>
          <p className="text-xs text-muted-foreground mt-0.5">{active} ativos · {inactive} inativos</p>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 bg-primary-600 hover:bg-primary-500 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-glow-sm"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            Upload
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
            className="hidden"
            onChange={e => e.target.files && handleFileUpload(e.target.files)}
            disabled={uploading}
          />

          {isAdmin && (
            <button
              onClick={() => setAddOpen(true)}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors shadow-glow-sm"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Adicionar Vendedor
            </button>
          )}
        </div>
      </div>

      {/* Error banner (only for missing table, silent otherwise) */}
      {fetchError && (
        <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 text-xs text-amber-400">
          {fetchError}
        </div>
      )}

      {/* Files Section */}
      {files.length > 0 && (
        <div className="space-y-3">
          <div>
            <h4 className="font-semibold text-foreground text-sm">Arquivos Enviados</h4>
            <p className="text-xs text-muted-foreground mt-0.5">{files.length} arquivo(s)</p>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {files.map(f => (
              <div key={f.id} className="group relative bg-[#161b22] border border-[#2d3748] rounded-xl overflow-hidden hover:border-primary-700/50 transition-all duration-200 hover:shadow-glow-sm">
                {/* Preview */}
                <div className="h-32 bg-[#0d1117] flex items-center justify-center overflow-hidden">
                  {f.type.startsWith('image/') ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={f.url} alt={f.name} className="w-full h-full object-cover" />
                  ) : (
                    <FileIcon type={f.type} />
                  )}
                </div>

                {/* Info */}
                <div className="p-2.5">
                  <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{fmtSize(f.size)}</p>
                </div>

                {/* Actions overlay */}
                <div className="absolute inset-0 bg-black/70 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    onClick={() => handleRemoveFile(f.id)}
                    className="bg-red-900/60 hover:bg-red-900 text-red-300 p-2 rounded-lg transition-colors"
                    title="Remover arquivo"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
            ))}

            {/* Add more */}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="h-full min-h-[170px] border-2 border-dashed border-[#2d3748] rounded-xl flex items-center justify-center hover:border-primary-700 hover:bg-primary-900/10 transition-all text-muted-foreground hover:text-primary-400 disabled:opacity-50"
            >
              {uploading ? (
                <span className="w-5 h-5 border-2 border-muted-foreground/20 border-t-primary-500 rounded-full animate-spin" />
              ) : (
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M12 4v16m8-8H4" />
                </svg>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Table */}
      <div className="bg-[#161b22] rounded-xl border border-[#2d3748] overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center gap-3 py-16 text-muted-foreground text-sm">
            <span className="w-5 h-5 border-2 border-muted-foreground/20 border-t-primary-500 rounded-full animate-spin" />
            Carregando...
          </div>
        ) : sellers.length === 0 ? (
          <div className="py-16 text-center">
            <svg className="w-10 h-10 mx-auto mb-3 text-muted-foreground/20" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <p className="text-sm text-muted-foreground font-medium">Nenhum vendedor cadastrado</p>
            {isAdmin && (
              <p className="text-xs text-muted-foreground/60 mt-1">
                Clique em &quot;Adicionar Vendedor&quot; para começar
              </p>
            )}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-[#0d1117]/50 border-b border-[#2d3748]">
                {['Vendedor', 'E-mail', 'Cargo', 'Meta', 'Comissão %', 'Leads', 'Conv.', 'Desde', 'Status', 'Ações'].map(h => (
                  <th key={h} className={`text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide ${
                    ['Meta', 'Comissão %', 'Leads', 'Conv.'].includes(h) ? 'text-right' : 'text-left'
                  }`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/60">
              {sellers.map(s => (
                <tr key={s.id} className={`hover:bg-[#1a2133]/60 transition-colors ${s.status === 'inativo' ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-900/40 border border-primary-800/40 flex items-center justify-center flex-none">
                        <span className="text-xs font-bold text-primary-400">{s.name[0]}</span>
                      </div>
                      <span className="font-semibold text-foreground">{s.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{s.cargo ?? '—'}</td>
                  <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">
                    {s.monthly_goal ? `R$ ${(s.monthly_goal).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '—'}
                  </td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {s.default_commission ?? 0}%
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-foreground tabular-nums">{s.leads_assigned}</td>
                  <td className="px-4 py-3 text-right text-muted-foreground tabular-nums">
                    {(s.conversion_rate * 100).toFixed(1)}%
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {s.created_at ? formatDate(s.created_at) : '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-1 rounded-full border font-medium ${
                      s.status === 'ativo'
                        ? 'bg-emerald-900/30 text-emerald-400 border-emerald-800/50'
                        : 'bg-slate-800/40 text-slate-400 border-slate-700/50'
                    }`}>
                      {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {isAdmin && (
                      <button
                        onClick={() => handleToggle(s.id, s.status)}
                        className="text-xs text-muted-foreground hover:text-foreground underline underline-offset-2 transition-colors"
                      >
                        {s.status === 'ativo' ? 'Desativar' : 'Ativar'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal overlay — abre apenas para admin */}
      {addOpen && isAdmin && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-[#161b22] border border-[#2d3748] rounded-2xl shadow-card-hover w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-[#2d3748]">
              <h2 className="font-bold text-foreground text-base">Adicionar Vendedor</h2>
              <button
                onClick={() => { setAddOpen(false); setForm({ name: '', email: '', cargo: '', monthly_goal: '', default_commission: '' }) }}
                className="text-muted-foreground hover:text-foreground transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-5 space-y-4">
              {[
                { key: 'name',  label: 'Nome *',         type: 'text',  ph: 'Nome completo' },
                { key: 'email', label: 'E-mail',         type: 'email', ph: 'email@exemplo.com' },
                { key: 'cargo', label: 'Cargo / Perfil', type: 'text',  ph: 'Ex: SDR, Closer, Account...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">{f.label}</label>
                  <input
                    type={f.type}
                    value={form[f.key as keyof typeof form]}
                    onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                    className={inputCls}
                    placeholder={f.ph}
                  />
                </div>
              ))}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Meta Mensal (R$)</label>
                  <input
                    type="number"
                    value={form.monthly_goal}
                    onChange={e => setForm(p => ({ ...p, monthly_goal: e.target.value }))}
                    className={inputCls}
                    placeholder="0,00"
                    min="0"
                    step="100"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-muted-foreground mb-1.5">Comissão % </label>
                  <input
                    type="number"
                    value={form.default_commission}
                    onChange={e => setForm(p => ({ ...p, default_commission: e.target.value }))}
                    className={inputCls}
                    placeholder="0,00"
                    min="0"
                    max="100"
                    step="0.1"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <button
                  onClick={() => { setAddOpen(false); setForm({ name: '', email: '', cargo: '', monthly_goal: '', default_commission: '' }) }}
                  className="flex-1 border border-[#2d3748] text-muted-foreground py-2.5 rounded-lg text-sm hover:bg-[#1e2533] transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleAdd}
                  disabled={saving || !form.name.trim()}
                  className="flex-1 bg-primary-600 text-white py-2.5 rounded-lg text-sm font-semibold hover:bg-primary-500 transition-colors disabled:opacity-50 shadow-glow-sm"
                >
                  {saving ? 'Salvando...' : 'Adicionar'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
