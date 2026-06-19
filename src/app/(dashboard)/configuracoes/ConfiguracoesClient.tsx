'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import {
  Sun, Moon, Monitor, Home, Briefcase, ListChecks, Projector, Users,
  Palette, Accessibility, Image as ImageIcon, User, LayoutGrid, Database, Plug, Info,
  Download, RefreshCw, ExternalLink, BadgePercent,
  type LucideIcon,
} from 'lucide-react'
import { Panel } from '@/components/bento/Panel'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { ymd, usd } from '@/lib/format'
import { SYSTEM_LOGO_BUCKET, SYSTEM_LOGO_PATH } from '@/lib/logo'
import { isDarkByTime, getDarkHours, DEFAULT_DARK_START, DEFAULT_DARK_END } from '@/lib/theme'
import { loadA11y, saveA11y, applyA11y, DEFAULT_A11Y, type A11ySettings, type FontScale } from '@/lib/a11y'
import { loadDensity, saveDensity, applyDensity, type Density } from '@/lib/uiPrefs'
import { weeklyCommissionUsd, hasCommissionPct, DEFAULT_TETO_SEMANAS, LEGACY_VPS_USD } from '@/lib/commission/planCommission'

// classes compartilhadas
const inputCls = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime min-h-[44px]'
const actionBtnCls = 'flex items-center justify-center gap-2 bg-bento-bg border border-bento-border text-bento-text px-4 py-2 rounded-btn text-sm hover:border-lime transition-colors disabled:opacity-50 min-h-[44px]'

type Theme = 'light' | 'dark' | 'auto'
interface NavItem { key: string; label: string; Icon: LucideIcon }

// ─── SISTEMA › Tema (claro/escuro/auto + horários da virada, client/localStorage) ───
function ThemeSection() {
  const [theme, setTheme] = useState<Theme>('auto')
  const [start, setStart] = useState(DEFAULT_DARK_START)
  const [end, setEnd] = useState(DEFAULT_DARK_END)
  const [mounted, setMounted] = useState(false)

  const apply = useCallback((t: Theme) => {
    const html = document.documentElement
    const dark = t === 'dark' || (t === 'auto' && isDarkByTime())
    if (dark) { html.style.colorScheme = 'dark'; html.classList.add('dark'); html.classList.remove('light') }
    else { html.style.colorScheme = 'light'; html.classList.add('light'); html.classList.remove('dark') }
  }, [])

  useEffect(() => {
    setMounted(true)
    try { const t = localStorage.getItem('theme') as Theme | null; if (t) setTheme(t) } catch { /* ignore */ }
    const h = getDarkHours(); setStart(h.start); setEnd(h.end)
  }, [])

  const choose = (t: Theme) => {
    setTheme(t)
    try { localStorage.setItem('theme', t) } catch { /* ignore */ }
    apply(t)
  }
  const saveHours = (ns: number, ne: number) => {
    setStart(ns); setEnd(ne)
    try { localStorage.setItem('theme_dark_start', String(ns)); localStorage.setItem('theme_dark_end', String(ne)) } catch { /* ignore */ }
    apply(theme)
  }
  if (!mounted) return null

  const opts: { id: Theme; label: string; Icon: LucideIcon }[] = [
    { id: 'light', label: 'Claro', Icon: Sun }, { id: 'dark', label: 'Escuro', Icon: Moon }, { id: 'auto', label: 'Auto', Icon: Monitor },
  ]
  const hourOpts = Array.from({ length: 24 }, (_, i) => i)
  const selCls = 'mt-1 block bg-bento-bg border border-bento-border rounded-btn px-2 py-1.5 text-sm text-bento-text focus:outline-none focus:border-lime'

  return (
    <Panel label="Tema">
      <div className="space-y-4">
        <div className="flex gap-2">
          {opts.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => choose(id)}
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-btn border text-sm min-h-[44px]',
                theme === id ? 'bento-btn border-transparent' : 'bg-bento-bg border-bento-border text-bento-dim hover:border-lime transition-colors')}>
              <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} /><span className="font-medium">{label}</span>
            </button>
          ))}
        </div>
        {theme === 'auto' && (
          <div className="border-t border-bento-border/60 pt-4">
            <p className="text-sm font-medium text-bento-text">Virada automática</p>
            <p className="text-xs text-bento-muted mt-0.5 mb-3">
              Escuro das <span className="font-tech text-bento-text">{String(start).padStart(2, '0')}h</span> às <span className="font-tech text-bento-text">{String(end).padStart(2, '0')}h</span>.
            </p>
            <div className="flex flex-wrap gap-4">
              <label className="text-xs text-bento-muted">Início (vira escuro)
                <select value={start} onChange={e => saveHours(Number(e.target.value), end)} className={selCls}>
                  {hourOpts.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
                </select>
              </label>
              <label className="text-xs text-bento-muted">Fim (vira claro)
                <select value={end} onChange={e => saveHours(start, Number(e.target.value))} className={selCls}>
                  {hourOpts.map(h => <option key={h} value={h}>{String(h).padStart(2, '0')}h</option>)}
                </select>
              </label>
            </div>
          </div>
        )}
      </div>
    </Panel>
  )
}

