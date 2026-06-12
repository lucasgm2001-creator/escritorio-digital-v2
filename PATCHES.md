# PATCHES

Registro de correções, mudanças e novidades. Mais recentes no topo.

Categorias: 🐛 Fix · 🔄 Mudança · ✨ Novidade

---

✨ Novidade — DESIGN_SYSTEM_VERDELIMA_EDV2.md: especificação canônica do design
system. Incorpora a revisão crítica: separa identidade ESTRUTURAL (verde contido:
botão/item ativo/foco) de EVENTO (verde brilhante: venda/meta/toast); cores de
STATUS (verde/âmbar/vermelho) não governam CATEGORIA (o funil usa wayfinding
frio); estados neutros (lead frio ≠ erro); vocabulário de pipeline (não "saúde do
sistema"). 19 seções: filosofia, semântica, tokens dark/light, tipografia,
superfícies, botões, inputs, tabelas, badges, gráficos, sidebar, pipeline,
toasts, estados, exemplos e regras do que evitar.

---

✨ Novidade — funil (Kanban) do Comercial no estilo Pipedrive: cor vira
informação, não decoração. As etapas do meio (Novo/Interagiu/Reunião/Proposta/
Não Interagiu) ficam NEUTRAS (dot cinza, nome bento-dim); só Fechado (verde lima
suave) e Perdido (vermelho suave) têm cor. Campo `tone` no ColumnConfig governa
isso só no Kanban — PipelineTab/AgendaTab seguem coloridos.
- Deal rotting (recurso-chave do Pipedrive): dias parado via last_contact_at
  (fallback created_at) → 3–4d borda+tag âmbar, 5+d vermelho ("esfriando").
- Lead quente: score≥650 OU prioridade alta/urgente → borda+tag limão "QUENTE".
  Um sinal por card, prioridade quente > esfriando > atenção.
- Card enxuto: nome · sub (nicho/empresa) · rodapé (valor + sinal OU próxima ação
  vinda de next_contact). Header da coluna com contagem + soma (mono).
- Lógica de sinais isolada em leadSignals.ts.
Divergência consciente da referência: "Ganho" usa verde lima (não o emerald do
mock) para bater com o design system VerdeLima.

---

✨ Novidade — design system VerdeLima: remapeia toda a paleta de tokens (dark +
light) para a identidade verde-lima e elimina o índigo/roxo residual.
- Dark verde-preto premium (#080D0A canvas, #111A14 card, #17231B elevado,
  #263328 borda, texto #F3F7EF/#A8B3A2/#6F7A6A). Light controlado, sem neon sobre
  branco: fill fechado #4F8500 com texto branco (AA), fundos suaves #E8F8D2.
- Sistema de acento por papéis: lime + hover/dim(active)/soft/soft-fg/border,
  todos theme-aware (--accent-*). Botão primário, item ativo, foco e ring → verde.
- De-roxo final: ::selection, hover de cards, .text-gradient, .btn-primary,
  gradientes e keyframe de glow no tailwind.config → verde. Login des-aroxado
  (fundo verde-preto + textos branco/verde). ui/button: hover lime + secundário
  com borda verde. HallClient: status "client" indigo→lime. MetricasTab: legenda
  "Venda Feita" emerald→lime.
- Camada de compat DARK (espelho da clara) remapeia hexes azul-acinzentados
  legados (#0d1117/#1e2533/#2d3748…) para os tokens verdes sem editar 11 arquivos.
  Migração desses hexes p/ tokens diretos fica como dívida pós-lançamento.

---

🔄 Mudança — remove o campo "Perfil de acesso" (role) da tela de Perfil.
Resquício do sistema de papéis removido no pivot para app de usuário único:
mostrava ROLE_LABELS[role] e não fazia mais sentido. Remove o campo, o tipo
ROLE_LABELS e a prop initialRole do PerfilClient, e o `role` do select em
perfil/page.tsx. (A coluna profiles.role segue existindo no banco — só não é
mais exibida.)

---

✨ Novidade — de-roxo + audit de tema do app inteiro. Varredura por classes que
ignoravam o tema/identidade e troca pelos tokens Bento (acento verde-limão).
- ClientesClient: ClientRow extraído para escopo de módulo (corrige o MESMO bug
  de foco do BUG 1 — o campo de "jobs" perdia o foco a cada tecla); de-roxo +
  tokens bento.
- AgentChat (Hall): balões, dots de loading, input e botão Enviar saem do roxo
  para limão/bento.
- PerfilClient: avatar, inputs e botão → limão/bento.
- Shell: Sidebar (item ativo, logo), Topbar (avatar) → limão.
- login: HÍBRIDO — mantém o fundo gradiente roxo (branding/primeira impressão),
  mas botão "Entrar" e link "Esqueci minha senha" viram limão.
- error.tsx: tinha light hardcode (bg-red-50/slate) → tokens bento.
- Código morto deixado on-brand: ThemeSelector, Clock, ui/button, ui/badge.
Cores SEMÂNTICAS (status, etapas do funil, score) preservadas. O único primary-*
remanescente é o branding do login (fundo/labels), intencional.

---

✨ Novidade — acabamento Bento no Comercial + correção de 3 bugs críticos nos
modais. Propaga o design Bento Compacto (do Hall) para o Comercial: abas
(DraggableTabs) e botão "Novo Lead" saem do roxo (`primary-*`) para o acento
verde-limão (`.bento-btn`); filtro Brasil/EUA/Todos e cards de lead ganham
acento limão + profundidade (`.bento-fx`); abas Pipeline/Métricas/Agenda usam
painéis com profundidade; Comissões/Vendedores/Fixo e os modais ficam sem roxo.
As cores SEMÂNTICAS de estágio do funil (azul/indigo/roxo/âmbar/esmeralda/rosa)
são mantidas de propósito.

BUGS corrigidos nos modais (Novo Lead, Comissão, Diário):
- FOCO: o input perdia o foco a cada tecla porque o subcomponente `Field` era
  definido DENTRO do `LeadModal` (recriado a cada render → input remontava).
  Movido para escopo de módulo. (Os outros modais não tinham o padrão.)
- TEMA: modais estavam presos no claro (`bg-white`/`slate-*`/`*-50` hardcoded),
  texto quase invisível no dark. Retematizados com tokens bento (contraste nos
  dois temas); emerald/azul/âmbar viram tons translúcidos semânticos.
- ROXO: "Preencher com IA" e pills de prioridade saíram do indigo → acento/bento.

Também (audit de tema): `lib/utils/score.ts` tinha TODOS os badges de score em
tons claros (`bg-*-50`, `gray-100`) que quebravam no dark — reescritos
dark-aware (aparecem no LeadCard e na Agenda).

---

✨ Novidade — refino de acabamento do design Bento Compacto (piloto no Hall).
Eleva o Bento de "troca de paleta" para acabamento técnico de instrumento,
SUTIL e ESTÁTICO. Valores de CSS copiados de painel_padrao_tecnico.html (fonte
da verdade), funcionando nos dois temas (claro/escuro). Implementado em
globals.css (classes `.bento-canvas/.bento-fx/.bento-metric/.bento-bars/
.bento-track/.bento-fill/.bento-btn`) e nos componentes bento (Panel ganha
profundidade + variante `hero` com filete de acento; Metric vai a 46px com
tracking negativo + centavos apagados; Button ganha inset highlight + sombra
colorida + active scale). Microdetalhes: (1) painéis com gradação sutil +
borda + inset highlight no topo (não chapado); (2) grade finíssima de 28px no
canvas (~0.015 escuro / 0.018 claro); (3) filete verde-limão só no painel
herói; (4) hierarquia forte (número 46px Space Grotesk vs label 10px JetBrains
Mono uppercase); (5) barras de proporção (trilho 3px) no resumo por tipo de
atividade; (6) gráfico com baseline + eixo X mono + barra "hoje" no acento
(eventos reais da semana); (7) botão com profundidade e resposta a toque.
TUDO ESTÁTICO (sem animação ambiente; exceções: pulse sutil do "online" e
hover/active de botões). Verde-limão pontual. Dados reais (eventos da semana,
atividades hoje, online, proporção por tipo). Próximo: replicar em Comercial e
Configurações.

---

🔄 Mudança — PIVOT para app PESSOAL de uso único (só o Lucas). Decisão de
produto: o sistema deixa de ser multi-área/multi-perfil e passa a focar no
fluxo de trabalho de um único usuário. Isso também elimina a maior fonte de
bugs recentes (papéis/roles, RLS por papel, layout que dependia do role).

O QUE SAI:
1. ÁREAS removidas por completo (rotas, páginas e componentes exclusivos):
   Tráfego (`/trafego`), Administrativo (`/administrativo`) e Financeiro
   (`/financeiro`). MANTIDAS: Hall, Comercial, Clientes, Configurações, Perfil.
   As TABELAS de dados dessas áreas (campanhas, pagamentos etc.) NÃO foram
   dropadas no banco — só a UI saiu, para permitir reativação futura.
2. SISTEMA DE PAPÉIS removido: filtro de NAV_ITEMS por role na Sidebar, prop
   `userRole` no layout/Shell/Topbar, gates `isAdmin` espalhados (passam a
   sempre liberar), e `src/lib/supabase/rbac.ts` (já era código morto).
   No banco, as policies de RLS baseadas em PAPEL são removidas por uma
   migration nova (014); o RLS de PRIVACIDADE (só o usuário autenticado acessa)
   é MANTIDO. A coluna `profiles.role` é mantida fisicamente (órfã, sem uso)
   para evitar quebra de queries e facilitar rollback.
3. CONFIGURAÇÕES: removido o gate admin-only da seção de logo (com 1 usuário
   não faz sentido). Mantidos tema, logo do sistema e perfil pessoal.

LOGIN MANTIDO: email+senha via Supabase Auth (o app vai pra internet, precisa
proteger os dados). O middleware continua protegendo as rotas (logado vê,
deslogado vai pro login) — só não há mais "níveis" de acesso.

COMO REVERTER (se a empresa precisar reativar): os commits desta mudança ficam
na branch `pivot-app-pessoal`. Para trazer uma área de volta, faça
`git revert <hash>` dos commits abaixo (ou cherry-pick dos arquivos das pastas
removidas a partir do commit ANTERIOR a eles):
  - feat: remover áreas Tráfego/Administrativo/Financeiro → 72fcc33
  - refactor(auth): remover sistema de papéis (usuário único) → 45e9438
  - refactor(config): limpar Configurações para usuário único → adbd933
  - DB: supabase/migrations/014_drop_role_system.sql

---

🔄 Mudança — responsividade mobile do dashboard (testado a 375px/390px).
PRINCIPAL: o Kanban do Comercial usava `grid grid-cols-5` fixo (~860px) e
ficava ilegível no celular. Agora, abaixo de `lg`, o funil vira um scroll
horizontal com snap (`flex` + colunas `w-[82vw] max-w-[300px] snap-start`),
escondendo os conectores em seta (que só fazem sentido na grade de desktop);
em `lg+` o funil posicional de 5 colunas é mantido idêntico. O DOM é único
(não duplica os droppables do dnd-kit). POLIMENTO geral: (1) grids fixos
`grid-cols-3/4/5` ganharam variante responsiva (`grid-cols-1 sm:grid-cols-3`,
`grid-cols-2 lg:grid-cols-4`, etc.) em Admin, Pipeline, Métricas, Comissões,
Clientes e form de Vendedores; (2) CTAs principais de cada página com alvo de
toque mínimo de 44px (`min-h-[44px]`); (3) modais (Novo Lead, Nova Campanha,
Novo Lançamento, Comissão, Cliente, Fixo) viram bottom-sheet no mobile
(`items-end sm:items-center`, `p-0 sm:p-4`, `rounded-t-2xl sm:rounded-2xl`,
`w-full sm:max-w-X`, `animate-slide-up`) — antes eram cards centralizados
cortados; (4) tabelas densas (Admin, Vendedores, Fixo) envolvidas em
`overflow-x-auto` com `min-w` para scroll horizontal; (5) calendário do Hall:
visão semanal vira scroll horizontal com snap no mobile (cards `min-w-[72px]`),
mensal mantém 7 colunas (padrão); (6) paddings de página reduzidos no mobile
(`p-4 sm:p-6` / `p-3 sm:p-5`). O menu hambúrguer já cobria todas as rotas e
fecha ao navegar (sem mudança).

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
