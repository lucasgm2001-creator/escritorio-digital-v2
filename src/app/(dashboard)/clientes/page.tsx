import { ClientesClient } from './ClientesClient'
import { createClient } from '@/lib/supabase/server'
import { getSessionUser, getProfile } from '@/lib/supabase/session'

export default async function ClientesPage() {
  const supabase = createClient()

  const [user, { data: clients }] = await Promise.all([
    getSessionUser(),
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
  ])
  const profile = await getProfile(user?.id ?? '')

  return (
    <ClientesClient
      initialClients={clients ?? []}
      currentUser={{ id: profile?.id ?? user?.id ?? '', name: profile?.name ?? '' }}
    />
  )
}
