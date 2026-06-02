# PATCHES

Registro de correções, mudanças e novidades. Mais recentes no topo.

Categorias: 🐛 Fix · 🔄 Mudança · ✨ Novidade

---

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
