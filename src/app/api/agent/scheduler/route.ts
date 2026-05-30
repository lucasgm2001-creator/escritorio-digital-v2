import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { getSuperAgent } from '@/lib/agents/SuperAgent'

/**
 * Rota para executar automações do SuperAgent
 * Deve ser chamada periodicamente via cron job ou webhook externo
 * Protegida por autenticação
 */
export async function POST() {
  // Verificar autenticação (apenas usuários autenticados podem chamar)
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return authResult.error
  }

  // Em produção, você pode adicionar uma verificação de API key secreto aqui
  // para permitir apenas requisições automáticas

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
