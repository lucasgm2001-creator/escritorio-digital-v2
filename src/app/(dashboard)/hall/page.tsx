import { HallClient } from './HallClient'
import { capitalizeName } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getProfile } from '@/lib/supabase/session'
import type { Task, LinkOption } from '../tarefas/types'

export default async function HallPage() {
  const supabase = createClient()
  const user = await getSessionUser()

  // Atividades + avisos (Visão Geral) + tarefas/leads/clients (aba Tarefas) + profile — em paralelo.
  const [{ data: activities }, { data: notices }, tasksRes, leadsRes, clientsRes, profile] = await Promise.all([
    supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(10),
    supabase.from('tasks').select('*').eq('user_id', user?.id ?? '').order('due_date', { ascending: true }),
    supabase.from('leads').select('id, name, phone, company, nicho').order('name'),
    supabase.from('clients').select('id, name, phone, company').order('name'),
    getProfile(user?.id ?? ''),
  ])

  const linkOptions: LinkOption[] = [
    ...(leadsRes.data ?? []).map(l => ({ type: 'lead' as const, id: l.id, name: l.name, phone: l.phone, detail: l.nicho || l.company || null })),
    ...(clientsRes.data ?? []).map(c => ({ type: 'client' as const, id: c.id, name: c.name, phone: c.phone, detail: c.company || null })),
  ]

  return (
    <HallClient
      initialActivities={activities ?? []}
      initialNotices={notices ?? []}
      initialTasks={(tasksRes.data ?? []) as Task[]}
      linkOptions={linkOptions}
      userName={capitalizeName(profile?.name ?? user?.email?.split('@')[0] ?? 'Usuário')}
      userId={user?.id ?? ''}
    />
  )
}
