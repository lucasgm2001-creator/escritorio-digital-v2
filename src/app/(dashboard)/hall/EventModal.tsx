'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { dayBR } from './dateBR'
import { type CalendarEvent, EVENT_TYPE_LABELS, bentoInput, useEscape } from './calendarShared'
import { Portal } from '@/components/ui/Portal'

interface EventModalProps {
  date: Date
  hour?: number
  userId: string
  onClose: () => void
  onSaved: (event: CalendarEvent) => void
}

export function EventModal({ date, hour, userId, onClose, onSaved }: EventModalProps) {
  const [form, setForm] = useState({
    title: '',
    date: dayBR(date),
    start_time: hour != null ? `${String(hour).padStart(2,'0')}:00` : '',
    end_time: hour != null ? `${String(hour + 1).padStart(2,'0')}:00` : '',
    description: '',
    type: 'reuniao' as CalendarEvent['type'],
    color: '#C2F73A',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const colors = ['#C2F73A','#10b981','#f59e0b','#ef4444','#8b5cf6','#06b6d4','#ec4899']

  const handleSave = async () => {
    if (!form.title.trim()) { setError('Título é obrigatório'); return }
    setSaving(true)
    setError('')
    try {
      const supabase = createClient()
      const { data, error: err } = await supabase.from('calendar_events').insert({
        user_id: userId,
        title: form.title.trim(),
        date: form.date,
        start_time: form.start_time || null,
        end_time: form.end_time || null,
        description: form.description || null,
        type: form.type,
        color: form.color,
      }).select().single()

      if (err) {
        console.error('[calendar_events.insert] Error:', err)
        setError(`Erro ao salvar evento: ${err.message}`)
        setSaving(false)
        return
      }
      onSaved(data as CalendarEvent)
      onClose()
    } catch (error) {
      console.error('[calendar_events.insert] Unexpected error:', error)
      setError(error instanceof Error ? `Erro ao salvar evento: ${error.message}` : 'Erro ao salvar evento.')
      setSaving(false)
    }
  }

  useEscape(onClose)

  return (
    <Portal>
    <div onClick={onClose} className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center z-[300] p-0 sm:p-4">
      <div onClick={e => e.stopPropagation()} className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-md animate-slide-up">
        <div className="flex items-center justify-between p-5 border-b border-bento-border">
          <h2 className="font-display font-bold text-bento-text text-base">Novo Evento</h2>
          <button onClick={onClose} className="text-bento-muted hover:text-bento-text transition-colors p-1">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {error && <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/40 rounded-lg px-3 py-2">{error}</p>}

          <div>
            <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Título *</label>
            <input value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              placeholder="Ex: Reunião com cliente" className={bentoInput} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Data</label>
              <input type="date" value={form.date} onChange={e => setForm(p => ({ ...p, date: e.target.value }))} className={bentoInput} />
            </div>
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Tipo</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value as CalendarEvent['type'] }))}
                className={bentoInput}>
                {Object.entries(EVENT_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Início</label>
              <input type="time" value={form.start_time} onChange={e => setForm(p => ({ ...p, start_time: e.target.value }))} className={bentoInput} />
            </div>
            <div>
              <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Fim</label>
              <input type="time" value={form.end_time} onChange={e => setForm(p => ({ ...p, end_time: e.target.value }))} className={bentoInput} />
            </div>
          </div>

          <div>
            <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Descrição (opcional)</label>
            <textarea value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              placeholder="Detalhes do evento..." rows={2}
              className={`${bentoInput} resize-none`} />
          </div>

          <div>
            <label className="block font-tech text-[10px] uppercase tracking-[0.12em] text-bento-muted mb-1.5">Cor</label>
            <div className="flex gap-2">
              {colors.map(c => (
                <button key={c} onClick={() => setForm(p => ({ ...p, color: c }))}
                  className={`w-7 h-7 rounded-full transition-all ${form.color === c ? 'ring-2 ring-bento-text ring-offset-2 ring-offset-bento-panel' : ''}`}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button onClick={onClose}
              className="flex-1 border border-bento-border text-bento-dim py-2.5 rounded-btn text-sm hover:border-lime hover:text-bento-text transition-colors min-h-[44px]">
              Cancelar
            </button>
            <button onClick={handleSave} disabled={saving || !form.title.trim()}
              className="bento-btn flex-1 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
              {saving ? 'Salvando...' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
    </Portal>
  )
}
