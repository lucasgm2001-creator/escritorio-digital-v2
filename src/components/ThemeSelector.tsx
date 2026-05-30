'use client'

import { useEffect, useState } from 'react'

type Theme = 'light' | 'dark' | 'auto'

export function ThemeSelector() {
  const [theme, setTheme] = useState<Theme>('auto')
  const [mounted, setMounted] = useState(false)
  const [currentHour, setCurrentHour] = useState<number>(0)

  // Determinar se deve ser dark baseado na hora: 18:00 até 05:59
  const isDarkByTime = (): boolean => {
    const now = new Date()
    const hour = now.getHours()
    return hour >= 18 || hour < 6
  }

  const applyTheme = (t: Theme) => {
    const html = document.documentElement
    const isDark = t === 'dark' || (t === 'auto' && isDarkByTime())

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

  useEffect(() => {
    setMounted(true)
    setCurrentHour(new Date().getHours())

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

    // Se tema é auto, verificar a cada minuto para atualizar ao cruzar 06:00 ou 18:00
    const interval = setInterval(() => {
      const newHour = new Date().getHours()
      setCurrentHour(newHour)
      // Atualizar tema se for auto
      const currentTheme = localStorage.getItem('theme') as Theme | null
      if (currentTheme === 'auto' || !currentTheme) {
        applyTheme('auto')
      }
    }, 60000) // Verificar a cada minuto

    return () => clearInterval(interval)
  }, [])

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

  const isDarkNow = isDarkByTime()

  return (
    <div className="space-y-4">
      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tema</p>
      <div className="grid grid-cols-3 gap-2">
        {[
          { id: 'light' as Theme, label: '☀️ Claro', icon: '☀️' },
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

      {/* Info box */}
      <div className="bg-[#1e2533] border border-[#2d3748] rounded-lg p-3 space-y-2">
        <p className="text-xs text-muted-foreground">
          {theme === 'auto' ? (
            <>
              <span className="font-medium text-blue-400">Automático:</span> Alterna conforme hora do dia
              <br />
              <span className="text-[10px] text-muted-foreground/70">
                🌙 18:00 - 06:00 = Escuro | ☀️ 06:00 - 18:00 = Claro
              </span>
            </>
          ) : theme === 'light' ? (
            <span className="text-blue-400">☀️ Tema claro ativado</span>
          ) : (
            <span className="text-amber-400">🌙 Tema escuro ativado</span>
          )}
        </p>

        {theme === 'auto' && (
          <div className="text-[10px] text-muted-foreground/70 pt-2 border-t border-[#2d3748]">
            <p>
              <span className="font-medium">Agora:</span> {currentHour.toString().padStart(2, '0')}:00
            </p>
            <p>
              <span className="font-medium">Modo ativo:</span>{' '}
              <span className={isDarkNow ? 'text-amber-400' : 'text-blue-400'}>
                {isDarkNow ? '🌙 Escuro' : '☀️ Claro'}
              </span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
