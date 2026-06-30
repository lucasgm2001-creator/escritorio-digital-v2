'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signIn, signUp } from '@/lib/supabase/auth-actions'

function EyeIcon({ show }: { show: boolean }) {
  return show ? (
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
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
  const [mode, setMode] = useState<'signin' | 'signup'>('signin')
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)

  const isSignup = mode === 'signup'
  const toggleMode = () => { setMode(m => (m === 'signin' ? 'signup' : 'signin')); setError(''); setInfo('') }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email || !password || (isSignup && !name)) return
    setLoading(true); setError(''); setInfo('')
    try {
      if (isSignup) {
        const result = await signUp(name, email, password)
        if (result?.error) { setError(result.error); setLoading(false) }
        else if (result?.needsConfirm) { setInfo('Conta criada! Confira seu e-mail para confirmar antes de entrar.'); setLoading(false) }
        // sucesso com sessão → o servidor redireciona pra /hall
      } else {
        const result = await signIn(email, password)
        if (result?.error) { setError(result.error); setLoading(false) }
      }
    } catch {
      setError('Erro inesperado. Tente novamente.')
      setLoading(false)
    }
  }

  return (
    <main className="h-[100dvh] overflow-y-auto bg-gradient-to-br from-[#080D0A] via-[#0D140F] to-[#111A14] flex items-center justify-center p-4 py-[max(1rem,env(safe-area-inset-top))]">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-white/10 backdrop-blur mb-6">
            <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-white mb-1">DR Growth</h1>
          <p className="text-lime-fg">Escritório Digital</p>
        </div>

        {/* Form */}
        <div className="bg-white/10 backdrop-blur border border-white/20 rounded-2xl p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Nome (só no cadastro) */}
            {isSignup && (
              <div>
                <label htmlFor="name" className="block text-sm font-medium text-white/90 mb-2">Nome</label>
                <input id="name" type="text" value={name}
                  onChange={e => { setName(e.target.value); setError('') }}
                  placeholder="Seu nome"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-lime/60 transition-colors"
                  disabled={loading} required />
              </div>
            )}
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-white/90 mb-2">
                E-mail
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={e => { setEmail(e.target.value); setError('') }}
                placeholder="seu@email.com"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-lime/60 transition-colors"
                disabled={loading}
                required
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-white/90 mb-2">
                Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => { setPassword(e.target.value); setError('') }}
                  placeholder="••••••••"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-lime/60 pr-12 transition-colors"
                  disabled={loading}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors"
                >
                  <EyeIcon show={showPassword} />
                </button>
              </div>
            </div>

            {/* Esqueci minha senha (só no login) */}
            {!isSignup && (
              <div className="text-right">
                <Link href="/forgot-password" className="text-sm text-lime-fg hover:text-lime transition-colors">
                  Esqueci minha senha
                </Link>
              </div>
            )}

            {/* Error / Info */}
            {error && (
              <p className="text-red-400 text-sm text-center bg-red-400/10 border border-red-400/30 rounded-lg p-3">
                {error}
              </p>
            )}
            {info && (
              <p className="text-lime-fg text-sm text-center bg-lime/10 border border-lime/30 rounded-lg p-3">
                {info}
              </p>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !email || !password || (isSignup && !name)}
              className="w-full bg-lime text-lime-ink font-semibold rounded-xl py-3 hover:bg-lime-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {loading ? (
                <span className="w-5 h-5 border-2 border-lime-ink/30 border-t-lime-ink rounded-full animate-spin" />
              ) : isSignup ? 'Criar conta' : 'Entrar'}
            </button>
          </form>

          {/* Alternar login / cadastro (sem reload) */}
          <p className="text-center text-white/60 text-sm mt-6">
            {isSignup ? 'Já tem conta?' : 'Não tem conta?'}{' '}
            <button type="button" onClick={toggleMode} className="text-lime-fg hover:text-lime font-semibold transition-colors">
              {isSignup ? 'Entrar' : 'Criar conta'}
            </button>
          </p>
        </div>

        {/* Footer */}
        <p className="text-center text-white/40 text-xs mt-8">
          © 2025 DR Growth • Sistema Interno
        </p>
      </div>
    </main>
  )
}
