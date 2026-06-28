import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { verifyState, exchangeCodeForTokens, fetchGoogleEmail, saveTokensForUser } from '@/lib/google/oauth'

// Retorno do consentimento Google. VALIDA o state assinado (CSRF) → user_id; CONFERE o nonce contra o cookie
// de USO ÚNICO (anti-replay, M15) e o LIMPA; troca code por tokens; descobre o email (userinfo); UPSERT
// preservando o refresh_token. Sempre volta pra /configuracoes. Node runtime.
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  // Toda saída LIMPA o cookie de nonce (uso único — vale p/ sucesso, replay ou erro).
  const to = (q: string) => {
    const res = NextResponse.redirect(new URL(`/configuracoes?google=${q}`, url.origin))
    res.cookies.delete('g_oauth_nonce')
    return res
  }

  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  if (url.searchParams.get('error') || !code) return to('error')

  // CSRF + ANTI-REPLAY: assinatura/expiração do state + nonce IGUAL ao do cookie httpOnly de uso único.
  // Cookie ausente/diferente → replay ou callback vencido → aborta.
  const parsed = verifyState(state)
  const cookieNonce = cookies().get('g_oauth_nonce')?.value
  if (!parsed || !cookieNonce || cookieNonce !== parsed.nonce) return to('error')

  const tokens = await exchangeCodeForTokens(code)
  if (!tokens?.access_token) return to('error')

  const email = await fetchGoogleEmail(tokens.access_token)
  await saveTokensForUser(parsed.userId, { ...tokens, google_email: email })

  return to('connected')
}
