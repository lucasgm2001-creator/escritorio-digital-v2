'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Lead } from './KanbanBoard'

interface Props {
  lead: Lead
  currentUser: { id: string; name: string }
  onClose: () => void
}

export function CommissionModal({ lead, currentUser, onClose }: Props) {
  const [percentage, setPercentage] = useState('10')
  const [customAmount, setCustomAmount] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [loading, setLoading] = useState(false)
  const [saved, setSaved] = useState(false)

  const supabase = createClient()

  const baseValue = lead.value || 0
  const calculatedAmount = baseValue > 0 && percentage
    ? ((baseValue * parseFloat(percentage || '0')) / 100)
    : 0

  const finalAmount = customAmount ? parseFloat(customAmount) : calculatedAmount

  const handleSave = async () => {
    setLoading(true)
    await supabase.from('commissions').insert({
      seller_id: lead.assigned_to ?? currentUser.id,
      lead_id: lead.id,
      amount: finalAmount,
      percentage: parseFloat(percentage || '0'),
      status: 'pendente',
      due_date: dueDate || null,
    })
    setSaved(true)
    setLoading(false)
    setTimeout(onClose, 1800)
  }

  const fmt = (v: number) =>
    v > 0 ? `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'R$ 0,00'

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm border border-slate-200 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-200 bg-gradient-to-r from-emerald-50 to-white">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-full bg-emerald-100 flex items-center justify-center shadow-sm">
              <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-base">Venda Concluída!</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                <strong>{lead.name}</strong> agora é cliente
              </p>
            </div>
          </div>
        </div>

        {saved ? (
          <div className="p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="font-semibold text-emerald-700">Comissão registrada!</p>
            <p className="text-xs text-slate-400 mt-1">{fmt(finalAmount)}</p>
          </div>
        ) : (
          <div className="p-5 space-y-4">
            <p className="text-sm text-slate-600">
              Registre a comissão para{' '}
              <span className="font-semibold text-slate-800">
                {lead.assigned_name ?? currentUser.name}
              </span>
              :
            </p>

            {baseValue > 0 && (
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200">
                <p className="text-[11px] text-slate-400 uppercase tracking-wide">Valor do Contrato</p>
                <p className="text-xl font-bold text-slate-900 mt-0.5">{fmt(baseValue)}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  % Comissão
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={percentage}
                    onChange={e => { setPercentage(e.target.value); setCustomAmount('') }}
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 pr-7"
                    placeholder="10"
                    min="0"
                    max="100"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs">%</span>
                </div>
                {baseValue > 0 && calculatedAmount > 0 && (
                  <p className="text-[10px] text-slate-400 mt-1 tabular-nums">= {fmt(calculatedAmount)}</p>
                )}
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  Valor (R$)
                </label>
                <input
                  type="number"
                  value={customAmount || (calculatedAmount > 0 ? calculatedAmount.toFixed(2) : '')}
                  onChange={e => setCustomAmount(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
                  placeholder="0,00"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                Data de Vencimento
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200"
              />
            </div>

            {finalAmount > 0 && (
              <div className="bg-emerald-50 rounded-xl px-4 py-3 border border-emerald-200 flex items-center justify-between">
                <span className="text-xs text-emerald-700 font-medium">Comissão a registrar</span>
                <span className="text-base font-bold text-emerald-800 tabular-nums">{fmt(finalAmount)}</span>
              </div>
            )}

            <div className="flex gap-3 pt-1">
              <button
                onClick={onClose}
                className="flex-1 border border-slate-200 text-slate-600 py-2.5 rounded-xl text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                Pular
              </button>
              <button
                onClick={handleSave}
                disabled={loading || finalAmount <= 0}
                className="flex-1 bg-primary-900 text-white py-2.5 rounded-xl text-sm font-semibold hover:bg-primary-800 active:bg-primary-950 transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Salvando...' : 'Salvar Comissão'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
