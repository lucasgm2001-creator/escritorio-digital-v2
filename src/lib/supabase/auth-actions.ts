'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from './server'

export async function signIn(email: string, password: string) {
  const supabase = createClient()

  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.includes('Email not confirmed')) {
      return { error: 'E-mail não confirmado. Confirme no Supabase Dashboard ou desative a confirmação nas configurações.' }
    }
    if (error.message.includes('Invalid login credentials')) {
      return { error: 'Senha incorreta. Tente novamente.' }
    }
    return { error: error.message }
  }

  revalidatePath('/', 'layout')
  redirect('/hall')
}

// Cadastro ABERTO (multi-tenant): qualquer e-mail+senha cria conta. O acesso aos dados é controlado pela
// EQUIPE — a guarda no layout do dashboard manda quem não tem equipe pro /onboarding (criar/entrar em equipe).
export async function signUp(name: string, email: string, password: string) {
  const nm = (name ?? '').trim()
  const em = (email ?? '').trim().toLowerCase()
  if (!nm || !em || !password) return { error: 'Preencha nome, e-mail e senha.' }

  const supabase = createClient()
  const { data, error } = await supabase.auth.signUp({ email: em, password, options: { data: { name: nm } } })
  if (error) {
    const m = error.message.toLowerCase()
    if (m.includes('already') || m.includes('registered')) return { error: 'Este e-mail já tem conta. Faça login.' }
    if (m.includes('password')) return { error: 'Senha fraca — use ao menos 6 caracteres.' }
    return { error: 'Não foi possível criar a conta. Tente novamente.' }
  }

  // Sessão imediata (confirmação de e-mail desligada): garante a linha em profiles (upsert por id —
  // não duplica se já houver trigger) e entra logado.
  if (data.user && data.session) {
    await supabase.from('profiles').upsert({ id: data.user.id, name: nm }, { onConflict: 'id' })
    revalidatePath('/', 'layout')
    redirect('/hall')
  }
  // Confirmação de e-mail ligada → ainda sem sessão.
  return { needsConfirm: true }
}

export async function signOut() {
  const supabase = createClient()

  // Faz logout no Supabase (limpa a sessão e cookies)
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('Erro ao fazer logout:', error)
  }

  // Limpa cache de todo o app
  revalidatePath('/', 'layout')

  // Redireciona obrigatoriamente para /login
  redirect('/login')
}

export async function getProfile() {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user.id)
    .single()

  return profile
}
