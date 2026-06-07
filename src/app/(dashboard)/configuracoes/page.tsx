import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ConfiguracoesClient } from './ConfiguracoesClient'

export default async function ConfiguracoesPage() {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  return (
    <ConfiguracoesClient userId={user.id} />
  )
}
