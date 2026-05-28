import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { lead, interactions } = await req.json()

  try {
    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `Analise este lead comercial e sugira o próximo passo para fechar a venda.

Lead: ${lead.name} | Score: ${lead.score} | Status: ${lead.status} | Operação: ${lead.operation}
Últimas interações: ${JSON.stringify(interactions.slice(0, 5))}

Responda em 2-3 frases diretas em português, focando na ação mais importante a tomar agora.`,
      maxOutputTokens: 200,
    })

    return NextResponse.json({ suggestion: text })
  } catch {
    return NextResponse.json({ suggestion: 'Não foi possível gerar análise no momento.' })
  }
}
