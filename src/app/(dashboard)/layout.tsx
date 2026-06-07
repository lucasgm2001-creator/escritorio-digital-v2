import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { capitalizeName } from '@/lib/utils'
import { getSystemLogoUrl } from '@/lib/logo'

const PAGE_TITLES: Record<string, string> = {
  '/hall':           'Hall',
  '/comercial':      'Comercial',
  '/clientes':       'Clientes',
  '/configuracoes':  'Configurações',
  '/perfil':         'Meu Perfil',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Só o nome do usuário (app pessoal de usuário único — sem papéis).
  // ATENÇÃO: NÃO redirecionar para /login em erro de leitura do profile.
  // O usuário ESTÁ autenticado (getUser passou) — o que falha é a query da
  // tabela profiles. Redirecionar daqui colide com o middleware (que manda
  // usuário logado de /login de volta para /hall) e cria loop infinito
  // (ERR_TOO_MANY_REDIRECTS). Em erro, caímos no nome derivado do e-mail.
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('name')
    .eq('id', user.id)
    .single()

  if (profileError || !profile) {
    console.error('[dashboard/layout] profile fetch failed:', profileError)
  }

  // avatar_url é opcional (pode não existir antes da migration 010/011).
  // Best-effort e isolada: qualquer erro de schema vira avatar nulo.
  let avatarUrl: string | null = null
  try {
    const { data: extra } = await supabase
      .from('profiles')
      .select('avatar_url')
      .eq('id', user.id)
      .single()
    avatarUrl = extra?.avatar_url ?? null
  } catch {
    avatarUrl = null
  }

  // Logo do sistema: URL pública (com versão p/ cache-bust) do bucket `assets`,
  // ou null se não houver logo enviada. Global para todos os usuários.
  const logoUrl = await getSystemLogoUrl(supabase)

  return (
    <DashboardShell
      userName={capitalizeName(profile?.name ?? user.email?.split('@')[0] ?? 'Usuário')}
      userId={user.id}
      avatarUrl={avatarUrl}
      logoUrl={logoUrl}
      pageTitles={PAGE_TITLES}
    >
      {children}
    </DashboardShell>
  )
}
