import { KanbanBoard } from './KanbanBoard'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getProfile } from '@/lib/supabase/session'
import { getStages } from '@/lib/funnelStages.server'

export default async function ComercialPage() {
  const supabase = createClient()

  // getUser (cacheado — reusa o do layout) em paralelo com os leads e as fases do funil.
  const [user, { data: leads }, stages, { data: clients }] = await Promise.all([
    getSessionUser(),
    supabase.from('leads').select('*').order('score', { ascending: false }),
    getStages(),
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
  ])
  const profile = await getProfile(user?.id ?? '')

  return (
    <KanbanBoard
      initialLeads={leads ?? []}
      initialStages={stages}
      initialClients={clients ?? []}
      currentUser={{
        id:   profile?.id   ?? user?.id   ?? '',
        name: profile?.name ?? user?.email?.split('@')[0] ?? 'Usuário',
      }}
    />
  )
}
