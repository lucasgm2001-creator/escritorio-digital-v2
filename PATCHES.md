# PATCHES

Registro de correções, mudanças e novidades. Mais recentes no topo.

Categorias: 🐛 Fix · 🔄 Mudança · ✨ Novidade

---

✨ Novidade — trocar o responsável de um lead já criado (painel do lead).
- Seletor "Responsável" no LeadDiary (espelha o de Fase): escolher o usuário
  logado grava o id real; escolher um vendedor grava só o nome (`assigned_name`) e
  deixa `assigned_to` null — MESMA lógica corrigida da criação (não repete a FK do
  bug do Lucas). UPDATE em `leads`, otimista + rollback + toast. Sem schema.

---

✨ Novidade — editar a data de uma semana já paga (aba Comissão do vendedor).
- No card da venda, clicar numa semana paga abre um campo de data + "Salvar" pra
  corrigir o `paid_on` (UPDATE em `weekly_payments`), além do "Desmarcar" que já
  existia. Otimista + rollback + toast (useSave). Sem mudança de schema.

---

🐛 Fix — atribuir lead a vendedor sem conta (ex.: "Lucas") quebrava com erro de
foreign key (`leads_assigned_to_fkey`).
- Causa: o menu "Responsável" lista `sellers` e gravava o `sellers.id` em
  `leads.assigned_to`, mas a FK exige um `profiles.id`. Só o usuário logado
  (Daniel) tem linha em `profiles` — por isso ele funcionava e os vendedores não.
- Correção (opção 1, sem mexer em schema/contas): no salvamento, `assigned_to` só
  recebe o id quando é o usuário logado; para qualquer vendedor fica `null` e o
  nome vai em `assigned_name` (que é o que a tela já exibe — funil/pipeline/agenda/
  comissão). Reorganização completa de contas e FK fica pra Fase 2.

---

