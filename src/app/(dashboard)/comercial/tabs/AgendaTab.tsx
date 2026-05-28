'use client'

import { useState } from 'react'
import { getScoreInfo } from '@/lib/utils/score'
import type { Lead } from '../KanbanBoard'
import { ALL_COLUMNS } from '../KanbanBoard'

interface Props { leads: Lead[] }

function formatWhatsApp(phone: string): string {
  const clean = phone.replace(/\D/g, '')
  const num   = clean.startsWith('55') ? clean : `55${clean}`
  return `https://wa.me/${num}`
}

export function AgendaTab({ leads }: Props) {
  const [search, setSearch] = useState('')
  const [stageFilter, setStageFilter] = useState<string>('todos')

  const withPhone = leads.filter(l => l.phone)

  const filtered = withPhone
    .filter(l => {
      const q = search.toLowerCase()
      const matchSearch = !q ||
        l.name.toLowerCase().includes(q) ||
        l.company?.toLowerCase().includes(q) ||
        l.phone?.includes(q)
      const matchStage = stageFilter === 'todos' || l.status === stageFilter
      return matchSearch && matchStage
    })
    .sort((a, b) => b.score - a.score)

  const stages = [
    { key: 'todos', label: 'Todos' },
    ...ALL_COLUMNS.map(c => ({ key: c.key, label: c.label })),
  ]

  return (
    <div className="p-6 space-y-4 overflow-auto h-full">
      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:border-primary-400 focus:ring-1 focus:ring-primary-200 bg-white shadow-sm"
            placeholder="Buscar nome, empresa ou telefone..."
          />
        </div>

        <select
          value={stageFilter}
          onChange={e => setStageFilter(e.target.value)}
          className="border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary-400 bg-white shadow-sm"
        >
          {stages.map(s => (
            <option key={s.key} value={s.key}>{s.label}</option>
          ))}
        </select>

        <span className="text-sm text-slate-400 ml-auto">{filtered.length} contatos</span>
      </div>

      {/* List */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-3">
              <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
            </div>
            <p className="text-sm text-slate-400">
              {withPhone.length === 0 ? 'Nenhum lead com telefone cadastrado' : 'Nenhum contato encontrado'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {/* Table header */}
            <div className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-2.5 bg-slate-50 border-b border-slate-200">
              <div className="w-9" />
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Lead</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Score</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide hidden md:block">Responsável</span>
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Contato</span>
            </div>

            {filtered.map(lead => {
              const scoreInfo = getScoreInfo(lead.score)
              return (
                <div
                  key={lead.id}
                  className="grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center px-4 py-3 hover:bg-slate-50 transition-colors"
                >
                  {/* Avatar */}
                  <div className="w-9 h-9 rounded-full bg-primary-100 flex items-center justify-center flex-none shadow-sm">
                    <span className="text-xs font-bold text-primary-700">{lead.name[0]}</span>
                  </div>

                  {/* Name + company */}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-800 truncate">{lead.name}</p>
                    <p className="text-xs text-slate-400 truncate">
                      {lead.company ?? lead.phone}
                    </p>
                  </div>

                  {/* Score badge */}
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full border whitespace-nowrap ${scoreInfo.bg} ${scoreInfo.color} ${scoreInfo.border}`}>
                    {scoreInfo.faixa}
                  </span>

                  {/* Seller */}
                  <span className="text-xs text-slate-400 hidden md:block whitespace-nowrap">
                    {lead.assigned_name ?? '—'}
                  </span>

                  {/* Phone + WhatsApp button */}
                  <div className="flex items-center gap-2 flex-none">
                    <span className="text-xs text-slate-500 hidden sm:block">{lead.phone}</span>
                    <a
                      href={formatWhatsApp(lead.phone!)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 bg-[#25D366] text-white text-xs px-3 py-1.5 rounded-lg hover:bg-[#20b858] transition-colors shadow-sm font-medium"
                      onClick={e => e.stopPropagation()}
                    >
                      <svg className="w-3.5 h-3.5 flex-none" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                      WhatsApp
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
