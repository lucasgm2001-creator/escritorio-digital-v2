import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'

// Webhook PÚBLICO — o Magnetic (GoHighLevel), no gatilho "Transcript Generated", manda a transcrição
// da ligação + dados do contato. Achamos o lead (por email/phone) e gravamos a transcrição como
// interação tipo 'ligacao' no histórico de contato. NÃO cria lead a partir de transcrição.
// Sem sessão → service-role (createServiceClient). Mesmo segredo do /api/leads/inbound.
//
// Envs: INBOUND_WEBHOOK_SECRET · NEXT_PUBLIC_SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY (estas 2 via createServiceClient).

export const runtime = 'nodejs'

// Compara o segredo em tempo constante (sha256 = buffers do mesmo tamanho). Nunca loga o segredo.
function secretOk(req: Request): boolean {
  const expected = process.env.INBOUND_WEBHOOK_SECRET
  if (!expected) return false
  const provided =
    req.headers.get('x-webhook-secret') ??
    new URL(req.url).searchParams.get('secret') ??
    ''
  if (!provided) return false
  return timingSafeEqual(
    createHash('sha256').update(provided).digest(),
    createHash('sha256').update(expected).digest(),
  )
}

const str = (v: unknown): string => (v == null ? '' : String(v).trim())

export async function POST(req: Request) {
  // 1) SEGURANÇA antes de qualquer acesso ao banco.
  if (!secretOk(req)) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 })
  }

  // 2) Corpo.
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ ok: false, error: 'invalid_json' }, { status: 400 })
  }
  // Loga só os NOMES dos campos (pra mapear os campos do GHL) — NUNCA o CONTEÚDO (transcript = PII). B3.
  console.log('[leads/transcript] payload keys:', Object.keys(body).join(','))

  try {
    const contact = body.contact && typeof body.contact === 'object' ? (body.contact as Record<string, unknown>) : undefined
    const custom = (body.customData ?? body.customFields ?? body['custom_fields']) as Record<string, unknown> | undefined

    // Identificação do contato (tenta chaves comuns; contact_id não tem coluna p/ casar → só diagnóstico).
    const email = str(body.email) || str(contact?.email)
    const phone = str(body.phone) || str(contact?.phone)

    // Texto da transcrição (top-level e dentro de customData/customFields).
    const transcript =
      str(body.transcript) || str(body.message_transcript) || str(body.call_transcript) || str(body.transcription) ||
      (custom ? str(custom.transcript ?? custom.message_transcript ?? custom.call_transcript ?? custom.transcription) : '')

    // 3) Sem transcrição → ignora (não insere).
    if (!transcript) {
      return NextResponse.json({ ok: true, ignored: 'no_transcript' })
    }

    const supabase = createServiceClient()

    // 4) Achar o lead por email OU phone (mesma lógica do /api/leads/inbound). NÃO cria lead.
    let leadId: string | null = null
    if (email) {
      const { data } = await supabase.from('leads').select('id').eq('email', email).limit(1)
      if (data && data.length) leadId = data[0].id as string
    }
    if (!leadId && phone) {
      const { data } = await supabase.from('leads').select('id').eq('phone', phone).limit(1)
      if (data && data.length) leadId = data[0].id as string
    }
    if (!leadId) {
      console.log('[leads/transcript] nenhum lead encontrado', { hasEmail: !!email, hasPhone: !!phone })
      return NextResponse.json({ ok: true, no_lead: true })
    }

    // 5) Cabeçalho de direção/duração, se vierem. Ex.: "Ligação (saída, 4min):\n<transcrição>".
    const dirRaw = str(body.direction || body.call_direction).toLowerCase()
    const dir = dirRaw === 'inbound' ? 'entrada' : dirRaw === 'outbound' ? 'saída' : ''
    const durSec = Number(body.duration ?? body.call_duration ?? body.duration_seconds)
    const durMin = Number.isFinite(durSec) && durSec > 0 ? `${Math.round(durSec / 60)}min` : ''
    const head = [dir, durMin].filter(Boolean).join(', ')
    const note = head ? `Ligação (${head}):\n${transcript}` : `Ligação:\n${transcript}`

    // 6) Dedup: mesma nota, mesmo lead, type 'ligacao', nos últimos ~10 min (cobre reenvio do GHL).
    //    (lead_interactions não tem coluna de id externo, então dedup por conteúdo da nota = transcrição.)
    const since = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: dup } = await supabase
      .from('lead_interactions').select('id')
      .eq('lead_id', leadId).eq('type', 'ligacao').eq('note', note).gte('created_at', since).limit(1)
    if (dup && dup.length) {
      return NextResponse.json({ ok: true, duplicate: true })
    }

    // 7) Insere no histórico de contato. score_delta default 0, created_by null (sem sessão).
    const { data, error } = await supabase
      .from('lead_interactions')
      .insert({ lead_id: leadId, type: 'ligacao', note, created_by_name: 'Magnetic' })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[leads/transcript] insert failed:', error?.message)
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, interactionId: data.id })
  } catch (e) {
    console.error('[leads/transcript] unexpected:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
