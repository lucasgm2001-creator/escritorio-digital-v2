'use client'

import { useCallback, useEffect, useState } from 'react'
import { Sun, Moon, Monitor } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Theme = 'light' | 'dark' | 'auto'

type ThemeItem = {
  label: string
  desc: string
  status: string
  isTheme: true
}

type ConfigItem = {
  label: string
  desc: string
  status: string
}

type ConfigItemWithContent = ConfigItem & {
  expandable: true
  content: React.ReactNode
}

type MenuItem = ThemeItem | ConfigItem | ConfigItemWithContent

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
      html.style.colorScheme = 'dark'
      html.classList.add('dark')
      html.classList.remove('light')
    } else {
      html.style.colorScheme = 'light'
      html.classList.add('light')
      html.classList.remove('dark')
    }
    document.body.style.removeProperty('background-color')
    document.body.style.removeProperty('color')
  }, [])

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved) {
        setTheme(saved)
        applyTheme(saved)
      } else {
        applyTheme('auto')
      }
    } catch (error) {
      console.error('localStorage not available:', error)
      applyTheme('auto')
    }
  }, [applyTheme])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
      applyTheme(newTheme)
    } catch (error) {
      console.error('Failed to save theme preference:', error)
      applyTheme(newTheme)
    }
  }

  if (!mounted) return null

  return (
    <div className="flex gap-2">
      {[
        { id: 'light' as Theme, label: 'Claro', Icon: Sun },
        { id: 'dark' as Theme, label: 'Escuro', Icon: Moon },
        { id: 'auto' as Theme, label: 'Auto', Icon: Monitor },
      ].map(({ id, label, Icon }) => (
        <button
          key={id}
          onClick={() => handleThemeChange(id)}
          className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border transition-all text-sm ${
            theme === id
              ? 'bg-primary-600 border-primary-600 text-white shadow-md'
              : 'bg-[#1e2533] border-[#2d3748] text-muted-foreground hover:border-primary-600'
          }`}
        >
          <Icon className="w-[18px] h-[18px]" strokeWidth={1.5} />
          <span className="font-medium">{label}</span>
        </button>
      ))}
    </div>
  )
}

export function ConfiguracoesClient() {
  const [expandedSection, setExpandedSection] = useState<string | null>(null)

  const sections = [
    {
      title: 'Aparência',
      items: [
        {
          label: 'Tema',
          desc: 'Escolha entre claro, escuro ou automático (18h-06h)',
          status: 'configurável',
          isTheme: true,
        },
        { label: 'Idioma', desc: 'Português (Brasil)', status: 'ativo' },
      ],
    },
    {
      title: 'Integrações',
      items: [
        { label: 'Supabase', desc: 'Banco de dados e autenticação', status: 'conectado' },
        { label: 'Anthropic / Claude', desc: 'Análise de leads com IA', status: 'conectado' },
        { label: 'WhatsApp', desc: 'Notificações e contato direto', status: 'pendente' },
      ],
    },
    {
      title: 'Notificações',
      items: [
        { label: 'Feed de atividades', desc: 'Realtime via Supabase', status: 'ativo' },
        { label: 'Mural de avisos', desc: 'Broadcast para todos os usuários', status: 'ativo' },
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

  const statusColors: Record<string, string> = {
    ativo: 'bg-green-900/30 text-green-400 border-green-800/50',
    conectado: 'bg-blue-900/30 text-blue-400 border-blue-800/50',
    pendente: 'bg-amber-900/30 text-amber-400 border-amber-800/50',
    configurável: 'bg-purple-900/30 text-purple-400 border-purple-800/50',
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Configurações</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Preferências e configurações do sistema</p>
      </div>

      {sections.map(section => (
        <Card key={section.title}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">{section.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-0 divide-y divide-[#2d3748]/60">
            {section.items.map((item: MenuItem) => (
              <div key={item.label}>
                {'isTheme' in item && item.isTheme === true ? (
                  <div className="flex items-center justify-between py-4 first:pt-0 last:pb-0">
                    <div className="text-left flex-1">
                      <p className="text-sm font-medium text-foreground">{item.label}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                    <div className="ml-4">
                      <ThemeSelectorInline />
                    </div>
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => {
                        if ('expandable' in item && item.expandable) {
                          setExpandedSection(expandedSection === item.label ? null : item.label)
                        }
                      }}
                      className={`w-full flex items-center justify-between py-3.5 first:pt-0 last:pb-0 ${
                        'expandable' in item && item.expandable ? 'cursor-pointer hover:bg-[#1a2533]/50 px-3 -mx-3 rounded' : ''
                      } transition-colors`}
                    >
                      <div className="text-left">
                        <p className="text-sm font-medium text-foreground">{item.label}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{item.desc}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold capitalize ${statusColors[item.status] ?? 'border-[#2d3748] bg-[#1e2533] text-muted-foreground'}`}
                        >
                          {item.status}
                        </span>
                        {('expandable' in item && item.expandable) && (
                          <svg
                            className={`w-4 h-4 text-muted-foreground transition-transform ${expandedSection === item.label ? 'rotate-180' : ''}`}
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                          </svg>
                        )}
                      </div>
                    </button>

                    {expandedSection === item.label && 'content' in item && (
                      <div className="py-4 px-3 bg-[#1a2533]/30 rounded-lg border border-[#2d3748]/50 mt-2">
                        {item.content}
                      </div>
                    )}
                  </>
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
