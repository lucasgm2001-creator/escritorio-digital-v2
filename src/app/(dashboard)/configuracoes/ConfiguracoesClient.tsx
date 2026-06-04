'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { createClient } from '@/lib/supabase/client'
import { SYSTEM_LOGO_BUCKET, SYSTEM_LOGO_PATH } from '@/lib/logo'

type Theme = 'light' | 'dark' | 'auto'

const isDarkByTime = (): boolean => {
  const hour = new Date().getHours()
  return hour >= 18 || hour < 6
}

function ThemeSelectorInline() {
  const [theme, setTheme] = useState<Theme>('auto')
  const [mounted, setMounted] = useState(false)

  const applyTheme = useCallback((t: Theme) => {
    const html = document.documentElement
    const isDark = t === 'dark' || (t === 'auto' && isDarkByTime())
    if (isDark) {
      html.style.colorScheme = 'dark'; html.classList.add('dark'); html.classList.remove('light')
    } else {
      html.style.colorScheme = 'light'; html.classList.add('light'); html.classList.remove('dark')
    }
    document.body.style.removeProperty('background-color')
    document.body.style.removeProperty('color')
  }, [])

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved) { setTheme(saved); applyTheme(saved) } else { applyTheme('auto') }
    } catch { applyTheme('auto') }
  }, [applyTheme])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    try { localStorage.setItem('theme', newTheme); applyTheme(newTheme) } catch { applyTheme(newTheme) }
  }

  if (!mounted) return null

  return (
    <div className="flex gap-2">
      {[
        { id: 'light' as Theme, label: 'Claro', Icon: Sun },
        { id: 'dark'  as Theme, label: 'Escuro', Icon: Moon },
        { id: 'auto'  as Theme, label: 'Auto',   Icon: Monitor },
      ].map(({ id, label, Icon }) => (
        <button key={id} onClick={() => handleThemeChange(id)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-sm min-h-[44px] ${
            theme === id ? 'bg-primary-600 border-primary-600 text-white shadow-md' : 'bg-[#1e2533] border-[#2d3748] text-muted-foreground hover:border-primary-600'
          }`}>
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="font-medium">{label}</span>
        </button>
      ))}
    </div>
  )
}

// ─── Logo Upload (admin only) ─────────────────────────────────────────────────

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
        width = Math.round(width * ratio)
        height = Math.round(height * ratio)
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
  const [logoUrl, setLogoUrl]     = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError]         = useState('')
  const [success, setSuccess]     = useState('')
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
      // A URL pública é fixa (mesmo path), então re-uploads ficariam em cache.
      // cacheControl baixo faz o navegador revalidar e mostrar a nova logo rápido.
      const { error: upErr } = await supabase.storage.from(SYSTEM_LOGO_BUCKET).upload(SYSTEM_LOGO_PATH, blob, {
        contentType: 'image/jpeg',
        cacheControl: '60',
        upsert: true,
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
      <p className="text-xs text-muted-foreground">
        Substitua a logo padrão do sistema. Máximo 200kb, qualquer formato de imagem.
      </p>
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-xl border border-[#2d3748] flex items-center justify-center bg-[#1a2133] overflow-hidden shrink-0">
          {logoUrl ? (
            <Image src={logoUrl} alt="Logo" width={64} height={64} className="w-full h-full object-contain" />
          ) : (
            <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center">
              <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
              </svg>
            </div>
          )}
        </div>
        <div>
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="flex items-center gap-2 bg-[#1e2533] border border-[#2d3748] text-foreground px-4 py-2 rounded-lg text-sm hover:border-primary-600 transition-colors disabled:opacity-50 min-h-[44px]"
          >
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

// ─── Main Component ───────────────────────────────────────────────────────────

interface Props {
  userId: string
  userRole: string
}

export function ConfiguracoesClient({ userId, userRole }: Props) {
  const isAdmin = userRole === 'admin' || userRole === 'administrador'

  const statusColors: Record<string, string> = {
    ativo:       'bg-green-900/30 text-green-400 border-green-800/50',
    conectado:   'bg-blue-900/30 text-blue-400 border-blue-800/50',
    pendente:    'bg-amber-900/30 text-amber-400 border-amber-800/50',
    configurável:'bg-purple-900/30 text-purple-400 border-purple-800/50',
  }

  const sections = [
    {
      title: 'Aparência',
      items: [
        { label: 'Tema',   desc: 'Claro, escuro ou automático (18h–06h)', status: 'configurável', isTheme: true },
        { label: 'Idioma', desc: 'Português (Brasil)', status: 'ativo' },
      ],
    },
    {
      title: 'Integrações',
      items: [
        { label: 'Supabase',         desc: 'Banco de dados e autenticação', status: 'conectado' },
        { label: 'Anthropic / Claude', desc: 'Análise de leads com IA', status: 'conectado' },
        { label: 'WhatsApp',         desc: 'Notificações e contato direto', status: 'pendente' },
      ],
    },
    {
      title: 'Notificações',
      items: [
        { label: 'Feed de atividades', desc: 'Realtime via Supabase', status: 'ativo' },
        { label: 'Mural de avisos',    desc: 'Broadcast para todos', status: 'ativo' },
      ],
    },
    {
      title: 'Dados & Privacidade',
      items: [
        { label: 'Backups automáticos', desc: 'Gerenciado pelo Supabase', status: 'ativo' },
        { label: 'Política de retenção', desc: 'Dados retidos indefinidamente', status: 'ativo' },
      ],
    },
  ]

  return (
    <div className="p-4 sm:p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Preferências e configurações do sistema</p>
      </div>

      {/* Admin-only: Logo section */}
      {isAdmin && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <svg className="w-4 h-4 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              Logo do Sistema
              <span className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-primary-600/20 text-primary-400 border border-primary-600/30 font-semibold">Admin</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <LogoUploadSection userId={userId} />
          </CardContent>
        </Card>
      )}

      {sections.map(section => (
        <Card key={section.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-[#2d3748]/60">
            {section.items.map((item) => (
              <div key={item.label}>
                {'isTheme' in item && item.isTheme ? (
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between py-4 first:pt-0 last:pb-0 gap-3">
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <div><ThemeSelectorInline /></div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between py-3.5 first:pt-0 last:pb-0">
                    <div className="text-left">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold capitalize ${statusColors[item.status] ?? 'border-[#2d3748] bg-[#1e2533] text-muted-foreground'}`}>
                      {item.status}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <p className="text-xs text-muted-foreground/50 text-center">
        Escritório Digital v2 · DR Growth · {new Date().getFullYear()}
      </p>
    </div>
  )
}
