'use client'

import { useEffect, useState } from 'react'
import { signOut } from '@/lib/supabase/auth-actions'

interface TopbarProps {
  title: string
  onMenuToggle: () => void
  sidebarOpen: boolean
  userName?: string
  userInitial?: string
  userRole?: string
}

function BrazilFlag() {
  return <span className="text-base leading-none">🇧🇷</span>
}
function USAFlag() {
  return <span className="text-base leading-none">🇺🇸</span>
}

function LiveClock({ timezone, flag }: { timezone: string; flag: React.ReactNode }) {
  const [time, setTime] = useState('')
  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('pt-BR', {
        timeZone: timezone,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [timezone])

  return (
    <div className="flex items-center gap-1.5">
      {flag}
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">{time}</span>
    </div>
  )
}

function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
    </svg>
  )
}

export function Topbar({ title, onMenuToggle, userName = 'Usuário', userInitial = 'U', userRole = '' }: TopbarProps) {
  const [dropdownOpen, setDropdownOpen] = useState(false)

  return (
    <header className="h-14 border-b border-border bg-white flex items-center px-4 gap-4 shrink-0">
      <button
        onClick={onMenuToggle}
        className="p-1.5 rounded-lg hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
        aria-label="Alternar menu"
      >
        <MenuIcon />
      </button>

      <h1 className="font-semibold text-foreground text-sm">{title}</h1>

      <div className="ml-auto flex items-center gap-4">
        {/* Relógios */}
        <div className="hidden sm:flex items-center gap-4 border-r border-border pr-4">
          <LiveClock timezone="America/Sao_Paulo" flag={<BrazilFlag />} />
          <LiveClock timezone="America/New_York" flag={<USAFlag />} />
        </div>

        {/* Avatar + dropdown */}
        <div className="relative">
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 p-1 rounded-lg hover:bg-muted transition-colors"
          >
            <div className="w-8 h-8 rounded-full bg-primary-800 flex items-center justify-center">
              <span className="text-sm font-bold text-white">{userInitial}</span>
            </div>
            <div className="hidden md:block text-left">
              <p className="text-sm font-medium text-foreground leading-none">{userName}</p>
              <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
            </div>
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setDropdownOpen(false)} />
              <div className="absolute right-0 top-10 z-20 w-44 bg-white border border-border rounded-xl shadow-lg py-1 overflow-hidden">
                <div className="px-3 py-2 border-b border-border">
                  <p className="text-sm font-medium text-foreground">{userName}</p>
                  <p className="text-xs text-muted-foreground capitalize">{userRole}</p>
                </div>
                <button
                  onClick={() => { setDropdownOpen(false); signOut() }}
                  className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Sair
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
