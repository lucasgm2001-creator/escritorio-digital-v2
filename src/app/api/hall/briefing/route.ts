import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { checkRateLimit } from '@/lib/rate-limit'
import { createServiceClient } from '@/lib/supabase/service'
import { aiErrorMessage } from '@/lib/aiError'

// Briefing matinal do Hall (resumo do dia). SÓ LEITURA: lê tarefas/leads/reuniões/atividades já
// salvos e pede à IA (mesmo cliente/modelo do /api/leads/briefing) um resumo curto. NÃO recalcula
// nada, NÃO toca em dinheiro (comissão/receita), NÃO grava nada — é derivado e sob demanda.

export const runtime = 'nodejs'
export const maxDuration = 60

const MODEL = 'claude-sonnet-4-6'   // mesmo do /api/leads/briefing
const DAY_MS = 86_400_000
const str = (v: unknown): string => (v == null ? '' : String(v).trim())

export async function POST() {
  // Chamado pela UI logada: auth por sessão + rate-limit (igual aos outros endpoints).
  const authResult = await requireAuth()
  if ('error' in authResult) return authResult.error
  const rl = checkRateLimit(authResult.user.id)
  if (!rl.allowed) {
    return NextResponse.json({ ok: true, briefing: 'Muitas requisições agora — tente o briefing em alguns segundos.' })
  }

  const userId = authResult.user.id
  const now = new Date()
  // Data civil de Brasília (mesma convenção do resto do app).
  const todayYMD = now.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' })
  const fiveDaysAgoISO = new Date(now.getTime() - 5 * DAY_MS).toISOString()

  try {
    const supabase = createServiceClient()

    const [tasksRes, stagesRes, meetingsRes, actsRes, profileRes] = await Promise.all([
      // Tarefas do usuário, NÃO concluídas, com data de hoje ou anterior.
      supabase.from('tasks').select('title, due_date, due_time, done')
        .eq('user_id', userId).eq('done', false).not('due_date', 'is', null).lte('due_date', todayYMD)
        .order('due_date', { ascending: true }),
      supabase.from('funnel_stages').select('slug, nome, is_won, is_lost, arquivada'),
      // Reuniões de HOJE (meetings.met_on). Só nome/observação — sem valores.
      supabase.from('meetings').select('client_name, note, met_on').eq('met_on', todayYMD),
      supabase.from('activities').select('description, user_name, created_at').order('created_at', { ascending: false }).limit(10),
      supabase.from('profiles').select('name').eq('id', userId).maybeSingle(),
    ])

    const tasks = tasksRes.data ?? []
    const hoje = tasks.filter(t => str(t.due_date) === todayYMD)
    const atrasadas = tasks.filter(t => str(t.due_date) < todayYMD)

    // Fases ATIVAS = não is_won, não is_lost, não arquivada, slug != 'lixeira'.
    const stages = stagesRes.data ?? []
    const activeSlugs = stages.filter(s => !s.is_won && !s.is_lost && !s.arquivada && s.slug !== 'lixeira').map(s => str(s.slug))
    const nomeBySlug = new Map(stages.map(s => [str(s.slug), str(s.nome) || str(s.slug)]))

    // Leads parados 5+ dias em fase ativa (pela updated_at).
    let parados: { name: string; fase: string; dias: number }[] = []
    if (activeSlugs.length) {
      const { data: leads } = await supabase.from('leads').select('name, status, updated_at')
        .in('status', activeSlugs).lte('updated_at', fiveDaysAgoISO)
        .order('updated_at', { ascending: true }).limit(15)
      parados = (leads ?? []).map(l => ({
        name: str(l.name) || 'Sem nome',
        fase: nomeBySlug.get(str(l.status)) ?? str(l.status),
        dias: Math.max(0, Math.floor((now.getTime() - new Date(l.updated_at as string).getTime()) / DAY_MS)),
      }))
    }

    const reunioes = (meetingsRes.data ?? []).map(m => str(m.client_name) || 'Reunião')
    const atividades = (actsRes.data ?? []).map(a => str(a.description)).filter(Boolean)
    const userName = str(profileRes.data?.name)

    // Se não há NADA relevante, evita a IA — devolve dia tranquilo.
    if (hoje.length + atrasadas.length + reunioes.length + parados.length === 0) {
      const oi = userName ? `Bom dia, ${userName}.` : 'Bom dia.'
      return NextResponse.json({ ok: true, briefing: `${oi} Dia tranquilo — nada urgente nas tarefas, reuniões ou leads parados.` })
    }

    // Dados pro modelo (somente o que existe).
    const dados = [
      `Tarefas de hoje (${hoje.length}): ${hoje.map(t => str(t.title) + (t.due_time ? ` às ${str(t.due_time).slice(0, 5)}` : '')).join('; ') || 'nenhuma'}`,
      `Tarefas atrasadas (${atrasadas.length}): ${atrasadas.map(t => `${str(t.title)} (venceu ${str(t.due_date)})`).join('; ') || 'nenhuma'}`,
      `Reuniões de hoje (${reunioes.length}): ${reunioes.join('; ') || 'nenhuma'}`,
      `Leads parados 5+ dias (${parados.length}): ${parados.map(p => `${p.name} — ${p.fase}, ${p.dias}d parado`).join('; ') || 'nenhum'}`,
      `Últimas atividades: ${atividades.slice(0, 10).join('; ') || 'nenhuma'}`,
    ]
    const todayLabel = now.toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long', timeZone: 'America/Sao_Paulo' })

    const system =
      'Você é uma secretária executiva objetiva. Gere um briefing matinal CURTO em português do Brasil ' +
      'a partir SOMENTE dos dados fornecidos — NUNCA invente itens, números ou nomes. Estrutura: um ' +
      'cumprimento curto e depois bullets com o que precisa de atenção HOJE (tarefas de hoje, atrasadas, ' +
      'reuniões, leads parados). Direto, sem floreio. Se não houver nada relevante, diga que o dia está ' +
      'tranquilo. Use markdown simples (bullets com "-"). NÃO cite valores em dinheiro.'
    const userContent = `Hoje é ${todayLabel}.${userName ? ` Usuário: ${userName}.` : ''}\n\nDADOS:\n${dados.join('\n')}`

    const { text } = await generateText({
      model: anthropic(MODEL),
      system,
      messages: [{ role: 'user', content: userContent }],
      maxOutputTokens: 700,
    })

    return NextResponse.json({ ok: true, briefing: str(text) || 'Não consegui gerar o briefing agora.' })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[hall/briefing] erro:', msg)
    // Fallback amigável (status 200) — nunca quebra o Hall; mostra o MOTIVO real.
    return NextResponse.json({ ok: true, briefing: `Não consegui gerar o briefing agora: ${aiErrorMessage(msg)}` })
  }
}
