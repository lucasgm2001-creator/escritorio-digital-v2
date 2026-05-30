import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { createClient } from '@/lib/supabase/server'

export class SuperAgent {
  private supabase = createClient()

  private async generateAIResponse(
    systemPrompt: string,
    userMessage: string,
    maxTokens: number = 400,
    model: 'haiku' | 'sonnet' = 'haiku'
  ): Promise<string> {
    const modelId = model === 'sonnet'
      ? 'claude-3-5-sonnet-20241022'
      : 'claude-haiku-4-5-20251001'

    const { text } = await generateText({
      model: anthropic(modelId),
      system: systemPrompt,
      messages: [
        {
          role: 'user',
          content: userMessage,
        },
      ],
      maxOutputTokens: maxTokens,
    })

    return text
  }

  // Dados disponíveis para o agente analisar
  async getContextData() {
    const [
      { data: leads },
      { data: clients },
      { data: payments },
      { data: campaigns },
    ] = await Promise.all([
      this.supabase.from('leads').select('*').limit(20),
      this.supabase.from('clients').select('*').limit(20),
      this.supabase.from('payments').select('*').limit(20),
      this.supabase.from('campaigns').select('*').limit(10),
    ])

    return {
      leads: leads || [],
      clients: clients || [],
      payments: payments || [],
      campaigns: campaigns || [],
    }
  }

  // Chat interativo com o agente
  async chat(userQuestion: string, userId: string, userRole: string = 'admin'): Promise<string> {
    const context = await this.getContextData()

    // Filtrar dados pelo role do usuário
    let filteredContext = { ...context }
    if (userRole === 'comercial') {
      // Comercial só vê leads e seus próprios clientes
      filteredContext = { leads: context.leads, clients: context.clients, payments: [], campaigns: [] }
    } else if (userRole === 'financeiro') {
      // Financeiro só vê pagamentos
      filteredContext = { leads: [], clients: context.clients, payments: context.payments, campaigns: [] }
    } else if (userRole === 'trafego') {
      // Tráfego só vê campanhas e leads
      filteredContext = { leads: context.leads, clients: [], payments: [], campaigns: context.campaigns }
    }

    return this.generateAIResponse(
      `Você é um assistente inteligente do Escritório Digital DR Growth. Você ajuda a equipe respondendo perguntas sobre leads, clientes, pagamentos e campanhas. Seja conciso, prático e orientado a ações. Responda em português.`,
      `Dados disponíveis:\n${JSON.stringify(filteredContext, null, 2)}\n\nPergunta do usuário (${userRole}): ${userQuestion}`,
      400,
      'haiku'
    )
  }

  // Gerar relatório semanal completo (para Daniel/admin)
  async gerarRelatorioSemanal(): Promise<string> {
    const context = await this.getContextData()

    return this.generateAIResponse(
      'Você é um analista de negócios da DR Growth. Gere um relatório executivo semanal em português com: 1) Resumo de resultados, 2) Principais KPIs, 3) Pontos de atenção, 4) Recomendações.',
      `Dados da semana:\n${JSON.stringify(context, null, 2)}`,
      800,
      'sonnet'
    )
  }

  // Gerar resumo diário
  async gerarResumoDiario(): Promise<string> {
    const context = await this.getContextData()

    return this.generateAIResponse(
      'Gere um resumo diário conciso em português com: leads novos, vendas, pagamentos recebidos, alertas urgentes.',
      `Dados de hoje:\n${JSON.stringify(context, null, 2)}`,
      300,
      'haiku'
    )
  }

  // Postar mensagem no Hall
  async postarNoHall(mensagem: string, tipo: 'info' | 'alert' | 'success' | 'warning' = 'info') {
    const { error } = await this.supabase.from('activities').insert({
      type: 'system',
      description: mensagem,
      user_name: 'Sistema',
      metadata: { notification_type: tipo },
    })

    if (error) console.error('Erro ao postar no Hall:', error)
  }

  // Criar cliente automaticamente a partir de lead
  async criarClienteDoLead(lead: { name: string; company?: string; email?: string; phone?: string; assigned_name?: string }) {
    const { data, error } = await this.supabase.from('clients').insert({
      name: lead.name,
      company: lead.company,
      email: lead.email,
      phone: lead.phone,
      plan_weekly: 140,
      status: 'ativo',
      start_date: new Date().toISOString().slice(0, 10),
      assigned_name: lead.assigned_name || 'Sistema',
    }).select().single()

    if (error) {
      console.error('Erro ao criar cliente do lead:', error)
      await this.postarNoHall(
        `❌ Falha ao criar cliente: ${lead.name}. Tente novamente.`,
        'alert'
      )
      return null
    }

    if (data) {
      await this.postarNoHall(
        `🎉 Novo contrato fechado — ${lead.name}`,
        'success'
      )
    }
    return data
  }

  // Checar pagamentos atrasados
  async verificarPagamentosAtrasados() {
    const { data: pagamentos } = await this.supabase
      .from('payments')
      .select('*')
      .eq('status', 'pendente')
      .lt('due_date', new Date().toISOString().slice(0, 10))

    if (pagamentos && pagamentos.length > 0) {
      await this.postarNoHall(
        `⚠️ ${pagamentos.length} pagamento(s) atrasado(s). Thamyris, favor cobrar!`,
        'warning'
      )
    }
  }

  // Checar MRR
  async verificarMRR() {
    const { data: clients } = await this.supabase
      .from('clients')
      .select('plan_weekly')
      .eq('status', 'ativo')

    const mrr = (clients || []).reduce((sum, c) => sum + (c.plan_weekly * 4), 0)

    if (mrr < 10000) {
      await this.postarNoHall(
        `📉 MRR baixo: R$ ${mrr.toFixed(2)}. Daniel, revisar conversões!`,
        'alert'
      )
    }

    return mrr
  }

  // Checar leads sem contato
  async verificarLeadsSemContato() {
    const cincodiasAtras = new Date()
    cincodiasAtras.setDate(cincodiasAtras.getDate() - 5)

    const { data: leads } = await this.supabase
      .from('leads')
      .select('*')
      .eq('status', 'proposta')
      .lt('updated_at', cincodiasAtras.toISOString())

    if (leads && leads.length > 0) {
      const nomes = leads.slice(0, 3).map(l => l.name).join(', ')
      await this.postarNoHall(
        `⏰ ${leads.length} lead(s) sem contato há 5+ dias: ${nomes}...`,
        'warning'
      )
    }
  }

  // Checar campanhas sem resultado
  async verificarCampanhasSemResultado() {
    const setedasAtras = new Date()
    setedasAtras.setDate(setedasAtras.getDate() - 7)

    const { data: campaigns } = await this.supabase
      .from('campaigns')
      .select('*')
      .lt('created_at', setedasAtras.toISOString())

    const semResultado = (campaigns || []).filter(c => c.leads === 0)

    if (semResultado.length > 0) {
      await this.postarNoHall(
        `🚨 Campanha(s) sem resultado em 7 dias. Gabriel, considere pausar: ${semResultado[0].name}`,
        'alert'
      )
    }
  }
}

let instance: SuperAgent | null = null

export function getSuperAgent(): SuperAgent {
  if (!instance) {
    instance = new SuperAgent()
  }
  return instance
}
