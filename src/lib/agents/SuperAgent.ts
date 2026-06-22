import { generateText, tool, jsonSchema } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import type { createClient } from '@/lib/supabase/server'
import { nextUnpaidWeek } from '@/lib/commission/actions'
import { ymd, usd } from '@/lib/format'
import { wonSlug, type FunnelStage } from '@/lib/funnelStages'

// Client supabase do REQUEST atual (server, ligado à sessão/cookies correntes).
type SupaClient = ReturnType<typeof createClient>

// Modelo das ações: sonnet decide ferramentas com mais confiabilidade que haiku.
// IMPORTANTE: tem que ser um modelo HABILITADO na conta — claude-3-5-sonnet-20241022
// devolvia 404 not_found aqui. claude-sonnet-4-6 está disponível e faz tool use ok.
const ACTION_MODEL = 'claude-sonnet-4-6'

// Ferramentas que o agente PODE executar (fase 1: criar lead, criar tarefa).
// SEM `execute`: a chamada é devolvida ao app, que pede confirmação ao usuário
// ANTES de tocar o banco. O modelo só decide A ação e os parâmetros.
const createLeadTool = tool({
  description:
    'Cria um novo lead no funil comercial. Use quando o usuário pedir para criar, cadastrar ou adicionar um lead/contato. Apenas o nome é obrigatório.',
  inputSchema: jsonSchema<{
    name: string; company?: string; phone?: string; niche?: string; value_estimated?: number; notes?: string
  }>({
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Nome do lead (obrigatório); pode ser só o primeiro nome.' },
      company: { type: 'string', description: 'Empresa do lead.' },
      phone: { type: 'string', description: 'Telefone do lead.' },
      niche: { type: 'string', description: 'Nicho ou segmento de atuação.' },
      value_estimated: { type: 'number', description: 'Valor estimado da venda, em dólares (US$).' },
      notes: { type: 'string', description: 'Observações livres sobre o lead.' },
    },
    required: ['name'],
    additionalProperties: false,
  }),
})

const createTaskTool = tool({
  description:
    'Cria uma nova tarefa/lembrete. Use quando o usuário pedir para criar, agendar ou lembrar de uma tarefa/compromisso. Apenas o título é obrigatório.',
  inputSchema: jsonSchema<{
    title: string; due_date?: string; due_time?: string; linked_lead_name?: string
  }>({
    type: 'object',
    properties: {
      title: { type: 'string', description: 'Título curto e imperativo da tarefa (ex: "Ligar pro João").' },
      due_date: { type: 'string', description: 'Data no formato YYYY-MM-DD (resolva datas relativas a partir de hoje).' },
      due_time: { type: 'string', description: 'Hora no formato HH:MM (24h). Só faz sentido junto com due_date.' },
      linked_lead_name: { type: 'string', description: 'Nome de um lead existente para vincular a tarefa, se o usuário mencionar.' },
    },
    required: ['title'],
    additionalProperties: false,
  }),
})

const completeTaskTool = tool({
  description:
    'Marca uma tarefa existente como CONCLUÍDA. Use quando o usuário disser que terminou/concluiu/fez uma tarefa (ex: "marca como feita a tarefa de ligar pro João", "conclui o follow-up do Sandro"). As tarefas pendentes estão no contexto (campo "tarefas").',
  inputSchema: jsonSchema<{ task_title: string }>({
    type: 'object',
    properties: {
      task_title: { type: 'string', description: 'Título (ou trecho) da tarefa PENDENTE a concluir, como aparece no contexto.' },
    },
    required: ['task_title'],
    additionalProperties: false,
  }),
})

