'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, Briefcase, Settings, type LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Barra de navegação inferior — SÓ mobile. É renderizada pelo DashboardShell apenas quando
 * `isMobile` (<1024px); no desktop (≥1024px) o shell mostra a Sidebar de sempre e NÃO renderiza
 * esta barra. Espelha EXATAMENTE os itens da nav principal (Sidebar.NAV_ITEMS) — não inventa áreas.
 * Fica no fluxo (último filho da coluna), então nunca cobre conteúdo.
 */
interface NavItem { href: string; label: string; Icon: LucideIcon }

// Studio fica FORA da barra mobile (só faz sentido no desktop; ver StudioGate). A Sidebar do
// desktop continua com Studio normalmente.
const ITEMS: NavItem[] = [
  { href: '/hall',          label: 'Hall',      Icon: Home },
  { href: '/comercial',     label: 'Comercial', Icon: Briefcase },
  { href: '/configuracoes', label: 'Config',    Icon: Settings },
]

export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="lg:hidden shrink-0 border-t border-bento-border bg-bento-panel pb-safe">
      <div className="flex items-stretch">
        {ITEMS.map(({ href, label, Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 transition-colors',
                active ? 'text-lime-fg' : 'text-bento-muted hover:text-bento-text',
              )}
            >
              <Icon className={cn('w-5 h-5', active && 'drop-shadow-[0_0_6px_rgba(194,247,58,0.4)]')} />
              <span className="font-tech text-[10px] tracking-tight">{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
