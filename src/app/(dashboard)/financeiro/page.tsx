import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function FinanceiroPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">Financeiro</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Receitas mês', value: 'R$ 68.400', color: 'text-green-600' },
          { label: 'Despesas mês', value: 'R$ 21.200', color: 'text-red-600' },
          { label: 'Saldo', value: 'R$ 47.200', color: 'text-primary-700' },
          { label: 'A receber', value: 'R$ 12.800', color: 'text-amber-600' },
        ].map(s => (
          <Card key={s.label} className="shadow-card">
            <CardContent className="pt-5">
              <p className="text-sm text-muted-foreground">{s.label}</p>
              <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>
      <Card className="shadow-card">
        <CardHeader><CardTitle>Fluxo de Caixa</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Gráficos e tabelas financeiras serão implementados aqui.</p>
        </CardContent>
      </Card>
    </div>
  )
}
