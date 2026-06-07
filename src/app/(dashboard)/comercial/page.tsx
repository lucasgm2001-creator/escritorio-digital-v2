import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from './KanbanBoard'

export default async function ComercialPage() {
  const supabase = createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('score', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()

  // Busca o perfil do usuário autenticado (app pessoal — sem papéis)
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name')
    .eq('id', user?.id ?? '')
    .single()

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