// ─── SISTEMA › Acessibilidade (client/localStorage, classes no <html>) ───
function ToggleRow({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="text-sm font-medium text-bento-text">{label}</p>
        <p className="text-xs text-bento-muted mt-0.5">{desc}</p>
      </div>
      <button type="button" role="switch" aria-checked={on} onClick={onClick}
        className={cn('px-3 py-1.5 rounded-btn text-xs font-semibold border min-h-[36px] flex-none',
          on ? 'bento-btn border-transparent' : 'bg-bento-bg border-bento-border text-bento-dim hover:border-lime transition-colors')}>
        {on ? 'Ativado' : 'Desativado'}
      </button>
    </div>
  )
}

function AccessibilitySection() {
  const [s, setS] = useState<A11ySettings>(DEFAULT_A11Y)
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); const v = loadA11y(); setS(v); applyA11y(v) }, [])
  const update = (patch: Partial<A11ySettings>) => { const next = { ...s, ...patch }; setS(next); saveA11y(next); applyA11y(next) }
  if (!mounted) return null

  const fonts: { id: FontScale; label: string }[] = [{ id: 'normal', label: 'Normal' }, { id: 'grande', label: 'Grande' }, { id: 'maior', label: 'Maior' }]
  return (
    <Panel label="Acessibilidade">
      <div className="space-y-4">
        <div>
          <p className="text-sm font-medium text-bento-text mb-2">Tamanho da fonte</p>
          <div className="flex gap-2">
            {fonts.map(f => (
              <button key={f.id} onClick={() => update({ font: f.id })}
                className={cn('px-3 py-2 rounded-btn border text-sm min-h-[44px]',
                  s.font === f.id ? 'bento-btn border-transparent' : 'bg-bento-bg border-bento-border text-bento-dim hover:border-lime transition-colors')}>
                {f.label}
              </button>
            ))}
          </div>
        </div>
        <div className="divide-y divide-bento-border/60 border-t border-bento-border/60 pt-1">
          <ToggleRow label="Alto contraste" desc="Aumenta o contraste de textos e bordas." on={s.contrast} onClick={() => update({ contrast: !s.contrast })} />
          <ToggleRow label="Mais espaçamento" desc="Aumenta o respiro entre as linhas." on={s.spacing} onClick={() => update({ spacing: !s.spacing })} />
          <ToggleRow label="Reduzir movimento" desc="Desliga animações e transições." on={s.reduceMotion} onClick={() => update({ reduceMotion: !s.reduceMotion })} />
        </div>
      </div>
    </Panel>
  )
}

function AboutSection() {
  return (
    <Panel label="Sobre">
      <div className="space-y-1">
        <p className="text-sm font-medium text-bento-text">Escritório Digital v2</p>
        <p className="font-tech text-xs text-bento-muted">DR Growth · {new Date().getFullYear()}</p>
        <p className="font-tech text-xs text-bento-muted">Idioma: Português (Brasil)</p>
      </div>
    </Panel>
  )
}

