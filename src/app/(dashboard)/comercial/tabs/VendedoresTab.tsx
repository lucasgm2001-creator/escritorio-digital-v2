'use client'

import { useState, useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/components/ui/toast'
import { useSave } from '@/lib/useSave'
import { cn, formatDate } from '@/lib/utils'
import { CommissionSection } from './CommissionSection'

interface SellerRow {
  id: string
  name: string
  email?: string
  phone?: string
  photo_url?: string | null
  cargo?: string
  monthly_goal?: number
  default_commission?: number
  fixed_salary?: number
  start_date?: string
  observations?: string
  status: 'ativo' | 'inativo'
  leads_assigned: number
  conversion_rate: number
  total_sales: number
  created_at: string
}

interface Commission {
  id: string
  seller_id: string
  seller_name?: string
  lead_id?: string
  lead_name?: string
  description?: string
  amount: number
  percentage: number
  status: 'pendente' | 'aprovada' | 'paga'
  due_date?: string
  paid_at?: string
  created_at: string
}

const SELLER_COLS = 'id, name, email, phone, photo_url, cargo, monthly_goal, default_commission, fixed_salary, start_date, observations, status, leads_assigned, conversion_rate, total_sales, created_at'

const fmtK = (v: number) => v >= 1000 ? `R$ ${(v / 1000).toFixed(1)}k` : `R$ ${v.toFixed(0)}`
const monthKey = (iso?: string) => { const d = iso ? new Date(iso) : new Date(); return `${d.getFullYear()}-${d.getMonth()}` }

const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime'

// Comprime a imagem (≤150kb) antes de subir — mesmo padrão do avatar do Perfil.
async function resizeImage(file: File, maxKb = 150): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const MAX = 400
      if (width > MAX || height > MAX) { const r = Math.min(MAX / width, MAX / height); width = Math.round(width * r); height = Math.round(height * r) }
      canvas.width = width; canvas.height = height
      canvas.getContext('2d')!.drawImage(img, 0, 0, width, height)
      const tryQ = (q: number) => canvas.toBlob(b => {
        if (!b) { reject(new Error('Falha ao converter')); return }
        if (b.size > maxKb * 1024 && q > 0.3) tryQ(q - 0.1); else resolve(b)
      }, 'image/jpeg', q)
      tryQ(0.85)
    }
    img.onerror = reject
    img.src = url
  })
}

async function uploadSellerPhoto(sellerId: string, file: File): Promise<string> {
  const supabase = createClient()
  const blob = await resizeImage(file)
  const path = `sellers/${sellerId}.jpg`
  const { error } = await supabase.storage.from('assets').upload(path, blob, { contentType: 'image/jpeg', upsert: true, cacheControl: '60' })
  if (error) throw error
  const { data: { publicUrl } } = supabase.storage.from('assets').getPublicUrl(path)
  return `${publicUrl}?t=${Date.now()}`
}

function Avatar({ name, photoUrl, size = 'md' }: { name: string; photoUrl?: string | null; size?: 'md' | 'lg' }) {
  const dim = size === 'lg' ? 'w-14 h-14 text-xl rounded-2xl' : 'w-10 h-10 text-sm rounded-xl'
  if (photoUrl) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} className={cn('object-cover border border-bento-border flex-none', dim)} />
  }
  return (
    <div className={cn('bg-lime/15 border border-lime/30 flex items-center justify-center flex-none', dim)}>
      <span className="font-bold text-lime-fg">{name[0]?.toUpperCase() ?? '?'}</span>
    </div>
  )
}

// ─── Painel lateral do vendedor ───────────────────────────────────────────────

type Section = 'dados' | 'remuneracao' | 'comissao'

