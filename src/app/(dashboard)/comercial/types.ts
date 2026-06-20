export type LeadStatus =
  | 'novo' | 'interagiu' | 'nao_interagiu' | 'reuniao' | 'no_show'
  | 'reagendamento' | 'proposta' | 'fechado' | 'perdido' | 'lixeira'

export interface Lead {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  value: number
  status: LeadStatus
  score: number
  operation: 'brasil' | 'eua'
  assigned_to?: string
  assigned_name?: string
  notes?: string
  nicho?: string
  origem?: 'instagram' | 'google' | 'indicacao' | 'tiktok' | 'site' | 'outro'
  prioridade?: 'baixa' | 'media' | 'alta' | 'urgente'
  next_contact?: string
  last_contact_at?: string
  stage_changed_at?: string   // quando o lead entrou na fase atual (deal rotting)
  updated_at?: string
  created_at: string
  received_at?: string        // data de CHEGADA do lead ('YYYY-MM-DD'); default hoje. Separa de created_at (cadastro).
  fuso?: 'leste' | 'central' | 'montanha' | 'pacifico' | null   // fuso horário (EUA)
}

// Fuso horário (EUA) — valor interno → label exibido. Compartilhado (Contatos + formulários de lead/cliente).
export const FUSO_LABELS: Record<string, string> = {
  leste: 'Leste (ET)', central: 'Central (CT)', montanha: 'Montanha (MT)', pacifico: 'Pacífico (PT)',
}
export const FUSO_OPTIONS: { value: string; label: string }[] = [
  { value: 'leste', label: 'Leste (ET)' },
  { value: 'central', label: 'Central (CT)' },
  { value: 'montanha', label: 'Montanha (MT)' },
  { value: 'pacifico', label: 'Pacífico (PT)' },
]

// `tone` governa cor da fase: meio do funil = neutro; só ganho/perda têm cor.
export type ColumnTone = 'neutral' | 'win' | 'loss'

export interface ColumnConfig {
  key: LeadStatus
  label: string
  tier: number
  tone: ColumnTone
  textColor: string
  bgColor: string
  dotColor: string
  borderColor: string
}

// Funil horizontal em 6 níveis (tiers). A ORDEM aqui é a ordem lógica do funil.
export const ALL_COLUMNS: ColumnConfig[] = [
  { key: 'novo',          label: 'Novo Lead',          tier: 1, tone: 'neutral', textColor: 'text-blue-400',   bgColor: 'bg-blue-900/20',   dotColor: 'bg-blue-500',   borderColor: 'border-blue-800/40' },
  { key: 'interagiu',     label: 'Interagiu',          tier: 2, tone: 'neutral', textColor: 'text-indigo-400', bgColor: 'bg-indigo-900/20', dotColor: 'bg-indigo-500', borderColor: 'border-indigo-800/40' },
  { key: 'nao_interagiu', label: 'Não Interagiu',      tier: 2, tone: 'neutral', textColor: 'text-slate-400',  bgColor: 'bg-slate-800/30',  dotColor: 'bg-slate-500',  borderColor: 'border-slate-700/40' },
  { key: 'reuniao',       label: 'Reunião Agendada',   tier: 3, tone: 'neutral', textColor: 'text-purple-400', bgColor: 'bg-purple-900/20', dotColor: 'bg-purple-500', borderColor: 'border-purple-800/40' },
  { key: 'no_show',       label: 'No-Show',            tier: 4, tone: 'neutral', textColor: 'text-orange-400', bgColor: 'bg-orange-900/20', dotColor: 'bg-orange-500', borderColor: 'border-orange-800/40' },
  { key: 'reagendamento', label: 'Reagendamento',      tier: 4, tone: 'neutral', textColor: 'text-cyan-400',   bgColor: 'bg-cyan-900/20',   dotColor: 'bg-cyan-500',   borderColor: 'border-cyan-800/40' },
  { key: 'proposta',      label: 'Proposta em Análise',tier: 4, tone: 'neutral', textColor: 'text-amber-400',  bgColor: 'bg-amber-900/20',  dotColor: 'bg-amber-500',  borderColor: 'border-amber-800/40' },
  { key: 'fechado',       label: 'Venda Fechada',      tier: 5, tone: 'win',     textColor: 'text-lime-fg',    bgColor: 'bg-lime/15',       dotColor: 'bg-lime',       borderColor: 'border-lime/30' },
  { key: 'perdido',       label: 'Venda Perdida',      tier: 5, tone: 'loss',    textColor: 'text-rose-400',   bgColor: 'bg-rose-900/20',   dotColor: 'bg-rose-500',   borderColor: 'border-rose-800/40' },
  { key: 'lixeira',       label: 'Lixeira',            tier: 6, tone: 'neutral', textColor: 'text-bento-muted',bgColor: 'bg-bento-bg',      dotColor: 'bg-bento-muted',borderColor: 'border-bento-border' },
]

// Agrupa as fases por tier (cada tier vira uma coluna vertical no funil).
export const TIERS: ColumnConfig[][] = (() => {
  const max = Math.max(...ALL_COLUMNS.map(c => c.tier))
  return Array.from({ length: max }, (_, i) => ALL_COLUMNS.filter(c => c.tier === i + 1))
})()
