import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getProfile } from '@/lib/supabase/session'
import { TarefasClient } from './TarefasClient'
import type { Task, LinkOption } from './types'

export default async function TarefasPage() {
  const supabase = createClient()

  const user = await getSessionUser()
  if (!user) redirect('/login')

  // Tarefas do dono + leads/clients (p/ vincular) + profile (cacheado) — tudo em paralelo.
  const [tasksRes, leadsRes, clientsRes, profile] = await Promise.all([
    supabase.from('tasks').select('*').eq('user_id', user.id).order('due_date', { ascending: true }),
    supabase.from('leads').select('id, name, phone, company, nicho').order('name'),
    supabase.from('clients').select('id, name, phone, company').order('name'),
    getProfile(user.id),
  ])

  const linkOptions: LinkOption[] = [
    ...(leadsRes.data ?? []).map(l => ({ type: 'lead' as const, id: l.id, name: l.name, phone: l.phone, detail: l.nicho || l.company || null })),
    ...(clientsRes.data ?? []).map(c => ({ type: 'client' as const, id: c.id, name: c.name, phone: c.phone, detail: c.company || null })),
  ]

  return (
    <TarefasClient
      initialTasks={(tasksRes.data ?? []) as Task[]}
      linkOptions={linkOptions}
      currentUser={{ id: profile?.id ?? user.id, name: profile?.name ?? '' }}
    />
  )
}
