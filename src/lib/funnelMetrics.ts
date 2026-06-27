// Conversão GERAL (estado ATUAL do funil) — definição ÚNICA, usada igual no Funil (rodapé), no Mapa
// (Hall) e na prévia do Config. NÃO é dinheiro (só %/contagem de exibição). Não confundir com a conversão
// DO PERÍODO da aba Métricas. REGRA ÚNICA: lead com origem='cliente_existente' NUNCA conta (nem no
// numerador nem no denominador) — cliente jogado no funil não é venda. Lixeira também fica de fora.
//
//   conversão geral = fechados ÷ (leads NÃO-Lixeira E NÃO-cliente_existente)

function funnelConversionPct(leads: { status: string; origem?: string | null }[]): number {
  const base = leads.filter(l => l.origem !== 'cliente_existente' && l.status !== 'lixeira')
  const fechados = base.filter(l => l.status === 'fechado').length
  return base.length > 0 ? (fechados / base.length) * 100 : 0
}

// Rótulo padronizado (1 casa decimal) — Funil, Mapa e Config renderizam o MESMO texto.
export function funnelConversionLabel(leads: { status: string; origem?: string | null }[]): string {
  return funnelConversionPct(leads).toFixed(1)
}
