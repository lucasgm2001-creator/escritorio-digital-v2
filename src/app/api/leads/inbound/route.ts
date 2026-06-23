import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { stateToFuso } from '@/lib/fuso'
import { logStageEvent } from '@/lib/stageEvents'

// Webhook PÚBLICO — o Magnetic (GoHighLevel) chama a cada lead novo e nós inserimos no funil
// (tabela `leads`), com os MESMOS defaults de um lead criado à mão. Sem sessão de usuário → usamos
// o client service-role (createServiceClient). Protegido por segredo compartilhado.
//
// Envs esperadas:
//   - INBOUND_WEBHOOK_SECRET   (segredo compartilhado; header "x-webhook-secret" ou ?secret=)
//   - NEXT_PUBLIC_SUPABASE_URL  +  SUPABASE_SERVICE_ROLE_KEY  (lidas dentro de createServiceClient)
//
// ⚠️ origem: a tabela `leads` tem CHECK (origem in instagram/google/indicacao/tiktok/site/outro),
// então NÃO dá pra gravar 'Magnetic' direto. Gravamos origem='outro' e marcamos "Origem: Magnetic"
// nas notas (info preservada). Pra ter um valor 'magnetic' de verdade, é preciso migration (à parte).

export const runtime = 'nodejs'

// Compara o segredo em tempo constante (sha256 garante buffers do mesmo tamanho). Nunca loga o segredo.
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

// Procura, case-insensitive, o 1º valor não-vazio entre as chaves pedidas.
function findKeyCI(obj: Record<string, unknown>, keys: string[]): string {
  const want = new Set(keys.map(k => k.toLowerCase()))
  for (const [k, v] of Object.entries(obj)) {
    if (want.has(k.toLowerCase())) { const s = str(v); if (s) return s }
  }
  return ''
}

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
  // Loga o payload BRUTO (pra vermos os nomes reais dos campos do GHL). NUNCA loga segredo/keys.
  console.log('[leads/inbound] payload:', JSON.stringify(body))

  try {
    // 3) Mapeamento best-effort (resiliente a campo faltando).
    const first = str(body.first_name)
    const last = str(body.last_name)
    const name =
      str(body.full_name) ||
      [first, last].filter(Boolean).join(' ').trim() ||
      str(body.name) ||
      first
    const email = str(body.email)
    const phone = str(body.phone)
    const company = str(body.company_name) || str(body.company)

    // Notas legíveis ("Chave: valor | ..."): marca a origem (Magnetic) + campos úteis + custom fields.
    const extras: string[] = ['Origem: Magnetic']
    const add = (label: string, v: unknown) => { const s = str(v); if (s) extras.push(`${label}: ${s}`) }
    add('Serviço', body.service ?? body['servico'] ?? body['serviço'])
    add('Estado', body.state ?? body['estado'])
    add('Cidade', body.city ?? body['cidade'])
    add('Mensagem', body.message ?? body['mensagem'])
    add('Fonte GHL', body.source)
    const custom = body.customData ?? body.customFields ?? body['custom_fields']
    if (custom && typeof custom === 'object') {
      for (const [k, v] of Object.entries(custom as Record<string, unknown>)) add(k, v)
    }
    const notes = extras.join(' | ')

    // 3b) Fuso automático a partir do estado: (a) payload (state/estado, inclusive em customData/
    //     customFields, case-insensitive) → (b) fallback regex nas notes que montamos acima.
    const customObj = custom && typeof custom === 'object' ? (custom as Record<string, unknown>) : {}
    let stateRaw = findKeyCI(body, ['state', 'estado']) || findKeyCI(customObj, ['state', 'estado'])
    if (!stateRaw) {
      const m = notes.match(/(?:estado|state)\s*:\s*([^|.]+)/i)
      if (m) stateRaw = m[1].trim()
    }
    const fuso = stateToFuso(stateRaw)

    // 4) Sem nome, e-mail e telefone → ignora (não insere).
    if (!name && !email && !phone) {
      return NextResponse.json({ ok: true, ignored: 'empty' })
    }

    const supabase = createServiceClient()

    // 5) Dedup: já existe lead com o MESMO email OU o MESMO phone? (o que vier)
    if (email) {
      const { data } = await supabase.from('leads').select('id').eq('email', email).limit(1)
      if (data && data.length) return NextResponse.json({ ok: true, duplicate: true })
    }
    if (phone) {
      const { data } = await supabase.from('leads').select('id').eq('phone', phone).limit(1)
      if (data && data.length) return NextResponse.json({ ok: true, duplicate: true })
    }

    // 6) Insere com os MESMOS padrões de um lead manual (LeadModal): status 'novo' (1º estágio,
    //    "Novo Lead"), operation 'eua', prioridade 'media', value 0, score 500. assigned ao Lucas
    //    (assigned_to null evita a FK de profiles, como na criação manual). received_at: default do banco.
    const { data, error } = await supabase
      .from('leads')
      .insert({
        name: name || 'Sem nome',
        email: email || null,
        phone: phone || null,
        company: company || null,
        notes,
        status: 'novo',
        operation: 'eua',
        origem: 'outro',          // CHECK não aceita 'Magnetic' → 'outro' + nota "Origem: Magnetic"
        prioridade: 'media',
        value: 0,
        score: 500,
        assigned_to: null,
        assigned_name: 'Lucas',
        ...(fuso ? { fuso } : {}),   // só seta se reconhecemos o estado (null → não envia)
      })
      .select('id')
      .single()

    if (error || !data) {
      console.error('[leads/inbound] insert failed:', error?.message)
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }

    // Histórico de movimentação: entrada no funil (ADITIVO/best-effort).
    await logStageEvent(supabase, {
      leadId: data.id, leadName: name || 'Sem nome',
      fromStage: null, toStage: 'novo',
      sellerId: null, sellerName: 'Lucas',
    })

    return NextResponse.json({ ok: true, leadId: data.id })
  } catch (e) {
    console.error('[leads/inbound] unexpected:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
