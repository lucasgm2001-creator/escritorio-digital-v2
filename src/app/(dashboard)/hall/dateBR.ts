// Dia (YYYY-MM-DD) no fuso de BRASÍLIA — util ÚNICO do Hall (consolidou toDateStr + saoPauloDay,
// que faziam a mesma coisa). Usado no bucketing da Agenda + Mural + KPIs. Antes o toDateStr usava
// toISOString() (UTC) e à noite (após ~21h BRT) virava o dia seguinte — corrigido.
export function dayBR(d: Date): string {
  return d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
}