// Enum de destino DINÂMICO: os slugs vêm de funnel_stages (não-arquivadas).
function buildMoverLeadTool(slugs: string[]) {
  return tool({
    description:
      'Move um lead para outro estágio do funil comercial. Use quando o usuário pedir para mover, avançar ou mudar um lead de fase (ex: "move o Sandro pra reunião", "o João fechou").',
    inputSchema: jsonSchema<{ lead_name: string; destino: string; plano?: string }>({
      type: 'object',
      properties: {
        lead_name: { type: 'string', description: 'Nome do lead a mover.' },
        destino: {
          type: 'string',
          enum: slugs,
          description: 'Estágio de destino (slug). Mapeie a linguagem natural para o slug: "reunião agendada"→reuniao; "no show"→no_show; "reagendar"→reagendamento; "proposta"→proposta; "venda fechada"/"fechou"/"ganhou"→fechado; "perdido"→perdido; "negócio futuro"/"guardar pra depois"/"depois"→negocio_futuro; "lixo"/"descartar"→lixeira; "não interagiu"→nao_interagiu; "novo"→novo.',
        },
        plano: { type: 'string', description: 'APENAS para "Venda Fechada": nome do plano/contrato do cliente (um dos planos do contexto, campo "plans"). Se o usuário não disse o plano, deixe vazio — o sistema pergunta.' },
      },
      required: ['lead_name', 'destino'],
      additionalProperties: false,
    }),
  })
}

const editarClienteTool = tool({
  description:
    'Edita os dados de um cliente existente (nome, telefone, e-mail, empresa). Use quando o usuário pedir para alterar/atualizar/corrigir dados de um cliente. NUNCA exclui clientes.',
  inputSchema: jsonSchema<{ client_name: string; name?: string; phone?: string; email?: string; company?: string }>({
    type: 'object',
    properties: {
      client_name: { type: 'string', description: 'Nome do cliente a editar (para localizar).' },
      name: { type: 'string', description: 'Novo nome, se for mudar.' },
      phone: { type: 'string', description: 'Novo telefone.' },
      email: { type: 'string', description: 'Novo e-mail.' },
      company: { type: 'string', description: 'Nova empresa.' },
    },
    required: ['client_name'],
    additionalProperties: false,
  }),
})

const registrarPagamentoTool = tool({
  description:
    'Registra o pagamento da PRÓXIMA semana de uma venda JÁ EXISTENTE de um cliente (teto de 4 semanas). Use quando o usuário disser que um cliente pagou (mais) uma semana. NÃO cria vendas — para registrar uma venda nova, o caminho é mover o lead para "Venda Fechada" (tool mover_lead).',
  inputSchema: jsonSchema<{ client_name: string }>({
    type: 'object',
    properties: { client_name: { type: 'string', description: 'Nome do cliente da venda.' } },
    required: ['client_name'],
    additionalProperties: false,
  }),
})

const registrarReuniaoTool = tool({
  description:
    'Registra uma reunião realizada (US$ 15 por padrão) numa data. Use quando o usuário disser que teve/fez uma reunião.',
  inputSchema: jsonSchema<{ client_name?: string; date?: string; valor_usd?: number }>({
    type: 'object',
    properties: {
      client_name: { type: 'string', description: 'Nome do cliente/lead da reunião (opcional; pode ser avulsa).' },
      date: { type: 'string', description: 'Data YYYY-MM-DD (resolva datas relativas; padrão hoje).' },
      valor_usd: { type: 'number', description: 'Valor em dólares (padrão 15).' },
    },
    required: [],
    additionalProperties: false,
  }),
})

// Texto do preview mostrado ao usuário antes de confirmar a gravação.
function buildActionPreview(toolName: string, p: Record<string, unknown>): string {
  if (toolName === 'create_lead') {
    const lines = ['Vou criar o **lead**:', `- Nome: ${p.name}`]
    if (p.company) lines.push(`- Empresa: ${p.company}`)
    if (p.phone) lines.push(`- Telefone: ${p.phone}`)
    if (p.niche) lines.push(`- Nicho: ${p.niche}`)
    if (p.value_estimated != null) lines.push(`- Valor estimado: US$ ${p.value_estimated}`)
    if (p.notes) lines.push(`- Notas: ${p.notes}`)
    lines.push('', 'Confirma?')
    return lines.join('\n')
  }
  if (toolName === 'create_task') {
    const lines = ['Vou criar a **tarefa**:', `- Título: ${p.title}`]
    if (p.due_date) {
      const quando = p.due_time ? `${p.due_date} às ${p.due_time}` : String(p.due_date)
      lines.push(`- Quando: ${quando}`)
    }
    if (p.linked_lead_name) lines.push(`- Vincular ao lead: ${p.linked_lead_name}`)
    lines.push('', 'Confirma?')
    return lines.join('\n')
  }
  if (toolName === 'complete_task') {
    return `Vou marcar a tarefa **${p.task_title}** como concluída.\n\nConfirma?`
  }
  if (toolName === 'mover_lead') {
    // Só chega aqui quando precisa confirmar (destino = Venda Fechada).
    return `Mover **${p.lead_name}** para **Venda Fechada** vai registrar a comissão (deal de US$ 100, 1ª semana paga). Confirma?`
  }
  return 'Confirma?'
}

