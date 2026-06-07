import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getSuperAgent } from '@/lib/agents/SuperAgent'
import { checkRateLimit } from '@/lib/rate-limit'

export async function POST(req: Request) {
  // Verificar autenticação
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return authResult.error
  }

  // Rate limiting (20 req/min)
  const rateLimitInfo = checkRateLimit(authResult.user.id)
  if (!rateLimitInfo.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((rateLimitInfo.resetTime - Date.now()) / 1000)),
          'X-RateLimit-Limit': '20',
          'X-RateLimit-Remaining': String(rateLimitInfo.remaining),
          'X-RateLimit-Reset': String(Math.ceil(rateLimitInfo.resetTime / 1000)),
        },
      }
    )
  }

  try {
    const { question } = await req.json()

    if (!question || typeof question !== 'string' || question.length > 1000) {
      return NextResponse.json(
        { error: 'Pergunta inválida. Máximo 1000 caracteres.' },
        { status: 400 }
      )
    }

    // App pessoal de usuário único: sem papéis. O SuperAgent responde com
    // acesso total (assina internamente o default 'admin').
    const resposta = await getSuperAgent().chat(question, authResult.user.id)

    return NextResponse.json({ resposta })
  } catch (error) {
    console.error('[agent-chat] Failed:', error)
    return NextResponse.json(
      { error: 'Erro ao processar pergunta.' },
      { status: 500 }
    )
  }
}
