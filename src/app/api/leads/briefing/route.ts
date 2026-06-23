import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { aiErrorMessage } from '@/lib/aiError'

// Briefing do lead: lê notas (leads.notes) + histórico (lead_interactions), pede um resumo à IA
// (mesmo modelo do SuperAgent) e SALVA como interação type='briefing'. SÓ LEITURA dos dados +
// 1 insert; NÃO mexe em dinheiro nem move o lead no funil (status é apenas SUGESTÃO/texto).

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'   // mesmo do SuperAgent

// Tipos de interação que ALIMENTAM o briefing (exclui 'briefing' e 'sistema').
const INPUT_TYPES = ['ligacao', 'mensagem', 'nota', 'reuniao', 'proposta', 'atendeu', 'nao_atendeu', 'reagendamento']
// Status válidos do funil (NUNCA 'lixeira') — o mesmo conjunto que o funil usa.
const VALID_STATUS = ['novo', 'interagiu', 'nao_interagiu', 'reuniao', 'no_show', 'reagendamento', 'proposta', 'fechado', 'perdido', 'negocio_futuro']

const str = (v: unknown): string => (v == null ? '' : String(v).trim())

export async function POST(req: Request) {
  // Acesso: rota chamada pela UI logada (não é webhook). Auth por sessão + rate limit.
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult.error
  const rl = checkRateLimit(authResult.user.id)
  if (!rl.allowed) {
    return NextResponse.json({ ok: false, reason: 'rate' }, {
      status: 429,
      headers: { 'Retry-After': String(Math.ceil((rl.resetTime - Date.now()) / 1000)) },
    })
  }

  let body: { leadId?: unknown }
  try {
    body = (await req.json()) as { leadId?: unknown }
  } catch {
    return NextResponse.json({ ok: false, reason: 'invalid_json' }, { status: 400 })
  }
  const leadId = str(body.leadId)
  if (!leadId) return NextResponse.json({ ok: false, reason: 'invalid' }, { status: 400 })

  try {
    const supabase = createServiceClient()

    // Lê o lead + o histórico (asc; só os tipos úteis, sem briefing/sistema).
    const [{ data: lead }, { data: ints }] = await Promise.all([
      supabase.from('leads').select('name, company, status, notes').eq('id', leadId).maybeSingle(),
      supabase.from('lead_interactions').select('type, note, created_at')
        .eq('lead_id', leadId).in('type', INPUT_TYPES).order('created_at', { ascending: true }),
    ])
    if (!lead) return NextResponse.json({ ok: false, reason: 'no_lead' }, { status: 404 })

    const interactions = ints ?? []
    const notes = str(lead.notes)

    // Sem nenhum conteúdo útil → não chama a IA.
    if (!notes && interactions.length === 0) {
      return NextResponse.json({ ok: false, reason: 'sem_dados' })
    }

    // Monta o input da IA (histórico legível).
    const linhas: string[] = []
    if (notes) linhas.push(`Observações de cadastro: ${notes}`)
    for (const it of interactions) {
      const quando = new Date(it.created_at as string).toLocaleDateString('pt-BR')
      const texto = str(it.note)
      linhas.push(`[${quando}] ${str(it.type)}${texto ? `: ${texto}` : ''}`)
    }

    const system =
      'Você é um analista comercial. Gere um briefing do lead a partir das conversas e observações. ' +
      'Responda SOMENTE com um JSON válido, sem markdown e sem crases, exatamente neste formato: ' +
      '{"resumo": string, "pontos_chave": string[], "proximo_passo": string, "status_sugerido": string, "justificativa_status": string}. ' +
      `O "status_sugerido" DEVE ser EXATAMENTE um destes: ${VALID_STATUS.join(', ')}. Nunca use "lixeira". ` +
      'Escreva em português do Brasil, objetivo e direto.'
    const userContent =
      `Lead: ${str(lead.name) || 'Sem nome'}${lead.company ? ` (${str(lead.company)})` : ''} | Status atual: ${str(lead.status)}\n\n` +
      `Histórico (mais antigo → mais recente):\n${linhas.join('\n')}`

    let text: string
    try {
      const res = await generateText({
        model: anthropic(MODEL),
        system,
        messages: [{ role: 'user', content: userContent }],
        maxOutputTokens: 1024,
      })
      text = res.text
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error('[leads/briefing] IA falhou:', msg)
      return NextResponse.json({ ok: false, reason: 'ia', message: aiErrorMessage(msg) }, { status: 502 })
    }

    // Parse seguro (limpa cercas ```json e pega o 1º bloco {...}).
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
    const match = cleaned.match(/\{[\s\S]*\}/)
    let parsed: Record<string, unknown> | null = null
    if (match) { try { parsed = JSON.parse(match[0]) } catch { parsed = null } }
    if (!parsed) {
      console.log('[leads/briefing] parse falhou; texto bruto:', text)
      return NextResponse.json({ ok: false, reason: 'parse' }, { status: 500 })
    }

    const resumo = str(parsed.resumo)
    const pontos_chave = Array.isArray(parsed.pontos_chave) ? parsed.pontos_chave.map(str).filter(Boolean) : []
    const proximo_passo = str(parsed.proximo_passo)
    const statusRaw = str(parsed.status_sugerido).toLowerCase()
    const status_sugerido = VALID_STATUS.includes(statusRaw) ? statusRaw : ''   // só sugestão; inválido → vazio
    const justificativa_status = str(parsed.justificativa_status)
    const briefing = { resumo, pontos_chave, proximo_passo, status_sugerido, justificativa_status }

    // Nota legível (pt-BR) salva no histórico.
    const noteText = [
      resumo && `Resumo: ${resumo}`,
      pontos_chave.length ? `Pontos-chave:\n${pontos_chave.map(p => `• ${p}`).join('\n')}` : '',
      proximo_passo && `Próximo passo: ${proximo_passo}`,
      status_sugerido && `Status sugerido: ${status_sugerido}${justificativa_status ? ` — ${justificativa_status}` : ''}`,
    ].filter(Boolean).join('\n\n')

    const { data: inserted, error } = await supabase
      .from('lead_interactions')
      .insert({ lead_id: leadId, type: 'briefing', created_by_name: 'Briefing IA', note: noteText })
      .select('id')
      .single()
    if (error || !inserted) {
      console.error('[leads/briefing] insert falhou:', error?.message)
      return NextResponse.json({ ok: false, reason: 'erro' }, { status: 500 })
    }

    return NextResponse.json({ ok: true, briefing, interactionId: inserted.id })
  } catch (e) {
    console.error('[leads/briefing] erro inesperado:', e instanceof Error ? e.message : String(e))
    return NextResponse.json({ ok: false, reason: 'erro' }, { status: 500 })
  }
}