// Quais ações exigem confirmação antes de executar. Mover é direto, EXCETO pra
// "fechado" (Venda Fechada), que dispara a comissão. Criar lead/tarefa sempre confirmam.
function needsConfirm(toolName: string, p: Record<string, unknown>, wonSlugStr: string): boolean {
  if (toolName === 'mover_lead') return p.destino === wonSlugStr
  return true
}

export type AgentTurn =
  | { type: 'text'; resposta: string }
  | { type: 'action'; tool: string; params: Record<string, unknown>; requiresConfirm: boolean; resposta: string }

export class SuperAgent {
  // Recebe o supabase do request atual (não cria o seu próprio): garante que
  // leituras/escritas usem a sessão/cookies do request corrente, não de um antigo.
  constructor(private supabase: SupaClient) {}

  // Fases do funil (cache por instância/request) — slugs/flags p/ o tool e a confirmação.
  private stagesCache?: FunnelStage[]
  private async loadStages(): Promise<FunnelStage[]> {
    if (!this.stagesCache) {
      const { data } = await this.supabase.from('funnel_stages').select('*').order('posicao')
      this.stagesCache = (data ?? []) as FunnelStage[]
    }
    return this.stagesCache
  }

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

  // MRR (USD) IDÊNTICO à tela de Clientes: clientes ativos, (plano.valor_semanal ?? plan_weekly) * 4.
  // Replica a fórmula de ClientesClient.tsx:391 (hoje não há helper compartilhado — ver resumo).
  private mrrUsd(
    clients: { status?: string | null; plano_id?: string | null; plan_weekly?: number | null }[],
    plans: { id: string; valor_semanal: number }[],
  ): number {
    return clients
      .filter(c => c.status === 'ativo')
      .reduce((sum, c) => sum + ((plans.find(p => p.id === c.plano_id)?.valor_semanal ?? c.plan_weekly ?? 0) * 4), 0)
  }

  // Dados disponíveis para o agente analisar. Financeiro = MESMAS tabelas/colunas do app:
  // receita = client_payments (tela Clientes) · comissão = weekly_payments (Equipe e Comissões).
  // Campanhas removidas (sem fonte real). MRR via mrrUsd (mesma fórmula da tela de Clientes).
  async getContextData() {
    const [
      { data: leads },
      { data: clients },
      { data: plans },
      { data: receita },
      { data: comissao },
      { data: tarefas },
    ] = await Promise.all([
      this.supabase.from('leads').select('*').limit(20),
      this.supabase.from('clients').select('*').limit(20),
      this.supabase.from('plans').select('id, nome, valor_semanal').eq('ativo', true).order('ordem'),
      this.supabase.from('client_payments').select('*').order('paid_on', { ascending: false }).limit(20),
      this.supabase.from('weekly_payments').select('id, deal_id, numero_semana, valor_usd, paid_on, cotacao_usd_brl').order('paid_on', { ascending: false }).limit(20),
      this.supabase.from('tasks').select('id, title, due_date').eq('done', false).order('due_date').limit(30),
    ])

    return {
      leads: leads || [],
      clients: clients || [],
      plans: plans || [],
      receita: receita || [],     // client_payments — recebido dos clientes
      comissao: comissao || [],   // weekly_payments — comissão recebida
      tarefas: tarefas || [],     // tarefas PENDENTES (p/ o agente referenciar e concluir)
      mrrUsd: this.mrrUsd(clients || [], plans || []),
    }
  }

