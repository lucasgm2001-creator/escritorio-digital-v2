'use client'

import { useEffect, useState } from 'react'
import { Trophy, Check } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'
import { usd } from '@/lib/format'
import { weeklyCommissionUsd, hasCommissionPct, LEGACY_VPS_USD, DEFAULT_TETO_SEMANAS } from '@/lib/commission/planCommission'

interface PlanRow { id: string; nome: string; valor_semanal: number; comissao_percentual: number | null }

// Modal de fechamento (Fase 2A): escolhe o plano da venda → a comissão segue o % do plano.
// onConfirm(planoId | null): null = sem plano ativo (legado US$25/sem). onCancel: NÃO fecha a venda.
export function WonPlanModal({ leadName, onConfirm, onCancel }: {
  leadName: string
  onConfirm: (planoId: string | null) => void
  onCancel: () => void
}) {
  const supabase = createClient()
  const [plans, setPlans] = useState<PlanRow[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let alive = true
    ;(async () => {
      // Planos ativos + plano ATUAL do cliente (se já existe, por nome) p/ pré-selecionar.
      const [{ data: pl }, { data: cli }] = await Promise.all([
        supabase.from('plans').select('id, nome, valor_semanal, comissao_percentual').eq('ativo', true).order('ordem'),
        supabase.from('clients').select('plano_id').ilike('name', leadName).limit(1),
      ])
      if (!alive) return
      const list = (pl ?? []) as PlanRow[]
      setPlans(list)
      const atual = (cli?.[0]?.plano_id as string | null) ?? null
      setSelected(atual ?? list[0]?.id ?? null)
      setLoading(false)
    })()
    return () => { alive = false }
  }, [supabase, leadName])

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onCancel() }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onCancel])

  const confirm = () => { if (busy) return; setBusy(true); onConfirm(selected) }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center z-[60] p-0 sm:p-4"
      onClick={onCancel}>
      <div className="bento-fx rounded-t-frame sm:rounded-frame shadow-card-hover w-full sm:max-w-lg max-h-[92vh] flex flex-col animate-slide-up"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center gap-2 p-5 border-b border-bento-border">
          <Trophy className="w-5 h-5 text-lime-fg shrink-0" />
          <div className="min-w-0">
            <h2 className="font-display font-bold text-bento-text text-base truncate">Fechar venda — {leadName}</h2>
            <p className="text-xs text-bento-muted mt-0.5">Escolha o plano. A comissão da venda segue o % do plano.</p>
          </div>
        </div>

        <div className="p-5 overflow-auto space-y-2">
          {loading ? (
            <p className="text-sm text-bento-muted">Carregando planos...</p>
          ) : plans.length === 0 ? (
            <p className="text-sm text-bento-muted">Nenhum plano ativo — a venda será lançada no legado ({usd(LEGACY_VPS_USD)}/semana).</p>
          ) : plans.map(p => {
            const pct = p.comissao_percentual != null ? Number(p.comissao_percentual) : null
            const temPct = hasCommissionPct(pct)
            const vps = weeklyCommissionUsd(p.valor_semanal, temPct ? pct : null)
            const on = selected === p.id
            return (
              <button key={p.id} type="button" onClick={() => setSelected(p.id)}
                className={cn('w-full text-left rounded-bento border p-3 transition-colors',
                  on ? 'border-lime bg-lime/10' : 'border-bento-border hover:border-lime/60')}>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-sm font-semibold text-bento-text">{p.nome}</span>
                  <span className={cn('w-4 h-4 rounded-full border flex items-center justify-center flex-none',
                    on ? 'border-lime bg-lime' : 'border-bento-border')}>
                    {on && <Check className="w-3 h-3 text-lime-ink" />}
                  </span>
                </div>
                <p className="font-tech text-[11px] text-bento-dim mt-1">
                  {usd(p.valor_semanal)}/sem · {temPct
                    ? <>comissão {pct}% = <span className="text-bento-text font-semibold">{usd(vps)}/sem</span> (× {DEFAULT_TETO_SEMANAS} = {usd(vps * DEFAULT_TETO_SEMANAS)})</>
                    : <>sem % → legado <span className="text-bento-text font-semibold">{usd(LEGACY_VPS_USD)}/sem</span></>}
                </p>
              </button>
            )
          })}
        </div>

        <div className="flex items-center justify-end gap-2 p-5 border-t border-bento-border">
          <button type="button" onClick={onCancel} disabled={busy}
            className="px-4 py-2 rounded-btn text-sm font-medium text-bento-dim border border-bento-border hover:border-lime transition-colors disabled:opacity-50 min-h-[44px]">
            Cancelar
          </button>
          <button type="button" onClick={confirm} disabled={busy || loading}
            className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">
            {busy ? 'Fechando...' : 'Fechar venda'}
          </button>
        </div>
      </div>
    </div>
  )
}
