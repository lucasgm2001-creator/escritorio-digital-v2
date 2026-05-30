import { NextResponse } from 'next/server'
import { requireAuth } from '@/lib/supabase/require-auth'
import { createClient } from '@/lib/supabase/server'

export async function POST(req: Request) {
  const authResult = await requireAuth()
  if ('error' in authResult) {
    return authResult.error
  }

  try {
    const { password } = await req.json()

    if (!password || typeof password !== 'string' || password.length === 0) {
      return NextResponse.json(
        { error: 'Senha inválida.' },
        { status: 400 }
      )
    }

    const supabase = createClient()
    const { data, error } = await supabase.auth.signInWithPassword({
      email: authResult.user.email || '',
      password,
    })

    if (error || !data.user) {
      return NextResponse.json(
        { valid: false },
        { status: 200 }
      )
    }

    return NextResponse.json({ valid: true })
  } catch (error) {
    console.error('[verify-password] Error:', error)
    return NextResponse.json(
      { error: 'Erro ao verificar senha.' },
      { status: 500 }
    )
  }
}
