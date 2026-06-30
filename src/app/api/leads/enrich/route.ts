import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { createServiceClient } from '@/lib/supabase/service'
import { stateToFuso } from '@/lib/fuso'
import { logStageEvent } from '@/lib/stageEvents'
import {
  AREA_CODES, flattenCI, pick, normalizeUsState, areaCodeFromPhone, parseValue, looksLikeAddress,
  NICHO_KEYS, COMPANY_KEYS, VALUE_KEYS, NOTES_KEYS, STATE_KEYS, CITY_KEYS,
} from '@/lib/leadIntake'

// Webhook PÚBLICO — recebe um FORMULÁRIO (Make, ou qualquer POST) e ENRIQUECE um lead existente (casando por
// telefone/e-mail via RPC find_lead_for_enrich), preenchendo SÓ campos vazios — principalmente `nicho`. Se não
// achar lead, cria (fallback) igual ao inbound, mas origem='formulario'. Sem sessão → service-role.
// Reaproveita o parsing PURO do inbound (src/lib/leadIntake.ts). Mesmo segredo do inbound.
//
// Envs: INBOUND_WEBHOOK_SECRET (header "x-webhook-secret" ou ?secret=) · NEXT_PUBLIC_SUPABASE_URL +
//       SUPABASE_SERVICE_ROLE_KEY (via createServiceClient).

export const runtime = 'nodejs'

// Vendedor responsável padrão (perfil "Lucas"), igual ao inbound.
const ASSIGNED_TO = '623dd724-ddeb-426c-956a-4c71f6653fa5'
const ASSIGNED_NAME = 'Lucas'
const RAW_MAX = 64 * 1024

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

