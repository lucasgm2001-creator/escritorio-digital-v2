import type { createClient } from '@/lib/supabase/client'

type SupaClient = ReturnType<typeof createClient>

type WeekRowDb = { id: string; deal_id: string; numero_semana: number; valor_usd: number; paid_on: string; cotacao_usd_brl: number }

export type PayWeekReason = 'frozen' | 'teto' | 'dup' | 'invalid' | 'db'
interface PayDeal { id: string; valorPorSemanaUsd: number; tetoSemanas: number; status: string }

// Próxima semana NÃO paga (1..teto) de um deal; null se cheio OU congelado (não em_andamento).
// Mesma regra que o DealCard usa pra oferecer slots — extraída pra o agente decidir a semana.
export function nextUnpaidWeek(deal: { tetoSemanas: number; status: string }, paidNumbers: number[]): number | null {
  if (deal.status !== 'em_andamento') return null
  const paid = new Set(paidNumbers)
  for (let n = 1; n <= deal.tetoSemanas; n++) if (!paid.has(n)) return n
  return null
}

// Registra UMA semana paga — ÚNICA fonte da regra de dinheiro (só em_andamento, dentro do
// teto, sem duplicar a mesma semana). Reusada pela UI (Comissões) E pelo agente do Hall.
// NÃO cria deal. Congela a cotação `rate` no lançamento.
export async function payWeek(
  supabase: SupaClient, deal: PayDeal, paidNumbers: number[], numero: number, paidOn: string, rate: number,
): Promise<{ ok: boolean; reason?: PayWeekReason; message?: string; row?: WeekRowDb }> {
  if (deal.status !== 'em_andamento') return { ok: false, reason: 'frozen' }
  if (!Number.isInteger(numero) || numero < 1 || numero > deal.tetoSemanas) return { ok: false, reason: 'invalid' }
  if (paidNumbers.includes(numero)) return { ok: false, reason: 'dup' }
  const { data, error } = await supabase.from('weekly_payments').insert({
    deal_id: deal.id, numero_semana: numero, valor_usd: deal.valorPorSemanaUsd, paid_on: paidOn, cotacao_usd_brl: rate,
  }).select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').single()
  if (error) {
    // 23505 = índice único uq_weekly_payments_deal_semana (deal_id, numero_semana):
    // corrida de 2 cliques / paidNumbers desatualizado → a semana já existe no banco.
    // Vira mensagem amigável ('dup') em vez de estourar o erro cru na tela.
    if (error.code === '23505') return { ok: false, reason: 'dup' }
    return { ok: false, reason: 'db', message: error.message }
  }
  if (!data) return { ok: false, reason: 'db' }
  return { ok: true, row: data as WeekRowDb }
}

// Mensagem padronizada do porquê uma semana não pôde ser registrada (UI e agente).
export function payWeekMessage(reason: PayWeekReason | undefined, dbMessage?: string): string {
  switch (reason) {
    case 'frozen':  return 'Venda interrompida/concluída — não dá pra registrar mais semanas.'
    case 'teto':    return 'Esta venda já tem todas as semanas pagas.'
    case 'dup':     return 'Essa semana já está registrada.'
    case 'invalid': return 'Número de semana inválido.'
    default:        return `Não foi possível registrar a semana${dbMessage ? `: ${dbMessage}` : ''}.`
  }
}

// Registra uma reunião (US$15 padrão). Retorna o builder do supabase → encaixa no useSave
// da UI e no `await` direto do agente. MESMA escrita. Congela a cotação `rate`.
export function registerMeeting(
  supabase: SupaClient, sellerId: string,
  m: { metOn: string; valorUsd: number; clientId?: string | null; clientName?: string | null; note?: string | null; leadId?: string | null }, rate: number,
) {
  return supabase.from('meetings').insert({
    seller_id: sellerId, met_on: m.metOn, valor_usd: m.valorUsd, cotacao_usd_brl: rate,
    client_id: m.clientId ?? null, client_name: m.clientName ?? null, note: m.note ?? null, lead_id: m.leadId ?? null,
  }).select('id, seller_id, met_on, valor_usd, cotacao_usd_brl, client_name').single()
}

// Atualiza campos de um cliente. MESMA escrita da UI de Clientes (retorna o builder).
// NUNCA deleta — não há função de exclusão aqui de propósito.
export function updateClient(
  supabase: SupaClient, id: string,
  patch: Record<string, string | number | null>,
) {
  return supabase.from('clients').update(patch).eq('id', id)
}

// ─── Comissão nova (incremento 2): pagamento parte do CLIENTE → receita + comissão derivada ───

