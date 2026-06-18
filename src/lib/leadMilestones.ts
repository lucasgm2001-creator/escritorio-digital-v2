import type { createClient } from '@/lib/supabase/client'

type SupaClient = ReturnType<typeof createClient>
export type Marco = 'interagiu' | 'reuniao' | 'fechou'

// Marcos do ciclo gravados ao ENTRAR no estágio. Avançar acumula (proposta = interagiu+reuniao;
// fechado = os 3). Estágios off-path (novo, nao_interagiu, perdido, lixeira) não gravam nada.
const STAGE_MARCOS: Record<string, Marco[]> = {
  interagiu:     ['interagiu'],
  reuniao:       ['interagiu'],            // Reunião Agendada: só interagiu (reunião "feita" é avançar daqui)
  no_show:       ['interagiu'],
  reagendamento: ['interagiu'],
  proposta:      ['interagiu', 'reuniao'],
  fechado:       ['interagiu', 'reuniao', 'fechou'],
}

export function marcosForStage(status: string): Marco[] {
  return STAGE_MARCOS[status] ?? []
}

// Upsert idempotente (1x por lead por marco) — on conflict (lead_id, marco) do nothing.
// Best-effort: não lança nem bloqueia o fluxo chamador se falhar.
export async function markMilestones(supabase: SupaClient, leadId: string, marcos: Marco[]): Promise<void> {
  if (!leadId || marcos.length === 0) return
  const rows = marcos.map(marco => ({ lead_id: leadId, marco }))
  await supabase.from('lead_milestones').upsert(rows, { onConflict: 'lead_id,marco', ignoreDuplicates: true })
}
