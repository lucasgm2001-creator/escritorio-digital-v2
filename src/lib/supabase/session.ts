import { cache } from 'react'
import { createClient } from './server'

// Dedup por REQUEST (React cache): layout e página compartilham UMA chamada de auth e
// UMA leitura de profile por navegação, em vez de cada um repetir as suas. Some o
// getUser/profile duplicado que rodava no layout E na página.

export const getSessionUser = cache(async () => {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return user
})

export const getProfile = cache(async (userId: string) => {
  if (!userId) return null
  const supabase = createClient()
  // name + avatar_url numa query só (antes eram duas leituras separadas do profile).
  const { data } = await supabase.from('profiles').select('id, name, avatar_url').eq('id', userId).single()
  return data
})
