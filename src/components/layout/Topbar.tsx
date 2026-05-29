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
                  onClick={() => { setDropdownOpen(false); signOut() }}
                  className="w-full text-left px-3 py-2.5 text-sm text-red-400 hover:bg-red-900/20 transition-colors flex items-center gap-2.5"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
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
