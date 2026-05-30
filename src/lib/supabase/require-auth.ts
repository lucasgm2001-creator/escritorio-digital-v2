import { NextResponse } from 'next/server'
import { createClient } from './server'

export type AuthRole = 'admin' | 'comercial' | 'trafego' | 'financeiro'

export async function requireAuth(requiredRole?: AuthRole) {
  const supabase = createClient()

  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: NextResponse.json(
        { error: 'Não autorizado' },
        { status: 401 }
      ),
    }
  }

  // Se requer role específica, buscar e validar
  if (requiredRole) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single()

    if (profile?.role !== requiredRole) {
      return {
        error: NextResponse.json(
          { error: 'Acesso negado' },
          { status: 403 }
        ),
      }
    }
  }

  return { user }
}
