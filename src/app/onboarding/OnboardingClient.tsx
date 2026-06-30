'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Users, Plus, LogIn } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils'

// Porta de entrada multi-tenant: criar equipe (create_team) OU entrar por convite (redeem_invite).
// Design Bento Compacto, estático (sem animação). NÃO seta team_id à mão — o trigger do banco carimba.
export function OnboardingClient() {
  const supabase = createClient()
  const router = useRouter()
  const [teamName, setTeamName] = useState('')
  const [token, setToken] = useState('')
  const [busy, setBusy] = useState<'create' | 'join' | null>(null)
  const [error, setError] = useState('')

  const go = () => { router.refresh(); router.push('/hall') }

  const createTeam = async () => {
    const name = teamName.trim()
    if (!name || busy) return
    setBusy('create'); setError('')
    const { error: e } = await supabase.rpc('create_team', { p_name: name })
    if (e) { setError(e.message); setBusy(null); return }
    go()
  }

  const joinTeam = async () => {
    const t = token.trim()
    if (!t || busy) return
    setBusy('join'); setError('')
    const { error: e } = await supabase.rpc('redeem_invite', { p_token: t })
    if (e) { setError(e.message); setBusy(null); return }
    go()
  }

  const fld = 'w-full bg-bento-bg border border-bento-border rounded-btn px-3 py-2.5 text-sm text-bento-text placeholder:text-bento-muted focus:outline-none focus:border-lime disabled:opacity-60'

  return (
    <main className="min-h-[100dvh] bg-bento-bg flex items-center justify-center p-4 py-[max(1rem,env(safe-area-inset-top))] font-body">
      <div className="w-full max-w-3xl">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-xl bg-lime/15 border border-lime/30 mb-4">
            <Users className="w-6 h-6 text-lime-fg" />
          </div>
          <h1 className="font-display text-2xl font-bold text-bento-text tracking-tight">Configure sua equipe</h1>
          <p className="text-bento-muted text-sm mt-1">Crie uma equipe nova ou entre numa existente com um código de convite.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {/* Criar equipe */}
          <div className="bento-fx p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-lime/15 border border-lime/30 flex items-center justify-center flex-none"><Plus className="w-4 h-4 text-lime-fg" /></span>
              <div className="min-w-0">
                <h2 className="font-display font-bold text-bento-text text-base">Criar equipe</h2>
                <p className="font-tech text-[11px] text-bento-muted">Você vira o owner</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ob-team" className="block text-xs font-medium text-bento-dim">Nome da equipe</label>
              <input id="ob-team" value={teamName} onChange={e => { setTeamName(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') createTeam() }}
                placeholder="ex.: DR Growth" className={fld} disabled={busy !== null} autoFocus />
            </div>
            <button onClick={createTeam} disabled={busy !== null || !teamName.trim()}
              className="bento-btn flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn text-sm font-semibold disabled:opacity-50 min-h-[44px] mt-auto">
              {busy === 'create' ? 'Criando…' : 'Criar e continuar'}
            </button>
          </div>

          {/* Entrar em equipe */}
          <div className="bento-fx p-5 flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              <span className="w-9 h-9 rounded-lg bg-bento-panel border border-bento-border flex items-center justify-center flex-none"><LogIn className="w-4 h-4 text-bento-muted" /></span>
              <div className="min-w-0">
                <h2 className="font-display font-bold text-bento-text text-base">Entrar em equipe</h2>
                <p className="font-tech text-[11px] text-bento-muted">Com um código de convite</p>
              </div>
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ob-token" className="block text-xs font-medium text-bento-dim">Código do convite</label>
              <input id="ob-token" value={token} onChange={e => { setToken(e.target.value); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') joinTeam() }}
                placeholder="cole o código aqui" className={cn(fld, 'font-tech')} disabled={busy !== null} />
            </div>
            <button onClick={joinTeam} disabled={busy !== null || !token.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2.5 rounded-btn text-sm font-semibold border border-bento-border text-bento-text hover:border-lime hover:text-lime-fg transition-colors disabled:opacity-50 min-h-[44px] mt-auto">
              {busy === 'join' ? 'Entrando…' : 'Entrar na equipe'}
            </button>
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/30 rounded-lg p-3 mt-4 font-tech">{error}</p>
        )}
      </div>
    </main>
  )
}
