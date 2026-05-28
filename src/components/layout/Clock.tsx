'use client'

import { useEffect, useState } from 'react'

interface ClockProps {
  timezone: string
  label: string
}

function Clock({ timezone, label }: ClockProps) {
  const [time, setTime] = useState('')

  useEffect(() => {
    const update = () => {
      setTime(new Date().toLocaleTimeString('pt-BR', { timeZone: timezone, hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [timezone])

  return (
    <div className="text-center">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-2xl font-mono font-bold text-primary-900">{time}</p>
    </div>
  )
}

export function Clocks() {
  return (
    <div className="flex items-center gap-8">
      <Clock timezone="America/Sao_Paulo" label="Brasil (SP)" />
      <div className="w-px h-10 bg-border" />
      <Clock timezone="America/New_York" label="EUA (NY)" />
    </div>
  )
}
