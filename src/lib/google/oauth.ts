import 'server-only'
import { google, type calendar_v3 } from 'googleapis'
import { createHmac, timingSafeEqual } from 'node:crypto'
import { createServiceClient } from '@/lib/supabase/service'

// OAuth do USUÁRIO p/ o sync da Agenda: conectado, os eventos são criados COMO o usuário e o Google Meet é
// criado de verdade (a service account não pode). NÃO conectado → o sync segue na service account (fallback,
// sem regressão). Tokens ficam em public.google_oauth_tokens (RLS sem policies → SÓ service role). O
// client_secret e os tokens NUNCA vão pro browser.

// calendar.events = criar/editar eventos (+ Meet). openid/email = só p/ descobrir/exibir a conta conectada
// (userinfo). Espaço-separado (formato do parâmetro scope do Google).
export const GOOGLE_OAUTH_SCOPES = 'https://www.googleapis.com/auth/calendar.events openid email'

// Redirect FIXO registrado no Google (override opcional via env). Tem que bater EXATAMENTE.
export const GOOGLE_OAUTH_REDIRECT_URI =
  process.env.GOOGLE_OAUTH_REDIRECT_URI?.trim() ||
  'https://escritorio-digital-v2.vercel.app/api/google/oauth/callback'

export function googleOAuthConfigured(): boolean {
  return !!(process.env.GOOGLE_OAUTH_CLIENT_ID && process.env.GOOGLE_OAUTH_CLIENT_SECRET)
}

// ── State assinado (CSRF) ──────────────────────────────────────────────────────
// state = payload(base64url JSON {u:userId, n:nonce, t:ts}) + '.' + HMAC. O callback RECUPERA o user_id
// daqui (sem confiar no browser) e rejeita state forjado/vencido. Assinado com OAUTH_STATE_SECRET (server-only).
function stateSecret(): string {
  const s = process.env.OAUTH_STATE_SECRET
  if (s) return s
  // Em produção NUNCA cair em fallback (seria forjável); falha alto. Em dev usa um default só p/ não travar local.
  if (process.env.NODE_ENV === 'production') throw new Error('OAUTH_STATE_SECRET ausente')
  return 'dev-only-state-secret'
}
// O `nonce` vem de fora (gerado no initiate) p/ ir TAMBÉM num cookie httpOnly de uso único (anti-replay, M15).
export function signState(userId: string, nonce: string): string {
  const payload = Buffer.from(JSON.stringify({ u: userId, n: nonce, t: Date.now() })).toString('base64url')
  const sig = createHmac('sha256', stateSecret()).update(payload).digest('base64url')
  return `${payload}.${sig}`
}
// Devolve { userId, nonce } (ou null) — o callback ainda confere o nonce contra o cookie de uso único.
export function verifyState(state: string | null | undefined): { userId: string; nonce: string } | null {
  if (!state || !state.includes('.')) return null
  const [payload, sig] = state.split('.')
  const expected = createHmac('sha256', stateSecret()).update(payload).digest('base64url')
  try {
    const a = Buffer.from(sig); const b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  } catch { return null }
  try {
    const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
    if (!data?.u || typeof data.u !== 'string') return null
    if (!data?.n || typeof data.n !== 'string') return null
    if (typeof data.t !== 'number' || Date.now() - data.t > 10 * 60_000) return null   // expira em 10min
    return { userId: data.u, nonce: data.n }
  } catch { return null }
}

// URL de consentimento do Google.
export function buildConsentUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    response_type: 'code',
    scope: GOOGLE_OAUTH_SCOPES,
    access_type: 'offline',          // pede refresh_token
    prompt: 'consent',               // garante refresh_token no 1º OK
    include_granted_scopes: 'true',
    state,
  })
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
}

// ── Troca de code / refresh / email (fetch direto ao Google) ────────────────────
interface GoogleTokenResp {
  access_token?: string; refresh_token?: string; expires_in?: number
  id_token?: string; scope?: string; error?: string; error_description?: string
}

async function postToken(body: Record<string, string>): Promise<GoogleTokenResp | null> {
  try {
    const res = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(body),
    })
    const json = (await res.json()) as GoogleTokenResp
    if (!res.ok || json.error) { console.error('[google-oauth] token endpoint:', json.error, json.error_description); return null }
    return json
  } catch (e) {
    console.error('[google-oauth] token endpoint fetch FALHOU:', (e as Error)?.message ?? e)
    return null
  }
}

