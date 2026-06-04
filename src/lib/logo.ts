import type { SupabaseClient } from '@supabase/supabase-js'

// A logo do sistema é GLOBAL (uma só para todos) e mora num caminho fixo do
// bucket público `assets`. Como o path é determinístico e o bucket é público,
// a URL é a mesma para qualquer usuário — não precisamos ler de nenhuma tabela
// para exibi-la. O arquivo no bucket É a fonte da verdade.
export const SYSTEM_LOGO_BUCKET = 'assets'
export const SYSTEM_LOGO_DIR = 'site-logo'
export const SYSTEM_LOGO_FILE = 'logo.jpg'
export const SYSTEM_LOGO_PATH = `${SYSTEM_LOGO_DIR}/${SYSTEM_LOGO_FILE}`

// Resolve a URL pública da logo, OU null se ainda não houver logo enviada.
// Faz um list() do diretório para (1) confirmar que o arquivo existe — evitando
// renderizar uma <img> quebrada (404) — e (2) anexar `updated_at` como versão
// (?v=), quebrando o cache do navegador sempre que uma logo nova for enviada.
// Sem isso, a URL é fixa e o navegador serve a logo antiga do cache (até 1h),
// dando a falsa impressão de que o upload "não salvou".
export async function getSystemLogoUrl(client: SupabaseClient): Promise<string | null> {
  const { data, error } = await client.storage
    .from(SYSTEM_LOGO_BUCKET)
    .list(SYSTEM_LOGO_DIR, { search: SYSTEM_LOGO_FILE })

  if (error) {
    console.error('[logo] falha ao listar logo do sistema:', error.message)
    return null
  }

  const file = data?.find((f) => f.name === SYSTEM_LOGO_FILE)
  if (!file) return null

  const { data: pub } = client.storage.from(SYSTEM_LOGO_BUCKET).getPublicUrl(SYSTEM_LOGO_PATH)
  const version = file.updated_at ?? file.created_at ?? file.id ?? ''
  return version ? `${pub.publicUrl}?v=${encodeURIComponent(version)}` : pub.publicUrl
}
