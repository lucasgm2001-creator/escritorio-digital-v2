import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'

export const runtime = 'nodejs'
export const maxDuration = 15

const FX_URL = 'https://economia.awesomeapi.com.br/json/last/USD-BRL'
const FX_FALLBACK = 5.40 // último caso (regra 5): a cotação efetiva NUNCA pode ser 0/nula
const TIMEOUT_MS = 3000
// TTL da referência (anti-429): só rebusca na API externa se a referência estiver vazia OU tiver sido
// gravada há mais de ~12h. Entre buscas, devolve a referência já gravada SEM chamar a API.
const REF_TTL_MS = 12 * 60 * 60 * 1000

// Busca USD->BRL na AwesomeAPI (campo bid). Timeout curto. NÃO engole o erro: retorna o MOTIVO
// (status HTTP / valor inválido / exceção / endpoint) pra dar pra diagnosticar no log [fx].
async function fetchUsdBrl(): Promise<{ value: number } | { error: string }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), TIMEOUT_MS)
  try {
    const res = await fetch(FX_URL, { signal: ctrl.signal, cache: 'no-store' })
    if (!res.ok) return { error: `HTTP ${res.status} em ${FX_URL}` }
    const json = await res.json()
    const raw = json?.USDBRL?.bid
    const bid = Number(raw)
    if (!(Number.isFinite(bid) && bid > 0)) return { error: `valor inválido (bid=${String(raw)}) em ${FX_URL}` }
    return { value: bid }
  } catch (e) {
    const msg = e instanceof Error ? `${e.name}: ${e.message}` : String(e)
    return { error: `exceção ao buscar ${FX_URL}: ${msg}` }
  } finally {
    clearTimeout(t)
  }
}

// Cotação efetiva do dia (fetch-on-read com cache diário + fallback). NÃO altera
// cotacao_manual/cotacao_travada nem qualquer cotacao_usd_brl histórico — só gerencia
// a cotacao_referencia (automática). Escreve pela MESMA sessão autenticada do app.
export async function POST(req: Request) {
  const auth = await requireAuth()
  if ('error' in auth) return auth.error

  const rl = checkRateLimit(`fx:${auth.user.id}`)
  if (!rl.allowed) return NextResponse.json({ error: 'Muitas requisições.' }, { status: 429 })

  const force = await req.json().then(b => !!b?.force).catch(() => false)

  const { data: cfg } = await auth.supabase
    .from('fx_config')
    .select('cotacao_manual, cotacao_travada, cotacao_referencia, updated_at')
    .eq('id', 1)
    .maybeSingle()

  const manual = cfg?.cotacao_manual != null ? Number(cfg.cotacao_manual) : null
  const travada = !!cfg?.cotacao_travada
  let referencia = cfg?.cotacao_referencia != null ? Number(cfg.cotacao_referencia) : null
  const updatedAt = cfg?.updated_at as string | undefined

  // 2) Travada com manual definido: NUNCA busca; a efetiva é a manual.
  if (travada && manual != null) {
    return NextResponse.json({ referencia: referencia ?? manual, effective: manual, source: 'manual', travada: true })
  }

  // 3) Referência "fresca" = referencia não-nula E gravada há menos de ~12h (REF_TTL_MS). Fresca →
  //    devolve a referência já gravada SEM chamar a API externa (corta o 429 por excesso de chamadas).
  const ageMs = updatedAt ? (Date.now() - new Date(updatedAt).getTime()) : Infinity
  const fresh = referencia != null && ageMs < REF_TTL_MS
  let source: 'auto' | 'fallback' = 'auto'

  // 4) Só busca se NÃO travada E (referência vazia OU > ~12h) — ou forçada. Travada NUNCA bate na API
  //    (ponto 5). Quando busca e vem valor válido (>0), GRAVA cotacao_referencia + updated_at = now.
  if (!travada && (force || !fresh)) {
    const fetched = await fetchUsdBrl()
    if ('value' in fetched) {
      referencia = fetched.value
      const { error: upErr } = await auth.supabase.from('fx_config')
        .update({ cotacao_referencia: fetched.value, updated_at: new Date().toISOString() })
        .eq('id', 1)
      if (upErr) {
        // Busca OK mas o WRITE falhou (provável RLS no fx_config). Surface — não engole.
        console.error('[fx] write da cotacao_referencia falhou:', upErr.message)
        return NextResponse.json(
          { referencia: fetched.value, effective: fetched.value, source: 'auto', travada, error: `[fx] write falhou: ${upErr.message}` },
          { status: 502 },
        )
      }
      source = 'auto'
    } else {
      // Busca FALHOU/inválida (ex.: 429): NÃO sobrescreve NADA (nem cotacao_referencia, nem updated_at) —
      // mantém a última referência boa e o fallback de EXIBIÇÃO. Só loga o motivo em [fx] (status/endpoint).
      console.error('[fx]', fetched.error)
      const ref = referencia ?? manual ?? FX_FALLBACK
      const effective = travada && manual != null ? manual : ref
      return NextResponse.json(
        { referencia: ref, effective, source: 'fallback', travada, error: `[fx] ${fetched.error}` },
        { status: 502 },
      )
    }
  }

  const ref = referencia ?? manual ?? FX_FALLBACK
  const effective = travada && manual != null ? manual : ref
  return NextResponse.json({ referencia: ref, effective, source, travada })
}
