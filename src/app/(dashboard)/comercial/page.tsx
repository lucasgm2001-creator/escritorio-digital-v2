import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from './KanbanBoard'

export default async function ComercialPage() {
  const supabase = createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('score', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user?.id ?? '')
    .single()

  return (
    <KanbanBoard
      initialLeads={leads ?? []}
      currentUser={{ id: profile?.id ?? '', name: profile?.name ?? 'Usuário', role: profile?.role ?? 'comercial' }}
    />
  )
}
