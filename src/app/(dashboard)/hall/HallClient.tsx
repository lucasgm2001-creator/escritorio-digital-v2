'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/utils'
import type { Activity, Notice } from '@/types'

interface Props {
  initialActivities: Activity[]
  initialNotices: Notice[]
  userName: string
  userRole: string
  userId: string
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  client: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  ),
  payment: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  task: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
    </svg>
  ),
  campaign: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" />
    </svg>
  ),
  system: (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" />
    </svg>
  ),
}

const ACTIVITY_COLORS: Record<string, string> = {
  lead: 'bg-blue-50 text-blue-600',
  client: 'bg-indigo-50 text-indigo-600',
  payment: 'bg-green-50 text-green-600',
  task: 'bg-amber-50 text-amber-600',
  campaign: 'bg-purple-50 text-purple-600',
  system: 'bg-slate-50 text-slate-600',
}

const NOTICE_COLORS: Record<string, string> = {
  info: 'border-blue-200 bg-blue-50',
  warning: 'border-amber-200 bg-amber-50',
  urgent: 'border-red-200 bg-red-50',
}

function greeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export function HallClient({ initialActivities, initialNotices, userName }: Props) {
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [notices, setNotices] = useState<Notice[]>(initialNotices)

  // Supabase Realtime
  useEffect(() => {
    const supabase = createClient()

    const channel = supabase
      .channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        (payload) => {
          setActivities(prev => [payload.new as Activity, ...prev.slice(0, 19)])
        }
      )
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' },
        (payload) => {
          setNotices(prev => [payload.new as Notice, ...prev.slice(0, 4)])
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [])

  const today = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  })

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* Saudação */}
      <div>
        <h1 className="text-2xl font-bold text-primary-900">
          {greeting()}, {userName}
        </h1>
        <p className="text-muted-foreground mt-0.5 capitalize text-sm">{today}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total de Leads', value: '—', sub: 'Sincronizando...', color: 'text-blue-600' },
          { label: 'Clientes Ativos', value: '—', sub: 'Sincronizando...', color: 'text-green-600' },
          { label: 'MRR Semanal', value: '—', sub: 'Sincronizando...', color: 'text-indigo-600' },
          { label: 'Tarefas Pendentes', value: '—', sub: 'Sincronizando...', color: 'text-amber-600' },
        ].map(stat => (
          <Card key={stat.label} className="shadow-card hover:shadow-card-hover transition-shadow">
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className={`text-2xl font-bold mt-1 ${stat.color}`}>{stat.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{stat.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Feed de atividades */}
        <Card className="lg:col-span-2 shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-primary-900 text-base flex items-center gap-2">
              Atividades Recentes
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1">
            {activities.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhuma atividade ainda.</p>
            ) : activities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[activity.type]}`}>
                  {ACTIVITY_ICONS[activity.type]}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{activity.description}</p>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    {activity.user_name && (
                      <>
                        <p className="text-xs text-muted-foreground">{activity.user_name}</p>
                        <span className="text-muted-foreground text-xs">·</span>
                      </>
                    )}
                    <p className="text-xs text-muted-foreground">{timeAgo(activity.created_at)}</p>
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Mural de avisos */}
        <Card className="shadow-card">
          <CardHeader className="pb-3">
            <CardTitle className="text-primary-900 text-base">Mural de Avisos</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {notices.length === 0 ? (
              <p className="text-sm text-muted-foreground py-4 text-center">Nenhum aviso.</p>
            ) : notices.map((notice) => (
              <div key={notice.id} className={`rounded-lg border p-3 ${NOTICE_COLORS[notice.priority]}`}>
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm font-semibold text-foreground">{notice.title}</p>
                  <Badge variant={notice.priority === 'info' ? 'default' : notice.priority === 'warning' ? 'warning' : 'destructive'} className="text-xs">
                    {notice.priority === 'info' ? 'Info' : notice.priority === 'warning' ? 'Atenção' : 'Urgente'}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{notice.content}</p>
                {notice.author_name && (
                  <p className="text-xs text-muted-foreground mt-1">— {notice.author_name} · {timeAgo(notice.created_at)}</p>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Agenda da semana */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-primary-900 text-base">Semana Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((day, i) => {
              const jsDay = new Date().getDay() // 0=Dom
              const dayMap = [1, 2, 3, 4, 5]
              const diff = dayMap[i] - jsDay
              const date = new Date(Date.now() + diff * 86400000)
              const isToday = dayMap[i] === jsDay
              return (
                <div key={day} className={`rounded-xl p-3 text-center border transition-colors ${
                  isToday ? 'bg-primary-900 text-white border-primary-900' : 'bg-muted border-border hover:bg-muted/80'
                }`}>
                  <p className={`text-xs font-medium ${isToday ? 'text-primary-200' : 'text-muted-foreground'}`}>{day}</p>
                  <p className={`text-xl font-bold mt-1 ${isToday ? 'text-white' : 'text-foreground'}`}>{date.getDate()}</p>
                </div>
              )
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