🐛 Fix — "Preencher com IA" respondia 200 mas não preenchia os campos.
- Causa: o `parse-lead` extraía o JSON com regex ANCORADO (`^\s*\{…\}\s*$`), que
  exige a resposta inteira ser JSON puro. Quando o modelo embrulhava em
  ```` ```json ```` ou colava texto em volta, não casava → devolvia `{ lead: null }`
  com 200 → campos vaziam.
- Correção: extração tolerante igual ao `/api/tasks/parse` (`/\{[\s\S]*\}/` — pega
  o `{…}` de qualquer lugar). Só mudou a forma de extrair; modelo e lógica intactos.

---

🐛 Fix — "Preencher com IA" (e demais rotas de IA) dava 503 + "Failed to fetch".
- Causa: o 503 não vinha do nosso código (que só emite 400/429/500) — era a Vercel
  derrubando a função durante a chamada à Anthropic (sem `maxDuration`, valia o
  default ~10s; o SDK ainda re-tenta quando a IA está lenta). Cliente sem catch
  mostrava o erro cru "Failed to fetch".
- Servidor: `export const runtime = 'nodejs'` + `export const maxDuration = 60` nas
  6 rotas de IA (parse-lead, tasks/parse, tasks/summary, agent/chat, lead-analysis,
  agent/scheduler). Lógica e modelo inalterados.
- Cliente: tratamento de erro com mensagem clara via toast — LeadModal
  (handleAiParse, que não tinha catch), TarefasClient (criar tarefa + resumo do dia)
  e LeadDiary (análise). AgentChat já tratava: só melhorou a mensagem (sem toast).

---

✨ Novidade — tela de comissão, Bloco 2 (lançamentos) na aba "Comissão".
- Lançar venda: form com cliente (livre ou vincula a cliente existente via
  datalist), valor total USD e nº de semanas EDITÁVEIS (pré 100/4), valor por
  semana calculado automático; grava em `deals` com valor_por_semana congelado.
- Semanas pagas: cada venda mostra chips S1..Sn (paga c/ data ou pendente).
  Marcar pede a data do recebimento (paid_on) → grava em `weekly_payments` com a
  cotação congelada; dá pra desmarcar. A semana conta no mês do paid_on.
- Reunião: form (data met_on, valor pré US$15, cliente/nota opcionais) → grava em
  `meetings` com cotação congelada; lista as do mês em foco + remover.
- Status/rescisão: selector em_andamento/interrompido/concluido por venda;
  interrompido congela no que já foi pago (mostra "Congelado em US$X").
- Pendências na tela: chip "{n} semana(s) pendente(s)" no topo de Vendas + nota
  por venda. Sem cron/mural (fica pra etapa futura).
- Resumo do mês passa a refletir os lançamentos reais (USD e BRL). Trava: não
  deixa lançar sem cotação > 0. Tudo grava via helper useSave (rollback + toast).

---

✨ Novidade — tela de comissão, Bloco 1 (no perfil do vendedor) + limpeza do
modelo antigo.
- Nova sub-tab "Comissão" no perfil do vendedor (Comercial → Vendedores → abrir
  vendedor). Tem: Resumo do mês (seletor de mês; Salário + Reuniões + Vendas +
  Total em USD e BRL, estado vazio tratado), Salário fixo USD com vigência
  (cada mudança é um registro novo, aumento só pra frente), e Cotação USD→BRL
  global (travar manual / automática). Usa só as tabelas/funções da 017; nada de
  lançamento (bloco 2) nem histórico (bloco 3). `src/.../tabs/CommissionSection.tsx`.
- Limpeza do modelo de comissão antigo (genérico, em R$):
  - Removida a sub-tab "Comissões" (plural) de dentro do perfil do vendedor.
  - Removida a aba "Comissões" do topo do Comercial; arquivo `ComissoesTab.tsx`
    apagado (ficou órfão). Topo agora: Funil · Pipeline · Métricas · Agenda ·
    Apresentação · Vendedores.
  - Removido o campo "comissão padrão (%)" da aba Metas & Remuneração e o
    "Comissão (%)" do form Novo Vendedor (resíduo do modelo %). Coluna
    `sellers.default_commission` mantida no banco (sem mudança de schema).
- Mantidos (leem ainda o modelo antigo, serão religados ao novo num bloco
  futuro): o KPI "Comissão" no topo do painel e o "Comissão do mês" nos cards.

---

✨ Novidade — módulo de comissão, Fase 1 (schema + cálculo + testes, SEM UI).
- Migration 017 (rodada em prod): 5 tabelas no modelo "long" (uma linha por
  evento), moeda real = USD, BRL só exibição. `fx_config` (cotação USD→BRL
  global, com trava manual), `seller_salaries` (salário USD com vigência —
  aumento só pra frente), `deals` (vendas: US$100, teto 4 semanas, status
  em_andamento/interrompido/concluido), `weekly_payments` (semana recebida, mês
  por `paid_on` + cotação congelada), `meetings` (reunião US$15, mês por `met_on`
  + cotação congelada). FK `on delete restrict` (soft delete via sellers.status).
  NÃO toca na tabela `commissions` antiga.
- Cálculo (TS puro, sem banco): `src/lib/commission/{types,calc}.ts` — resumo
  mensal (salário+reuniões+semanas, USD e BRL), total da venda por status
  (em_andamento projeta o que falta; interrompido congela no pago), projeção do
  próximo dia 1º, e resolução de cotação travada vs automática.
- Testes: `scripts/commission-test.ts` (`npx tsx`). Os 5 casos obrigatórios
  passaram: mai US$25 / jun US$75; resumo US$555 (R$2.975); interrompida congela
  US$50; conversão auto R$2.997 vs travada R$2.775; salário 500→700 por vigência.
- Sem tela ainda: nada do app usa essas tabelas; ligação com UI vem em fase futura.

---

🔄 Mudança — remoção de código morto (faxina pré-Fase 2). 13 arquivos órfãos
saíram (~552 linhas), sem mudar nenhum comportamento:
- Agentes antigos do multi-área: AgentManager + ComercialAgent/FinanceiroAgent/
  GestorAgent/TrafegoAgent (cadeia fechada, ninguém importava). O SuperAgent
  (usado pela rota /api/agent/chat) FICA.
- Componentes não usados: ui/badge, ui/button; bento AgentPanel/Delta/Button
  (só o barrel não-usado os citava → barrel `bento/index.ts` ajustado p/ manter
  só Panel/Metric/LiveDot).
- Legados do pivot: Clock.tsx (substituído pelo LiveClock dos fusos no Topbar) e
  ThemeSelector.tsx (tema agora vive em layout + Configurações).
- lib/middleware/with-rate-limit.ts (HOF sem uso; rotas usam lib/rate-limit).
- Auditoria confirmou: sem import dinâmico, sem ref por string, build passa.
  Middleware duplicado (raiz vs src) NÃO mexido — fica p/ investigação à parte.

---

🐛 Fix — respostas do agente do Hall agora renderizam markdown (antes os `##`,
`**` e listas apareciam como texto cru).
- AgentChat trocou o `<p whitespace-pre-wrap>` por um componente Markdown
  (react-markdown + remark-gfm) — só nas respostas do agente; a bolha do usuário
  segue texto puro (fundo lima/tinta escura, contexto de cor diferente).
