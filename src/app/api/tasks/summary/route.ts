import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'

interface CompactTask {
  title: string
  priority: 'normal' | 'alta' | 'urgente'
  due_time?: string | null
  overdue?: boolean
}

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult.error

  const rl = checkRateLimit(`tasks-summary:${authResult.user.id}`)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetTime - Date.now()) / 1000)) } }
    )
  }

  try {
    const body = await req.json()
    const tasks: CompactTask[] = Array.isArray(body.tasks) ? body.tasks.slice(0, 60) : []

    if (tasks.length === 0) {
      return NextResponse.json({ summary: 'Você não tem nenhuma tarefa para hoje nem pendências atrasadas. Dia livre. 🎯' })
    }

    // Lista compacta para o modelo (sem dados sensíveis além do título).
    const lines = tasks.map(t => {
      const tags = [
        t.overdue ? 'ATRASADA' : null,
        t.priority !== 'normal' ? t.priority.toUpperCase() : null,
        t.due_time ? t.due_time.slice(0, 5) : null,
      ].filter(Boolean).join(', ')
      return `- ${t.title}${tags ? ` (${tags})` : ''}`
    }).join('\n')

    const system = [
      `Você é um assistente de produtividade. Resuma o dia do usuário em 2 a 4 frases curtas, em português, tom direto e encorajador.`,
      `Mencione: quantas tarefas, quais são urgentes (pelo nome) e o que está atrasado. NÃO liste tudo cru — sintetize e priorize o que precisa de atenção.`,
      `Não invente nada que não esteja na lista. Responda só o texto, sem markdown nem títulos.`,
    ].join('\n')

    const { text: summary } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system,
      messages: [{ role: 'user', content: `Tarefas (hoje + atrasadas):\n${lines}` }],
      maxOutputTokens: 300,
    })

    return NextResponse.json({ summary: summary.trim() })
  } catch {
    console.error('[tasks/summary] failed')
    return NextResponse.json({ error: 'Falha ao gerar resumo.' }, { status: 500 })
  }
}
