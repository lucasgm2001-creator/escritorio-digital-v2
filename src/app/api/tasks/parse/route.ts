import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'

const MAX_TEXT_LENGTH = 500

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult.error

  const rl = checkRateLimit(`tasks-parse:${authResult.user.id}`)
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Muitas requisições. Aguarde um momento.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((rl.resetTime - Date.now()) / 1000)) } }
    )
  }

  try {
    const body = await req.json()
    if (typeof body.text !== 'string' || !body.text.trim()) {
      return NextResponse.json({ error: 'Campo text é obrigatório' }, { status: 400 })
    }
    if (body.text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: `text não pode exceder ${MAX_TEXT_LENGTH} caracteres` }, { status: 400 })
    }

    // Hoje vem do cliente (fuso local). todayLabel é legível p/ resolver "sexta".
    const today: string = typeof body.today === 'string' ? body.today : new Date().toISOString().slice(0, 10)
    const todayLabel: string = typeof body.todayLabel === 'string' ? body.todayLabel : today

    const system = [
      `Você extrai os dados de UMA tarefa a partir de texto em português e retorna APENAS um JSON válido.`,
      `Hoje é ${todayLabel} (${today}). Resolva datas relativas (hoje, amanhã, depois de amanhã, sexta, segunda, semana que vem) para uma data absoluta a partir de hoje. Se um dia da semana já passou nesta semana, use a próxima ocorrência.`,
      `Chaves do JSON:`,
      `- "title": frase imperativa curta do QUE fazer, INCLUINDO o nome da pessoa/empresa quando houver (ex: "Ligar pro João", "Reunião com Flávio", "Enviar proposta pra ACME"). Apenas NÃO inclua a data, a hora, nem palavras de prioridade. NUNCA deixe vazio — se estiver em dúvida, use o próprio texto limpo. Capitalize a primeira letra.`,
      `- "due_date": "YYYY-MM-DD" ou "" se não houver data.`,
      `- "due_time": "HH:MM" (24h) ou "" se não houver hora. "15h"→"15:00", "9 da manhã"→"09:00", "meio-dia"→"12:00".`,
      `- "priority": "urgente" (urgente/asap/pra ontem), "alta" (importante/prioridade) ou "normal".`,
      `- "contact_name": só o nome da PESSOA/empresa mencionada, para conectar (ex: "João", "Flávio"), ou "" se nenhum. O nome também permanece no title.`,
      `Responda só com o JSON, sem explicações.`,
      `Exemplos:`,
      `Texto: "ligar pro João amanhã 10h, urgente" → {"title":"Ligar pro João","due_date":"<amanhã em YYYY-MM-DD>","due_time":"10:00","priority":"urgente","contact_name":"João"}`,
      `Texto: "reunião com Flávio sexta 15h" → {"title":"Reunião com Flávio","due_date":"<próxima sexta>","due_time":"15:00","priority":"normal","contact_name":"Flávio"}`,
      `Texto: "comprar café" → {"title":"Comprar café","due_date":"","due_time":"","priority":"normal","contact_name":""}`,
    ].join('\n')

    const { text: result } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      system,
      messages: [{ role: 'user', content: body.text }],
      maxOutputTokens: 250,
    })

    const match = result.match(/\{[\s\S]*\}/)
    if (!match) return NextResponse.json({ task: null })

    let parsed: Record<string, unknown>
    try { parsed = JSON.parse(match[0]) } catch { return NextResponse.json({ task: null }) }

    const prio = String(parsed.priority ?? 'normal')

    // Rede de segurança: título NUNCA vazio. Se a IA não preencheu, derivo do
    // texto original removendo fragmentos óbvios de data/hora/prioridade.
    let title = String(parsed.title ?? '').trim()
    if (!title) {
      title = body.text
        .replace(/\b(urgente|urgência|asap|importante|prioridade(?:\s+alta)?|pra ontem)\b/gi, '')
        .replace(/\b(hoje|amanh[ãa]|depois de amanh[ãa]|segunda|ter[çc]a|quarta|quinta|sexta|s[áa]bado|domingo|semana que vem|pr[óo]xima semana)(?:-feira)?\b/gi, '')
        .replace(/\b[àás]?\s*\d{1,2}\s*(?:h|hs|horas?|:\d{2})\b/gi, '')
        .replace(/\b(de\s+)?(manh[ãa]|tarde|noite|meio-dia)\b/gi, '')
        .replace(/[,;]+/g, ' ')
        .replace(/\s{2,}/g, ' ')
        .trim()
    }
    if (title) title = title.charAt(0).toUpperCase() + title.slice(1)

    const task = {
      title,
      due_date: String(parsed.due_date ?? '').trim(),
      due_time: String(parsed.due_time ?? '').trim().slice(0, 5),
      priority: (['normal', 'alta', 'urgente'].includes(prio) ? prio : 'normal') as 'normal' | 'alta' | 'urgente',
      contact_name: String(parsed.contact_name ?? '').trim(),
    }
    return NextResponse.json({ task })
  } catch {
    console.error('[tasks/parse] failed')
    return NextResponse.json({ task: null }, { status: 500 })
  }
}