// ─── SISTEMA › Conta (e-mail + trocar senha via Supabase Auth; perfil fica em /perfil) ───
function ContaSection() {
  const supabase = createClient()
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<{ t: 'ok' | 'err'; m: string } | null>(null)

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? '')) }, [supabase])

  const trocarSenha = async () => {
    setMsg(null)
    if (pw.length < 6) { setMsg({ t: 'err', m: 'A senha precisa de ao menos 6 caracteres.' }); return }
    if (pw !== pw2) { setMsg({ t: 'err', m: 'As senhas não conferem.' }); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password: pw })
    setBusy(false)
    if (error) setMsg({ t: 'err', m: `Não foi possível alterar: ${error.message}` })
    else { setMsg({ t: 'ok', m: 'Senha alterada com sucesso.' }); setPw(''); setPw2('') }
  }

  return (
    <Panel label="Conta">
      <div className="space-y-5">
        <div>
          <p className="font-tech text-[10px] uppercase tracking-wide text-bento-muted">E-mail</p>
          <p className="text-sm text-bento-text mt-0.5">{email || '—'}</p>
        </div>
        <div className="border-t border-bento-border/60 pt-4 space-y-2 max-w-sm">
          <p className="text-sm font-medium text-bento-text">Alterar senha</p>
          <input type="password" value={pw} onChange={e => setPw(e.target.value)} placeholder="Nova senha" autoComplete="new-password" className={inputCls} />
          <input type="password" value={pw2} onChange={e => setPw2(e.target.value)} placeholder="Confirmar nova senha" autoComplete="new-password" className={inputCls} />
          <button onClick={trocarSenha} disabled={busy || !pw} className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
            {busy ? 'Salvando...' : 'Salvar senha'}
          </button>
          {msg && <p className={cn('text-xs', msg.t === 'ok' ? 'text-green-400' : 'text-red-400')}>{msg.m}</p>}
        </div>
        <div className="border-t border-bento-border/60 pt-4">
          <a href="/perfil" className="inline-flex items-center gap-1.5 text-sm text-lime-fg hover:underline">Editar nome e foto no Perfil <ExternalLink className="w-3.5 h-3.5" /></a>
        </div>
      </div>
    </Panel>
  )
}

// ─── SISTEMA › Aparência (densidade — pref visual cliente, classe no <html>) ───
function AparenciaSection() {
  const [d, setD] = useState<Density>('confortavel')
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true); const v = loadDensity(); setD(v); applyDensity(v) }, [])
  const choose = (v: Density) => { setD(v); saveDensity(v); applyDensity(v) }
  if (!mounted) return null

  const opts: { id: Density; label: string; desc: string }[] = [
    { id: 'confortavel', label: 'Confortável', desc: 'Espaçamento padrão.' },
    { id: 'compact', label: 'Compacto', desc: 'Menos respiro; mostra mais na tela.' },
  ]
  return (
    <Panel label="Aparência">
      <div className="space-y-3">
        <p className="text-sm font-medium text-bento-text">Densidade</p>
        <div className="flex flex-col sm:flex-row gap-2">
          {opts.map(o => (
            <button key={o.id} onClick={() => choose(o.id)}
              className={cn('flex-1 px-3 py-2.5 rounded-btn border text-left min-h-[44px]',
                d === o.id ? 'bento-btn border-transparent' : 'bg-bento-bg border-bento-border text-bento-dim hover:border-lime transition-colors')}>
              <span className="text-sm font-medium block">{o.label}</span>
              <span className="text-[11px] opacity-80">{o.desc}</span>
            </button>
          ))}
        </div>
        <p className="font-tech text-[11px] text-bento-muted/70">Aplica em todo o sistema. Tema (claro/escuro) e tamanho de fonte ficam em Tema e Acessibilidade.</p>
      </div>
    </Panel>
  )
}

// ─── SISTEMA › Dados & Export (CSV cliente, somente leitura) ───
function csvDownload(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) { alert('Nada para exportar.'); return }
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => { const s = v == null ? '' : String(v); return /[",\n;]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
  const csv = [cols.join(';'), ...rows.map(r => cols.map(c => esc(r[c])).join(';'))].join('\n')
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })  // BOM → Excel lê acentos
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

