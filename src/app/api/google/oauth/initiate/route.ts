import { NextResponse } from 'next/server'
import { randomBytes } from 'node:crypto'
import { requireAuth } from '@/lib/supabase/require-auth'
import { googleOAuthConfigured, signState, buildConsentUrl } from '@/lib/google/oauth'

// Inicia o consentimento OAuth do Google. Exige sessão (senão 401). Sem env de OAuth → volta pra Configurações
// com aviso (não quebra). O state assinado carrega o user_id (CSRF) + um nonce de USO ÚNICO que também vai num
// cookie httpOnly curto — o callback confere e LIMPA (anti-replay, M15). googleapis/oauth = Node (não Edge).
export const runtime = 'nodejs'

export async function GET(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const origin = new URL(req.url).origin
  if (!googleOAuthConfigured()) {
    return NextResponse.redirect(new URL('/configuracoes?google=unconfigured', origin))
  }
  // M15: nonce de USO ÚNICO no state (assinado) E num cookie httpOnly. sameSite=lax p/ voltar no redirect
  // top-level do Google; secure/httpOnly; expira em 10min (mesma janela do state).
  const nonce = randomBytes(16).toString('hex')
  const state = signState(auth.user.id, nonce)
  const res = NextResponse.redirect(buildConsentUrl(state))
  res.cookies.set('g_oauth_nonce', nonce, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: 600 })
  return res
}
