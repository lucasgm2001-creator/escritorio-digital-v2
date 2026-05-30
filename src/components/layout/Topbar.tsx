'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase/auth-actions'

type Theme = 'light' | 'dark' | 'auto'

interface TopbarProps {
  title: string
  onMenuToggle: () => void
  sidebarOpen: boolean
  userName?: string
  userInitial?: string
  userRole?: string
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrador',
  comercial: 'Comercial',
  trafego: 'Tráfego',
  financeiro: 'Financeiro',
}

function LiveClock({ timezone, flag }: { timezone: string; flag: string }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('pt-BR', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit',
    }))
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [timezone])

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-sm leading-none">{flag}</span>
      <span className="font-mono text-xs font-semibold text-foreground tabular-nums tracking-wide">{time}</span>
    </div>
  )
}

export function Topbar({ title, onMenuToggle, userName = 'Usuário', userInitial = 'U', userRole = '' }: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [themeDropdownOpen, setThemeDropdownOpen] = useState(false)
  const [theme, setTheme] = useState<Theme>('auto')
  const [mounted, setMounted] = useState(false)
  const router = useRouter()

  useEffect(() => {
    setMounted(true)
    try {
      const saved = localStorage.getItem('theme') as Theme | null
      if (saved) setTheme(saved)
    } catch (error) {
      console.error('Failed to read theme from localStorage:', error)
    }
  }, [])

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    setThemeDropdownOpen(false)
    try {
      localStorage.setItem('theme', newTheme)
      // Aplicar tema
      const html = document.documentElement
      const isDarkByTime = () => {
        const hour = new Date().getHours()
        return hour >= 18 || hour < 6
      }
      const isDark = newTheme === 'dark' || (newTheme === 'auto' && isDarkByTime())
      if (isDark) {
        html.style.colorScheme = 'dark'
        html.classList.add('dark')
        document.body.style.backgroundColor = '#0d1117'
        document.body.style.color = '#e6edf3'
      } else {
        html.style.colorScheme = 'light'
        html.classList.remove('dark')
        document.body.style.backgroundColor = '#ffffff'
        document.body.style.color = '#24292f'
      }
    } catch (error) {
      console.error('Failed to save theme:', error)
    }
  }

  const handleLogout = async () => {
    setDropdownOpen(false)
    setIsLoggingOut(true)

    try {
      // Chama a Server Action de logout
      await signOut()
      // Se chegou aqui, o signOut não fez redirect (possível erro)
      // Fallback: redireciona manualmente
      window.location.href = '/login'
    } catch {
      // signOut() faz redirect(), que lança uma exceção
      // Se chegarmos aqui, tenta redirecionar manualmente
      setTimeout(() => {
        window.location.href = '/login'
      }, 100)
    }
  }

  return (
    <header className="h-14 border-b border-[#2d3748] bg-[#0d1117] flex items-center px-4 gap-4 shrink-0">
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg hover:bg-[#1e2533] transition-colors text-slate-500 hover:text-slate-300"
        aria-label="Alternar menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <h1 className="font-semibold text-foreground text-sm tracking-tight">{title}</h1>

      <div className="ml-auto flex items-center gap-4">
        {/* Clocks */}
        <div className="hidden sm:flex items-center gap-4 border-r border-[#2d3748] pr-4">
          <LiveClock timezone="America/Sao_Paulo" flag="🇧🇷" />
          <LiveClock timezone="America/New_York" flag="🇺🇸" />
        </div>

        {/* Theme Selector */}
        {mounted && (
          <div className="relative">
            <button
              onClick={() => setThemeDropdownOpen(!themeDropdownOpen)}
              className="p-1.5 rounded-lg hover:bg-[#1e2533] transition-colors text-slate-500 hover:text-slate-300"
              title="Mudar tema"
              aria-label="Tema"
            >
              {theme === 'light' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.536l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.707.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.464 5.05l-.707-.707a1 1 0 00-1.414 1.414l.707.707zm5.657-9.193a1 1 0 00-1.414 0l-.707.707A1 1 0 005.05 6.464l.707-.707a1 1 0 001.414-1.414zM5 11a1 1 0 100-2H4a1 1 0 100 2h1z" clipRule="evenodd" />
                </svg>
              ) : theme === 'dark' ? (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4 2a1 1 0 011 1v2a1 1 0 11-2 0V3a1 1 0 011-1zm-1 13a1 1 0 100 2h2a1 1 0 100-2H3zm13-2a1 1 0 011 1v2a1 1 0 11-2 0v-2a1 1 0 011-1zM4 5a2 2 0 100 4 2 2 0 000-4zm2.165 4.168a1 1 0 11-1.414-1.414A2 2 0 103.414 9.414a1 1 0 011.414 1.414zM12 9a3 3 0 110-6 3 3 0 010 6z" clipRule="evenodd" />
                </svg>
              )}
            </button>

            {themeDropdownOpen && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setThemeDropdownOpen(false)} />
                <div className="absolute right-0 top-11 z-20 w-40 bg-[#1e2533] border border-[#2d3748] rounded-xl shadow-card-hover py-1 overflow-hidden animate-fade-in">
                  {[
                    { id: 'light' as Theme, label: '☀️ Claro', icon: '☀️' },
                    { id: 'auto' as Theme, label: '🔄 Automático', icon: '🔄' },
                    { id: 'dark' as Theme, label: '🌙 Escuro', icon: '🌙' },
                  ].map(opt => (
                    <button
                      key={opt.id}
                      onClick={() => handleThemeChange(opt.id)}
                      className={`w-full text-left px-3 py-2.5 text-sm transition-colors flex items-center gap-2 ${
                        theme === opt.id
                          ? 'bg-primary-600/30 text-primary-400'
                          : 'text-foreground hover:bg-[#2d3748]'
                      }`}
                    >
                      <span>{opt.icon}</span>
                      <span>{opt.label}</span>
                      {theme === opt.id && (
                        <svg className="w-4 h-4 ml-auto" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        )}

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#1e2533] transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center shadow-glow-sm">
              <span className="text-xs font-bold text-white">{userInitial}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-foreground leading-none">{userName}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{ROLE_LABELS[userRole] ?? userRole}</p>
            </div>
            <svg className="w-3.5 h-3.5 text-muted-foreground hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-48 bg-[#1e2533] border border-[#2d3748] rounded-xl shadow-card-hover py-1 overflow-hidden animate-fade-in">
                <div className="px-3 py-2.5 border-b border-[#2d3748]">
                  <p className="text-sm font-semibold text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[userRole] ?? userRole}</p>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); router.push('/perfil') }}
                  className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-[#2d3748] transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                      d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  Meu Perfil
                </button>
                <button
                  onClick={handleLogout}
                  disabled={isLoggingOut}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2.5"
                >
                  {isLoggingOut ? (
                    <span className="w-4 h-4 border-2 border-red-400/30 border-t-red-400 rounded-full animate-spin" />
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                        d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                    </svg>
                  )}
                  {isLoggingOut ? 'Saindo...' : 'Sair'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