function DadosSection() {
  const supabase = createClient()
  const [busy, setBusy] = useState('')
  const run = async (kind: 'leads' | 'tarefas') => {
    setBusy(kind)
    // SELECT somente — nada é alterado.
    const q = kind === 'leads'
      ? supabase.from('leads').select('name, status, value, source, score, created_at, last_contact_at')
      : supabase.from('tasks').select('title, notes, due_date, due_time, priority, done, completed_at, created_at')
    const { data, error } = await q
    setBusy('')
    if (error) { alert(`Não foi possível exportar: ${error.message}`); return }
    csvDownload(`${kind}-${ymd(new Date())}.csv`, (data ?? []) as Record<string, unknown>[])
  }
  return (
    <Panel label="Dados & Export">
      <div className="space-y-4">
        <p className="text-xs text-bento-muted">Baixe seus dados em CSV (abre no Excel/Google Sheets). Somente leitura — nada é alterado.</p>
        <div className="flex flex-col sm:flex-row gap-2">
          <button onClick={() => run('leads')} disabled={!!busy} className={actionBtnCls}><Download className="w-4 h-4" />{busy === 'leads' ? 'Exportando...' : 'Exportar leads (CSV)'}</button>
          <button onClick={() => run('tarefas')} disabled={!!busy} className={actionBtnCls}><Download className="w-4 h-4" />{busy === 'tarefas' ? 'Exportando...' : 'Exportar tarefas (CSV)'}</button>
        </div>
        <p className="font-tech text-[11px] text-bento-muted/70 border-t border-bento-border/60 pt-3">Apagar conta / dados em massa: em breve (TODO).</p>
      </div>
    </Panel>
  )
}

// ─── SISTEMA › Integrações (status real do Supabase; demais = TODO) ───
function IntegStatus({ nome, detalhe, status }: { nome: string; detalhe: string; status: 'ok' | 'err' | 'check' | 'todo' }) {
  const map = {
    ok:    { dot: 'bg-lime',        txt: 'text-lime-fg',     label: 'Conectado' },
    err:   { dot: 'bg-red-500',     txt: 'text-red-400',     label: 'Erro' },
    check: { dot: 'bg-bento-muted', txt: 'text-bento-muted', label: 'Verificando...' },
    todo:  { dot: 'bg-bento-muted', txt: 'text-bento-muted', label: 'Em breve' },
  }[status]
  return (
    <div className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
      <span className={cn('w-2 h-2 rounded-full flex-none', map.dot)} />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-bento-text">{nome}</p>
        <p className="font-tech text-[11px] text-bento-muted truncate">{detalhe}</p>
      </div>
      <span className={cn('text-xs font-semibold', map.txt)}>{map.label}</span>
    </div>
  )
}

function IntegracoesSection() {
  const supabase = createClient()
  const [supaOk, setSupaOk] = useState<'ok' | 'err' | 'check'>('check')
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
  useEffect(() => {
    supabase.from('leads').select('id', { count: 'exact', head: true }).then(({ error }) => setSupaOk(error ? 'err' : 'ok'))
  }, [supabase])
  const host = (() => { try { return new URL(url).host } catch { return url || '—' } })()
  return (
    <Panel label="Integrações">
      <div className="divide-y divide-bento-border/60">
        <IntegStatus nome="Supabase" detalhe={host} status={supaOk} />
        <IntegStatus nome="Anthropic (IA)" detalhe="Chave configurada no servidor (env)" status="todo" />
        <IntegStatus nome="WhatsApp" detalhe="Ainda não conectado" status="todo" />
      </div>
    </Panel>
  )
}

// ─── ANDARES › por andar: descrição + abrir + restaurar ordem das abas (DraggableTabs) ───
const FLOOR_META: Record<string, { route: string; section: string; desc: string }> = {
  'andar-hall':      { route: '/hall',      section: 'hall',      desc: 'Mural de avisos, agenda e visão geral do dia.' },
  'andar-comercial': { route: '/comercial', section: 'comercial', desc: 'Funil de leads, clientes, métricas e fases.' },
  'andar-tarefas':   { route: '/tarefas',   section: 'tarefas',   desc: 'Tarefas e relatório do vendedor.' },
  'andar-studio':    { route: '/studio',    section: 'studio',    desc: 'Apresentações e materiais.' },
  'andar-clientes':  { route: '/clientes',  section: 'clientes',  desc: 'Carteira de clientes.' },
}