  // Chat interativo com o agente
  async chat(userQuestion: string, userId: string, userRole: string = 'admin'): Promise<string> {
    const context = await this.getContextData()

    // Filtrar dados pelo role do usuário
    let filteredContext = { ...context }
    if (userRole === 'comercial') {
      // Comercial vê leads/clientes; oculta financeiro (receita/comissão/MRR).
      filteredContext = { ...context, receita: [], comissao: [], mrrUsd: 0 }
    } else if (userRole === 'financeiro') {
      // Financeiro vê clientes + receita/comissão/MRR; oculta leads.
      filteredContext = { ...context, leads: [] }
    } else if (userRole === 'trafego') {
      // Tráfego só vê leads (sem fonte real de campanhas).
      filteredContext = { ...context, clients: [], plans: [], receita: [], comissao: [], mrrUsd: 0 }
    }

    return this.generateAIResponse(
      `Você é um assistente inteligente do Escritório Digital DR Growth. Você ajuda a equipe respondendo perguntas sobre leads, clientes, receita e comissões. Seja conciso, prático e orientado a ações. Responda em português.`,
      `Dados disponíveis:\n${JSON.stringify(filteredContext, null, 2)}\n\nPergunta do usuário (${userRole}): ${userQuestion}`,
      400,
      'haiku'
    )
  }

  // Chat COM ações (tool use). Recebe o histórico da conversa e devolve OU um texto
  // (perguntas/consultas) OU uma ação pendente (create_lead / create_task) com os
  // parâmetros decididos pelo modelo. NÃO grava nada: o app confirma antes de executar.
  async chatWithActions(
    messages: { role: 'user' | 'assistant'; content: string }[],
    opts: { today: string; todayLabel: string },
  ): Promise<AgentTurn> {
    const context = await this.getContextData()
    const stages = await this.loadStages()
    const STATIC_SLUGS = ['novo', 'interagiu', 'nao_interagiu', 'reuniao', 'no_show', 'reagendamento', 'proposta', 'fechado', 'perdido', 'negocio_futuro', 'lixeira']
    const slugs = stages.length ? stages.filter(s => !s.arquivada).map(s => s.slug) : STATIC_SLUGS
    const won = wonSlug(stages)
    // FASE 1 do agente: só as 4 ações seguras. As 3 sensíveis (editar_cliente, registrar_pagamento,
    // registrar_reuniao) ficam ESCONDIDAS por esta flag — NÃO vão pro modelo nem executam. Trocar
    // para false reativa (o código delas continua intacto).
    const AGENT_PHASE1_ONLY = true
    const acoesPrompt = AGENT_PHASE1_ONLY
      ? 'Você PODE executar SÓ estas ações pelas ferramentas: create_lead (criar lead — entra na fase Novo), create_task (criar tarefa), complete_task (marcar uma tarefa como concluída) e mover_lead (mover lead de estágio). Para perguntas, consultas e análises, responda em texto, sem ferramenta. Você AINDA NÃO executa: registrar venda/pagamento de comissão, registrar reunião, criar/editar cliente, editar o valor de um lead, nem qualquer exclusão — se pedirem, explique que ainda não faz isso e sugira fazer manualmente na tela correspondente.'
      : 'Você PODE executar ações pelas ferramentas: create_lead (criar lead), create_task (criar tarefa), complete_task (marcar uma tarefa como concluída), mover_lead (mover lead de estágio), editar_cliente (editar dados de um cliente — NUNCA excluir), registrar_pagamento (registrar o pagamento da próxima semana de uma venda JÁ existente) e registrar_reuniao (registrar reunião, US$ 15 padrão). Use a ferramenta quando o usuário pedir a ação correspondente. IMPORTANTE: NÃO existe ferramenta de criar venda/deal — registrar uma venda nova = mover o lead para "Venda Fechada" (mover_lead). Para perguntas, consultas e análises, responda em texto, sem ferramenta.'
    const system = [
      'Você é o assistente do Escritório Digital DR Growth. Responda em português, de forma concisa e prática.',
      `Hoje é ${opts.todayLabel} (${opts.today}). Resolva datas relativas (hoje, amanhã, depois de amanhã, sexta, segunda, semana que vem) para datas absolutas no formato YYYY-MM-DD a partir de hoje. Se o dia da semana já passou nesta semana, use a próxima ocorrência.`,
      acoesPrompt,
      'Fechar venda = mover_lead para "Venda Fechada". Inclua o parâmetro `plano` com o nome do plano/contrato que o usuário escolher (veja os planos no campo "plans" do contexto). Se ele não disse qual plano, NÃO invente — deixe `plano` vazio que o sistema pergunta.',
      'Nunca diga que já criou algo: ao chamar uma ferramenta, o aplicativo ainda vai pedir a confirmação do usuário antes de gravar.',
      'Se faltar um dado obrigatório (nome do lead, ou título da tarefa), peça-o em texto antes de usar a ferramenta.',
      'MRR: use SEMPRE o número já calculado no campo "mrrUsd" do contexto. Ao explicar, descreva como "clientes ativos × valor semanal × 4 (quatro semanas)" — a MESMA base da tela de Clientes. NUNCA invente multiplicadores como "4,33 semanas/mês", "× 4,3" ou "média mensal", nem converta para mês: é sempre × 4. A explicação TEM que bater com o número (não recalcule).',
      'Dados atuais do sistema (somente leitura, use apenas para responder perguntas):',
      JSON.stringify(context),
    ].join('\n')

    const result = await generateText({
      model: anthropic(ACTION_MODEL),
      system,
      messages,
      tools: {
        create_lead: createLeadTool, create_task: createTaskTool, complete_task: completeTaskTool, mover_lead: buildMoverLeadTool(slugs),
        // Ações sensíveis (dinheiro/cliente) — só quando a Fase 1 estiver desligada. Escondidas do modelo nesta fase.
        ...(AGENT_PHASE1_ONLY ? {} : { editar_cliente: editarClienteTool, registrar_pagamento: registrarPagamentoTool, registrar_reuniao: registrarReuniaoTool }),
      },
      maxOutputTokens: 600,
    })

    const call = result.toolCalls?.[0]
    if (call) {
      const params = (call.input ?? {}) as Record<string, unknown>
      // Ações que resolvem no banco (preview rico / pergunta se ambíguo):
      if (call.toolName === 'editar_cliente') return this.prepEditClient(params)
      if (call.toolName === 'registrar_pagamento') return this.prepPayWeek(params)
      if (call.toolName === 'registrar_reuniao') return this.prepMeeting(params)
      // Fechar venda (mover→is_won) exige o PLANO (comissão Fase 2A). Demais fases caem no fluxo direto.
      if (call.toolName === 'mover_lead') {
        const r = await this.prepMoverLead(params, won)
        if (r) return r
      }
      // Ações de preview estático (resolução acontece na execução):
      return { type: 'action', tool: call.toolName, params, requiresConfirm: needsConfirm(call.toolName, params, won), resposta: buildActionPreview(call.toolName, params) }
    }
    return { type: 'text', resposta: result.text?.trim() || 'Não entendi. Pode reformular?' }
  }

