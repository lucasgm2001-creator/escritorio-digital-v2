import { resolveRate } from '@/lib/commission/calc'
import type { FxConfig } from '@/lib/commission/types'
import type { createClient } from '@/lib/supabase/client'
import type { LeadStatus } from './types'
import { ymd } from '@/lib/format'
import { markMilestones } from '@/lib/leadMilestones'
import { wonSlug, marcosForSlug, type FunnelStage } from '@/lib/funnelStages'
import { resolveClientPlan } from '@/lib/commission/actions'
import { weeklyCommissionUsd, hasCommissionPct, LEGACY_VPS_USD, DEFAULT_TETO_SEMANAS } from '@/lib/commission/planCommission'

type SupaClient = ReturnType<typeof createClient>

// Mensagem de efeito colateral (ex: comissão lançada). O funil mostra como toast;
// o agente do Hall mostra como texto no chat.
export type ActionNote = { message: string; type: 'success' | 'error' }

// Campos mínimos que mover/won-flow precisam. Um Lead completo é compatível.
export interface MovableLead {
  id: string
  name: string
  status: LeadStatus
  email?: string | null
  phone?: string | null
  company?: string | null
  assigned_to?: string | null
  assigned_name?: string | null
}

// Fluxo de "ganhou" (lead → Venda Fechada): atividade + cliente (idempotente, reativa
// se inativo) + LANÇA o deal de comissão (+1ª semana paga). Idempotente: não duplica se
// o lead sair e voltar (dedup por lead_id, com fallback client_name+seller).
// Extraído do KanbanBoard pra ser reusado pelo agente do Hall — MESMA lógica, sem duplicar.
export async function runWonFlow(supabase: SupaClient, lead: MovableLead, userName: string, planoId: string | null = null): Promise<ActionNote[]> {
  const notes: ActionNote[] = []
  const today = ymd(new Date())

  await supabase.from('activities').insert({
    type: 'lead',
    description: `Lead ${lead.name} movido para Venda Fechada`,
    user_name: userName,
    entity_id: lead.id,
  })

  // 1) Cliente idempotente: reusa se já existe (por nome); senão cria. Reativa se inativo.
  let clientId: string | null = null
  const { data: existing } = await supabase.from('clients').select('id, status').eq('name', lead.name).limit(1)
  if (existing && existing.length) {
    clientId = existing[0].id
    if (existing[0].status !== 'ativo') {
      await supabase.from('clients').update({ status: 'ativo' }).eq('id', existing[0].id)
    }
  } else {
    const { data: newClient, error: clientErr } = await supabase.from('clients').insert({
      name: lead.name, email: lead.email ?? null, phone: lead.phone ?? null, company: lead.company ?? null,
      plan_weekly: 0, status: 'ativo',
      assigned_to: lead.assigned_to ?? null, assigned_name: lead.assigned_name ?? null,
      start_date: new Date().toISOString(),
    }).select('id').single()
    if (clientErr) notes.push({ message: `Lead movido, mas falhou ao cadastrar o cliente: ${clientErr.message}`, type: 'error' })
    else clientId = newClient?.id ?? null
  }

  // GUARDA: sem cliente vinculado NÃO criamos o deal — deal órfão (client_id null) quebra a
  // derivação da comissão. Avisa (não falha silencioso) e para aqui.
  if (!clientId) {
    console.error('[runWonFlow] client_id nulo — venda NÃO criada para evitar deal órfão', { lead: lead.name })
    notes.push({ message: 'Lead movido, mas NÃO lancei a comissão: não consegui vincular o cliente. Cadastre o cliente e lance a venda manualmente.', type: 'error' })
    return notes
  }

  // Dono do deal = vendedor ativo (decisão: hoje só há 1). Resolve dinamicamente,
  // sem id de fallback fixo. Sem vendedor ativo → não cria deal com id inventado.
  const { data: activeSellers } = await supabase.from('sellers').select('id').eq('status', 'ativo').order('created_at')
  if (!activeSellers || activeSellers.length === 0) {
    notes.push({ message: 'Cliente cadastrado, mas não lancei a comissão: nenhum vendedor ativo configurado.', type: 'error' })
    return notes
  }
  // TODO(multi-vendedor): hoje usamos o primeiro ativo. Quando houver vários, atribuir
  // ao responsável do lead (lead.assigned_to) em vez do primeiro.
  const sellerId = activeSellers[0].id

  // 2) Deal idempotente: não cria se já existe deal deste lead (lead_id) ou mesmo
  //    client_name+seller (cobre deals antigos sem lead_id). Evita comissão dobrada.
  const { data: deals } = await supabase.from('deals').select('id, lead_id, client_name').eq('seller_id', sellerId)
  if ((deals ?? []).some(x => x.lead_id === lead.id || x.client_name === lead.name)) return notes

  // 2.5) Plano escolhido no fechamento (Fase 2A): grava no cliente + calcula a comissão/semana
  //      pelo % do plano. Sem plano OU plano sem % → LEGADO (US$25/sem). NÃO mexe em payWeek/calc.
  let vps = LEGACY_VPS_USD
  let pctUsed: number | null = null
  if (planoId) {
    await supabase.from('clients').update({ plano_id: planoId }).eq('id', clientId)
    const { data: pl } = await supabase.from('plans').select('valor_semanal, comissao_percentual').eq('id', planoId).maybeSingle()
    const pct = pl?.comissao_percentual != null ? Number(pl.comissao_percentual) : null
    if (pl && hasCommissionPct(pct)) {
      pctUsed = pct
      vps = weeklyCommissionUsd(Number(pl.valor_semanal), pct)
    }
  }
  const tetoSemanas = DEFAULT_TETO_SEMANAS
  const valorTotalUsd = Math.round(vps * tetoSemanas * 100) / 100

  const { data: deal, error: dealErr } = await supabase.from('deals').insert({
    seller_id: sellerId, client_id: clientId, client_name: lead.name, lead_id: lead.id,
    valor_total_usd: valorTotalUsd, teto_semanas: tetoSemanas, valor_por_semana_usd: vps,
    comissao_percentual: pctUsed,
    status: 'em_andamento', data_fechamento: today,
  }).select('id').single()
  if (dealErr || !deal) {
    notes.push({ message: `Cliente ok, mas não foi possível lançar a comissão: ${dealErr?.message ?? 'erro'}`, type: 'error' })
    return notes
  }

  // 3) 1ª semana já paga, com a cotação vigente (mesma lógica do registro manual).
  const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
  const { error: wkErr } = await supabase.from('weekly_payments').insert({
    deal_id: deal.id, numero_semana: 1, valor_usd: vps, paid_on: today, cotacao_usd_brl: resolveRate(fxc, manual ?? 0),
  })
  if (wkErr) { notes.push({ message: `Deal criado, mas falhou a 1ª semana: ${wkErr.message}`, type: 'error' }); return notes }

  // RECEITA da semana 1 (ledger do cliente) — espelha a comissão da semana 1. ADITIVO: NÃO
  // toca na comissão; best-effort (não quebra o fechamento). Cliente sem plano → padrão (140).
  if (clientId) {
    const plan = await resolveClientPlan(supabase, clientId)
    await supabase.from('client_payments').insert({
      client_id: clientId, numero_semana: 1, valor_usd: plan.valorUsd, paid_on: today,
      cotacao_usd_brl: resolveRate(fxc, manual ?? 0), plano_id: plan.planoId,
    })
  }

  notes.push({ message: 'Venda registrada: comissão lançada', type: 'success' })
  return notes
}

