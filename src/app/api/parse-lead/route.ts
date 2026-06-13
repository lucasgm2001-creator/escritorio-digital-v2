import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_TEXT_LENGTH = 2000

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

    // Validar campo text
    if (typeof body.text !== 'string' || !body.text.trim()) {
      return NextResponse.json(
        { error: 'Campo text é obrigatório e deve ser uma string' },
        { status: 400 }
      )
    }

    if (body.text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json(
        { error: `Campo text não pode exceder ${MAX_TEXT_LENGTH} caracteres` },
        { status: 400 }
      )
    }

    const { text } = body

    const { text: result } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system: 'Extraia os dados do lead abaixo e retorne APENAS um JSON válido com as chaves: name, company, email, phone, notes. Se não encontrar, use string vazia. Responda apenas com o JSON, sem explicações.',
      messages: [
        {
          role: 'user',
          content: text,
        },
      ],
      maxOutputTokens: 300,
    })

    // Extração tolerante (mesmo padrão do /api/tasks/parse): pega o primeiro {…}
    // de qualquer lugar da resposta, mesmo se o modelo embrulhar em ```json … ```
    // ou colar texto em volta. Regex ancorado exigia JSON puro e falhava.
    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      return NextResponse.json({ lead: null })
    }

    let lead
    try {
      lead = JSON.parse(jsonMatch[0])
    } catch {
      return NextResponse.json({ lead: null })
    }
    return NextResponse.json({ lead })
  } catch {
    console.error('[parse-lead] Failed to parse')
    return NextResponse.json(
      { lead: null },
      { status: 500 }
    )
  }
}
