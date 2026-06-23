import type { SupabaseClient } from '@supabase/supabase-js'

// Histórico de MOVIMENTAÇÃO do funil (tabela stage_events, já criada no banco). ADITIVO:
// só registra a mudança de fase — não toca em nada de comissão/dinheiro. NUNCA lança: uma
// falha de log não pode quebrar a criação/movimentação do lead (best-effort, try/catch).
export interface StageEventInput {
  leadId: string
  leadName: string
  fromStage: string | null   // null = criação do lead (entrou no funil)
  toStage: string
  sellerId?: string | null
  sellerName?: string | null
}

export async function logStageEvent(
  supabase: SupabaseClient,
  { leadId, leadName, fromStage, toStage, sellerId, sellerName }: StageEventInput,
): Promise<void> {
  try {
    await supabase.from('stage_events').insert({
      lead_id: leadId,
      lead_name: leadName,
      from_stage: fromStage,
      to_stage: toStage,
      seller_id: sellerId ?? null,
      seller_name: sellerName ?? null,
      changed_at: new Date().toISOString(),
    })
  } catch {
    /* log de evento é secundário — não quebra o fluxo do lead */
  }
}