// Valor semanal do cliente (snapshot): plano (plans.valor_semanal) → plan_weekly → 140 (padrão).
export async function resolveClientPlan(
  supabase: SupaClient, clientId: string,
): Promise<{ planoId: string | null; valorUsd: number }> {
  const { data: cli } = await supabase.from('clients').select('plano_id, plan_weekly').eq('id', clientId).maybeSingle()
  const planoId: string | null = (cli?.plano_id as string | null) ?? null
  let valor = Number(cli?.plan_weekly) || 0
  if (planoId) {
    const { data: pl } = await supabase.from('plans').select('valor_semanal').eq('id', planoId).maybeSingle()
    if (pl?.valor_semanal != null) valor = Number(pl.valor_semanal)
  }
  if (!valor || valor <= 0) valor = 140 // padrão p/ não quebrar (cliente sem plano)
  return { planoId, valorUsd: valor }
}

export type CommissionOutcome = 'paid' | 'capped' | 'no_deal' | 'dup' | 'frozen' | 'error'

// Deriva a semana de comissão a partir da semana paga do cliente — pelo MESMO payWeek
// (US$25, teto 4, trava). NÃO muda a regra; só decide SE chama e com quais paidNumbers.
async function deriveCommission(
  supabase: SupaClient, clientId: string, numero: number, paidOn: string, rate: number,
): Promise<CommissionOutcome> {
  const { data: deals } = await supabase.from('deals')
    .select('id, valor_por_semana_usd, teto_semanas, status')
    .eq('client_id', clientId).eq('status', 'em_andamento').order('data_fechamento', { ascending: false }).limit(1)
  const deal = deals?.[0]
  if (!deal) return 'no_deal'
  if (numero > deal.teto_semanas) return 'capped'
  const { data: wk } = await supabase.from('weekly_payments').select('numero_semana').eq('deal_id', deal.id)
  const paidNumbers = (wk ?? []).map(w => w.numero_semana as number)
  const res = await payWeek(
    supabase,
    { id: deal.id, valorPorSemanaUsd: Number(deal.valor_por_semana_usd), tetoSemanas: deal.teto_semanas, status: deal.status },
    paidNumbers, numero, paidOn, rate,
  )
  if (res.ok) return 'paid'
  if (res.reason === 'dup') return 'dup'
  if (res.reason === 'frozen') return 'frozen'
  return 'error'
}

// Registra a semana N paga DO CLIENTE: RECEITA (valor do plano, SEM teto) + deriva a comissão.
// Fonte única do fluxo novo — reusa payWeek (mantém trava/regra/números). Receita idempotente
// (unique client_id+numero_semana → 'dup'). A comissão é derivada mesmo em 'dup' (auto-corrige).
export async function payClientWeek(
  supabase: SupaClient, clientId: string, numero: number, paidOn: string, rate: number,
): Promise<{ ok: boolean; reason?: 'dup' | 'invalid' | 'db'; message?: string; valorUsd?: number; commission?: CommissionOutcome }> {
  if (!Number.isInteger(numero) || numero < 1) return { ok: false, reason: 'invalid' }
  const { planoId, valorUsd } = await resolveClientPlan(supabase, clientId)

  const { error } = await supabase.from('client_payments').insert({
    client_id: clientId, numero_semana: numero, valor_usd: valorUsd, paid_on: paidOn, cotacao_usd_brl: rate, plano_id: planoId,
  })
  let dup = false
  if (error) {
    if (error.code === '23505') dup = true
    else return { ok: false, reason: 'db', message: error.message }
  }

  const commission = await deriveCommission(supabase, clientId, numero, paidOn, rate)
  if (dup) return { ok: false, reason: 'dup', commission, valorUsd }
  return { ok: true, valorUsd, commission }
}

// ESTORNO auditável: ANULA a receita (flag em client_payments, SEM delete) e REMOVE a comissão
// derivada da semana (DELETE da weekly_payment → calc.ts fica intacto: a linha simplesmente some).
// Requer as colunas anulado/anulado_em/anulado_motivo em client_payments (Lucas adiciona no banco).
export async function voidClientWeek(
  supabase: SupaClient, clientId: string, numero: number, motivo?: string | null,
): Promise<{ ok: boolean; message?: string }> {
  const { error } = await supabase.from('client_payments')
    .update({ anulado: true, anulado_em: new Date().toISOString(), anulado_motivo: motivo ?? null })
    .eq('client_id', clientId).eq('numero_semana', numero)
  if (error) return { ok: false, message: error.message }
  // Remove a comissão da MESMA semana (deal do cliente). numero>4 não tem comissão → no-op.
  const { data: deals } = await supabase.from('deals').select('id').eq('client_id', clientId).order('data_fechamento', { ascending: false }).limit(1)
  const deal = deals?.[0]
  if (deal) await supabase.from('weekly_payments').delete().eq('deal_id', deal.id).eq('numero_semana', numero)
  return { ok: true }
}
