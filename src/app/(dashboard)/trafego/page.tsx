import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function TrafegoPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <h1 className="text-3xl font-bold text-primary-900 mb-6">Tráfego</h1>
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Campanhas ativas', value: '4', color: 'text-blue-600' },
          { label: 'Leads gerados', value: '183', color: 'text-indigo-600' },
          { label: 'Custo por lead', value: 'R$ 28', color: 'text-green-600' },
          { label: 'Investimento total', value: 'R$ 5.124', color: 'text-primary-700' },
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
        <CardHeader><CardTitle>Campanhas</CardTitle></CardHeader>
        <CardContent>
          <p className="text-muted-foreground text-sm">Dashboard de campanhas será implementado aqui.</p>
        </CardContent>
      </Card>
    </div>
  )
}