function AndarSection({ keyId, label }: { keyId: string; label: string }) {
  const meta = FLOOR_META[keyId]
  const [done, setDone] = useState(false)
  const resetTabs = () => {
    if (meta) { try { localStorage.removeItem(`dashboard-tabs-order-${meta.section}`) } catch { /* ignore */ } }
    setDone(true); setTimeout(() => setDone(false), 2500)
  }
  return (
    <Panel label={`Andar — ${label}`}>
      <div className="space-y-4">
        <p className="text-sm text-bento-muted">{meta?.desc}</p>
        <div className="flex flex-wrap gap-2">
          {meta && <a href={meta.route} className={actionBtnCls}><ExternalLink className="w-4 h-4" />Abrir {label}</a>}
          <button onClick={resetTabs} className={actionBtnCls}><RefreshCw className="w-4 h-4" />{done ? 'Ordem restaurada' : 'Restaurar ordem das abas'}</button>
        </div>
        <p className="font-tech text-[11px] text-bento-muted/70 border-t border-bento-border/60 pt-3">Preferências específicas deste andar: em breve (TODO).</p>
      </div>
    </Panel>
  )
}

// ─── Logo Upload (preservado) ───────────────────────────────────────────────────
async function resizeLogo(file: File, maxKb = 200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = document.createElement('img')
    const url = URL.createObjectURL(file)
    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      let { width, height } = img
      const MAX_DIM = 512
      if (width > MAX_DIM || height > MAX_DIM) {
        const ratio = Math.min(MAX_DIM / width, MAX_DIM / height)
        width = Math.round(width * ratio); height = Math.round(height * ratio)
      }
      canvas.width = width; canvas.height = height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0, width, height)
      const tryQ = (q: number) => {
        canvas.toBlob(blob => {
          if (!blob) { reject(new Error('Falha ao converter')); return }
          if (blob.size > maxKb * 1024 && q > 0.3) tryQ(q - 0.1)
          else resolve(blob)
        }, 'image/jpeg', q)
      }
      tryQ(0.9)
    }
    img.onerror = reject
    img.src = url
  })
}

function LogoUploadSection({ userId }: { userId: string }) {
  const [logoUrl, setLogoUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.from('profiles').select('logo_url').eq('id', userId).single().then(({ data }) => {
      if (data?.logo_url) setLogoUrl(data.logo_url)
    })
  }, [userId])

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Selecione uma imagem.'); return }
    setUploading(true); setError(''); setSuccess('')
    try {
      const blob = await resizeLogo(file, 200)
      const supabase = createClient()
      const { error: upErr } = await supabase.storage.from(SYSTEM_LOGO_BUCKET).upload(SYSTEM_LOGO_PATH, blob, {
        contentType: 'image/jpeg', cacheControl: '60', upsert: true,
      })
      if (upErr) throw upErr
      const { data: { publicUrl } } = supabase.storage.from(SYSTEM_LOGO_BUCKET).getPublicUrl(SYSTEM_LOGO_PATH)
      const urlWithBust = `${publicUrl}?t=${Date.now()}`
      await supabase.from('profiles').update({ logo_url: urlWithBust }).eq('id', userId)
      setLogoUrl(urlWithBust)
      setSuccess('Logo atualizada. Recarregue a página para vê-la no menu lateral.')
    } catch (err) {
      console.error(err)
      setError('Erro ao enviar logo. Verifique o bucket "assets" no Supabase.')
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  return (
    <div className="space-y-4">
      <p className="text-xs text-bento-muted">Substitua a logo padrão do sistema. Máximo 200kb, qualquer formato de imagem.</p>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-bento-border flex items-center justify-center bg-bento-bg overflow-hidden shrink-0">
          {logoUrl ? (
            <Image src={logoUrl} alt="Logo" width={64} height={64} className="w-full h-full object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-lime flex items-center justify-center">
              <svg className="w-4 h-4 text-lime-ink" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" />
              </svg>
            </div>
          )}
        </div>
        <div>
          <button onClick={() => fileRef.current?.click()} disabled={uploading}
            className="flex items-center gap-2 bg-bento-bg border border-bento-border text-bento-text px-4 py-2 rounded-btn text-sm hover:border-lime transition-colors disabled:opacity-50 min-h-[44px]">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
            </svg>
            {uploading ? 'Enviando...' : 'Alterar logo'}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
        </div>
      </div>
      {error && <p className="text-xs text-red-400">{error}</p>}
      {success && <p className="text-xs text-green-400">{success}</p>}
    </div>
  )
}

