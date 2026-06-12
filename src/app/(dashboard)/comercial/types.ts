export type LeadStatus = 'novo' | 'interagiu' | 'reuniao' | 'proposta' | 'fechado' | 'nao_interagiu' | 'perdido'

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
  created_at: string
}

// `tone` governa o FUNIL (Kanban estilo Pipedrive): etapas do meio são neutras;
// só ganho/perda têm cor (e suave). Os campos *Color continuam alimentando o
// PipelineTab/AgendaTab (visualizações que mantêm cor por etapa).
export type ColumnTone = 'neutral' | 'win' | 'loss'

export interface ColumnConfig {
  key: LeadStatus
  label: string
  tone: ColumnTone
  textColor: string
  bgColor: string
  dotColor: string
  borderColor: string
}

export const MAIN_FLOW: ColumnConfig[] = [
  { key: 'novo',      label: 'Novo Lead',   tone: 'neutral', textColor: 'text-blue-400',    bgColor: 'bg-blue-900/20',    dotColor: 'bg-blue-500',    borderColor: 'border-blue-800/40' },
  { key: 'interagiu', label: 'Interagiu',   tone: 'neutral', textColor: 'text-indigo-400',  bgColor: 'bg-indigo-900/20',  dotColor: 'bg-indigo-500',  borderColor: 'border-indigo-800/40' },
  { key: 'reuniao',   label: 'Reunião',     tone: 'neutral', textColor: 'text-purple-400',  bgColor: 'bg-purple-900/20',  dotColor: 'bg-purple-500',  borderColor: 'border-purple-800/40' },
  { key: 'proposta',  label: 'Proposta',    tone: 'neutral', textColor: 'text-amber-400',   bgColor: 'bg-amber-900/20',   dotColor: 'bg-amber-500',   borderColor: 'border-amber-800/40' },
  { key: 'fechado',   label: 'Venda Feita', tone: 'win',     textColor: 'text-lime-fg',     bgColor: 'bg-lime/15',        dotColor: 'bg-lime',        borderColor: 'border-lime/30' },
]

export const SECONDARY_FLOW: (ColumnConfig & { parentIndex: number })[] = [
  { key: 'nao_interagiu', label: 'Não Interagiu', tone: 'neutral', textColor: 'text-slate-400', bgColor: 'bg-slate-800/30', dotColor: 'bg-slate-500', borderColor: 'border-slate-700/40', parentIndex: 1 },
  { key: 'perdido',       label: 'Venda Perdida', tone: 'loss',    textColor: 'text-rose-400',  bgColor: 'bg-rose-900/20',  dotColor: 'bg-rose-500',  borderColor: 'border-rose-800/40',  parentIndex: 3 },
]

export const ALL_COLUMNS: ColumnConfig[] = [...MAIN_FLOW, ...SECONDARY_FLOW]
