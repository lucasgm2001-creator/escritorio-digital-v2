'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Presentation } from 'lucide-react'

interface NavItem {
  href: string
  label: string
  icon: React.ReactNode
  group?: string
}

const icons = {
  hall: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  tarefas: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 11l3 3L22 4M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  ),
  comercial: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  clientes: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  studio: (
    <Presentation className="w-[18px] h-[18px] shrink-0" />
  ),
  config: (
    <svg className="w-[18px] h-[18px] shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

const NAV_ITEMS: NavItem[] = [
  { href: '/hall',           label: 'Hall',           icon: icons.hall,       group: 'main' },
  { href: '/comercial',      label: 'Comercial',      icon: icons.comercial,  group: 'main' },
  { href: '/studio',         label: 'Studio de Apresentação', icon: icons.studio, group: 'main' },
  { href: '/configuracoes',  label: 'Configurações',  icon: icons.config,     group: 'system' },
]

interface SidebarProps {
  open: boolean
  onToggle: () => void
  logoUrl?: string | null
  mobileClose?: () => void
}

export function Sidebar({ open, onToggle, logoUrl, mobileClose }: SidebarProps) {
  const pathname = usePathname()
  const isMobileDrawer = !!mobileClose
  // Se a logo customizada não existir/falhar (404 no bucket), caímos no ícone padrão.
  const [logoFailed, setLogoFailed] = useState(false)
  const showCustomLogo = !!logoUrl && !logoFailed

  // App pessoal de usuário único: sem papéis, todos os itens são visíveis.
  const mainItems   = NAV_ITEMS.filter(i => i.group === 'main')
  const systemItems = NAV_ITEMS.filter(i => i.group === 'system')

  return (
    <aside
      className={cn(
        'flex flex-col h-screen transition-all duration-200 ease-in-out shrink-0 relative z-30',
        'bg-sidebar border-r border-sidebar-border/10',
        isMobileDrawer ? 'w-56' : open ? 'w-56' : 'w-[60px]'
      )}
    >
      {/* Logo */}
      <div className="flex items-center h-14 px-3.5 border-b border-sidebar-border/10 overflow-hidden">
        {showCustomLogo ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={logoUrl}
            alt="Logo"
            onError={() => setLogoFailed(true)}
            className="w-7 h-7 rounded-lg object-contain shrink-0"
          />
        ) : (
          <div className="w-7 h-7 rounded-lg bg-lime flex items-center justify-center shrink-0">
            <svg className="w-4 h-4 text-lime-ink" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
            </svg>
          </div>
        )}
        {(open || isMobileDrawer) && (
          <div className="ml-2.5 overflow-hidden flex-1">
            <span className="font-bold text-sidebar-foreground text-sm tracking-tight whitespace-nowrap">DR Growth</span>
            <p className="text-[10px] text-sidebar-muted whitespace-nowrap leading-none mt-0.5">Escritório Digital</p>
          </div>
        )}
        {isMobileDrawer && (
          <button onClick={mobileClose}
            className="ml-auto p-1.5 rounded-lg hover:bg-sidebar-accent/10 transition-colors text-sidebar-muted hover:text-sidebar-foreground"
            aria-label="Fechar menu">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-hidden overflow-y-auto">
        {mainItems.map(item => (
          <NavLink key={item.href} item={item} pathname={pathname} open={open || isMobileDrawer} />
        ))}

        {systemItems.length > 0 && (
          <>
            {(open || isMobileDrawer) && (
              <div className="px-2 pt-4 pb-1">
                <p className="text-[10px] uppercase tracking-wider text-sidebar-muted font-semibold">Sistema</p>
              </div>
            )}
            {!(open || isMobileDrawer) && <div className="my-2 mx-2 border-t border-sidebar-border/10" />}
            {systemItems.map(item => (
              <NavLink key={item.href} item={item} pathname={pathname} open={open || isMobileDrawer} />
            ))}
          </>
        )}
      </nav>

      {/* Toggle (only on desktop) */}
      {!isMobileDrawer && (
        <button
          onClick={onToggle}
          className="m-2 p-2 rounded-lg hover:bg-sidebar-accent/10 transition-colors text-sidebar-muted hover:text-sidebar-foreground flex items-center justify-center"
          aria-label={open ? 'Fechar sidebar' : 'Abrir sidebar'}
        >
          <svg
            className={cn('w-4 h-4 transition-transform duration-200', open ? 'rotate-180' : '')}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9 5l7 7-7 7" />
          </svg>
        </button>
      )}
    </aside>
  )
}

function NavLink({ item, pathname, open }: { item: NavItem; pathname: string; open: boolean }) {
  const active = pathname === item.href || pathname.startsWith(item.href + '/')

  return (
    <div className="relative group">
      <Link
        href={item.href}
        className={cn(
          'flex items-center gap-2.5 px-2.5 py-2 rounded-lg transition-all duration-150 text-sm min-h-[44px] md:min-h-0',
          active
            ? 'bg-lime/15 text-lime-fg font-medium'
            : 'text-slate-400 hover:bg-[rgba(255,255,255,0.05)] hover:text-slate-200'
        )}
      >
        <span className={cn('shrink-0', active ? 'text-lime-fg' : '')}>
          {item.icon}
        </span>
        {open && (
          <span className="whitespace-nowrap truncate">{item.label}</span>
        )}
        {active && open && (
          <span className="ml-auto w-1.5 h-1.5 rounded-full bg-lime shrink-0" />
        )}
      </Link>

      {/* Tooltip when collapsed */}
      {!open && (
        <div className="absolute left-full top-1/2 -translate-y-1/2 ml-2.5 px-2.5 py-1.5 bg-[#1e2533] border border-[#2d3748] text-white text-xs rounded-lg whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-card">
          {item.label}
        </div>
      )}
    </div>
  )
}