// ─── Navegação ────────────────────────────────────────────────────────────────
const ANDARES: NavItem[] = [
  { key: 'andar-hall', label: 'Hall', Icon: Home },
  { key: 'andar-comercial', label: 'Comercial', Icon: Briefcase },
  { key: 'andar-tarefas', label: 'Tarefas', Icon: ListChecks },
  { key: 'andar-studio', label: 'Studio', Icon: Projector },
  { key: 'andar-clientes', label: 'Clientes', Icon: Users },
]
const SISTEMA: NavItem[] = [
  { key: 'tema', label: 'Tema', Icon: Palette },
  { key: 'acessibilidade', label: 'Acessibilidade', Icon: Accessibility },
  { key: 'logo', label: 'Logo do sistema', Icon: ImageIcon },
  { key: 'conta', label: 'Conta', Icon: User },
  { key: 'aparencia', label: 'Aparência', Icon: LayoutGrid },
  { key: 'dados', label: 'Dados & Export', Icon: Database },
  { key: 'integracoes', label: 'Integrações', Icon: Plug },
  { key: 'planos', label: 'Planos & Comissão', Icon: BadgePercent },
  { key: 'sobre', label: 'Sobre', Icon: Info },
]

// ─── SISTEMA › Planos & Comissão (catálogo + % por plano — Fase 2A) ───
// Grava plans.comissao_percentual. NÃO recalcula vendas existentes; vale só p/ vendas novas do funil.
interface PlanRow { id: string; nome: string; valor_semanal: number; comissao_percentual: number | null }

function PlanosSection() {
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [draft, setDraft] = useState<Record<string, string>>({})   // id → texto do campo %
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ id: string; t: 'ok' | 'err'; m: string } | null>(null)

  const load = useCallback(async () => {
    const { data } = await supabase.from('plans').select('id, nome, valor_semanal, comissao_percentual').eq('ativo', true).order('ordem')
    const list = (data ?? []) as PlanRow[]
    setPlans(list)
    setDraft(Object.fromEntries(list.map(p => [p.id, p.comissao_percentual != null ? String(p.comissao_percentual) : ''])))
    setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load])

  const salvar = async (p: PlanRow) => {
    const raw = (draft[p.id] ?? '').trim().replace(',', '.')
    let pct: number | null
    if (raw === '') pct = null   // vazio = legado
    else {
      pct = Number(raw)
      if (!Number.isFinite(pct) || pct < 0 || pct > 100) { setMsg({ id: p.id, t: 'err', m: 'Informe um % entre 0 e 100 (ou vazio p/ legado).' }); return }
    }
    setBusyId(p.id); setMsg(null)
    const { error } = await supabase.from('plans').update({ comissao_percentual: pct }).eq('id', p.id)
    setBusyId(null)
    if (error) { setMsg({ id: p.id, t: 'err', m: `Não foi possível salvar: ${error.message}` }); return }
    setPlans(prev => prev.map(x => x.id === p.id ? { ...x, comissao_percentual: pct } : x))
    setMsg({ id: p.id, t: 'ok', m: 'Comissão salva.' })
  }

  return (
    <Panel label="Planos & Comissão">
      <div className="space-y-3">
        <p className="text-xs text-bento-muted">
          Quanto da mensalidade semanal de cada plano vira comissão do vendedor. Vale só para vendas <strong>novas</strong> fechadas pelo funil — vendas já lançadas não mudam. Vazio = legado ({usd(LEGACY_VPS_USD)}/semana).
        </p>
        {loading ? <p className="text-sm text-bento-muted">Carregando...</p> : plans.length === 0 ? (
          <p className="text-sm text-bento-muted">Nenhum plano ativo na tabela plans.</p>
        ) : plans.map(p => {
          const rawDraft = (draft[p.id] ?? '').trim().replace(',', '.')
          const previewPct = rawDraft === '' ? null : Number(rawDraft)
          const valido = previewPct == null || (Number.isFinite(previewPct) && previewPct >= 0 && previewPct <= 100)
          const legado = !hasCommissionPct(previewPct)
          const vps = weeklyCommissionUsd(p.valor_semanal, hasCommissionPct(previewPct) ? previewPct : null)
          return (
            <div key={p.id} className="bento-fx p-4 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-bento-text truncate">{p.nome}</p>
                  <p className="font-tech text-[11px] text-bento-muted">{usd(p.valor_semanal)}/semana</p>
                </div>
                <div className="flex items-end gap-2 shrink-0">
                  <label className="text-[11px] text-bento-muted">Comissão (%)
                    <div className="flex items-center gap-1 mt-1">
                      <input inputMode="decimal" value={draft[p.id] ?? ''} placeholder="—"
                        onChange={e => setDraft(d => ({ ...d, [p.id]: e.target.value }))}
                        className="w-20 bg-bento-bg border border-bento-border rounded-btn px-2 py-1.5 text-sm text-bento-text text-right focus:outline-none focus:border-lime" />
                      <span className="text-sm text-bento-muted">%</span>
                    </div>
                  </label>
                  <button onClick={() => salvar(p)} disabled={busyId === p.id || !valido}
                    className="bento-btn px-3 py-1.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[36px]">
                    {busyId === p.id ? '...' : 'Salvar'}
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-bento-border/60 pt-2">
                <BadgePercent className="w-3.5 h-3.5 text-bento-muted shrink-0" />
                {legado
                  ? <p className="font-tech text-[11px] text-bento-muted">Sem % → usando legado <span className="text-bento-text">{usd(LEGACY_VPS_USD)}/semana</span> (× {DEFAULT_TETO_SEMANAS} = {usd(LEGACY_VPS_USD * DEFAULT_TETO_SEMANAS)} por venda).</p>
                  : <p className="font-tech text-[11px] text-bento-dim">{previewPct}% de {usd(p.valor_semanal)} = <span className="text-bento-text font-semibold">{usd(vps)}/semana</span> (× {DEFAULT_TETO_SEMANAS} = {usd(vps * DEFAULT_TETO_SEMANAS)} por venda).</p>}
              </div>
              {msg && msg.id === p.id && <p className={cn('text-xs', msg.t === 'ok' ? 'text-green-400' : 'text-red-400')}>{msg.m}</p>}
            </div>
          )
        })}
      </div>
    </Panel>
  )
}

