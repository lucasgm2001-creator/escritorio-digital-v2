import { createClient } from '@/lib/supabase/server'
import { ClientesClient } from './ClientesClient'

export default async function ClientesPage() {
  const supabase = createClient()

  const [{ data: clients }, { data: { user } }] = await Promise.all([
    supabase.from('clients').select('*').order('created_at', { ascending: false }),
    supabase.auth.getUser(),
  ])

  const { data: profile } = await supabase
    .from('profiles').select('id, name').eq('id', user?.id ?? '').single()

  return (
    <ClientesClient
      initialClients={clients ?? []}
      currentUser={{ id: profile?.id ?? '', name: profile?.name ?? '' }}
    />
  )
}
