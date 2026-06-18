import { KanbanBoard } from './KanbanBoard'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getProfile } from '@/lib/supabase/session'

export default async function ComercialPage() {
  const supabase = createClient()

  // getUser (cacheado — reusa o do layout) em paralelo com os leads; profile depois (cacheado).
  const [user, { data: leads }] = await Promise.all([
    getSessionUser(),
    supabase.from('leads').select('*').order('score', { ascending: false }),
  ])
  const profile = await getProfile(user?.id ?? '')

  return (
    <KanbanBoard
      initialLeads={leads ?? []}
      currentUser={{
        id:   profile?.id   ?? user?.id   ?? '',
        name: profile?.name ?? user?.email?.split('@')[0] ?? 'Usuário',
      }}
    />
  )
}