function NavGroup({ title, items, active, onSelect }: { title: string; items: NavItem[]; active: string; onSelect: (k: string) => void }) {
  return (
    <div>
      <p className="font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted px-2 mb-1.5">{title}</p>
      <div className="space-y-0.5">
        {items.map(it => (
          <button key={it.key} onClick={() => onSelect(it.key)}
            className={cn('w-full flex items-center gap-2 px-2.5 py-2 rounded-btn text-sm text-left transition-colors',
              active === it.key ? 'bg-lime/15 text-lime-fg font-semibold' : 'text-bento-dim hover:text-bento-text hover:bg-bento-bg')}>
            <it.Icon className="w-4 h-4 flex-none" />{it.label}
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── Main ───────────────────────────────────────────────────────────────────────
interface Props { userId: string }

export function ConfiguracoesClient({ userId }: Props) {
  const [active, setActive] = useState('tema')

  const content = (() => {
    if (active.startsWith('andar-')) {
      const label = ANDARES.find(a => a.key === active)?.label ?? 'Andar'
      return <AndarSection keyId={active} label={label} />
    }
    switch (active) {
      case 'tema': return <ThemeSection />
      case 'acessibilidade': return <AccessibilitySection />
      case 'logo': return <Panel label="Logo do sistema"><LogoUploadSection userId={userId} /></Panel>
      case 'sobre': return <AboutSection />
      case 'conta': return <ContaSection />
      case 'aparencia': return <AparenciaSection />
      case 'dados': return <DadosSection />
      case 'integracoes': return <IntegracoesSection />
      case 'planos': return <PlanosSection />
      default: return null
    }
  })()

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto font-body">
      <div className="mb-5">
        <h1 className="font-display text-2xl font-bold text-bento-text tracking-tight">Configurações</h1>
        <p className="text-bento-muted text-sm mt-0.5">Andares e Sistema</p>
      </div>
      <div className="flex flex-col md:flex-row gap-5">
        <nav className="md:w-56 shrink-0 space-y-4">
          <NavGroup title="Andares" items={ANDARES} active={active} onSelect={setActive} />
          <NavGroup title="Sistema" items={SISTEMA} active={active} onSelect={setActive} />
        </nav>
        <div className="flex-1 min-w-0">{content}</div>
      </div>
    </div>
  )
}
