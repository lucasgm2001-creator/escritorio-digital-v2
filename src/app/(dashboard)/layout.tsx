import { redirect } from 'next/navigation'
import { DashboardShell } from '@/components/layout/DashboardShell'
import { ToastProvider } from '@/components/ui/toast'
import { capitalizeName } from '@/lib/utils'
import { getRequestContext } from '@/server/context/request-context'
import { CommissionLockProvider } from '@/components/commission/CommissionLock'

const PAGE_TITLES: Record<string, string> = {
  '/hall':           'Hall',
  '/comercial':      'Comercial',
  '/studio':         'Studio de Apresentação',
  '/tarefas':        'Tarefas',
  '/clientes':       'Clientes',
  '/configuracoes':  'Configurações',
  '/perfil':         'Meu Perfil',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  // Auth primeiro (necessária para o resto); NÃO redirecionar em erro de profile —
  // o usuário ESTÁ autenticado (getUser passou); redirecionar daqui colidiria com o
  // middleware e criaria loop (ERR_TOO_MANY_REDIRECTS). Em erro, nome cai pro e-mail.
  const context = await getRequestContext()
  if (!context) redirect('/login')

  // GUARDA DE EQUIPE (multi-tenant): sem linha em team_members (RLS já restringe à própria equipe) → manda
  // pro /onboarding (criar/entrar em equipe). Quem JÁ tem equipe segue direto, sem nunca ver o onboarding.
  if (context.memberships.length === 0) redirect('/onboarding')

  // profile (name + avatar numa query só, cacheada por request). A marca do app é estática
  // (public/logo-full.png na Sidebar/cabeçalho) — não depende mais do logo do Storage.
  const avatarUrl = context.profile?.avatar_url ?? null

  return (
    <DashboardShell
      userName={capitalizeName(context.profile?.name ?? context.user.email?.split('@')[0] ?? 'Usuário')}
      userId={context.user.id}
      avatarUrl={avatarUrl}
      pageTitles={PAGE_TITLES}
    >
      <ToastProvider><CommissionLockProvider>{children}</CommissionLockProvider></ToastProvider>
    </DashboardShell>
  )
}
