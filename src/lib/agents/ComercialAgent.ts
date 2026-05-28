import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { Lead, AgentAnalysis } from '@/types'

export class ComercialAgent {
  private readonly agentId = 'comercial-agent'
  private readonly agentName = 'Agente Comercial'

  async analyzeLeads(leads: Lead[]): Promise<AgentAnalysis> {
    const summary = `Total: ${leads.length} leads | Fechados: ${leads.filter(l => l.status === 'fechado').length} | Em negociação: ${leads.filter(l => l.status === 'proposta').length}`

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt: `Analise estes leads comerciais e forneça insights estratégicos: ${JSON.stringify(leads.slice(0, 10))}. Responda em português com 3 insights e 3 recomendações objetivas.`,
      maxOutputTokens: 500,
    })

    const lines = text.split('\n').filter(Boolean)

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      analysisType: 'lead_analysis',
      summary,
      insights: lines.slice(0, 3),
      recommendations: lines.slice(3, 6),
      createdAt: new Date().toISOString(),
    }
  }

  async suggestFollowUp(lead: Lead): Promise<string> {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt: `Sugira uma mensagem de follow-up para o lead: ${lead.name}, status: ${lead.status}. Seja breve e objetivo, em português.`,
      maxOutputTokens: 200,
    })
    return text
  }

  getConversionRate(leads: Lead[]): number {
    if (leads.length === 0) return 0
    return (leads.filter(l => l.status === 'fechado').length / leads.length) * 100
  }
}
