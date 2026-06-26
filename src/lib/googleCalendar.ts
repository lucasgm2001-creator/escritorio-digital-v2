import 'server-only'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/service'

// Sincroniza tarefas (tabela `tasks`) com o Google Agenda via CONTA DE SERVIÇO.
// SOMENTE servidor — NUNCA importar em client component. A chave nunca chega ao browser.
// Tudo é BEST-EFFORT: qualquer falha (env ausente, API caiu) é logada e engolida — o salvamento
// da tarefa NUNCA depende disto. NÃO toca em dinheiro/comissão.

const SCOPES = ['https://www.googleapis.com/auth/calendar.events']
const TIMEZONE = 'America/Sao_Paulo'
const DURATION_MIN = 30

interface TaskRow {
  id: string
  title: string
  notes?: string | null
  due_date?: string | null
  due_time?: string | null
  linked_name?: string | null
  google_event_id?: string | null
}

// Autentica com a conta de serviço (GOOGLE_SERVICE_ACCOUNT_KEY = JSON completo). private_key tem \n —
// JSON.parse já resolve. Retorna null se faltar env/credencial (→ sync vira no-op silencioso).
function getCalendarClient() {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  const calendarId = process.env.GOOGLE_CALENDAR_ID
  if (!raw || !calendarId) return null
  let creds: { client_email?: string; private_key?: string }
  try {
    creds = JSON.parse(raw)
  } catch (e) {
    console.error('[googleCalendar] GOOGLE_SERVICE_ACCOUNT_KEY não é um JSON válido:', e)
    return null
  }
  if (!creds.client_email || !creds.private_key) {
    console.error('[googleCalendar] credencial sem client_email/private_key.')
    return null
  }
  const auth = new google.auth.JWT({ email: creds.client_email, key: creds.private_key, scopes: SCOPES })
  return { calendar: google.calendar({ version: 'v3', auth }), calendarId }
}

// 'YYYY-MM-DD' + dias → 'YYYY-MM-DD' (UTC puro, sem escorregar por fuso).
function addDays(date: string, days: number): string {
  const dt = new Date(`${date}T00:00:00Z`)
  dt.setUTCDate(dt.getUTCDate() + days)
  return dt.toISOString().slice(0, 10)
}

// 'HH:MM' + minutos → { date, time }; rola pro dia seguinte se passar da meia-noite.
function addMinutes(date: string, time: string, mins: number): { date: string; time: string } {
  const [h, m] = time.slice(0, 5).split(':').map(Number)
  let total = h * 60 + m + mins
  let extraDays = 0
  while (total >= 1440) { total -= 1440; extraDays += 1 }
  const hh = String(Math.floor(total / 60)).padStart(2, '0')
  const mm = String(total % 60).padStart(2, '0')
  return { date: extraDays ? addDays(date, extraDays) : date, time: `${hh}:${mm}` }
}

// Tarefa → corpo do evento. due_date vazio → null (não vira evento).
function buildEventBody(task: TaskRow) {
  if (!task.due_date) return null
  const desc: string[] = []
  if (task.notes?.trim()) desc.push(task.notes.trim())
  if (task.linked_name?.trim()) desc.push(`Lead: ${task.linked_name.trim()}`)
  const base = { summary: task.title?.trim() || 'Tarefa', description: desc.join('\n\n') || undefined }

  if (task.due_time) {
    const t = task.due_time.slice(0, 5)
    const end = addMinutes(task.due_date, t, DURATION_MIN)
    return {
      ...base,
      start: { dateTime: `${task.due_date}T${t}:00`, timeZone: TIMEZONE },
      end:   { dateTime: `${end.date}T${end.time}:00`, timeZone: TIMEZONE },
    }
  }
  // Dia inteiro: end.date é EXCLUSIVO (dia seguinte).
  return { ...base, start: { date: task.due_date }, end: { date: addDays(task.due_date, 1) } }
}

export async function createEvent(task: TaskRow): Promise<string | null> {
  const ctx = getCalendarClient(); if (!ctx) return null
  const requestBody = buildEventBody(task); if (!requestBody) return null
  const res = await ctx.calendar.events.insert({ calendarId: ctx.calendarId, requestBody })
  return res.data.id ?? null
}

export async function updateEvent(googleEventId: string, task: TaskRow): Promise<void> {
  const ctx = getCalendarClient(); if (!ctx) return
  const requestBody = buildEventBody(task); if (!requestBody) return
  await ctx.calendar.events.update({ calendarId: ctx.calendarId, eventId: googleEventId, requestBody })
}

export async function deleteEvent(googleEventId: string): Promise<void> {
  const ctx = getCalendarClient(); if (!ctx) return
  await ctx.calendar.events.delete({ calendarId: ctx.calendarId, eventId: googleEventId })
}

// ── Orquestração (best-effort) ──────────────────────────────────────────────
// Lê a linha FRESCA da tarefa e reconcilia o evento:
//  • sem due_date  → se tinha evento, apaga e limpa google_event_id.
//  • com due_date  → tem evento? atualiza. não tem? cria e grava o id.
export async function syncTaskCalendar(taskId: string): Promise<void> {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_CALENDAR_ID) return
    const supabase = createServiceClient()
    const { data, error } = await supabase
      .from('tasks')
      .select('id, title, notes, due_date, due_time, linked_name, google_event_id')
      .eq('id', taskId)
      .single()
    if (error || !data) return
    const task = data as TaskRow

    if (!task.due_date) {
      if (task.google_event_id) {
        await deleteEvent(task.google_event_id)
        await supabase.from('tasks').update({ google_event_id: null }).eq('id', taskId)
      }
      return
    }
    if (task.google_event_id) {
      await updateEvent(task.google_event_id, task)
    } else {
      const eventId = await createEvent(task)
      if (eventId) await supabase.from('tasks').update({ google_event_id: eventId }).eq('id', taskId)
    }
  } catch (e) {
    console.error('[googleCalendar] syncTaskCalendar (best-effort) falhou:', e)
  }
}

// Apaga o evento de uma tarefa que está sendo excluída (a linha some logo em seguida).
export async function deleteTaskEvent(googleEventId: string): Promise<void> {
  try {
    if (!process.env.GOOGLE_SERVICE_ACCOUNT_KEY || !process.env.GOOGLE_CALENDAR_ID) return
    await deleteEvent(googleEventId)
  } catch (e) {
    console.error('[googleCalendar] deleteTaskEvent (best-effort) falhou:', e)
  }
}
