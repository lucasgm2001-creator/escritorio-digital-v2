import { ComercialAgent } from './ComercialAgent'
import { FinanceiroAgent } from './FinanceiroAgent'
import { TrafegoAgent } from './TrafegoAgent'
import { GestorAgent } from './GestorAgent'

export class AgentManager {
  readonly comercial: ComercialAgent
  readonly financeiro: FinanceiroAgent
  readonly trafego: TrafegoAgent
  readonly gestor: GestorAgent

  constructor() {
    this.comercial = new ComercialAgent()
    this.financeiro = new FinanceiroAgent()
    this.trafego = new TrafegoAgent()
    this.gestor = new GestorAgent()
  }
}

// Singleton para uso em toda a aplicação
let agentManager: AgentManager | null = null

export function getAgentManager(): AgentManager {
  if (!agentManager) {
    agentManager = new AgentManager()
  }
  return agentManager
}