  // ── Preparação das ações que resolvem no banco (preview rico; pergunta se ambíguo) ──

  // Editar cliente: localiza por nome; monta o patch só com campos informados e
  // diferentes (de→para). Pergunta se ambíguo/não achar. NUNCA exclui.
  // Fechar venda pelo agente: pede o PLANO (se faltar) e mapeia nome→planoId, pra fechar pelo % do
  // plano (Fase 2A) em vez do legado. Retorna null pras outras fases (seguem o fluxo direto de hoje).
  // NÃO calcula dinheiro: só FORNECE o planoId pro mesmo runWonFlow(planoId) que o modal do funil usa.
  private async prepMoverLead(params: Record<string, unknown>, won: string): Promise<AgentTurn | null> {
    if (String(params.destino ?? '') !== won) return null   // não-won: comportamento atual (direto)
    const { data } = await this.supabase.from('plans').select('id, nome, valor_semanal').eq('ativo', true).order('ordem')
    const planos = (data ?? []) as { id: string; nome: string; valor_semanal: number }[]
    const lead = String(params.lead_name ?? 'lead')
    const planoNome = String(params.plano ?? '').trim()
    if (!planoNome) {
      const opts = planos.length ? ` Planos: ${planos.map(p => `${p.nome} (${usd(Number(p.valor_semanal))}/sem)`).join(' · ')}.` : ''
      return { type: 'text', resposta: `Pra fechar a venda do ${lead}, qual o plano/contrato?${opts}` }
    }
    const plano = planos.find(p => p.nome.toLowerCase() === planoNome.toLowerCase())
      ?? planos.find(p => p.nome.toLowerCase().includes(planoNome.toLowerCase()))
    if (!plano) return { type: 'text', resposta: `Não achei o plano "${planoNome}". Planos disponíveis: ${planos.map(p => p.nome).join(', ') || '(nenhum)'}.` }
    return {
      type: 'action', tool: 'mover_lead', requiresConfirm: true,
      params: { ...params, planoId: plano.id, planoNome: plano.nome },
      resposta: `Vou fechar a venda do **${lead}** com o plano **${plano.nome}** (${usd(Number(plano.valor_semanal))}/sem) e registrar a comissão pelo % do plano. Confirma?`,
    }
  }

