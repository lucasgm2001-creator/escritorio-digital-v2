import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function AdministrativoPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">Administrativo</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card className="shadow-card">
          <CardHeader><CardTitle>Usuários do Sistema</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Gestão de permissões e usuários.</p>
          </CardContent>
        </Card>
        <Card className="shadow-card">
          <CardHeader><CardTitle>Configurações</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground text-sm">Configurações gerais do sistema.</p>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
