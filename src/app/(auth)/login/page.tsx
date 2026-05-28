'use client'

import { useState, useRef, useEffect } from 'react'
import { signIn } from '@/lib/supabase/auth-actions'

interface Profile {
  id: string
  name: string
  role: 'admin' | 'comercial' | 'trafego' | 'financeiro'
  email: string
  initial: string
  gradient: string
}

const PROFILES: Profile[] = [
  { id: 'daniel',   name: 'Daniel',   role: 'admin',      email: 'daniel@drgrowth.com',   initial: 'D', gradient: 'from-slate-700 to-slate-500' },
  { id: 'lucas',    name: 'Lucas',    role: 'comercial',  email: 'lucas@drgrowth.com',    initial: 'L', gradient: 'from-blue-700 to-blue-500' },
  { id: 'gabriel',  name: 'Gabriel',  role: 'trafego',    email: 'gabriel@drgrowth.com',  initial: 'G', gradient: 'from-indigo-700 to-indigo-500' },
  { id: 'thamyris', name: 'Thamyris', role: 'financeiro', email: 'thamyris@drgrowth.com', initial: 'T', gradient: 'from-violet-700 to-violet-500' },
]

const ROLE_LABELS: Record<Profile['role'], string> = {
  admin: 'Administrador',
  comercial: 'Comercial',
  trafego: 'Tráfego',
  financeiro: 'Financeiro',
}

// Ícone de cadeado SVG
function LockIcon() {
  return (
    <svg className="w-5 h-5 text-primary-300" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
    </svg>
  )
}

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
    </svg>
  ) : (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  )
}

export default function LoginPage() {
  const [selected, setSelected] = useState<Profile | null>(null)
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (selected) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [selected])

  const handleCardClick = (profile: Profile) => {
    setSelected(profile)
    setPassword('')
    setError('')
  }

  const handleClose = () => {
    setSelected(null)
    setPassword('')
    setError('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selected || !password) return
    setLoading(true)
    setError('')
    try {
      const result = await signIn(selected.email, password)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
      // Se não retornou erro, o redirect('/hall') foi chamado — navegação automática
    } catch {
      // redirect() lança internamente — é esperado e não é um erro real
      // Qualquer outro erro:
      setError('Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-primary-950 via-primary-900 to-primary-800 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">

        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-white/10 backdrop-blur mb-6">
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-4xl font-bold text-white mb-2">Escritório Digital</h1>
          <p className="text-primary-200 text-lg">DR Growth — Selecione seu perfil</p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {PROFILES.map((profile) => (
            <button
              key={profile.id}
              onClick={() => handleCardClick(profile)}
              className={`
                group relative overflow-hidden rounded-2xl p-6 text-left transition-all duration-200
                border-2 cursor-pointer
                ${selected?.id === profile.id
                  ? 'border-white/60 bg-white/20 scale-[1.02]'
                  : 'border-transparent bg-white/10 hover:bg-white/15 hover:border-white/20 hover:scale-[1.02]'}
              `}
            >
              <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${profile.gradient} flex items-center justify-center mb-4 shadow-lg`}>
                <span className="text-2xl font-bold text-white">{profile.initial}</span>
              </div>
              <h3 className="text-xl font-bold text-white mb-1">{profile.name}</h3>
              <p className="text-primary-200 text-sm">{ROLE_LABELS[profile.role]}</p>
              <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                <LockIcon />
              </div>
            </button>
          ))}
        </div>

        <p className="text-center text-primary-400 text-sm mt-10">
          © 2025 DR Growth • Sistema Interno
        </p>
      </div>

      {/* Modal de senha */}
      {selected && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
          onClick={(e) => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div className="bg-primary-900 border border-white/10 rounded-2xl p-8 w-full max-w-sm shadow-2xl">
            {/* Avatar */}
            <div className="flex flex-col items-center mb-6">
              <div className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${selected.gradient} flex items-center justify-center shadow-lg mb-3`}>
                <span className="text-3xl font-bold text-white">{selected.initial}</span>
              </div>
              <h2 className="text-xl font-bold text-white">{selected.name}</h2>
              <p className="text-primary-300 text-sm">{ROLE_LABELS[selected.role]}</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="Digite sua senha"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-primary-400 focus:outline-none focus:border-white/50 pr-12 transition-colors"
                  disabled={loading}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-primary-300 hover:text-white transition-colors"
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>

              {error && (
                <p className="text-red-400 text-sm text-center">{error}</p>
              )}

              <button
                type="submit"
                disabled={loading || !password}
                className="w-full bg-white text-primary-900 font-semibold rounded-xl py-3 hover:bg-primary-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <span className="w-5 h-5 border-2 border-primary-900/30 border-t-primary-900 rounded-full animate-spin" />
                ) : 'Entrar'}
              </button>

              <button
                type="button"
                onClick={handleClose}
                className="w-full text-primary-400 text-sm hover:text-primary-200 transition-colors py-2"
              >
                Cancelar
              </button>
            </form>
          </div>
        </div>
      )}
    </main>
  )
}
