'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { signOut } from '@/lib/supabase/auth-actions'

interface TopbarProps {
  title: string
  onMenuToggle: () => void
  sidebarOpen: boolean
  userName?: string
  userInitial?: string
  userId?: string
  avatarUrl?: string | null
}

// O fuso IANA (America/...) já resolve o horário de verão dos EUA automaticamente.
function LiveClock({ timezone, label, primary }: { timezone: string; label: string; primary?: boolean }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => setTime(new Date().toLocaleTimeString('pt-BR', {
      timeZone: timezone, hour: '2-digit', minute: '2-digit',
    }))
    update()
    const id = setInterval(update, 15_000)
    return () => clearInterval(id)
  }, [timezone])

  // Brasília (principal) destacada em lime; demais fusos em cinza. Hora em JetBrains
  // Mono (font-mono). Atualização a cada 15s = funcional, não enfeite.
  return (
    <div className="flex flex-col items-center leading-none gap-0.5">
      <span className={`text-[9px] uppercase tracking-wide whitespace-nowrap ${primary ? 'text-lime-fg font-semibold' : 'text-bento-muted'}`}>{label}</span>
      <span className={`font-mono text-xs font-semibold tabular-nums ${primary ? 'text-bento-text' : 'text-bento-dim'}`}>{time || '--:--'}</span>
    </div>
  )
}

function UserAvatar({ avatarUrl, userInitial }: { avatarUrl?: string | null; userInitial: string }) {
  if (avatarUrl) {
    return (
      <div className="w-7 h-7 rounded-lg overflow-hidden shadow-glow-sm shrink-0">
        <Image src={avatarUrl} alt="Avatar" width={28} height={28} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-lg bg-lime flex items-center justify-center shrink-0">
      <span className="text-xs font-bold text-lime-ink">{userInitial}</span>
    </div>
  )
}

export function Topbar({ onMenuToggle, userName = 'Usuário', userInitial = 'U', avatarUrl }: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const router = useRouter()

  const handleLogout = async () => {
    setDropdownOpen(false)
    setIsLoggingOut(true)
    try {
      await signOut()
      window.location.href = '/login'
    } catch {
      setTimeout(() => { window.location.href = '/login' }, 100)
    }
  }

  return (
    <header className="h-14 border-b border-[#2d3748] bg-[#0d1117] flex items-center px-4 gap-4 shrink-0">
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg hover:bg-[#1e2533] transition-colors text-slate-500 hover:text-slate-300 min-w-[36px] min-h-[36px] hidden lg:flex items-center justify-center"
        aria-label="Alternar menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Título da seção REMOVIDO daqui — cada página já tem seu próprio título de conteúdo (evita
          nome duplicado). O Topbar mantém só relógios + avatar; a seção ativa fica na Sidebar. */}
      <div className="ml-auto flex items-center gap-3 sm:gap-4 min-w-0">
        {/* Fusos sempre visíveis (Brasília lime + EUA Leste/Montanha/Oeste). Mobile (<1024): grade 2x2
            compacta, cabe sem overflow; desktop (lg+): uma linha, igual a hoje. */}
        <div className="grid grid-cols-2 gap-x-3 gap-y-0 lg:flex lg:items-center lg:gap-3.5 border-r border-[#2d3748] pr-3 sm:pr-4 shrink-0">
          <LiveClock timezone="America/Sao_Paulo" label="Brasília" primary />
          <LiveClock timezone="America/New_York"    label="EUA Leste" />
          <LiveClock timezone="America/Denver"      label="EUA Mont." />
          <LiveClock timezone="America/Los_Angeles" label="EUA Oeste" />
        </div>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2.5 p-1.5 rounded-lg hover:bg-[#1e2533] transition-colors min-h-[44px]"
          >
            <UserAvatar avatarUrl={avatarUrl} userInitial={userInitial} />
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-foreground leading-none">{userName}</p>
            </div>
            <svg className="w-3.5 h-3.5 text-muted-foreground hidden md:block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-11 z-20 w-56 bg-[#1e2533] border border-[#2d3748] rounded-xl shadow-card-hover py-1 overflow-hidden animate-fade-in">
                <div className="px-3 py-2.5 border-b border-[#2d3748]">
                  <p className="text-sm font-semibold text-foreground">{userName}</p>
                </div>

                <button
                  onClick={() => { setDropdownOpen(false); router.push('/perfil') }}
                  className="w-full text-left px-3 py-2.5 text-sm text-foreground hover:bg-[#2d3748] transition-colors flex items-center gap-2.5 min-h-[44px]"
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
                  className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2.5 min-h-[44px]"
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
