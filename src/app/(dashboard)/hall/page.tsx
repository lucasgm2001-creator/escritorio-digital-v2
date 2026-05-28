import { createClient } from '@/lib/supabase/server'
import { HallClient } from './HallClient'

export default async function HallPage() {
  const supabase = createClient()

  const [
    { data: { user } },
    { data: activities },
    { data: notices },
  ] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from('activities').select('*').order('created_at', { ascending: false }).limit(20),
    supabase.from('notices').select('*').order('created_at', { ascending: false }).limit(5),
  ])

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <HallClient
      initialActivities={activities ?? []}
      initialNotices={notices ?? []}
      userName={profile?.name ?? 'Usuário'}
      userRole={profile?.role ?? 'admin'}
      userId={user?.id ?? ''}
    />
  )
}
