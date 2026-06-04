# PATCHES

Registro de correções, mudanças e novidades. Mais recentes no topo.

Categorias: 🐛 Fix · 🔄 Mudança · ✨ Novidade

---

✨ Novidade — exibição da logo customizada do sistema. O upload em
/configuracoes gravava o arquivo no bucket público `assets`
(`site-logo/logo.jpg`) com sucesso, mas a logo nunca aparecia: o cabeçalho da
Sidebar renderizava um ícone SVG fixo + texto "DR Growth" e NUNCA lia a logo
enviada (não havia `<img>` nem requisição ao storage fora da própria tela de
config). Implementada a exibição: a logo é GLOBAL e mora num caminho fixo do
bucket público, então a URL é determinística (`getPublicUrl`) — `layout.tsx`
(server) a computa via novo helper `src/lib/logo.ts` e a passa por
`DashboardShell` → `Sidebar`, que renderiza `<img src={logoUrl}>` no lugar do
ícone. Fallback: `onError` (404 = sem logo customizada) volta ao ícone/texto
padrão. Upload passou a usar `cacheControl: '60'` (URL é fixa) para re-uploads
aparecerem após refresh. Persistência = o arquivo no bucket é a fonte da verdade
(não depende de tabela).

🐛 Fix (HOTFIX) — loop de redirecionamento em produção (ERR_TOO_MANY_REDIRECTS):
/login → /hall → /login infinitamente, ninguém logava. CAUSA RAIZ: recursão
infinita de RLS (Postgres 42P17) na policy "Admin lê todos" de profiles, que
fazia subquery em profiles dentro de uma policy de profiles — toda leitura
autenticada de profiles falhava. Com o hard-fail do layout (Bloco 3), a falha
virava redirect('/login'), e o middleware devolvia o usuário logado de /login
para /hall → loop. (Também era a causa real do "só Hall" original.) Corrigido em
2 frentes: (A) código — `layout.tsx` não redireciona mais em erro de leitura do
profile (renderiza e a Sidebar mostra "Sessão inválida"); `src/middleware.ts`
preserva os cookies de sessão nos redirects (rotação de token). (B) banco —
migration 013 troca a policy recursiva por uma função SECURITY DEFINER
`is_admin()` (sem recursão). A frente B é o que restaura 100% — rodar no Supabase.

🐛 Fix — sidebar mostrava só o Hall para todos (inclusive admin). Causa:
`avatar_url` no select do `layout.tsx` (coluna ainda inexistente, migration
pendente) derrubava a query inteira no PostgREST + erro engolido (não
desestruturado) + fallback do role para `''`, que no filtro de NAV_ITEMS só
deixava passar o Hall. Corrigido em camadas: (1) `layout.tsx` busca só
`name, role` com erro desestruturado e `redirect('/login')` em falha — nunca
renderiza com role vazio; `avatar_url` vai numa query separada e opcional
(try/catch → null). (2) `Sidebar.tsx` trata role inválido/ausente como erro de
sessão explícito (estado "Sessão inválida" + re-login), em vez de degradar para
o menu só-Hall. (3) Migration das colunas e consolidação do role: aplicar no
Supabase (Camada 3, manual). Helper `scripts/check-profiles.ts` para verificar
os roles via service-role.

🐛 Fix — scheduler do SuperAgent expunha IA cara a qualquer usuário logado.
Causa: rota protegida só por `requireAuth()`, sem secret de cron. Corrigido
exigindo `CRON_SECRET` como porta principal (comparação em tempo constante via
`crypto.timingSafeEqual` sobre hash sha256; 401 imediato se o secret não estiver
configurado, o header faltar ou não bater). Como um cron não tem sessão, o
`requireAuth` foi removido desta rota. Também foi necessário abrir `/api` no
middleware (`src/middleware.ts`): ele redirecionava toda `/api/*` para `/login`
(307) antes do handler, tornando o gate do secret inalcançável — agora cada
rota de API cuida da própria auth e responde 401 JSON. `CRON_SECRET` documentado
no `.env.example` e no README.

🐛 Fix — verify-password virou oráculo de brute-force. Causa: rota sem rate
limit e usando `signInWithPassword` no client SSR (criava sessão paralela e
podia embaralhar os cookies da sessão ativa). Corrigido com rate limit
agressivo e isolado (5 tentativas / 15 min por usuário, bucket próprio, 429 +
Retry-After) e validação da senha via client Supabase efêmero (`persistSession:
false`), que nunca toca nos cookies da requisição. Resposta mantida genérica
(`{valid:false}`) para não vazar informação.
