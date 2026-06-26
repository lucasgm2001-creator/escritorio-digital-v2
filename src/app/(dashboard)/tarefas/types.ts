export type TaskPriority = 'normal' | 'alta' | 'urgente'
export type LinkedType = 'lead' | 'client'

export interface Task {
  id: string
  user_id: string
  title: string
  notes?: string | null
  due_date?: string | null      // 'YYYY-MM-DD'
  due_time?: string | null      // 'HH:MM' (sem data própria; só faz sentido com due_date)
  done: boolean
  completed_at?: string | null
  priority: TaskPriority
  linked_type?: LinkedType | null
  linked_id?: string | null
  linked_name?: string | null
  responsavel_id?: string | null     // vendedor dono da tarefa (FK sellers)
  responsavel_nome?: string | null   // nome no momento (exibição/relatório)
  google_event_id?: string | null    // id do evento no Google Agenda (sync via conta de serviço)
  add_call?: boolean                  // inclui o link de chamada do usuário (profiles.call_link) no evento
  is_meeting?: boolean                // modo Reunião (SÓ organização/calendário — NÃO mexe em comissão)
  duration_min?: number | null        // duração do evento em minutos (reunião)
  timezone?: string | null            // fuso IANA do evento (reunião)
  created_at: string
  updated_at: string
}

// Opção do campo "Conectar a" (lead ou cliente existente).
export interface LinkOption {
  type: LinkedType
  id: string
  name: string
  phone?: string | null
  detail?: string | null     // empresa/nicho — p/ diferenciar homônimos
}

// Saída do parser de linguagem natural (/api/tasks/parse).
export interface ParsedTask {
  title: string
  due_date: string           // 'YYYY-MM-DD' ou ''
  due_time: string           // 'HH:MM' ou ''
  priority: TaskPriority
  contact_name: string       // nome solto p/ casar com um LinkOption
}
