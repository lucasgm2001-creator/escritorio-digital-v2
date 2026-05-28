import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { AgentAnalysis } from '@/types'

export class GestorAgent {
  private readonly agentId = 'gestor-agent'
  private readonly agentName = 'Agente Gestor'

  async generateDailyBriefing(data: {
    leads: number
    revenue: number
    activeCampaigns: number
    pendingTasks: number
  }): Promise<AgentAnalysis> {
    const summary = `Leads: ${data.leads} | Receita: R$${data.revenue.toFixed(2)} | Campanhas: ${data.activeCampaigns} | Tarefas: ${data.pendingTasks}`

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt: `Gere um briefing executivo diário com base nos dados: ${JSON.stringify(data)}. Inclua 3 pontos de atenção e 3 prioridades para o dia. Responda em português de forma concisa.`,
      maxOutputTokens: 400,
    })

    const lines = text.split('\n').filter(Boolean)

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      analysisType: 'daily_briefing',
      summary,
      insights: lines.slice(0, 3),
      recommendations: lines.slice(3, 6),
      data,
      createdAt: new Date().toISOString(),
    }
  }

  async askQuestion(question: string, context?: string): Promise<string> {
    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt: context
        ? `Contexto do negócio: ${context}\n\nPergunta: ${question}`
        : question,
      maxOutputTokens: 600,
    })
    return text
  }
}
