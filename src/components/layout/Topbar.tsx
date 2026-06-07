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

function UserAvatar({ avatarUrl, userInitial }: { avatarUrl?: string | null; userInitial: string }) {
  if (avatarUrl) {
    return (
      <div className="w-7 h-7 rounded-lg overflow-hidden shadow-glow-sm shrink-0">
        <Image src={avatarUrl} alt="Avatar" width={28} height={28} className="w-full h-full object-cover" />
      </div>
    )
  }
  return (
    <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center shadow-glow-sm shrink-0">
      <span className="text-xs font-bold text-white">{userInitial}</span>
    </div>
  )
}

export function Topbar({ title, onMenuToggle, userName = 'Usuário', userInitial = 'U', avatarUrl }: TopbarProps) {
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
        className="p-1.5 rounded-lg hover:bg-[#1e2533] transition-colors text-slate-500 hover:text-slate-300 min-w-[36px] min-h-[36px] flex items-center justify-center"
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
          <LiveClock timezone="America/Sao_Paulo" flag="BR" />
          <LiveClock timezone="America/New_York" flag="EUA" />
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
