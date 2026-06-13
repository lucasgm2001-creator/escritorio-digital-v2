import { NextResponse } from 'next/server'
import { createHash, timingSafeEqual } from 'crypto'
import { getSuperAgent } from '@/lib/agents/SuperAgent'

/**
 * Rota para executar automações do SuperAgent.
 * Disparada por um cron externo. Protegida por CRON_SECRET — NÃO por sessão de
 * usuário: um cron não tem cookies de auth, então o secret é a única porta.
 * Dispara IA cara (Sonnet) e várias queries; não pode ficar aberta.
 */

// Comparação em tempo constante. O hash sha256 garante buffers de mesmo
// tamanho (timingSafeEqual lança quando diferem) e não vaza o comprimento.
function secretsMatch(a: string, b: string): boolean {
  return timingSafeEqual(
    createHash('sha256').update(a).digest(),
    createHash('sha256').update(b).digest()
  )
}

export const runtime = 'nodejs'
export const maxDuration = 60

export async function POST(req: Request) {
  // Porta principal: secret do cron. 401 imediato — antes de qualquer trabalho —
  // se CRON_SECRET não estiver configurado, se o header estiver ausente, ou se
  // não bater (comparação em tempo constante). Secret vazio NÃO autentica.
  const cronSecret = process.env.CRON_SECRET
  const provided =
    req.headers.get('x-cron-secret') ??
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ??
    null

  if (!cronSecret || !provided || !secretsMatch(provided, cronSecret)) {
    return NextResponse.json({ error: 'Não autorizado' }, { status: 401 })
  }

  try {
    // Usar UTC para garantir consistência entre timezones
    const now = new Date()
    const utcHour = now.getUTCHours()
    const utcDay = now.getUTCDay()

    // Horários esperados em UTC:
    // 22h diário = 01:00 UTC (ajuste conforme necessário)
    // Segunda 10h = segunda em UTC (ajuste conforme fuso horário)

    // Executar automações baseadas no horário
    const logs: string[] = []

    // Verificações diárias (rodas a cada hora)
    logs.push('Verificando pagamentos atrasados...')
    await getSuperAgent().verificarPagamentosAtrasados()

    logs.push('Verificando leads sem contato...')
    await getSuperAgent().verificarLeadsSemContato()

    logs.push('Verificando campanhas sem resultado...')
    await getSuperAgent().verificarCampanhasSemResultado()

    logs.push('Verificando MRR...')
    const mrr = await getSuperAgent().verificarMRR()
    logs.push(`MRR atual: R$ ${mrr.toFixed(2)}`)

    // Resumo diário ao final do dia (01:00 UTC = 22:00 BRT)
    if (utcHour === 1) {
      logs.push('Gerando resumo diário...')
      const resumo = await getSuperAgent().gerarResumoDiario()
      await getSuperAgent().postarNoHall(`📊 Resumo do dia:\n\n${resumo}`, 'info')
    }

    // Relatório semanal toda segunda (14:00 UTC = 10:00 BRT)
    if (utcDay === 1 && utcHour === 14) {
      logs.push('Gerando relatório semanal...')
      const relatorio = await getSuperAgent().gerarRelatorioSemanal()
      await getSuperAgent().postarNoHall(`📈 Relatório semanal:\n\n${relatorio}`, 'info')
    }

    return NextResponse.json({
      success: true,
      timestamp: now.toISOString(),
      logs,
    })
  } catch (error) {
    console.error('[agent-scheduler] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao executar automações.' },
      { status: 500 }
    )
  }
}
