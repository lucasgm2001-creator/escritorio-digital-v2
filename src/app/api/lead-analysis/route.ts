import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  // Verificar autenticação
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return authResult.error
  }

  // Verificar rate limiting (20 req/min por usuário)
  const rateLimitInfo = checkRateLimit(authResult.user.id)
  if (!rateLimitInfo.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: {
        'Retry-After': String(Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)),
        'X-RateLimit-Limit': '20',
        'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
        'X-RateLimit-Reset': String(Math.ceil(rateLimitInfo.resetTime / 1000)),
      }}
    )
  }

  try {
    const body = await req.json()

    // Validar campos obrigatórios
    if (!body.lead || typeof body.lead !== 'object') {
      return NextResponse.json(
        { error: 'Campo lead é obrigatório' },
        { status: 400 }
      )
    }

    if (!Array.isArray(body.interactions)) {
      return NextResponse.json(
        { error: 'Campo interactions deve ser um array' },
        { status: 400 }
      )
    }

    const { lead, interactions } = body

    // Sanitizar dados de entrada
    const sanitize = (s: string) => (s || '').replace(/[\r\n`{}]/g, ' ').slice(0, 100)
    const leadScore = Math.min(1000, Math.max(0, lead.score || 0))
    const safeLeadData = {
      name: sanitize(lead.name),
      score: leadScore,
      status: sanitize(lead.status),
      operation: sanitize(lead.operation),
    }

    const { text } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: 'Analise este lead comercial e sugira o próximo passo para fechar a venda. Responda em 2-3 frases diretas em português, focando na ação mais importante a tomar agora.',
      messages: [
        {
          role: 'user',
          content: `Lead: ${safeLeadData.name} | Score: ${safeLeadData.score} | Status: ${safeLeadData.status} | Operação: ${safeLeadData.operation}\nÚltimas interações: ${JSON.stringify(interactions.slice(0, 5))}`,
        },
      ],
      maxOutputTokens: 200,
    })

    return NextResponse.json({ suggestion: text })
  } catch {
    console.error('[lead-analysis] Failed to generate analysis')
    return NextResponse.json(
      { error: 'Não foi possível gerar análise no momento.' },
      { status: 500 }
    )
  }
}
