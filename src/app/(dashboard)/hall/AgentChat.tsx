'use client'

import { useState, useRef, useEffect } from 'react'
import { Markdown } from '@/components/ui/Markdown'

interface Message {
  id: string
  role: 'user' | 'agent'
  content: string
  timestamp: Date
}

export function AgentChat() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input.trim() || loading) return

    // Adicionar mensagem do usuário
    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input,
      timestamp: new Date(),
    }
    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: input }),
      })

      if (!res.ok) {
        const error = await res.json()
        throw new Error(error.error || 'Erro ao comunicar com agente')
      }

      const data = await res.json()
      const agentMessage: Message = {
        id: `agent-${Date.now()}`,
        role: 'agent',
        content: data.resposta,
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, agentMessage])
    } catch {
      const errorMessage: Message = {
        id: `error-${Date.now()}`,
        role: 'agent',
        content: 'A IA demorou para responder ou está indisponível. Tente novamente em instantes.',
        timestamp: new Date(),
      }
      setMessages(prev => [...prev, errorMessage])
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
          Faça perguntas sobre leads, clientes, campanhas e pagamentos
        </p>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center">
            <p className="text-muted-foreground mb-2">Nenhuma conversa iniciada</p>
            <p className="text-sm text-muted-foreground/70">
              Faça uma pergunta para começar
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

      {/* Input */}
      <div className="p-4 border-t border-bento-border">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Faça uma pergunta..."
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