- Novo `components/ui/Markdown.tsx`: cada elemento (títulos, negrito, listas,
  links, código, tabela, citação) estilizado só com tokens (bento-*/lime-*/
  font-display/font-tech) → funciona nos dois temas, sem cor hardcoded.
- Lógica e prompt do agente intactos: mudou só a camada de exibição.

---

✨ Novidade — Vendedores reestruturado como perfil clicável (passo 2).
- Lista vira cards clicáveis com 2 indicadores: Vendas + Comissão do mês (agregada
  numa query só, por mês corrente).
- Painel lateral (estilo detalhe do lead): foto (upload), KPIs no topo (vendas /
  comissão paga+pendente / conversão) e 3 seções — Dados, Metas & Remuneração
  (salário fixo + metas juntos) e Comissões (resumo + adicionar + mudar status).
- Cadastro ganhou foto + contato (e-mail/telefone).
- Foto no Supabase Storage (bucket `assets`, sellers/<id>.jpg, comprimida ≤150kb).
  Requer coluna sellers.photo_url (add column if not exists, rodada em prod).
- Tudo que grava usa o helper useSave (rollback + toast). Tema migrado p/ tokens
  bento (saíram os #hex legados).

---

✨ Novidade — país/fusos + melhorias do funil (publicados juntos).
- Fusos: o Topbar mostra 4 relógios — Brasília (principal) + EUA Leste/Montanha/
  Oeste — usando fuso IANA (horário de verão dos EUA automático). Brasília a
  partir de sm; os 3 dos EUA a partir de lg; oculto no mobile.
- Sai a segmentação Brasil/EUA: filtro Todos/Brasil/EUA do Comercial, campo
  "Operação" do cadastro de lead e a divisão Brasil/EUA das Métricas (virou card
  "Resumo": Total/Ativos/Fechados). A coluna leads.operation fica órfã no banco
  (sem SQL). Comissão USD+BRL intocada.
- Funil mobile em ACORDEÃO: cada fase é uma linha compacta; tocar expande os
  leads daquela etapa (PhaseAccordion + StaticLeadCard). Desktop mantém colunas
  com drag (renderiza só um dos dois p/ não duplicar ids no dnd).
- Mudar de fase pelo card: no detalhe do lead há um seletor "Fase" (todas as 7);
  move com o helper (rollback + toast). Arrastar e seletor usam o MESMO caminho
  (moveLeadToStatus) → "Venda Feita" pelos dois cria cliente + abre comissão.

---

🐛 Fix — schema de produção desalinhado (migrations 006–012 aplicadas só em
parte → "funciona no local, quebra no ar"). Quebrou leads (006) e depois a aba
Vendedores ("column sellers.cargo does not exist"). A varredura migrations×código
achou ainda `commissions.cargo/description` (criar comissão quebraria) e
`profiles.avatar_url/phone/cargo/logo_url`. Migration 016_reconcile_prod_schema:
`add column if not exists` de TODAS as colunas que o código usa em sellers,
commissions, profiles e leads — idempotente, não apaga nada. Rodada em prod.

---

🐛 Fix — escritas que falhavam em SILÊNCIO (risco de perda de dado sem aviso).
Helper central de persistência: `lib/useSave.ts` (optimistic → await → em erro
rollback + toast vermelho; em sucesso, toast opcional) + `components/ui/toast.tsx`
(ToastProvider/useToast, montado no layout do dashboard). Aplicado nos ~14
write-sites que não tratavam erro:
- Clientes: criar, editar, +job, −job, inativar, reativar (optimistic + rollback).
- Comercial/Funil (KanbanBoard): mover etapa no drag (rollback do status) + criar
  cliente ao ganhar — via o toast próprio do board.
- Hall: excluir evento. LeadDiary: interação/score (aplica local só se persistir).
- Comissões: status. Vendedores: fixo, status, criar, ativar/inativar. Fixo:
  salvar (relança no try/catch). Perfil: avatar (usa o erro local existente).
A varredura não achou OUTRA mutação fire-and-forget além das de Tarefas (já
corrigidas); reads com `.then()` executam normalmente.

---

🐛 Fix — concluir/excluir tarefa não persistia (voltava ao recarregar). Causa: os
query builders do supabase-js são lazy/thenable — `toggleDone` e `handleDelete`
montavam `.update()/.delete()` SEM `await`, então a requisição nunca disparava
(zero chamadas na rede; só o estado local mudava). Corrigido: ambas viraram
`async` com `await`, optimistic update + ROLLBACK se o banco recusar, e banner de
erro visível (sem falha silenciosa). Tabela tasks já tinha done/completed_at e a
RLS de update/delete do dono (migration 015).

---

🐛 Fix — criar lead só com o nome falhava com 400 silencioso. Dois problemas:
(1) o app engolia o erro do insert (modal não fechava, nada aparecia) → agora
mostra um banner "Não foi possível criar o lead: <motivo>" (fim da falha
silenciosa). (2) Payload defensivo no LeadModal: só `name` é obrigatório;
opcionais → null; defaults sensatos (operation/prioridade/status/score/value);
`assigned_to` → null quando sem vendedor (evita violar a FK de profiles).
Causa raiz do 400 em produção: a migration 006 (campos nicho/origem/prioridade/
next_contact) não havia sido aplicada no banco de prod — resolvida rodando a 006
(idempotente, add column if not exists) no Supabase.

---

✨ Novidade — agente nas Tarefas (etapa 2a): criar tarefa por texto natural +
resumo do dia, via API Anthropic (claude-haiku) com auth + rate-limit.
- Criar por texto: input "Escreva uma tarefa…" no topo de /tarefas.
  /api/tasks/parse interpreta título, data, hora e prioridade (datas relativas
  resolvidas a partir de hoje, no fuso do navegador) e o contato; o nome casa
  com um lead/cliente no cliente. Abre o modal JÁ PREENCHIDO (preview editável,
  selo "preenchido por IA") — não salva sozinho. Título nunca vazio: fallback
  do texto digitado (servidor e cliente).
- Resumo do dia: botão no header → /api/tasks/summary resume hoje + atrasadas
  em texto curto e humano (não lista crua).
- Busca de lead melhorada: o "Conectar a" do modal mostra nome · empresa/nicho.
Não inclui o sugerir-sozinho (etapa 2b).

---

✨ Novidade — área de Tarefas (To-do), etapa 1 (base; o agente fica p/ etapa 2).
- Banco: migration 015_tasks.sql cria a tabela `tasks` (due_date + due_time,
  notes, prioridade, done/completed_at, linked_type/id/name p/ conectar a lead ou
  cliente). RLS OWNER-ONLY (auth.uid()=user_id), sem papel. Recria a `tasks`
  ANTIGA (tarefas de equipe da 005, resquício do sistema de papéis, sem UI) com
  `drop ... cascade` — a velha estava vazia.
- Menu: "Tarefas" na Sidebar entre Hall e Comercial (ícone check-square, ativo
  limão).
- Tela /tarefas: seções por dia (Atrasadas/Hoje/Amanhã/Esta semana/Depois/
  Concluídas recolhível); contagem por seção; vazias somem (exceto Hoje). Linha:
  checkbox (otimista), título, chip do lead/cliente + telefone (tel:), briefing
  expansível, tag de prioridade (alta/urgente), data+hora (mono). Ordenação:
  prioridade → dia → com hora (por horário) antes de sem hora.
- Modal Bento (Field em escopo de módulo → sem bug de foco): título, briefing,
  data, hora, prioridade e "Conectar a" (busca lead/cliente). Dois temas.

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
