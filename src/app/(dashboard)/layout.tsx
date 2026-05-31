import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { capitalizeName } from '@/lib/utils'

const PAGE_TITLES: Record<string, string> = {
  '/hall':           'Hall',
  '/comercial':      'Comercial',
  '/clientes':       'Clientes',
  '/financeiro':     'Financeiro',
  '/trafego':        'Tráfego',
  '/administrativo': 'Administrativo',
  '/configuracoes':  'Configurações',
  '/perfil':         'Meu Perfil',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Caminho crítico: só colunas garantidas (name, role). Mantemos esta query
  // separada das colunas opcionais para que um problema de schema nunca colapse
  // o role do usuário e derrube as permissões do shell inteiro.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  if (profileError) {
    console.error('[dashboard layout] falha ao carregar name/role do perfil:', profileError.message)
  }

  // avatar_url é opcional (pode não existir antes da migration 010). Busca
  // best-effort: qualquer erro aqui vira avatar nulo, sem afetar o role.
  const { data: avatarRow } = await supabase
    .from('profiles')
    .select('avatar_url')
    .eq('id', user.id)
    .single()

  return (
    <DashboardShell
      userName={capitalizeName(profile?.name ?? user.email?.split('@')[0] ?? 'Usuário')}
      userRole={profile?.role ?? ''}
      userId={user.id}
      avatarUrl={avatarRow?.avatar_url ?? null}
      pageTitles={PAGE_TITLES}
    >
      {children}
    </DashboardShell>
  )
}
