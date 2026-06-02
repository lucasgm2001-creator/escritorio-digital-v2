import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const PUBLIC_ROUTES = ['/login']

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const path = request.nextUrl.pathname

  // Rotas de API cuidam da própria autenticação (requireAuth → 401 JSON, ou
  // CRON_SECRET no scheduler). Não redirecionamos /api para /login: um cron
  // não tem sessão e precisa alcançar o handler para validar o secret — e uma
  // chamada de API deve receber 401 JSON, não um redirect HTML.
  if (path.startsWith('/api')) {
    return response
  }

  // Redirect que PRESERVA os cookies que o getUser() possa ter atualizado
  // (rotação de token). Sem isso, o redirect descarta a sessão renovada e o
  // usuário aparece deslogado na próxima request — re-login intermitente.
  const redirectTo = (to: string) => {
    const res = NextResponse.redirect(new URL(to, request.url))
    response.cookies.getAll().forEach((cookie) => res.cookies.set(cookie))
    return res
  }

  const isPublic = PUBLIC_ROUTES.some(r => path.startsWith(r))

  if (!user && !isPublic) {
    return redirectTo('/login')
  }

  if (user && path === '/login') {
    return redirectTo('/hall')
  }

  return response
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