const isEmpty = (v: unknown): boolean => v == null || (typeof v === 'string' && v.trim() === '')

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
  const rawStr = JSON.stringify(body)
  if (process.env.INBOUND_DEBUG) console.log('[leads/enrich] payload:', rawStr)
  // form_enrich/raw com TETO de 64KB (igual inbound): payload gigante não incha a linha.
  const rawCapped: unknown = rawStr.length <= RAW_MAX ? body : { _truncated: true, _bytes: rawStr.length }

  try {
    const flat = flattenCI(body)

    // Identificadores (top-level e aninhados via flat).
    const email = pick(flat, ['email', 'e-mail', 'email_address', 'mail'])
    const phone = pick(flat, ['phone', 'telefone', 'celular', 'whatsapp', 'phone_number', 'telephone', 'tel', 'mobile'])

    // Campos do formulário (MESMA regra do inbound).
    const nichoRaw = pick(flat, NICHO_KEYS)
    const companyRaw = pick(flat, COMPANY_KEYS)
    const company = companyRaw && !looksLikeAddress(companyRaw) ? companyRaw : null
    const value = parseValue(pick(flat, VALUE_KEYS))
    const notes = pick(flat, NOTES_KEYS) || null

    // Geografia US — base no DDD do telefone; "Estado" do form só entra se for estado US válido.
    const area_code = areaCodeFromPhone(phone) || null
    let state: string | null = null
    let city: string | null = null
    if (area_code && AREA_CODES[area_code]) { state = AREA_CODES[area_code].st; city = AREA_CODES[area_code].city }
    const payloadState = normalizeUsState(pick(flat, STATE_KEYS))
    const payloadCity = pick(flat, CITY_KEYS)
    if (payloadState) { state = payloadState; if (payloadCity) city = payloadCity }
    const fuso = stateToFuso(state ?? '')

    // 3) Sem identificador → 400.
    if (!email && !phone) {
      return NextResponse.json({ ok: false, error: 'sem_identificador' }, { status: 400 })
    }

    const supabase = createServiceClient()

    // 4) Normalizar o nicho contra os nichos ATIVOS (match case-insensitive → nome canônico; sem match → como
    //    veio; vazio → null). NÃO cria nicho novo.
    let nichoFinal: string | null = null
    if (nichoRaw.trim()) {
      const { data: nichos, error: nErr } = await supabase.from('nichos').select('nome').eq('ativo', true)
      if (nErr) return NextResponse.json({ ok: false, error: 'falha ao buscar nichos' }, { status: 500 })
      const want = nichoRaw.trim().toLowerCase()
      const match = (nichos ?? []).find(n => String((n as { nome: string }).nome).trim().toLowerCase() === want)
      nichoFinal = match ? String((match as { nome: string }).nome) : nichoRaw.trim()
    }

    // 5) Casar o lead (RPC). Erro na RPC → 500 (não criar às cegas).
    const digits = phone.replace(/\D/g, '')
    const last10 = digits.slice(-10)
    const { data: matchId, error: rpcErr } = await supabase.rpc('find_lead_for_enrich', {
      p_email: email || '', p_phone_digits: last10 || '',
    })
    if (rpcErr) return NextResponse.json({ ok: false, error: 'falha ao casar lead' }, { status: 500 })
    const leadId: string | null = (matchId as string | null) ?? null

    // 6) ACHOU → enriquecer (preenche SÓ o que está vazio; nunca sobrescreve campo não-vazio).
    if (leadId) {
      const { data: cur, error: selErr } = await supabase
        .from('leads')
        .select('nicho, company, value, notes, city, state, area_code, raw_payload')
        .eq('id', leadId).single()
      if (selErr || !cur) return NextResponse.json({ ok: false, error: 'falha ao ler lead' }, { status: 500 })

      const c = cur as Record<string, unknown>
      const patch: Record<string, unknown> = {}
      if (nichoFinal && isEmpty(c.nicho)) patch.nicho = nichoFinal
      if (company && isEmpty(c.company)) patch.company = company
      if (notes && isEmpty(c.notes)) patch.notes = notes
      if (city && isEmpty(c.city)) patch.city = city
      if (state && isEmpty(c.state)) patch.state = state
      if (area_code && isEmpty(c.area_code)) patch.area_code = area_code
      if (value > 0 && (c.value == null || Number(c.value) === 0)) patch.value = value

      // raw_payload: merge SEM perder o existente → { ...atual, form_enrich: body } (com teto 64KB).
      const curRaw = (c.raw_payload && typeof c.raw_payload === 'object' && !Array.isArray(c.raw_payload))
        ? (c.raw_payload as Record<string, unknown>) : {}
      patch.raw_payload = { ...curRaw, form_enrich: rawCapped }
      patch.updated_at = new Date().toISOString()

      const { error: updErr } = await supabase.from('leads').update(patch).eq('id', leadId)
      if (updErr) return NextResponse.json({ ok: false, error: 'update_failed' }, { status: 500 })

      return NextResponse.json({ ok: true, action: 'enriched', leadId, nicho_aplicado: (patch.nicho as string | undefined) ?? null })
    }

    // 7) NÃO achou → cria (fallback), igual ao inbound mas origem='formulario'.
    const name =
      pick(flat, ['full_name', 'fullname', 'nome_completo', 'name', 'nome']) ||
      [pick(flat, ['first_name', 'firstname', 'primeiro_nome']), pick(flat, ['last_name', 'lastname', 'sobrenome'])].filter(Boolean).join(' ').trim()

    const { data: ins, error: insErr } = await supabase
      .from('leads')
      .insert({
        name: name || 'Sem nome',
        email: email || null,
        phone: phone || null,
        company,
        nicho: nichoFinal,
        city,
        state,
        area_code,
        value,
        notes,
        status: 'novo',
        operation: 'eua',
        origem: 'formulario',     // constraint leads_origem_check aceita 'formulario'
        prioridade: 'media',
        score: 500,
        assigned_to: ASSIGNED_TO,
        assigned_name: ASSIGNED_NAME,
        raw_payload: rawCapped,
        ...(fuso ? { fuso } : {}),
      })
      .select('id')
      .single()

    if (insErr) {
      // 23505 = índice único (email/phone) → lead JÁ existe; trata como duplicado, nunca 500.
      if (insErr.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
      console.error('[leads/enrich] insert failed:', insErr.message)
      return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })
    }
    if (!ins) return NextResponse.json({ ok: false, error: 'insert_failed' }, { status: 500 })

    // Histórico de movimentação: entrada no funil (ADITIVO/best-effort).
    await logStageEvent(supabase, {
      leadId: ins.id, leadName: name || 'Sem nome',
      fromStage: null, toStage: 'novo',
      sellerId: null, sellerName: ASSIGNED_NAME,
    })

    return NextResponse.json({ ok: true, action: 'created', leadId: ins.id })
  } catch (e) {
    console.error('[leads/enrich] unexpected:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: false, error: 'server_error' }, { status: 500 })
  }
}
