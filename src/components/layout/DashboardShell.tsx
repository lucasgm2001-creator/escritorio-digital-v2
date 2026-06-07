'use client'

import { useState, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'

interface DashboardShellProps {
  children: React.ReactNode
  userName: string
  userId: string
  avatarUrl: string | null
  logoUrl: string | null
  pageTitles: Record<string, string>
}

export function DashboardShell({ children, userName, userId, avatarUrl, logoUrl, pageTitles }: DashboardShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen]   = useState(false)
  const [isMobile, setIsMobile]       = useState(false)
  const pathname = usePathname()

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth < 768
      setIsMobile(mobile)
      if (mobile) setSidebarOpen(false)
    }
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  const title = Object.entries(pageTitles).find(([key]) =>
    pathname === key || pathname.startsWith(key + '/')
  )?.[1] ?? 'Dashboard'

  const handleMenuToggle = () => {
    if (isMobile) {
      setMobileOpen(o => !o)
    } else {
      setSidebarOpen(o => !o)
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      {!isMobile && (
        <Sidebar
          open={sidebarOpen}
          onToggle={() => setSidebarOpen(o => !o)}
          logoUrl={logoUrl}
        />
      )}

      {/* Mobile sidebar overlay */}
      {isMobile && mobileOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
            onClick={() => setMobileOpen(false)}
          />
          <div className="fixed left-0 top-0 h-screen z-50">
            <Sidebar
              open={true}
              onToggle={() => setMobileOpen(false)}
              logoUrl={logoUrl}
              mobileClose={() => setMobileOpen(false)}
            />
          </div>
        </>
      )}

      <div className="flex flex-col flex-1 min-w-0">
        <Topbar
          title={title}
          onMenuToggle={handleMenuToggle}
          sidebarOpen={isMobile ? mobileOpen : sidebarOpen}
          userName={userName}
          userInitial={userName[0]?.toUpperCase() ?? 'U'}
          userId={userId}
          avatarUrl={avatarUrl}
        />
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
