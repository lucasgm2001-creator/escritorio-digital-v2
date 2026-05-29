import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { DashboardShell } from '@/components/layout/DashboardShell'

const PAGE_TITLES: Record<string, string> = {
  '/hall':           'Hall',
  '/comercial':      'Comercial',
  '/clientes':       'Clientes',
  '/financeiro':     'Financeiro',
  '/trafego':        'Tráfego',
  '/administrativo': 'Administrativo',
  '/configuracoes':  'Configurações',
}

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles')
    .select('name, role')
    .eq('id', user.id)
    .single()

  return (
    <DashboardShell
      userName={profile?.name ?? user.email?.split('@')[0] ?? 'Usuário'}
      userRole={profile?.role ?? 'admin'}
      pageTitles={PAGE_TITLES}
    >
      {children}
    </DashboardShell>
  )
}