// Move um lead de estágio: persiste status + stage_changed_at e, ao ir pra "fechado",
// dispara o won-flow (comissão). NÃO faz UI — devolve resultado + notas pro chamador
// decidir como mostrar (toast no funil / texto no chat do agente).
export async function moveLead(
  supabase: SupaClient, lead: MovableLead, newStatus: LeadStatus, userName: string, stages: FunnelStage[], planoId: string | null = null,
): Promise<{ ok: boolean; error?: string; notes: ActionNote[] }> {
  if (lead.status === newStatus) return { ok: true, notes: [] }
  const nowIso = new Date().toISOString()
  const { error } = await supabase
    .from('leads').update({ status: newStatus, stage_changed_at: nowIso, updated_at: nowIso }).eq('id', lead.id)
  if (error) return { ok: false, error: error.message, notes: [] }
  // Marcos do ciclo (relatório) — significado lido de funnel_stages. Idempotente, NÃO mexe em comissão.
  await markMilestones(supabase, lead.id, marcosForSlug(stages, newStatus))
  // Won-flow (DINHEIRO) dispara pela FLAG is_won da fase (não por slug fixo). Comportamento idêntico.
  const won = wonSlug(stages)
  const notes = (newStatus === won && lead.status !== won) ? await runWonFlow(supabase, lead, userName, planoId) : []
  return { ok: true, notes }
}
