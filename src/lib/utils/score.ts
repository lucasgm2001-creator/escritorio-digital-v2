export type ScoreFaixa =
  | 'Perdido'
  | 'Muito Frio'
  | 'Frio'
  | 'Morno'
  | 'Quente'
  | 'Muito Quente'
  | 'Fechando'

export interface ScoreInfo {
  faixa: ScoreFaixa
  color: string
  bg: string
  border: string
  dot: string
}

export function getScoreInfo(score: number): ScoreInfo {
  if (score <= 200) return { faixa: 'Perdido',      color: 'text-gray-500',  bg: 'bg-gray-100',   border: 'border-gray-300',  dot: 'bg-gray-400' }
  if (score <= 400) return { faixa: 'Muito Frio',   color: 'text-blue-500',  bg: 'bg-blue-50',    border: 'border-blue-200',  dot: 'bg-blue-400' }
  if (score <= 550) return { faixa: 'Frio',         color: 'text-cyan-600',  bg: 'bg-cyan-50',    border: 'border-cyan-200',  dot: 'bg-cyan-500' }
  if (score <= 650) return { faixa: 'Morno',        color: 'text-yellow-600',bg: 'bg-yellow-50',  border: 'border-yellow-200',dot: 'bg-yellow-500' }
  if (score <= 800) return { faixa: 'Quente',       color: 'text-orange-600',bg: 'bg-orange-50',  border: 'border-orange-200',dot: 'bg-orange-500' }
  if (score <= 950) return { faixa: 'Muito Quente', color: 'text-red-600',   bg: 'bg-red-50',     border: 'border-red-200',   dot: 'bg-red-500' }
  return                   { faixa: 'Fechando',     color: 'text-green-700', bg: 'bg-green-50',   border: 'border-green-300', dot: 'bg-green-500' }
}

export const SCORE_DELTAS: Record<string, number> = {
  atendeu:      80,
  nao_atendeu: -30,
  mensagem:     20,
  reuniao:     150,
  proposta:    100,
}
