'use client'

import { useState, useRef, useEffect } from 'react'
import { Markdown } from '@/components/ui/Markdown'
import { createClient } from '@/lib/supabase/client'
import { moveLead, type MovableLead } from '../comercial/leadActions'
import { type LeadStatus } from '../comercial/types'
import { loadStages } from '@/lib/funnelStages'
import { payWeek, payWeekMessage, registerMeeting, updateClient } from '@/lib/commission/actions'
import { markMilestones } from '@/lib/leadMilestones'
import { ymd } from '@/lib/format'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

// Ação proposta pelo modelo (tool use) aguardando confirmação do usuário.
interface PendingAction {
  tool: string
  params: Record<string, unknown>
}

// Respostas curtas que confirmam/cancelam uma ação pendente SEM chamar o modelo.
// Precisam casar a mensagem inteira — "não, a empresa é Souza" NÃO é cancelar (é correção).
const YES = /^(sim|claro|confirmo|confirmar|confirma|pode|pode ser|pode criar|ok|okay|isso|isso a[ií]|manda|manda ver|vai|fechou|beleza|blz)[.!]*$/i
const NO = /^(n[ãa]o|cancela|cancelar|deixa|deixa pra l[áa]|esquece|para)[.!]*$/i

// Cotação efetiva atual (mesma do /api/fx) pra congelar em pagamentos/reuniões. Nunca 0.
async function getFxRate(): Promise<number> {
  try {
    const res = await fetch('/api/fx', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) })
    if (res.ok) { const d = await res.json(); const r = Number(d.effective); if (r > 0) return r }
  } catch { /* usa o fallback abaixo */ }
  return 5.40
}

