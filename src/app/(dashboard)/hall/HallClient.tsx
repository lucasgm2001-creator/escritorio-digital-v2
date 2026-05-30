'use client'

import { useEffect, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { timeAgo } from '@/lib/utils'
import { AgentChat } from './AgentChat'
import type { Activity, Notice } from '@/types'

type Tab = 'activities' | 'agent'

interface Props {
  initialActivities: Activity[]
  initialNotices: Notice[]
  userName: string
  userRole: string
  userId: string
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
  lead: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" /></svg>,
  client: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>,
  payment: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  task: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
  campaign: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z" /></svg>,
  system: <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>,
}

const ACTIVITY_COLORS: Record<string, string> = {
  lead:     'bg-blue-900/40 text-blue-400',
  client:   'bg-indigo-900/40 text-indigo-400',
  payment:  'bg-green-900/40 text-green-400',
  task:     'bg-amber-900/40 text-amber-400',
  campaign: 'bg-purple-900/40 text-purple-400',
  system:   'bg-slate-800/60 text-slate-400',
}

const NOTICE_BORDER: Record<string, string> = {
  info:    'border-blue-800/50 bg-blue-900/20',
  warning: 'border-amber-800/50 bg-amber-900/20',
  urgent:  'border-red-800/50 bg-red-900/20',
}

function computeGreeting(): string {
  const h = new Date().getHours()
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

function computeWeekDays() {
  const now = new Date()
  const jsDay = now.getDay()
  const daysToMonday = jsDay === 0 ? -6 : 1 - jsDay
  const monday = new Date(now)
  monday.setDate(monday.getDate() + daysToMonday)
  const todayStr = now.toDateString()
  return ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'].map((label, i) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + i)
    return { label, date: d.getDate(), isToday: d.toDateString() === todayStr }
  })
}