  private async prepEditClient(params: Record<string, unknown>): Promise<AgentTurn> {
    const name = String(params.client_name ?? '').trim()
    if (!name) return { type: 'text', resposta: 'Qual cliente você quer editar?' }
    const { data } = await this.supabase.from('clients').select('id, name, phone, email, company').ilike('name', `%${name}%`).limit(6)
    const matches = data ?? []
    if (matches.length === 0) return { type: 'text', resposta: `Não achei nenhum cliente com "${name}".` }
    let c = matches[0]
    if (matches.length > 1) {
      const exact = matches.filter(m => (m.name ?? '').toLowerCase() === name.toLowerCase())
      if (exact.length === 1) c = exact[0]
      else return { type: 'text', resposta: `Achei mais de um cliente parecido com "${name}": ${matches.map(m => m.name).join(', ')}. Qual deles?` }
    }
    const patch: Record<string, string> = {}
    const lines: string[] = []
    const consider = (key: 'name' | 'phone' | 'email' | 'company', label: string) => {
      const v = params[key]
      if (v == null) return
      const nv = String(v).trim()
      if (!nv) return
      const cur = (c as Record<string, unknown>)[key]
      if (nv === (cur == null ? '' : String(cur))) return
      patch[key] = nv
      lines.push(`- ${label}: ${cur ? String(cur) : '—'} → ${nv}`)
    }
    consider('name', 'Nome'); consider('phone', 'Telefone'); consider('email', 'E-mail'); consider('company', 'Empresa')
    if (lines.length === 0) return { type: 'text', resposta: `O que você quer mudar no cliente ${c.name}? (nome, telefone, e-mail ou empresa)` }
    return {
      type: 'action', tool: 'editar_cliente', requiresConfirm: true,
      params: { clientId: c.id, clientName: c.name, patch },
      resposta: `Vou editar o cliente **${c.name}**:\n${lines.join('\n')}\n\nConfirma?`,
    }
  }

  // Registrar pagamento: localiza a venda do cliente, calcula a PRÓXIMA semana não paga
  // (respeitando teto e status). NÃO cria venda. Pergunta/explica se ambíguo/cheio/congelado.
  private async prepPayWeek(params: Record<string, unknown>): Promise<AgentTurn> {
    const name = String(params.client_name ?? '').trim()
    if (!name) return { type: 'text', resposta: 'De qual cliente é o pagamento da semana?' }
    const { data } = await this.supabase.from('deals').select('id, client_name, valor_por_semana_usd, teto_semanas, status').ilike('client_name', `%${name}%`)
    const matches = data ?? []
    if (matches.length === 0) return { type: 'text', resposta: `Não achei nenhuma venda do cliente "${name}". (Para registrar uma venda nova, mova o lead para "Venda Fechada".)` }
    let d = matches[0]
    if (matches.length > 1) {
      const active = matches.filter(x => x.status === 'em_andamento')
      const exact = matches.filter(x => (x.client_name ?? '').toLowerCase() === name.toLowerCase())
      if (active.length === 1) d = active[0]
      else if (exact.length === 1) d = exact[0]
      else return { type: 'text', resposta: `Achei mais de uma venda para "${name}": ${matches.map(x => x.client_name).join(', ')}. De qual cliente?` }
    }
    if (d.status !== 'em_andamento') return { type: 'text', resposta: `A venda do ${d.client_name} está ${d.status === 'interrompido' ? 'interrompida' : 'concluída'} — não dá pra registrar mais semanas.` }
    const { data: wk } = await this.supabase.from('weekly_payments').select('numero_semana').eq('deal_id', d.id)
    const paidNums = (wk ?? []).map(w => Number(w.numero_semana))
    const numero = nextUnpaidWeek({ tetoSemanas: d.teto_semanas, status: d.status }, paidNums)
    if (numero == null) return { type: 'text', resposta: `A venda do ${d.client_name} já tem todas as ${d.teto_semanas} semanas pagas.` }
    const valorUsd = Number(d.valor_por_semana_usd)
    const today = ymd(new Date())
    return {
      type: 'action', tool: 'registrar_pagamento', requiresConfirm: true,
      params: { dealId: d.id, clientName: d.client_name, numero, valorUsd, teto: d.teto_semanas, paidOn: today },
      resposta: `Registrar pagamento — **${d.client_name}**: semana ${numero} de ${d.teto_semanas}, US$ ${valorUsd}, hoje (${today}).\n\nConfirma?`,
    }
  }

