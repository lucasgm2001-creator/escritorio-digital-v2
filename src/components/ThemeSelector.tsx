'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'auto'

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>('auto')
  const [mounted, setMounted] = useState(false)

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
  }, [])

  const applyTheme = (t: Theme) => {
    const html = document.documentElement
    const isDark = t === 'dark' || (t === 'auto' && window.matchMedia('(prefers-color-scheme: dark)').matches)

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
  }

  const handleThemeChange = (newTheme: Theme) => {
    setTheme(newTheme)
    try {
      localStorage.setItem('theme', newTheme)
      applyTheme(newTheme)
    } catch (error) {
      console.error('Failed to save theme preference:', error)
      // Ainda aplicar tema mesmo se localStorage falhar (private mode, quota exceeded)
      applyTheme(newTheme)
    }
  }

  if (!mounted) return null

  return (
    <div className="space-y-3">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tema</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'light', label: '☀️ Claro', icon: '☀️' },
          { id: 'auto', label: '🔄 Automático', icon: '🔄' },
          { id: 'dark', label: '🌙 Escuro', icon: '🌙' },
        ].map(opt => (
          <button
            key={opt.id}
            onClick={() => handleThemeChange(opt.id as Theme)}
            className={`flex flex-col items-center justify-center gap-2 px-3 py-3 rounded-lg border transition-all ${
              theme === opt.id
                ? 'bg-primary-600 border-primary-600 text-white shadow-md'
                : 'bg-[#1e2533] border-[#2d3748] text-muted-foreground hover:border-primary-600'
            }`}
          >
            <span className="text-2xl">{opt.icon}</span>
            <span className="text-xs font-medium">{opt.label.split(' ')[1]}</span>
          </button>
        ))}
      </div>
      <p className="text-xs text-muted-foreground">
        {theme === 'auto'
          ? 'Tema adaptado à preferência do sistema'
          : theme === 'light'
            ? 'Tema claro ativado'
            : 'Tema escuro ativado'}
      </p>
    </div>
  )
}
