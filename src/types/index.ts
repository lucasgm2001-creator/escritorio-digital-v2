export interface UserProfile {
  id: string
  name: string
  avatar?: string
  email?: string
}

// Tipos com snake_case — espelham o banco Supabase
export interface Lead {
  id: string
  name: string
  company?: string
  email?: string
  phone?: string
  value: number
  status: 'novo' | 'interagiu' | 'reuniao' | 'proposta' | 'fechado' | 'nao_interagiu' | 'perdido'
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
  updated_at: string
}

export interface Client {
  id: string
  name: string
  email?: string
  phone?: string
  company?: string
  plan_weekly: number
  status: 'ativo' | 'inativo' | 'prospect'
  start_date?: string
  end_date?: string
  end_reason?: string
  assigned_to?: string
  assigned_name?: string
  created_at: string
  updated_at: string
}

export interface Commission {
  id: string
  seller_id: string
  lead_id?: string
  client_id?: string
  amount: number
  percentage: number
  status: 'pendente' | 'aprovada' | 'paga'
  due_date?: string
  paid_at?: string
  created_at: string
}

export interface Task {
  id: string
  title: string
  description?: string
  assigned_to?: string
  status: 'pendente' | 'em_andamento' | 'concluida' | 'cancelada'
  priority: 'baixa' | 'media' | 'alta' | 'urgente'
  due_date?: string
  created_at: string
  updated_at: string
}

export interface Campaign {
  id: string
  name: string
  platform: 'google' | 'meta' | 'instagram' | 'tiktok' | 'outro'
  status: 'ativa' | 'pausada' | 'encerrada'
  budget: number
  spent: number
  leads: number
  conversions: number
  start_date: string
  end_date?: string
  managed_by?: string
}

export interface Payment {
  id: string
  client_id?: string
  description: string
  amount: number
  type: 'receita' | 'despesa'
  status: 'pendente' | 'pago' | 'cancelado' | 'atrasado'
  due_date: string
  paid_at?: string
  category?: string
  created_at: string
}

export interface Seller {
  id: string
  name: string
  email?: string
  phone?: string
  status: 'ativo' | 'inativo'
  total_sales: number
  total_commissions: number
  leads_assigned: number
  conversion_rate: number
}

export interface AgentAnalysis {
  agentId: string
  agentName: string
  analysisType: string
  summary: string
  insights: string[]
  recommendations: string[]
  data?: Record<string, unknown>
  createdAt: string
}

export interface Activity {
  id: string
  type: 'lead' | 'client' | 'payment' | 'task' | 'campaign' | 'system'
  description: string
  user_id?: string
  user_name?: string
  entity_id?: string
  created_at: string
}

export interface Notice {
  id: string
  title: string
  content: string
  priority: 'info' | 'warning' | 'urgent'
  author_id?: string
  author_name?: string
  expires_at?: string
  created_at: string
}
