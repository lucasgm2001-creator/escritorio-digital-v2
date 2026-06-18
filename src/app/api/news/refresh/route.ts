import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const maxDuration = 60

const NICHOS = ['licencas', 'construcao', 'imigracao', 'house_cleaning', 'servicos']
const ESTADOS = ['MA', 'NJ', 'CA', 'NC', 'SC', 'US']
const SEV = new Set(['critico', 'alta', 'media'])

// Agendador: header x-cron-secret === CRON_SECRET. (Fallback do Hall usa requireAuth.)
function authorizedByToken(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  return !!secret && !!provided && provided === secret
}

type NewsItem = {
  titulo?: unknown; categoria?: unknown; estados?: unknown; severidade?: unknown
  resumo?: unknown; impacto?: unknown; fonte_url?: unknown; fonte_nome?: unknown; published_at?: unknown
}

// Parse robusto: limpa cercas ```json e pega o primeiro array JSON do texto.
function parseItems(text: string): NewsItem[] {
  const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim()
  const start = cleaned.indexOf('[')
  const end = cleaned.lastIndexOf(']')
  if (start === -1 || end <= start) return []
  try {
    const arr = JSON.parse(cleaned.slice(start, end + 1))
    return Array.isArray(arr) ? (arr as NewsItem[]) : []
  } catch {
    return []
  }
}

const str = (v: unknown, max: number): string | null => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : null)

export async function POST(req: Request) {
  // Auth dupla: token do agendador OU usuário logado (fallback do Hall). Senão 401.
  if (!authorizedByToken(req)) {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
  }

  try {
    const system = `Você é um curador de notícias para uma empresa de serviços nos EUA (licenças/registro de empresas, construção, imigração, house cleaning e serviços em geral). `
      + `Use a ferramenta web_search para achar notícias REAIS e RECENTES (últimas 24-48h) que impactem esses nichos nos estados ${ESTADOS.join(', ')} (e EUA em geral). Escreva em português.`
    const prompt = `Liste até 12 notícias relevantes das últimas 48h.\n`
      + `Categorias válidas (use exatamente): ${NICHOS.join(', ')}.\n`
      + `Estados: siglas ${ESTADOS.join(', ')} (use 'US' para nacional).\n`
      + `Responda APENAS um array JSON (nada fora dele). Cada item:\n`
      + `{"titulo","categoria","estados":["MA"],"severidade":"critico|alta|media","resumo":"1-2 frases","impacto":"1 linha de impacto pra empresa","fonte_url","fonte_nome","published_at":"ISO8601"}`

    const { text } = await generateText({
      model: anthropic('claude-sonnet-4-6'),
      tools: { web_search: anthropic.tools.webSearch_20250305({ maxUses: 4 }) },
      system,
      prompt,
      maxOutputTokens: 4000,
    })

    // Normaliza + valida.
    const items = parseItems(text)
      .map(n => ({
        titulo: str(n.titulo, 300),
        categoria: NICHOS.includes(String(n.categoria)) ? String(n.categoria) : null,
        estados: Array.isArray(n.estados) ? n.estados.map(s => String(s).toUpperCase().slice(0, 4)).slice(0, 8) : [],
        severidade: SEV.has(String(n.severidade)) ? String(n.severidade) : 'media',
        resumo: str(n.resumo, 600),
        impacto: str(n.impacto, 300),
        fonte_url: str(n.fonte_url, 1000),
        fonte_nome: str(n.fonte_nome, 200),
        published_at: str(n.published_at, 40),
        fetched_at: new Date().toISOString(),
      }))
      .filter(n => n.titulo)

    if (items.length === 0) return NextResponse.json({ ok: true, inserted: 0, note: 'nada parseado' })

    const supabase = createServiceClient()

    // Dedup no lote (por url) + contra o que já existe (índice é parcial → dedup na app).
    const seen = new Set<string>()
    const batch = items.filter(n => {
      if (!n.fonte_url) return true
      if (seen.has(n.fonte_url)) return false
      seen.add(n.fonte_url)
      return true
    })
    const urls = batch.map(n => n.fonte_url).filter(Boolean) as string[]
    let existing = new Set<string>()
    if (urls.length) {
      const { data: ex } = await supabase.from('news').select('fonte_url').in('fonte_url', urls)
      existing = new Set((ex ?? []).map(r => r.fonte_url as string))
    }
    const toInsert = batch.filter(n => !n.fonte_url || !existing.has(n.fonte_url))
    if (toInsert.length === 0) return NextResponse.json({ ok: true, inserted: 0 })

    const { error } = await supabase.from('news').insert(toInsert)
    if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 })
    return NextResponse.json({ ok: true, inserted: toInsert.length })
  } catch (e) {
    console.error('[news/refresh] failed', e)
    return NextResponse.json({ ok: false, error: 'refresh falhou' }, { status: 500 })
  }
}