export function exchangeCodeForTokens(code: string): Promise<GoogleTokenResp | null> {
  return postToken({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    code,
    redirect_uri: GOOGLE_OAUTH_REDIRECT_URI,
    grant_type: 'authorization_code',
  })
}

function refreshTokens(refreshToken: string): Promise<GoogleTokenResp | null> {
  return postToken({
    client_id: process.env.GOOGLE_OAUTH_CLIENT_ID!,
    client_secret: process.env.GOOGLE_OAUTH_CLIENT_SECRET!,
    refresh_token: refreshToken,
    grant_type: 'refresh_token',
  })
}

// Email da conta Google (userinfo). Precisa do escopo openid/email (incluído acima).
export async function fetchGoogleEmail(accessToken: string): Promise<string | null> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', { headers: { Authorization: `Bearer ${accessToken}` } })
    if (!res.ok) return null
    const json = (await res.json()) as { email?: string }
    return typeof json?.email === 'string' ? json.email : null
  } catch { return null }
}

// ── Persistência (SERVICE ROLE; a tabela tem RLS sem policies) ──────────────────
interface TokenRow {
  user_id: string; google_email: string | null; access_token: string | null
  refresh_token: string | null; expires_at: string | null; scope: string | null
}

export async function getTokenRow(userId: string): Promise<TokenRow | null> {
  const supabase = createServiceClient()
  const { data, error } = await supabase
    .from('google_oauth_tokens')
    .select('user_id, google_email, access_token, refresh_token, expires_at, scope')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) { console.error('[google-oauth] getTokenRow:', error.message); return null }
  return (data as TokenRow) ?? null
}

// Upsert no callback. PRESERVA refresh_token/google_email existentes quando o Google não manda novos (o
// refresh_token só vem no 1º consentimento / prompt=consent) — omitir a coluna faz o upsert NÃO mexer nela.
export async function saveTokensForUser(userId: string, t: GoogleTokenResp & { google_email?: string | null }): Promise<void> {
  const supabase = createServiceClient()
  const row: Record<string, unknown> = {
    user_id: userId,
    access_token: t.access_token ?? null,
    expires_at: typeof t.expires_in === 'number' ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
    scope: t.scope ?? null,
    updated_at: new Date().toISOString(),
  }
  if (t.refresh_token) row.refresh_token = t.refresh_token
  if (t.google_email) row.google_email = t.google_email
  const { error } = await supabase.from('google_oauth_tokens').upsert(row, { onConflict: 'user_id' })
  if (error) console.error('[google-oauth] saveTokens upsert:', error.message)
}

export async function deleteTokensForUser(userId: string): Promise<{ ok: boolean; reason?: string }> {
  const supabase = createServiceClient()
  const { error } = await supabase.from('google_oauth_tokens').delete().eq('user_id', userId)
  return error ? { ok: false, reason: error.message } : { ok: true }
}

// Access token VÁLIDO do usuário: usa o salvo se ainda vale (folga de 60s), senão faz refresh
// (grant_type=refresh_token) e PERSISTE o novo access_token+expires_at. null se não conectou / sem refresh.
export async function getUserGoogleAccessToken(userId: string): Promise<string | null> {
  const row = await getTokenRow(userId)
  if (!row) return null
  const now = Date.now()
  const expMs = row.expires_at ? new Date(row.expires_at).getTime() : 0
  if (row.access_token && expMs - 60_000 > now) return row.access_token   // ainda válido
  if (!row.refresh_token) return null
  const t = await refreshTokens(row.refresh_token)
  if (!t?.access_token) return null
  const supabase = createServiceClient()
  await supabase.from('google_oauth_tokens').update({
    access_token: t.access_token,
    expires_at: typeof t.expires_in === 'number' ? new Date(Date.now() + t.expires_in * 1000).toISOString() : null,
    updated_at: new Date().toISOString(),
  }).eq('user_id', userId)
  return t.access_token
}

// Cliente do Google Calendar autenticado COMO o usuário (OAuth), no 'primary'. null se não conectou.
export async function getUserCalendar(
  userId: string,
): Promise<{ calendar: calendar_v3.Calendar; calendarId: string } | null> {
  const token = await getUserGoogleAccessToken(userId)
  if (!token) return null
  const auth = new google.auth.OAuth2()
  auth.setCredentials({ access_token: token })   // só anexa o Bearer; não precisa de client_id p/ USAR o token
  return { calendar: google.calendar({ version: 'v3', auth }), calendarId: 'primary' }
}