  // Registrar reunião (US$ 15 padrão): vendedor ativo + cliente opcional (avulsa permitida).
  private async prepMeeting(params: Record<string, unknown>): Promise<AgentTurn> {
    const { data: sellers } = await this.supabase.from('sellers').select('id').eq('status', 'ativo').order('created_at')
    if (!sellers || sellers.length === 0) return { type: 'text', resposta: 'Não há vendedor ativo configurado para lançar a reunião.' }
    const sellerId = sellers[0].id
    const name = String(params.client_name ?? '').trim()
    let clientId: string | null = null
    let clientName: string | null = name || null
    if (name) {
      const { data: cs } = await this.supabase.from('clients').select('id, name').ilike('name', `%${name}%`).limit(6)
      const list = cs ?? []
      const exact = list.filter(c => (c.name ?? '').toLowerCase() === name.toLowerCase())
      if (list.length === 1) { clientId = list[0].id; clientName = list[0].name }
      else if (exact.length === 1) { clientId = exact[0].id; clientName = exact[0].name }
      // senão: reunião avulsa com o nome dito (clientId null)
    }
    // Resolve também um LEAD pelo nome → marco 'reuniao' do relatório (separado da comissão). Best-effort.
    let leadId: string | null = null
    if (name) {
      const { data: ls } = await this.supabase.from('leads').select('id, name').ilike('name', `%${name}%`).limit(6)
      const ll = ls ?? []
      const lex = ll.filter(l => (l.name ?? '').toLowerCase() === name.toLowerCase())
      if (ll.length === 1) leadId = ll[0].id
      else if (lex.length === 1) leadId = lex[0].id
    }
    const valorUsd = typeof params.valor_usd === 'number' ? params.valor_usd : 15
    const date = String(params.date ?? '')
    const metOn = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : ymd(new Date())
    return {
      type: 'action', tool: 'registrar_reuniao', requiresConfirm: true,
      params: { sellerId, clientId, clientName, leadId, metOn, valorUsd },
      resposta: `Registrar reunião${clientName ? ` com **${clientName}**` : ''}: ${metOn}, US$ ${valorUsd}.\n\nConfirma?`,
    }
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

  // "Pagamentos atrasados": o modelo atual (client_payments) é um LEDGER de semanas PAGAS — não
  // tem status "pendente"/due_date. "Atrasado" deriva do vencimento (payDueWeeks/dueDateFor, lógica
  // de dinheiro) → fica pra tarefa específica. Aposentado pra não ler tabela morta (payments).
  async verificarPagamentosAtrasados() {
    return
  }

  // Checar MRR — MESMO número da tela de Clientes (USD): plano_id → plans.valor_semanal (fallback plan_weekly).
  async verificarMRR() {
    const [{ data: clients }, { data: plans }] = await Promise.all([
      this.supabase.from('clients').select('plano_id, plan_weekly, status').eq('status', 'ativo'),
      this.supabase.from('plans').select('id, valor_semanal').eq('ativo', true),
    ])

    const mrr = this.mrrUsd(clients || [], plans || [])

    if (mrr < 10000) {
      await this.postarNoHall(
        `📉 MRR baixo: ${usd(mrr)}. Daniel, revisar conversões!`,
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

  // Campanhas: sem fonte de dados real (nada popula campanhas hoje). Contexto de campanhas
  // removido — re-adicionar quando houver tráfego real com fonte de verdade. Não lê tabela morta.
  async verificarCampanhasSemResultado() {
    return
  }
}

// Cria um agente com o supabase do REQUEST atual. NÃO cachear num singleton: um
// client preso ao 1º request usaria cookies/sessão velhos nas requisições seguintes.
export function getSuperAgent(supabase: SupaClient): SuperAgent {
  return new SuperAgent(supabase)
}
