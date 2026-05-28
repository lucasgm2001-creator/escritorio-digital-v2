import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { Campaign, AgentAnalysis } from '@/types'

export class TrafegoAgent {
  private readonly agentId = 'trafego-agent'
  private readonly agentName = 'Agente de Tráfego'

  async analyzeCampaigns(campaigns: Campaign[]): Promise<AgentAnalysis> {
    const totalBudget = campaigns.reduce((sum, c) => sum + c.budget, 0)
    const totalLeads = campaigns.reduce((sum, c) => sum + c.leads, 0)
    const totalConversions = campaigns.reduce((sum, c) => sum + c.conversions, 0)
    const summary = `${campaigns.length} campanhas | R$${totalBudget.toFixed(0)} investidos | ${totalLeads} leads | ${totalConversions} conversões`

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      prompt: `Analise o desempenho dessas campanhas de tráfego pago: ${JSON.stringify(campaigns)}. Responda em português com 3 insights sobre performance e 3 otimizações recomendadas.`,
      maxOutputTokens: 500,
    })

    const lines = text.split('\n').filter(Boolean)

    return {
      agentId: this.agentId,
      agentName: this.agentName,
      analysisType: 'campaign_analysis',
      summary,
      insights: lines.slice(0, 3),
      recommendations: lines.slice(3, 6),
      data: { totalBudget, totalLeads, totalConversions },
      createdAt: new Date().toISOString(),
    }
  }

  getCostPerLead(campaign: Campaign): number {
    if (campaign.leads === 0) return 0
    return campaign.spent / campaign.leads
  }

  getBestPerformingCampaign(campaigns: Campaign[]): Campaign | null {
    if (campaigns.length === 0) return null
    return campaigns.reduce((best, c) => {
      const cpl = this.getCostPerLead(c)
      const bestCpl = this.getCostPerLead(best)
      return cpl < bestCpl ? c : best
    })
  }
}
