import { NextResponse } from 'next/server'
import { getSessionUser } from '@/lib/supabase/session'
import { syncTaskCalendar, deleteTaskEvent } from '@/lib/googleCalendar'

// Sincroniza UMA tarefa com o Google Agenda (conta de serviço). SÓ servidor — a credencial nunca
// sai daqui. BEST-EFFORT: sempre responde ok; nunca derruba o fluxo de salvar/excluir do cliente.
// googleapis precisa de Node (não Edge).
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    // Só usuário logado dispara sincronização (app de usuário único).
    const user = await getSessionUser()
    if (!user) return NextResponse.json({ ok: false }, { status: 401 })

    const body = await req.json().catch(() => ({} as Record<string, unknown>))

    // Excluir: a linha some no cliente; apagamos o evento pelo id que veio do estado.
    if (body?.deleteEventId) {
      await deleteTaskEvent(String(body.deleteEventId))
      return NextResponse.json({ ok: true })
    }
    // Criar/Editar: lê a tarefa fresca e reconcilia (cria/atualiza/remove o evento + grava o id).
    if (body?.taskId) {
      await syncTaskCalendar(String(body.taskId))
      return NextResponse.json({ ok: true })
    }
    return NextResponse.json({ ok: false, error: 'taskId ou deleteEventId obrigatório' }, { status: 400 })
  } catch (e) {
    console.error('[api/tasks/calendar-sync] erro (best-effort):', e)
    return NextResponse.json({ ok: true })   // nunca quebra o cliente
  }
}
