import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { createServiceClient } from '@/lib/supabase/service'
import { payClientWeek } from '@/lib/commission/actions'
import { resolveRate } from '@/lib/commission/calc'
import type { FxConfig } from '@/lib/commission/types'

export const runtime = 'nodejs'
export const maxDuration = 60

// Auto-preenchimento da semana paga do cliente → REUSA payClientWeek (receita + comissão derivada
// via payWeek). NÃO duplica regra. Idempotente (trava unique + checagens). DINHEIRO: não muda
// calc.ts/payWeek; só decide QUANDO chamar o fluxo do incremento 2.

function authorizedByToken(req: Request): boolean {
  const secret = process.env.CRON_SECRET
  const provided = req.headers.get('x-cron-secret')
  return !!secret && !!provided && provided === secret
}

const spDay = (d: Date) => d.toLocaleDateString('en-CA', { timeZone: 'America/Sao_Paulo' }) // YYYY-MM-DD (Brasília)
const dowOf = (ymd: string) => { const [y, m, d] = ymd.split('-').map(Number); return new Date(Date.UTC(y, m - 1, d)).getUTCDay() } // 0=Dom..6=Sáb
const daysBetween = (a: string, b: string) => {
  const pa = a.split('-').map(Number), pb = b.split('-').map(Number)
  return Math.floor((Date.UTC(pa[0], pa[1] - 1, pa[2]) - Date.UTC(pb[0], pb[1] - 1, pb[2])) / 86400000)
}

type SupaService = ReturnType<typeof createServiceClient>

async function resolveServerRate(supabase: SupaService): Promise<number> {
  const { data: fx } = await supabase.from('fx_config').select('cotacao_manual, cotacao_travada, cotacao_referencia').eq('id', 1).maybeSingle()
  const manual = fx?.cotacao_manual != null ? Number(fx.cotacao_manual) : null
  const fxc: FxConfig = { cotacaoManual: manual, cotacaoTravada: !!fx?.cotacao_travada }
  const auto = Number(fx?.cotacao_referencia) || manual || 5.40
  const r = resolveRate(fxc, auto)
  return r > 0 ? r : 5.40
}

type Cli = { id: string; status: string; start_date: string | null; dia_pagamento_semana: number | null }

// force=true (gatilho manual de teste): ignora as travas de calendário e marca a próxima semana.
async function processClient(supabase: SupaService, cli: Cli, today: string, rate: number, force: boolean): Promise<string> {
  if (cli.status !== 'ativo') return 'skip:inativo'
  if (!cli.start_date) return 'skip:sem_inicio'
  const payday = cli.dia_pagamento_semana ?? dowOf(cli.start_date)
  if (!force && dowOf(today) !== payday) return 'skip:nao_e_o_dia'

  const { data: cps } = await supabase.from('client_payments').select('numero_semana, paid_on').eq('client_id', cli.id)
  const nums = (cps ?? []).map(r => r.numero_semana as number)
  const dueWeeks = Math.floor(daysBetween(today, cli.start_date) / 7) + 1
  if (!force && nums.length >= dueWeeks) return 'skip:em_dia'
  if (!force && (cps ?? []).some(r => r.paid_on === today)) return 'skip:ja_pago_hoje'

  let n = 1; const set = new Set(nums); while (set.has(n)) n++
  const res = await payClientWeek(supabase, cli.id, n, today, rate)
  if (!res.ok) return `skip:${res.reason ?? 'erro'}`
  return `pago:semana_${n}:comissao_${res.commission ?? 'na'}`
}

export async function POST(req: Request) {
  let body: { clientId?: string } = {}
  try { body = await req.json() } catch { /* sem corpo = cron */ }

  // Auth: token do agendador OU usuário logado (gatilho manual da tela).
  if (!authorizedByToken(req)) {
    const auth = await requireAuth()
    if ('error' in auth) return auth.error
  }

  const supabase = createServiceClient()
  const today = spDay(new Date())
  const rate = await resolveServerRate(supabase)

  // Gatilho MANUAL (1 cliente) — testa o caminho completo server-side antes de ligar pra todos.
  if (body.clientId) {
    const { data: cli } = await supabase.from('clients').select('id, status, start_date, dia_pagamento_semana').eq('id', body.clientId).maybeSingle()
    if (!cli) return NextResponse.json({ ok: false, error: 'cliente não encontrado' }, { status: 404 })
    const result = await processClient(supabase, cli as Cli, today, rate, true)
    return NextResponse.json({ ok: true, mode: 'single', result })
  }

  // CRON (todos): SÓ roda se ligado explicitamente (segurança — desligado até validar).
  if (process.env.COMMISSION_AUTO_ENABLED !== 'true') {
    return NextResponse.json({ ok: true, mode: 'all', disabled: true, note: 'COMMISSION_AUTO_ENABLED != "true"' })
  }
  const { data: clients } = await supabase.from('clients').select('id, status, start_date, dia_pagamento_semana').eq('status', 'ativo')
  const results: Record<string, string> = {}
  for (const c of clients ?? []) results[c.id] = await processClient(supabase, c as Cli, today, rate, false)
  return NextResponse.json({ ok: true, mode: 'all', count: Object.keys(results).length, results })
}
