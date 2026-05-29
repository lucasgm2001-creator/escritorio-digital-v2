import { createClient } from '@/lib/supabase/server'
import { KanbanBoard } from './KanbanBoard'

export default async function ComercialPage() {
  const supabase = createClient()

  const { data: leads } = await supabase
    .from('leads')
    .select('*')
    .order('score', { ascending: false })

  const { data: { user } } = await supabase.auth.getUser()

  // Busca o perfil completo do usuário autenticado
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, name, role')
    .eq('id', user?.id ?? '')
    .single()

  // Role real do banco — sem fallback genérico que pode esconder permissões
  const role = profile?.role ?? user?.user_metadata?.role ?? ''

  return (
    <KanbanBoard
      initialLeads={leads ?? []}
      currentUser={{
        id:   profile?.id   ?? user?.id   ?? '',
        name: profile?.name ?? user?.email?.split('@')[0] ?? 'Usuário',
        role,
      }}
    />
  )
}
