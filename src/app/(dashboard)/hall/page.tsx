import { HallClient } from './HallClient'
import { capitalizeName } from '@/lib/utils'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getProfile } from '@/lib/supabase/session'

export default async function HallPage() {
  const supabase = createClient()

  // user (cacheado, reusa o do layout) + atividades + avisos em paralelo; profile depois (cacheado).
  const [user, { data: activities }, { data: notices }] = await Promise.all([
    getSessionUser(),
    supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(10),
  ])
  const profile = await getProfile(user?.id ?? '')

  return (
    <HallClient
      initialActivities={activities ?? []}
      initialNotices={notices ?? []}
      userName={capitalizeName(profile?.name ?? user?.email?.split('@')[0] ?? 'Usuário')}
      userId={user?.id ?? ''}
    />
  )
}
