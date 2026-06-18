import { createClient as createSupabaseClient } from '@supabase/supabase-js'

// Client server-only com SERVICE ROLE: IGNORA o RLS. Usar SOMENTE em rotas de servidor
// (ex.: /api/news/refresh) que gravam sem sessão de usuário.
// ⚠️ NUNCA importar isto em componentes client — a chave de service role é secreta.
export function createServiceClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  )
}