function SellerProfile({ seller, onClose, onUpdated, onDeleted }: {
  seller: SellerRow
  onClose: () => void
  onUpdated: (s: SellerRow) => void
  onDeleted: (id: string) => void
}) {
  const { toast } = useToast()
  const save = useSave()
  const supabase = createClient()
  const photoRef = useRef<HTMLInputElement>(null)

  const [section, setSection] = useState<Section>('dados')
  const [current, setCurrent] = useState<SellerRow>(seller)
  const [commissions, setCommissions] = useState<Commission[]>([])
  const [uploading, setUploading] = useState(false)

  // Form Metas & Remuneração (salário fixo + metas juntos)
  const [rem, setRem] = useState({
    fixed_salary: seller.fixed_salary?.toString() ?? '',
    monthly_goal: seller.monthly_goal?.toString() ?? '',
    start_date: seller.start_date?.split('T')[0] ?? '',
    observations: seller.observations ?? '',
  })
  const [savingRem, setSavingRem] = useState(false)
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

  // Comissões antigas (modelo genérico) — usadas só nos KPIs do topo do painel.
  useEffect(() => {
    supabase.from('commissions').select('*').eq('seller_id', seller.id).order('created_at', { ascending: false })
      .then(({ data }) => setCommissions(data ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seller.id])

  const totalPaid    = commissions.filter(c => c.status === 'paga').reduce((s, c) => s + c.amount, 0)
  const totalPending = commissions.filter(c => c.status === 'pendente').reduce((s, c) => s + c.amount, 0)

  const handlePhoto = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast({ type: 'error', message: 'Selecione uma imagem válida.' }); return }
    setUploading(true)
    try {
      const photo_url = await uploadSellerPhoto(seller.id, file)
      const { error } = await supabase.from('sellers').update({ photo_url }).eq('id', seller.id)
      if (error) { toast({ type: 'error', message: `Falha ao salvar a foto: ${error.message}` }); return }
      const updated = { ...current, photo_url }
      setCurrent(updated); onUpdated(updated)
      toast({ type: 'success', message: 'Foto atualizada.' })
    } catch {
      toast({ type: 'error', message: 'Erro ao enviar a foto. Confira o bucket "assets".' })
    } finally {
      setUploading(false)
      if (photoRef.current) photoRef.current.value = ''
    }
  }

  const saveRemuneracao = async () => {
    setSavingRem(true)
    const patch = {
      fixed_salary: parseFloat(rem.fixed_salary) || 0,
      monthly_goal: parseFloat(rem.monthly_goal) || 0,
      start_date: rem.start_date || null,
      observations: rem.observations || null,
    }
    const prev = current
    const u: SellerRow = {
      ...current,
      fixed_salary: patch.fixed_salary,
      monthly_goal: patch.monthly_goal,
      start_date: rem.start_date || undefined,
      observations: rem.observations || undefined,
    }
    await save({
      optimistic: () => { setCurrent(u); onUpdated(u) },
      run: () => supabase.from('sellers').update(patch).eq('id', seller.id),
      rollback: () => { setCurrent(prev); onUpdated(prev) },
      success: 'Remuneração & metas salvas.',
      error: 'Não foi possível salvar',
    })
    setSavingRem(false)
  }

  const toggleStatus = async () => {
    const next = current.status === 'ativo' ? 'inativo' : 'ativo'
    const prev = current
    await save({
      optimistic: () => { const u = { ...current, status: next as 'ativo' | 'inativo' }; setCurrent(u); onUpdated(u) },
      run: () => supabase.from('sellers').update({ status: next }).eq('id', seller.id),
      rollback: () => { setCurrent(prev); onUpdated(prev) },
      error: 'Não foi possível mudar o status',
    })
  }

  const handleDelete = async () => {
    setDeleting(true)
    const { error } = await supabase.from('sellers').delete().eq('id', seller.id)
    if (error) {
      const msg = error.code === '23503'
        ? 'Não é possível excluir: este vendedor tem vendas/comissões registradas. Desative-o em vez de excluir.'
        : `Não foi possível excluir o vendedor: ${error.message}`
      toast({ type: 'error', message: msg })
      setDeleting(false)
      return
    }
    toast({ type: 'success', message: 'Vendedor excluído.' })
    onDeleted(seller.id)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="w-full max-w-md bg-bento-panel border-l border-bento-border flex flex-col shadow-card-hover animate-slide-up">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 p-5 border-b border-bento-border shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative">
              <Avatar name={current.name} photoUrl={current.photo_url} size="lg" />
              <button onClick={() => photoRef.current?.click()} disabled={uploading}
                className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-lime text-lime-ink flex items-center justify-center border-2 border-bento-panel disabled:opacity-50"
                aria-label="Trocar foto">
                {uploading
                  ? <span className="w-3 h-3 border-2 border-lime-ink/40 border-t-lime-ink rounded-full animate-spin" />
                  : <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z M15 13a3 3 0 11-6 0 3 3 0 016 0z" /></svg>}
              </button>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
            </div>
            <div className="min-w-0">
              <h2 className="font-bold text-bento-text truncate">{current.name}</h2>
              <p className="text-xs text-bento-muted truncate">{current.cargo ?? current.email ?? '—'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-bento-muted hover:text-bento-text p-1 shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
          </button>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-2 px-5 py-4 border-b border-bento-border shrink-0">
          <div><p className="text-[10px] text-bento-muted">Vendas</p><p className="text-sm font-bold text-bento-text tabular-nums">{fmtK(current.total_sales)}</p></div>
          <div><p className="text-[10px] text-bento-muted">Comissão</p><p className="text-sm font-bold text-lime-fg tabular-nums">{fmtK(totalPaid)}</p><p className="text-[9px] text-amber-400 tabular-nums">+{fmtK(totalPending)} pend.</p></div>
          <div><p className="text-[10px] text-bento-muted">Conversão</p><p className="text-sm font-bold text-bento-text tabular-nums">{(current.conversion_rate * 100).toFixed(1)}%</p></div>
        </div>

        {/* Section tabs */}
        <div className="flex gap-1 px-5 pt-3 border-b border-bento-border shrink-0 overflow-x-auto">
          {([['dados', 'Dados'], ['remuneracao', 'Metas & Remuneração'], ['comissao', 'Comissão']] as const).map(([k, label]) => (
            <button key={k} onClick={() => setSection(k)}
              className={cn('px-2.5 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap',
                section === k ? 'border-lime text-lime-fg' : 'border-transparent text-bento-muted hover:text-bento-text')}>
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Dados */}
          {section === 'dados' && (
            <div className="space-y-3">
              {[
                { label: 'E-mail', value: current.email ?? '—' },
                { label: 'Telefone', value: current.phone ?? '—' },
                { label: 'Cargo', value: current.cargo ?? '—' },
                { label: 'Desde', value: current.created_at ? formatDate(current.created_at) : '—' },
                { label: 'Leads atribuídos', value: String(current.leads_assigned) },
              ].map(r => (
                <div key={r.label} className="flex items-center justify-between py-2 border-b border-bento-border/40 last:border-0">
                  <span className="text-xs text-bento-muted">{r.label}</span>
                  <span className="text-sm text-bento-text font-medium">{r.value}</span>
                </div>
              ))}
              <button onClick={toggleStatus}
                className={cn('w-full mt-2 py-2.5 rounded-btn text-sm font-semibold border transition-colors min-h-[44px]',
                  current.status === 'ativo'
                    ? 'border-bento-border text-bento-dim hover:border-red-400/50 hover:text-red-400'
                    : 'bento-btn')}>
                {current.status === 'ativo' ? 'Desativar vendedor' : 'Ativar vendedor'}
              </button>
              {confirmingDelete ? (
                <div className="space-y-2 mt-2">
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
                  className="w-full mt-2 py-2.5 rounded-btn text-sm font-semibold border border-bento-border text-bento-dim hover:border-red-400/50 hover:text-red-400 transition-colors min-h-[44px]">
                  Excluir vendedor
                </button>
              )}
            </div>
          )}

          {/* Metas & Remuneração */}
          {section === 'remuneracao' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-bento-dim mb-1.5">Meta mensal (R$)</label>
                  <input type="number" value={rem.monthly_goal} onChange={e => setRem(p => ({ ...p, monthly_goal: e.target.value }))} className={inputCls} placeholder="0,00" min="0" step="100" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-bento-dim mb-1.5">Salário fixo (R$)</label>
                  <input type="number" value={rem.fixed_salary} onChange={e => setRem(p => ({ ...p, fixed_salary: e.target.value }))} className={inputCls} placeholder="0,00" min="0" step="100" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1.5">Data de início</label>
                <input type="date" value={rem.start_date} onChange={e => setRem(p => ({ ...p, start_date: e.target.value }))} className={inputCls} />
              </div>
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1.5">Observações</label>
                <textarea value={rem.observations} onChange={e => setRem(p => ({ ...p, observations: e.target.value }))} className={`${inputCls} resize-none`} rows={3} placeholder="Ex: revisão em junho, vale refeição incluso..." />
              </div>
              <button onClick={saveRemuneracao} disabled={savingRem} className="w-full bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
                {savingRem ? 'Salvando...' : 'Salvar metas & remuneração'}
              </button>
            </div>
          )}

          {/* Comissão (módulo novo — bloco 1: config + resumo do mês) */}
          {section === 'comissao' && <CommissionSection sellerId={seller.id} sellerName={current.name} />}
        </div>
      </div>
    </div>
  )
}

// ─── Aba Vendedores ───────────────────────────────────────────────────────────

export function VendedoresTab() {
  const { toast } = useToast()
  const save = useSave()
  const supabase = createClient()

  const [sellers, setSellers] = useState<SellerRow[]>([])
  const [comByMonth, setComByMonth] = useState<Map<string, number>>(new Map())   // seller_id → comissão do mês
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [selected, setSelected] = useState<SellerRow | null>(null)

  const emptyForm = { name: '', email: '', telefone: '', cargo: '', monthly_goal: '' }
  const [form, setForm] = useState(emptyForm)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const addPhotoRef = useRef<HTMLInputElement>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      const [sRes, cRes] = await Promise.all([
        supabase.from('sellers').select(SELLER_COLS).order('name'),
        supabase.from('commissions').select('seller_id, amount, created_at'),
      ])
      if (sRes.error) {
        setFetchError(sRes.error.code === '42P01'
          ? 'Tabela sellers não encontrada. Rode a migration 005 no Supabase.'
          : `Erro ao carregar vendedores: ${sRes.error.message}`)
        setSellers([])
      } else {
        setSellers((sRes.data ?? []) as SellerRow[])
        setFetchError(null)
        const mk = monthKey()
        const map = new Map<string, number>()
        for (const c of (cRes.data ?? []) as Commission[]) {
          if (monthKey(c.created_at) === mk) map.set(c.seller_id, (map.get(c.seller_id) ?? 0) + (c.amount || 0))
        }
        setComByMonth(map)
      }
      setLoading(false)
    }
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const closeAdd = () => { setAddOpen(false); setForm(emptyForm); setPhotoFile(null); setPhotoPreview(null) }

  const pickAddPhoto = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast({ type: 'error', message: 'Selecione uma imagem válida.' }); return }
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  const handleAdd = async () => {
    if (!form.name.trim()) return
    const goal = form.monthly_goal ? parseFloat(form.monthly_goal) : 0
    if (form.monthly_goal && (isNaN(goal) || goal < 0)) { toast({ type: 'error', message: 'Meta mensal inválida' }); return }

    setSaving(true)
    const { ok, data } = await save<SellerRow>({
      run: () => supabase.from('sellers').insert({
        name: form.name.trim(), email: form.email.trim() || null, phone: form.telefone.trim() || null,
        cargo: form.cargo.trim() || null, monthly_goal: goal,
        status: 'ativo', total_sales: 0, total_commissions: 0, leads_assigned: 0, conversion_rate: 0,
      }).select(SELLER_COLS).single(),
      success: 'Vendedor criado.',
      error: 'Não foi possível criar o vendedor',
    })

    if (ok && data) {
      let created = data
      // Foto (se escolhida): sobe agora que já temos o id.
      if (photoFile) {
        try {
          const photo_url = await uploadSellerPhoto(created.id, photoFile)
          await supabase.from('sellers').update({ photo_url }).eq('id', created.id)
          created = { ...created, photo_url }
        } catch {
          toast({ type: 'error', message: 'Vendedor criado, mas a foto falhou ao subir.' })
        }
      }
      setSellers(prev => [...prev, created])
      closeAdd()
    }
    setSaving(false)
  }

  const active   = sellers.filter(s => s.status === 'ativo').length
  const inactive = sellers.filter(s => s.status === 'inativo').length

  return (
    <div className="p-4 sm:p-6 space-y-5 overflow-auto h-full bg-bento-bg animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="font-display font-bold text-bento-text">Vendedores</h3>
          <p className="text-xs text-bento-muted mt-0.5">{active} ativos · {inactive} inativos</p>
        </div>
        <button onClick={() => setAddOpen(true)} className="flex items-center gap-2 bento-btn px-4 py-2 rounded-btn text-sm font-semibold min-h-[44px]">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
          Novo Vendedor
        </button>
      </div>

      {fetchError && <div className="bg-amber-900/20 border border-amber-800/40 rounded-btn px-4 py-3 text-xs text-amber-400">{fetchError}</div>}

      {/* Cards clicáveis */}
      {loading ? (
        <div className="flex items-center justify-center gap-3 py-16 text-bento-muted text-sm"><span className="w-5 h-5 border-2 border-bento-muted/20 border-t-lime rounded-full animate-spin" />Carregando...</div>
      ) : sellers.length === 0 ? (
        <div className="bento-fx py-16 text-center">
          <svg className="w-10 h-10 mx-auto mb-3 text-bento-muted/30" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
          <p className="text-sm text-bento-muted font-medium">Nenhum vendedor cadastrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {sellers.map(s => (
            <button key={s.id} onClick={() => setSelected(s)}
              className={cn('bento-fx p-4 text-left hover:border-lime/50 transition-colors', s.status === 'inativo' && 'opacity-50')}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar name={s.name} photoUrl={s.photo_url} />
                  <div className="min-w-0">
                    <p className="font-semibold text-bento-text text-sm truncate">{s.name}</p>
                    <p className="text-xs text-bento-muted truncate">{s.cargo ?? s.email ?? '—'}</p>
                  </div>
                </div>
                <span className={cn('text-[11px] px-2 py-1 rounded-full border font-medium flex-none',
                  s.status === 'ativo' ? 'bg-lime/15 text-lime-fg border-lime/30' : 'bg-slate-800/40 text-slate-400 border-slate-700/50')}>
                  {s.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-center">
                <div className="bg-bento-bg rounded-btn p-2 border border-bento-border/60">
                  <p className="text-[10px] text-bento-muted">Vendas</p>
                  <p className="text-sm font-bold text-bento-text mt-0.5 tabular-nums">{fmtK(s.total_sales)}</p>
                </div>
                <div className="bg-bento-bg rounded-btn p-2 border border-bento-border/60">
                  <p className="text-[10px] text-bento-muted">Comissão do mês</p>
                  <p className="text-sm font-bold text-lime-fg mt-0.5 tabular-nums">{fmtK(comByMonth.get(s.id) ?? 0)}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Novo Vendedor */}
      {addOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-sm max-h-[92vh] flex flex-col animate-slide-up">
            <div className="flex items-center justify-between p-5 border-b border-bento-border shrink-0">
              <h2 className="font-display font-bold text-bento-text text-base">Novo Vendedor</h2>
              <button onClick={closeAdd} className="text-bento-muted hover:text-bento-text">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <div className="p-5 space-y-4 overflow-y-auto">
              {/* Foto */}
              <div className="flex items-center gap-3">
                {photoPreview
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={photoPreview} alt="" className="w-14 h-14 rounded-2xl object-cover border border-bento-border" />
                  : <div className="w-14 h-14 rounded-2xl bg-bento-bg border border-bento-border flex items-center justify-center text-bento-muted"><svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg></div>}
                <div>
                  <button type="button" onClick={() => addPhotoRef.current?.click()} className="text-xs px-3 py-1.5 rounded-btn border border-bento-border text-bento-dim hover:border-lime transition-colors">
                    {photoFile ? 'Trocar foto' : 'Adicionar foto'}
                  </button>
                  <p className="text-[10px] text-bento-muted mt-1">JPG/PNG, otimizada p/ ≤150kb.</p>
                  <input ref={addPhotoRef} type="file" accept="image/*" className="hidden" onChange={pickAddPhoto} />
                </div>
              </div>

              {[
                { key: 'name', label: 'Nome *', type: 'text', ph: 'Nome completo' },
                { key: 'email', label: 'E-mail', type: 'email', ph: 'email@exemplo.com' },
                { key: 'telefone', label: 'Telefone', type: 'tel', ph: '(11) 99999-9999' },
                { key: 'cargo', label: 'Cargo', type: 'text', ph: 'Ex: SDR, Closer...' },
              ].map(f => (
                <div key={f.key}>
                  <label className="block text-xs font-medium text-bento-dim mb-1.5">{f.label}</label>
                  <input type={f.type} value={form[f.key as keyof typeof form]} onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} className={inputCls} placeholder={f.ph} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-bento-dim mb-1.5">Meta mensal (R$)</label>
                <input type="number" value={form.monthly_goal} onChange={e => setForm(p => ({ ...p, monthly_goal: e.target.value }))} className={inputCls} placeholder="0,00" min="0" step="100" />
              </div>
              <div className="flex gap-3 pt-1">
                <button onClick={closeAdd} className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime transition-colors min-h-[44px]">Cancelar</button>
                <button onClick={handleAdd} disabled={saving || !form.name.trim()} className="flex-1 bento-btn py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">{saving ? 'Salvando...' : 'Adicionar'}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Painel do vendedor */}
      {selected && (
        <SellerProfile
          seller={selected}
          onClose={() => setSelected(null)}
          onUpdated={u => { setSellers(prev => prev.map(s => s.id === u.id ? u : s)); setSelected(u) }}
          onDeleted={id => { setSellers(prev => prev.filter(s => s.id !== id)); setSelected(null) }}
        />
      )}
    </div>
  )
}
