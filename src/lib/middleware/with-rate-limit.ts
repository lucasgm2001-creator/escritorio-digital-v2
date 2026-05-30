import { NextResponse } from 'next/server'
import { checkRateLimit } from '@/lib/rate-limit'
import { requireAuth } from '@/lib/supabase/require-auth'

/**
 * Wrapper para aplicar rate limiting automaticamente a rotas API
 * Uso: export const POST = withRateLimit(async (req) => { ... })
 */
export function withRateLimit(handler: (req: Request) => Promise<Response>) {
  return async (req: Request): Promise<Response> => {
    // Autenticar usuário
    const authResult = await requireAuth()
    if ('error' in authResult && authResult.error) {
      return authResult.error as Response
    }

    // Verificar rate limit (20 req/min per user)
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

    // Executar handler original
    return handler(req)
  }
}
