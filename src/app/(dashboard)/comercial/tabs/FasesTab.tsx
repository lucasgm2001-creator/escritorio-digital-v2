'use client'

import { useState, useEffect, useCallback } from 'react'
import { ChevronUp, ChevronDown } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { FunnelStage } from '@/lib/funnelStages'

// nome → slug estável (sem acento/espaço). O slug NUNCA muda no renomear → nenhum lead muda de fase.
function slugify(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '')
}

// Gestão das fases do funil (funnel_stages). Criar/renomear/reordenar. NÃO mexe em dinheiro:
// is_won/is_lost/conta_* não são editáveis aqui (fases novas nascem neutras). Excluir/mesclar = TODO.
export function FasesTab() {
  const supabase = createClient()
  const [stages, setStages] = useState<FunnelStage[]>([])
  const [loading, setLoading] = useState(true)
  const [novo, setNovo] = useState('')
  const [busy, setBusy] = useState(false)
  const [editSlug, setEditSlug] = useState<string | null>(null)
  const [editNome, setEditNome] = useState('')

  const load = useCallback(async () => {
    const { data } = await supabase.from('funnel_stages').select('*').order('posicao')
    setStages((data ?? []) as FunnelStage[])
    setLoading(false)
  }, [supabase])
  useEffect(() => { load() }, [load])

  const criar = async () => {
    const nome = novo.trim()
    if (!nome || busy) return
    let slug = slugify(nome)
    if (!slug) { alert('Nome inválido.'); return }
    if (stages.some(s => s.slug === slug)) slug = `${slug}_${Date.now().toString().slice(-4)}`
    setBusy(true)
    const posicao = Math.max(0, ...stages.map(s => s.posicao)) + 1
    // Fase nova nasce NEUTRA: is_won/is_lost/is_system = false (não dispara won-flow). conta_interagiu
    // = true (estar numa fase real conta como interação no relatório); reuniao/fechou = false.
    const { error } = await supabase.from('funnel_stages').insert({
      slug, nome, posicao, is_won: false, is_lost: false, is_system: false,
      conta_interagiu: true, conta_reuniao: false, conta_fechou: false, arquivada: false,
    })
    setBusy(false)
    if (error) { alert(`Não foi possível criar a fase: ${error.message}`); return }
    setNovo('')
    load()
  }

  const renomear = async (s: FunnelStage) => {
    const nome = editNome.trim()
    if (!nome) { setEditSlug(null); return }
    setBusy(true)
    await supabase.from('funnel_stages').update({ nome }).eq('slug', s.slug)  // só o rótulo; slug preservado
    setBusy(false)
    setEditSlug(null)
    load()
  }

  const mover = async (i: number, dir: -1 | 1) => {
    const j = i + dir
    if (j < 0 || j >= stages.length || busy) return
    const a = stages[i], b = stages[j]
    setBusy(true)
    await supabase.from('funnel_stages').update({ posicao: b.posicao }).eq('slug', a.slug)
    await supabase.from('funnel_stages').update({ posicao: a.posicao }).eq('slug', b.slug)
    setBusy(false)
    load()
  }

  return (
    <div className="p-4 sm:p-6 max-w-2xl mx-auto space-y-4 overflow-auto h-full bg-bento-bg font-body">
      <div>
        <h2 className="font-display font-bold text-bento-text text-base">Fases do funil</h2>
        <p className="text-bento-muted text-xs mt-0.5">Criar, renomear e reordenar os estágios. Renomear muda só o rótulo — o identificador interno é preservado, então nenhum lead muda de fase.</p>
      </div>

      <div className="flex gap-2">
        <input value={novo} onChange={e => setNovo(e.target.value)} onKeyDown={e => e.key === 'Enter' && criar()}
          placeholder="Nova fase (ex.: Negócio Futuro)"
          className="flex-1 bg-bento-bg border border-bento-border rounded-btn px-3 py-2 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime min-h-[44px]" />
        <button onClick={criar} disabled={busy || !novo.trim()}
          className="bento-btn px-4 py-2 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px]">Criar</button>
      </div>

      <div className="space-y-1.5">
        {loading ? (
          <p className="text-sm text-bento-muted">Carregando...</p>
        ) : stages.map((s, i) => (
          <div key={s.slug} className="flex items-center gap-2 bento-fx p-3">
            <span className="font-tech text-xs text-bento-muted tabular-nums w-5 text-right">{i + 1}</span>
            {editSlug === s.slug ? (
              <input value={editNome} onChange={e => setEditNome(e.target.value)} onKeyDown={e => e.key === 'Enter' && renomear(s)} autoFocus
                className="flex-1 bg-bento-bg border border-bento-border rounded-btn px-2 py-1 text-sm text-bento-text focus:outline-none focus:border-lime" />
            ) : (
              <span className="flex-1 text-sm text-bento-text truncate">{s.nome}</span>
            )}
            {s.is_won && <span className="text-[10px] px-2 py-0.5 rounded-full border border-green-800/50 text-green-400 font-semibold shrink-0">venda</span>}
            {s.is_lost && <span className="text-[10px] px-2 py-0.5 rounded-full border border-red-800/50 text-red-400 font-semibold shrink-0">perda</span>}
            {s.is_system && !s.is_won && !s.is_lost && <span className="text-[10px] px-2 py-0.5 rounded-full border border-bento-border text-bento-muted font-semibold shrink-0">sistema</span>}
            <div className="flex items-center gap-0.5 shrink-0">
              <button onClick={() => mover(i, -1)} disabled={i === 0 || busy} className="p-1.5 rounded-md text-bento-muted hover:text-bento-text hover:bg-bento-bg disabled:opacity-30" aria-label="Subir"><ChevronUp className="w-4 h-4" /></button>
              <button onClick={() => mover(i, 1)} disabled={i === stages.length - 1 || busy} className="p-1.5 rounded-md text-bento-muted hover:text-bento-text hover:bg-bento-bg disabled:opacity-30" aria-label="Descer"><ChevronDown className="w-4 h-4" /></button>
              {editSlug === s.slug
                ? <button onClick={() => renomear(s)} disabled={busy} className="text-xs text-lime-fg font-semibold px-2 disabled:opacity-50">Salvar</button>
                : <button onClick={() => { setEditSlug(s.slug); setEditNome(s.nome) }} className="text-xs text-bento-muted hover:text-bento-text px-2">Renomear</button>}
            </div>
          </div>
        ))}
      </div>

      <p className="font-tech text-[11px] text-bento-muted/70">
        Excluir / mesclar fases: em breve (TODO). Fases de venda/perda são de sistema (não afetam dinheiro por aqui).
        Mudanças aparecem no funil ao recarregar.
      </p>
    </div>
  )
}