export function AgentChat({ userId, userName }: { userId: string; userName: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [pending, setPending] = useState<PendingAction | null>(null)
  const [confirming, setConfirming] = useState(false)
  const busyRef = useRef(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const supabase = createClient()

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const addAgent = (content: string) =>
    setMessages(prev => [...prev, { id: `agent-${Date.now()}`, role: 'agent', content, timestamp: new Date() }])

  // Grava no banco SÓ depois da confirmação. Escrita client-side (mesma sessão/RLS
  // do resto do app), espelhando os inserts de LeadModal/TaskModal.
  const executeAction = async (action: PendingAction): Promise<string> => {
    const p = action.params
    if (action.tool === 'create_lead') {
      const name = String(p.name ?? '').trim()
      if (!name) return 'Não consegui criar: faltou o nome do lead.'
      const { error } = await supabase.from('leads').insert({
        name,
        company: p.company ? String(p.company) : null,
        phone: p.phone ? String(p.phone) : null,
        nicho: p.niche ? String(p.niche) : null,
        value: typeof p.value_estimated === 'number' ? p.value_estimated : 0,
        notes: p.notes ? String(p.notes) : null,
        status: 'novo',
        assigned_to: userId,
        assigned_name: userName,
      })
      if (error) return `Não consegui criar o lead: ${error.message}`
      return `Pronto! Lead "${name}" criado no funil (status Novo).`
    }
    if (action.tool === 'create_task') {
      const title = String(p.title ?? '').trim()
      if (!title) return 'Não consegui criar: faltou o título da tarefa.'
      const dueDate = p.due_date ? String(p.due_date) : null
      const dueTime = dueDate && p.due_time ? String(p.due_time).slice(0, 5) : null
      // Vínculo opcional: casa por nome com um lead existente.
      let link: { linked_type: string; linked_id: string; linked_name: string } | null = null
      if (p.linked_lead_name) {
        const { data } = await supabase
          .from('leads')
          .select('id, name')
          .ilike('name', `%${String(p.linked_lead_name)}%`)
          .limit(1)
        if (data && data[0]) link = { linked_type: 'lead', linked_id: data[0].id, linked_name: data[0].name }
      }
      const { error } = await supabase.from('tasks').insert({
        user_id: userId, title, due_date: dueDate, due_time: dueTime, done: false, ...(link ?? {}),
      })
      if (error) return `Não consegui criar a tarefa: ${error.message}`
      return `Pronto! Tarefa "${title}" criada${link ? ` e vinculada ao lead ${link.linked_name}` : ''}.`
    }
    if (action.tool === 'mover_lead') {
      const leadName = String(p.lead_name ?? '').trim()
      const destino = String(p.destino ?? '').trim()
      if (!leadName) return 'Não consegui mover: faltou o nome do lead.'
      const stages = await loadStages(supabase)
      const stage = stages.find(s => s.slug === destino && !s.arquivada)
      if (stages.length > 0 && !stage) return `Não consegui mover: estágio "${destino}" inválido.`
      // Busca por nome (igual ao vínculo de tarefa); trata "não achei" e ambiguidade.
      const { data: matches, error: findErr } = await supabase
        .from('leads')
        .select('id, name, status, email, phone, company, assigned_to, assigned_name')
        .ilike('name', `%${leadName}%`)
      if (findErr) return `Não consegui buscar o lead: ${findErr.message}`
      if (!matches || matches.length === 0) return `Não achei nenhum lead com "${leadName}".`
      let lead = matches[0]
      if (matches.length > 1) {
        const exact = matches.filter(m => m.name.toLowerCase() === leadName.toLowerCase())
        if (exact.length === 1) lead = exact[0]
        else return `Achei mais de um lead parecido com "${leadName}": ${matches.map(m => m.name).join(', ')}. Qual deles?`
      }
      const label = stage?.nome ?? destino
      if (lead.status === destino) return `O ${lead.name} já está em ${label}.`
      // MESMA função do funil → dispara o won-flow pela flag is_won da fase.
      const res = await moveLead(supabase, lead as MovableLead, destino as LeadStatus, userName, stages)
      if (!res.ok) return `Não consegui mover o ${lead.name}: ${res.error}`
      let msg = `Pronto! Movi o ${lead.name} pra ${label}.`
      for (const n of res.notes) if (n.message) msg += `\n${n.message}`
      return msg
    }
    if (action.tool === 'editar_cliente') {
      const clientId = String(p.clientId ?? '')
      const clientName = String(p.clientName ?? 'cliente')
      const patch = (p.patch ?? {}) as Record<string, string>
      if (!clientId || Object.keys(patch).length === 0) return 'Não consegui editar: faltou o cliente ou o que mudar.'
      const { error } = await updateClient(supabase, clientId, patch)
      if (error) return `Não consegui editar o ${clientName}: ${error.message}`
      return `Pronto! Cliente ${clientName} atualizado.`
    }
    if (action.tool === 'registrar_pagamento') {
      const dealId = String(p.dealId ?? '')
      const clientName = String(p.clientName ?? 'cliente')
      const numero = Number(p.numero)
      const teto = Number(p.teto)
      const paidOn = String(p.paidOn ?? '')
      if (!dealId || !numero || !paidOn) return 'Não consegui registrar o pagamento: dados incompletos.'
      // Re-confere venda + semanas na hora (anti-duplicação) e congela a cotação efetiva.
      const { data: deal } = await supabase.from('deals').select('id, valor_por_semana_usd, teto_semanas, status').eq('id', dealId).single()
      if (!deal) return `Não achei mais a venda do ${clientName}.`
      const { data: wk } = await supabase.from('weekly_payments').select('numero_semana').eq('deal_id', dealId)
      const paidNums = (wk ?? []).map(w => Number(w.numero_semana))
      const rate = await getFxRate()
      const res = await payWeek(supabase, { id: deal.id, valorPorSemanaUsd: Number(deal.valor_por_semana_usd), tetoSemanas: deal.teto_semanas, status: deal.status }, paidNums, numero, paidOn, rate)
      if (!res.ok) return `Não registrei o pagamento do ${clientName}: ${payWeekMessage(res.reason, res.message)}`
      return `Pronto! ${clientName}: semana ${numero} de ${teto} registrada (US$ ${Number(p.valorUsd)}).`
    }
    if (action.tool === 'registrar_reuniao') {
      const sellerId = String(p.sellerId ?? '')
      const metOn = String(p.metOn ?? '')
      const valorUsd = Number(p.valorUsd)
      const clientId = p.clientId ? String(p.clientId) : null
      const clientName = p.clientName ? String(p.clientName) : null
      const leadId = p.leadId ? String(p.leadId) : null
      if (!sellerId || !metOn) return 'Não consegui registrar a reunião: dados incompletos.'
      const rate = await getFxRate()
      const { error } = await registerMeeting(supabase, sellerId, { metOn, valorUsd, clientId, clientName, leadId }, rate)
      if (error) return `Não consegui lançar a reunião: ${error.message}`
      // Marco do relatório: reunião feita com o lead (separado da comissão). Idempotente.
      if (leadId) await markMilestones(supabase, leadId, ['reuniao'])
      return `Pronto! Reunião${clientName ? ` com ${clientName}` : ''} lançada (US$ ${valorUsd}, ${metOn}).`
    }
    return 'Ação desconhecida.'
  }

  const confirmAction = async (action: PendingAction) => {
    if (busyRef.current) return // guarda síncrona: 2º clique no mesmo tick não dispara 2x
    busyRef.current = true
    setConfirming(true)
    try {
      addAgent(await executeAction(action))
    } catch {
      // Belt-and-suspenders: executeAction é throw-safe, mas se algo inesperado
      // estourar, nunca deixa a barra/loading travado.
      addAgent('Algo deu errado ao executar a ação. Tente de novo.')
    } finally {
      busyRef.current = false
      setConfirming(false)
      setPending(null)
    }
  }

  const cancelAction = () => {
    setPending(null)
    addAgent('Ok, cancelado. Não criei nada.')
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const text = input.trim()
    if (!text || loading) return

    const userMessage: Message = { id: `user-${Date.now()}`, role: 'user', content: text, timestamp: new Date() }
    const history = [...messages, userMessage]
    setMessages(history)
    setInput('')

    // Com ação pendente: "sim/confirma" executa, "não/cancela" cancela — sem modelo.
    // Qualquer outra resposta segue pro modelo como correção.
    if (pending) {
      if (YES.test(text)) { await confirmAction(pending); return }
      if (NO.test(text)) { cancelAction(); return }
    }

    setLoading(true)
    try {
      const now = new Date()
      const today = ymd(now)
      const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })

      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: history.map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content })),
          today,
          todayLabel,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.detail || err.error || 'Erro ao comunicar com agente')
      }

      const data = await res.json()
      if (data.pendingAction && data.requiresConfirm === false) {
        // Ação direta (ex: mover pra estágio normal): executa sem pedir confirmação.
        addAgent(await executeAction(data.pendingAction))
        setPending(null)
      } else if (data.pendingAction) {
        addAgent(data.resposta)   // preview; aguarda Confirmar/Cancelar
        setPending(data.pendingAction)
      } else {
        addAgent(data.resposta)
        setPending(null)
      }
    } catch (e) {
      const msg = e instanceof Error && e.message ? e.message : ''
      addAgent(msg ? `Não consegui processar: ${msg}` : 'A IA demorou para responder ou está indisponível. Tente novamente em instantes.')
      setPending(null)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full bg-transparent font-body">
      {/* Header */}
      <div className="p-4 border-b border-bento-border">
        <h2 className="font-display text-lg font-semibold text-bento-text flex items-center gap-2">
          <svg className="w-4 h-4 text-lime-fg" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17H3a2 2 0 01-2-2V5a2 2 0 012-2h14a2 2 0 012 2v10a2 2 0 01-2 2h-2" /></svg>
          Agente IA
        </h2>
        <p className="text-xs text-muted-foreground mt-1">
          Pergunte sobre o sistema, ou peça pra criar um lead ou tarefa (confirmo antes de salvar)
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground mb-2">Nenhuma conversa iniciada</p>
            <p className="text-sm text-muted-foreground/70">
              Ex.: &quot;cria um lead chamado João da Construtora Silva&quot;
            </p>
          </div>
        )}

        {messages.map(msg => (
          <div
            key={msg.id}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-md px-4 py-2 rounded-lg ${
                msg.role === 'user'
                  ? 'bg-lime text-lime-ink'
                  : 'bg-bento-bg text-bento-text border border-bento-border'
              }`}
            >
              {msg.role === 'agent' ? (
                <Markdown>{msg.content}</Markdown>
              ) : (
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
              )}
              <p
                className={`text-xs mt-1 ${
                  msg.role === 'user'
                    ? 'text-lime-ink/60'
                    : 'text-bento-muted'
                }`}
              >
                {msg.timestamp.toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-bento-bg text-bento-text border border-bento-border px-4 py-2 rounded-lg">
              <div className="flex gap-2 items-center">
                <div className="w-2 h-2 bg-lime rounded-full animate-bounce" />
                <div className="w-2 h-2 bg-lime rounded-full animate-bounce delay-100" />
                <div className="w-2 h-2 bg-lime rounded-full animate-bounce delay-200" />
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Barra de confirmação — só toca o banco depois daqui (ou de um "sim" digitado) */}
      {pending && !loading && (
        <div className="px-4 pb-2">
          <div className="flex items-center gap-2 rounded-btn border border-lime/40 bg-lime/10 px-3 py-2">
            <span className="text-xs text-bento-text flex-1">
              Confirmar {pending.tool === 'create_lead' ? 'criação do lead' : pending.tool === 'create_task' ? 'criação da tarefa' : pending.tool === 'mover_lead' ? 'mover pra Venda Fechada' : pending.tool === 'editar_cliente' ? 'a edição do cliente' : pending.tool === 'registrar_pagamento' ? 'o pagamento da semana' : pending.tool === 'registrar_reuniao' ? 'a reunião' : 'a ação'}?
            </span>
            <button
              type="button"
              onClick={() => confirmAction(pending)}
              disabled={confirming}
              className="bento-btn px-3 py-1 rounded-btn text-xs font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {confirming ? 'Salvando...' : 'Confirmar'}
            </button>
            <button
              type="button"
              onClick={cancelAction}
              disabled={confirming}
              className="px-3 py-1 rounded-btn text-xs border border-bento-border text-bento-dim hover:text-bento-text transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="p-4 border-t border-bento-border">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder={pending ? 'Confirme acima, ou corrija (ex: a empresa é Souza)...' : 'Faça uma pergunta ou peça uma ação...'}
            disabled={loading}
            className="flex-1 bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="bento-btn px-4 py-2 rounded-btn text-sm font-medium disabled:cursor-not-allowed"
          >
            Enviar
          </button>
        </form>
      </div>
    </div>
  )
}