export function HallClient({ initialActivities, initialNotices, userName, userRole, userId }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('activities')
  const [activities, setActivities] = useState<Activity[]>(initialActivities)
  const [notices, setNotices]       = useState<Notice[]>(initialNotices)
  const [greeting, setGreeting]     = useState('')
  const [today, setToday]           = useState('')
  const [weekDays, setWeekDays]     = useState<{ label: string; date: number; isToday: boolean }[]>([])
  const [onlineCount, setOnlineCount] = useState(1)
  const [showNoticeForm, setShowNoticeForm] = useState(false)
  const [noticeForm, setNoticeForm] = useState({ title: '', content: '', priority: 'info' as 'info' | 'warning' | 'urgent' })
  const [savingNotice, setSavingNotice] = useState(false)

  const canPostNotice = userRole === 'admin' || userRole === 'financeiro'

  useEffect(() => {
    setGreeting(computeGreeting())
    setToday(new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
    setWeekDays(computeWeekDays())
  }, [])

  useEffect(() => {
    const supabase = createClient()
    const dataChannel = supabase.channel('hall-realtime')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activities' },
        p => setActivities(prev => [p.new as Activity, ...prev.slice(0, 19)]))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notices' },
        p => setNotices(prev => [p.new as Notice, ...prev.slice(0, 9)]))
      .subscribe()

    const presenceChannel = supabase.channel('hall-presence', { config: { presence: { key: userId } } })
    presenceChannel
      .on('presence', { event: 'sync' }, () => setOnlineCount(Object.keys(presenceChannel.presenceState()).length))
      .subscribe(async status => {
        if (status === 'SUBSCRIBED') await presenceChannel.track({ user_id: userId, name: userName })
      })

    return () => {
      dataChannel.unsubscribe().then(() => supabase.removeChannel(dataChannel))
      presenceChannel.unsubscribe().then(() => supabase.removeChannel(presenceChannel))
    }
  }, [userId, userName])

  const handlePostNotice = async () => {
    if (!noticeForm.title.trim()) return
    setSavingNotice(true)
    try {
      const supabase = createClient()
      const { error } = await supabase.from('notices').insert({ ...noticeForm, author_id: userId, author_name: userName })
      if (error) {
        console.error('Erro ao postar aviso:', error)
        alert('Erro ao postar aviso. Tente novamente.')
        setSavingNotice(false)
        return
      }
      setNoticeForm({ title: '', content: '', priority: 'info' })
      setShowNoticeForm(false)
    } catch (err) {
      console.error('Erro ao postar aviso:', err)
      alert('Erro ao postar aviso. Tente novamente.')
    } finally {
      setSavingNotice(false)
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground tracking-tight">
            {greeting ? `${greeting}, ${userName}` : userName}
          </h1>
          <p className="text-muted-foreground mt-0.5 capitalize text-sm">{today}</p>
        </div>
        <div className="flex items-center gap-2 border border-green-800/50 bg-green-900/20 rounded-full px-3 py-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
          <span className="text-xs font-medium text-green-400">{onlineCount} online</span>
        </div>
      </div>

      {/* Abas */}
      <div className="flex gap-2 border-b border-[#2d3748]">
        {[
          { id: 'activities' as Tab, label: '📊 Atividades', count: activities.length },
          { id: 'agent' as Tab, label: '🤖 Agente', count: 0 },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary-600 text-primary-400'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'activities' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <Card className="lg:col-span-2">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-sm">
                Atividades Recentes
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-0 divide-y divide-[#2d3748]/60">
              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">Nenhuma atividade ainda.</p>
              ) : activities.map(a => (
                <div key={a.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${ACTIVITY_COLORS[a.type] ?? 'bg-slate-800/60 text-slate-400'}`}>
                    {ACTIVITY_ICONS[a.type]}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground leading-snug">{a.description}</p>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      {a.user_name && <><p className="text-xs text-muted-foreground">{a.user_name}</p><span className="text-muted-foreground/50 text-xs">·</span></>}
                      <p className="text-xs text-muted-foreground">{timeAgo(a.created_at)}</p>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm">Mural de Avisos</CardTitle>
                {canPostNotice && (
                  <button
                    onClick={() => setShowNoticeForm(!showNoticeForm)}
                    className="text-xs text-primary-400 hover:text-primary-300 transition-colors font-medium flex items-center gap-1"
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Postar
                  </button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {showNoticeForm && (
                <div className="bg-[#1e2533] border border-[#2d3748] rounded-xl p-3 space-y-2 mb-3">
                  <input value={noticeForm.title} onChange={e => setNoticeForm(p => ({ ...p, title: e.target.value }))}
                    placeholder="Título" className="w-full bg-[#161b22] border border-[#2d3748] rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600" />
                  <textarea value={noticeForm.content} onChange={e => setNoticeForm(p => ({ ...p, content: e.target.value }))}
                    placeholder="Mensagem..." rows={2}
                    className="w-full bg-[#161b22] border border-[#2d3748] rounded-lg px-3 py-1.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary-600 resize-none" />
                  <div className="flex gap-1.5">
                    {(['info', 'warning', 'urgent'] as const).map(p => (
                      <button key={p} onClick={() => setNoticeForm(prev => ({ ...prev, priority: p }))}
                        className={`flex-1 py-1 rounded-md text-xs font-medium border transition-all ${
                          noticeForm.priority === p
                            ? p === 'info' ? 'bg-blue-900/40 text-blue-400 border-blue-800/50'
                              : p === 'warning' ? 'bg-amber-900/40 text-amber-400 border-amber-800/50'
                              : 'bg-red-900/40 text-red-400 border-red-800/50'
                            : 'bg-transparent text-muted-foreground border-[#2d3748]'
                        }`}>
                        {p === 'info' ? 'Info' : p === 'warning' ? 'Atenção' : 'Urgente'}
                      </button>
                    ))}
                    <button onClick={handlePostNotice} disabled={savingNotice || !noticeForm.title.trim()}
                      className="px-3 py-1 bg-primary-600 text-white rounded-lg text-xs font-semibold hover:bg-primary-500 disabled:opacity-50 transition-colors">
                      {savingNotice ? '...' : 'OK'}
                    </button>
                  </div>
                </div>
              )}
              {notices.length === 0
                ? <p className="text-sm text-muted-foreground py-6 text-center">Nenhum aviso.</p>
                : notices.map(n => (
                  <div key={n.id} className={`rounded-xl border p-3 ${NOTICE_BORDER[n.priority] ?? 'border-[#2d3748]'}`}>
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-semibold text-foreground">{n.title}</p>
                      <Badge variant={n.priority === 'info' ? 'default' : n.priority === 'warning' ? 'warning' : 'destructive'} className="text-[10px]">
                        {n.priority === 'info' ? 'Info' : n.priority === 'warning' ? 'Atenção' : 'Urgente'}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{n.content}</p>
                    {n.author_name && <p className="text-xs text-muted-foreground/60 mt-1">— {n.author_name} · {timeAgo(n.created_at)}</p>}
                  </div>
                ))
              }
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === 'agent' && (
        <div className="lg:col-span-2 h-[600px] rounded-lg border border-[#2d3748] bg-[#0d1117] overflow-hidden">
          <AgentChat />
        </div>
      )}

      {/* Semana Atual */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Semana Atual</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-5 gap-2">
            {(weekDays.length > 0 ? weekDays : ['Seg','Ter','Qua','Qui','Sex'].map(l => ({ label: l, date: 0, isToday: false }))).map(({ label, date, isToday }) => (
              <div key={label} className={`rounded-xl p-3 text-center border transition-all duration-150 ${
                isToday
                  ? 'bg-primary-600/20 border-primary-600/40 shadow-glow-sm'
                  : 'bg-[#1a2133] border-[#2d3748] hover:border-[#3d4f6a]'
              }`}>
                <p className={`text-xs font-medium ${isToday ? 'text-primary-400' : 'text-muted-foreground'}`}>{label}</p>
                <p className={`text-xl font-bold mt-1 tabular-nums ${isToday ? 'text-primary-300' : 'text-foreground'}`}>
                  {date || '—'}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
