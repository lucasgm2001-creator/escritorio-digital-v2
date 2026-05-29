import { createClient } from '@/lib/supabase/server'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function AdministrativoPage() {
  const supabase = createClient()

  const [
    { count: totalLeads },
    { count: totalClients },
    { count: totalSellers },
    { data: profiles },
  ] = await Promise.all([
    supabase.from('leads').select('*', { count: 'exact', head: true }),
    supabase.from('clients').select('*', { count: 'exact', head: true }),
    supabase.from('sellers').select('*', { count: 'exact', head: true }),
    supabase.from('profiles').select('id, name, role, email, created_at').order('name'),
  ])

  const roleLabel: Record<string, string> = {
    admin: 'Administrador', comercial: 'Comercial',
    trafego: 'Tráfego', financeiro: 'Financeiro',
  }
  const roleColors: Record<string, string> = {
    admin:     'border-violet-800/50 bg-violet-900/20 text-violet-400',
    comercial: 'border-blue-800/50  bg-blue-900/20  text-blue-400',
    trafego:   'border-indigo-800/50 bg-indigo-900/20 text-indigo-400',
    financeiro:'border-green-800/50  bg-green-900/20  text-green-400',
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold text-foreground tracking-tight">Administrativo</h1>
        <p className="text-muted-foreground text-sm mt-0.5">Gestão interna da equipe e do sistema</p>
      </div>

      {/* Overview KPIs */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total de Leads',    value: totalLeads   ?? 0, color: 'text-blue-400',   accent: 'before:bg-blue-500' },
          { label: 'Total de Clientes', value: totalClients ?? 0, color: 'text-green-400',  accent: 'before:bg-green-500' },
          { label: 'Vendedores',        value: totalSellers ?? 0, color: 'text-violet-400', accent: 'before:bg-violet-500' },
        ].map(s => (
          <div key={s.label} className={`stat-card ${s.accent}`}>
            <p className="text-xs text-muted-foreground font-medium">{s.label}</p>
            <p className={`text-3xl font-bold mt-1 tabular-nums ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Users table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Usuários do Sistema</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[#2d3748] bg-[#0d1117]/50">
                {['Usuário', 'E-mail', 'Perfil', 'Membro desde'].map(h => (
                  <th key={h} className="text-left text-xs text-muted-foreground font-semibold px-4 py-3 uppercase tracking-wide">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2d3748]/60">
              {(profiles ?? []).map(p => (
                <tr key={p.id} className="hover:bg-[#1a2133]/60 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg bg-primary-600/20 border border-primary-600/30 flex items-center justify-center shrink-0">
                        <span className="text-xs font-bold text-primary-400">{p.name?.[0] ?? '?'}</span>
                      </div>
                      <span className="font-medium text-foreground">{p.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{p.email ?? '—'}</td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2.5 py-1 rounded-full border font-semibold ${roleColors[p.role] ?? 'border-[#2d3748] bg-[#1e2533] text-muted-foreground'}`}>
                      {roleLabel[p.role] ?? p.role}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">
                    {p.created_at ? new Date(p.created_at).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  )
}
