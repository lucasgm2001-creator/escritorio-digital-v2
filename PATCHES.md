# PATCHES

Registro de correções, mudanças e novidades. Mais recentes no topo.

Categorias: 🐛 Fix · 🔄 Mudança · ✨ Novidade

---

🔄 Mudança — Notícias: recência + clima extremo + quadro em destaque.
- **Busca (rota):** prompt exige notícias dos **ÚLTIMOS 7 DIAS** com `published_at` real (descarta antigo); filtro de recência no insert (>10 dias fora). **Nova categoria "clima"** — eventos climáticos extremos (nevasca/frio/furacão/enchente/calor/incêndio) em MA/NJ/CA/NC/SC + nacional que **afetam trabalho de campo**.
- **Limpeza:** após gravar, apaga `news` com `published_at` > 30 dias (tabela não acumula velharia).
- **NewsSection:** ordena por `published_at` DESC e mostra só os **últimos 30 dias**; **chip "Clima"** no filtro.
- **Hall:** quadro "Notícias do setor" **subiu** — abaixo de "Atividades hoje", **acima da Agenda** (briefing do dia).
- Cron diário já existe (GitHub Action 2x/dia, manhã+tarde). Sem schema (clima usa `categoria` text), sem dinheiro.

---

🔄 Mudança — Hall (aba Atividades) reorganizado: 1 só visão de tempo.
- As 3 caixas de tempo viraram UMA: mantido o calendário **Diário/Semanal/Mensal/Anual**, renomeado **"Agenda"** e **subido** (logo após o stat). **Removidos** o card "Agenda" (esta semana / no calendário) e a faixa "Agenda · esta semana" (Seg→Dom) — duplicatas.
- Nova ordem: saudação/relógios/online → tabs → **Atividades hoje** → **Agenda** → Atividades Recentes + Mural → Notícias.
- Mural e Notícias **intactos**. Mesmas fontes (`calendar_events` + `tasks`). Sem schema, sem dinheiro. (Removidas vars órfãs: weekdayBars/eventsThisWeek/eventsToday/agendaOpen.)

---

🐛 Fix (DINHEIRO) — deal órfão (`client_id` null) que quebrava a derivação da comissão.
- **Causa A** (`runWonFlow`): se o cliente não vinculasse (insert falhou → `clientId` null), o código **continuava** e criava o deal com `client_id` null. Agora há **GUARDA**: sem cliente, **NÃO cria o deal**, loga (`console.error`) + aviso (não falha silencioso).
- **Causa B** ("Nova venda"/editar venda em Comissões): nome de cliente **livre** que não casava exato virava `client_id` null. Agora **`ensureClient`** ACHA por nome (case-insensitive) **ou CRIA** → `deals.client_id` sempre preenchido; bloqueia se faltar o nome; novo cliente entra na lista local.
- `ensureClient` (actions.ts) compartilhado. **`calc.ts`/`payWeek` intactos** (só a garantia do vínculo na criação).

---

🔄 Mudança (DINHEIRO/AUTOMAÇÃO) — Comissão automática (INCREMENTO 3): scheduler + estorno + exibição.
- **Scheduler** `/api/commission/auto` (GitHub Action 1x/dia, `x-cron-secret`): p/ cada cliente **ativo**, no seu dia (`clients.dia_pagamento_semana`), marca a próxima semana devida via o **MESMO `payClientWeek`** (receita + comissão derivada). Inativo → pula. Idempotente. **SEGURANÇA:** cron p/ TODOS só roda com env **`COMMISSION_AUTO_ENABLED="true"`**; botão **"Rodar auto agora"** testa 1 cliente (`{clientId}`).
- **Estorno** `voidClientWeek`: anula a receita (flag `client_payments.anulado`, **auditável, sem delete**) e **DELETA a comissão** derivada da semana (calc.ts/payWeek **intactos**). UI "Anular" por semana + confirmação.
- **Exibição:** Cliente = lista de semanas pagas (nº, data, valor, paga/anulada) + total recebido. Comissões = painel **"Comissão por semana"** do mês (cliente + US$25 + R$).
- **COLUNAS que Lucas adiciona (eu NÃO rodo):** `client_payments.anulado boolean not null default false`; `anulado_em timestamptz`; `anulado_motivo text`.
- **ENV:** `COMMISSION_AUTO_ENABLED` (Vercel) liga o cron p/ todos; `CRON_SECRET` + `APP_BASE_URL` (GitHub) já existem. `calc.ts`/`payWeek`/`registerMeeting` **INALTERADOS**.

---

🔄 Mudança (DINHEIRO) — Comissão nova, INCREMENTO 2: pagamento parte do CLIENTE → receita + comissão derivada.
- `actions.ts` NOVO: `resolveClientPlan` + `payClientWeek` — grava `client_payments` (receita = valor do plano, **sem teto**) e **deriva** a comissão chamando o **MESMO `payWeek`** (US$25, ≤4, trava). `deriveCommission` acha o deal `em_andamento` do cliente. **`payWeek`/`calc.ts`/`registerMeeting` INALTERADOS** (só novos chamadores).
- Clientes: painel **"Pagamentos"** por cliente → **"Marcar semana N"** (próxima não paga) + **"Pagar mês (4 semanas)"**; anti-duplo-clique; trava `unique(client_id,numero_semana)` → "já registrada". **N>4** só receita; **cliente sem deal** só receita.
- `runWonFlow`: passa a gravar TAMBÉM a `client_payments` da semana 1 (receita = valor do plano; padrão 140 se sem plano) — **ADITIVO**, sem tocar na comissão.
- Sem mudança de número/regra de comissão. Sem localStorage.

---

🔄 Mudança — Comissão nova, INCREMENTO 1: planos + plano do cliente (estrutura/exibição; sem pagamento).
- Migration **029** (`plans` + `clients.plano_id` + `client_payments`) JÁ APLICADA por Lucas — arquivo só filado (idempotente).
- Clientes: **plano via dropdown** (lê `plans` ativos por ordem) no criar/editar → grava `clients.plano_id`. Badge mostra "Plano · $valor/sem" (valor do plano quando houver, senão `plan_weekly` legado); MRR usa o valor efetivo. `plan_weekly` mantido como legado (não removido).
- NÃO toca pagamento/comissão (`calc.ts`/`payWeek`/`registerMeeting`/`runWonFlow` intocados). Sem dinheiro, sem localStorage.

---

✨ Novidade — Configurações reestruturada (incremento 1): navegação Andares/Sistema + Tema e Acessibilidade reais.
- Nav em 2 grupos: **ANDARES** (Hall/Comercial/Tarefas/Studio/Clientes → placeholders "Em breve") e **SISTEMA**.
- **Tema** (reusa a lógica existente): claro/escuro/auto + **horários da virada configuráveis** (client/localStorage); `src/lib/theme.ts` virou a fonte única dos horários (ThemeWatcher + script inline do layout leem dela).
- **Acessibilidade** (real, client/localStorage, classes no `<html>` + globals.css): tamanho da fonte (normal/grande/maior), alto contraste, mais espaçamento, reduzir movimento. Aplicado **antes do paint** pelo script do layout.
- Logo do sistema preservada; placeholders "Em breve": Conta, Aparência, Dados & Export, Integrações, Sobre.
- Sem schema, sem dinheiro. localStorage só p/ preferências de cliente (tema/horários/acessibilidade), mesma categoria do tema.

---

✨ Novidade — Visão por PERÍODO na aba Métricas do Comercial.
- Seletor Dia/Semana/Mês/Semestre/Ano (espelha o Relatório), padrão **Semana atual**; helper compartilhado `src/lib/period.ts`.
- KPIs do topo respeitam o período: **Recebidos, Fechados, Taxa de Conversão** (fechados÷recebidos), **Pipeline** (ativos criados no período), **Ticket Médio** e **Receita Fechada**; + card **Conversão Reunião→Venda**. Fontes reusadas: `leads.created_at` + `lead_milestones` (nada de contagem nova).
- Cards de composição (funil por etapa, valor por estágio/vendedor, temperatura, resumo) seguem como **estado atual** (snapshot). Sem schema, sem dinheiro.

---

🔄 Mudança — Funil configurável: INCREMENTO 1 (fundação). Código lê as fases de `funnel_stages`; comportamento IDÊNTICO.
- Migration **028 (funnel_stages)** JÁ APLICADA por Lucas — arquivo só filado (10 fases seedadas, mapa de marcos idêntico, is_won=Venda Fechada, is_lost=Venda Perdida).
- Fonte única: `src/lib/funnelStages.ts` (tipos + helpers + loader client memoizado) e `funnelStages.server.ts` (`getStages` com React cache).
- Won-flow (DINHEIRO) dispara pela **flag `is_won`** (não pelo slug 'fechado'); marcos do relatório leem `conta_interagiu/reuniao/fechou` da fase. Fallback estático garante comportamento idêntico se as fases não carregarem.
- Funil desktop (KanbanColumn/tiers) e mobile (PhaseAccordion) renderizam as fases do banco (por `posicao`); estilo/cores reusam o mapa por slug. Mantido número grande / sem US$.
- Agente: enum de destino **dinâmico** (slugs de funnel_stages); confirmação de "venda" pela flag `is_won`.
- NÃO dropei a CHECK de leads.status nem criei slug novo (incremento 2). Sem aba de gestão ainda.

---

✨ Novidade — Área de Notícias automática no Hall (web_search).
- Painel "Notícias do setor" full-width (abaixo do conteúdo, antes do Calendar): cards com título, pills
  [categoria · estado(s) · severidade] (crítico=vermelho, alta=âmbar, média=neutro), resumo, impacto, fonte + tempo.
  Filtros client-side (nicho + estado), realtime (`useRealtimeRows('news')`), estado vazio amigável.
- Fonte automática: `POST /api/news/refresh` (Node, maxDuration 60) chama `claude-sonnet-4-6` com tool web_search
  (maxUses 4), parseia JSON, dedup por `fonte_url` e grava via client **service-role** (`lib/supabase/service.ts`, server-only).
- Agendador grátis: `.github/workflows/news-refresh.yml` (2×/dia) bate na rota com `x-cron-secret`. Fallback: ao abrir
  o Hall, se a última atualização passou de 12h, dispara o refresh em background.
- Migration **027 (tabela `news`)** JÁ APLICADA por Lucas — arquivo só filado (documentação). RLS: SELECT autenticado; escrita só service-role.
- ENVs (Lucas configura): `SUPABASE_SERVICE_ROLE_KEY` (Vercel) e `CRON_SECRET` (Vercel + GitHub Secret) + variable `APP_BASE_URL` (GitHub). Sem dinheiro.

---

🐛 Fix — funil MOBILE (PhaseAccordion): número de leads por etapa grande + remoção do "US$ 0".
- O ajuste do lote anterior tinha ido só pro `KanbanColumn` (kanban desktop); a aba Funil no celular usa o `PhaseAccordion`.
- Agora o número por etapa é grande (Space Grotesk `text-3xl`) e o "US$ 0" foi removido também no mobile.

---

✨ Novidade — Mural também mostra TAREFAS (com hora) junto de agenda e avisos.
- Tarefas pendentes (`done=false`) de HOJE + ATRASADAS entram no Mural (só exibição, zero sync, NÃO viram notice).
- Item: ícone de relógio + pill "Tarefa"; atrasadas em **vermelho** (padrão de atraso do app). Read-only: toca → aba Tarefas.
- Ordem: atrasadas no topo (destaque) → itens de hoje (agenda + tarefas) por horário → avisos abaixo.
- Lixeira continua só nos avisos (`notices`). Estado vazio: "Nada na agenda, tarefas ou avisos." Sem schema (tarefas já têm data/hora/`done`).

---

✨ Novidade — Mural de Avisos mostra a agenda (calendar_events) junto dos avisos.
- O Mural lista a agenda de HOJE (Brasília) no topo, ordenada por horário (`start_time`), + os avisos manuais (`notices`) abaixo.
- Item de agenda: ícone de relógio + pill "Agenda", READ-ONLY; tocar abre o detalhe do evento no `<Calendar>` (via prop `focusEvent`).
- Evento NÃO vira notice duplicado (só leitura mesclada na exibição, zero sync). `calendar_events` não tem campo de
  "concluído" → mostra só hoje (atrasados ficam de fora). A lixeira continua só para os avisos (`notices`).
- Relatório: KPI "Fecharam" → "Convertido em cliente" (PDF: "Convertidos") — só o rótulo; métrica do marco `fechou` inalterada.
- Housekeeping: arquivo da migration 026 alinhado ao banco (policies "...milestones", idempotente) e marcado JÁ APLICADA.

---

🔄 Mudança — Lote de ajustes de UI (Comercial, tema, Mural).
- Comercial/Métricas: novo card "Conversão Reunião → Venda" (% + "X de Y reuniões viraram venda").
  Base = marcos do ciclo (`lead_milestones`); enquanto a 026/backfill não estiverem aplicadas, cai automático
  no proxy do funil (status proposta+fechado ÷ fechado).
- Funil: número de leads por etapa maior/destacado (Space Grotesk) — leitura fácil no celular.
- Funil: removido o "US$ 0" das etapas (somava `value` que ninguém preenche) — mostra só a quantidade.
- Tema claro: relógios da Topbar (Brasília + EUA) passam a usar tokens de tema (contraste no claro; `lime-fg` mantém o realce).
- Mural de Avisos: ✨ ícone de lixeira por aviso com confirmação inline (✓/✕). Exclui só o aviso; não toca em activities.

---

✨ Novidade — Relatório do ciclo do lead automático (marcos: interagiu / reunião / fechou).
- Nova tabela `lead_milestones` (1x por lead por marco, idempotente) — migration 026 (revisar/aplicar).
- Marcos gravados sozinhos: ao mover de estágio (`moveLead` — interagiu/reuniao/fechou pela regra de avanço),
  ao "Registrar contato" (atendeu/mensagem → interagiu) e ao registrar reunião (→ reuniao, via novo `meetings.lead_id`).
- Relatório conta interagiu/reunião/fechou SÓ pelos marcos (fonte única, sem dobrar com lead_interactions/meetings);
  recebidos seguem de `leads.created_at`; novo KPI "Fecharam".
- Dinheiro/comissão 100% manual e intacto (US$15 por reunião e o won-flow não mudaram).

---

🐛 Fix — endurecimento das ações de dinheiro do agente (try/catch + anti-duplo-clique).
- confirmAction passou a envolver a execução em try/catch/finally: erro inesperado vira aviso amigável
  e SEMPRE libera o estado — nunca deixa "Salvando..."/barra travados.
- Botão "Confirmar" desabilita durante o save (mostra "Salvando...") + guarda síncrona (ref) contra
  clique duplo no mesmo tick disparar 2 gravações; "Cancelar" também trava durante o save.
- Sem mudança de regra (payWeek/registerMeeting/updateClient intactos) nem de schema.

---

🐛 Fix — semana de comissão duplicada vira aviso amigável (erro 23505 tratado).
- Com o índice único (migration 025), uma 2ª tentativa da MESMA semana (corrida de 2 cliques /
  estado desatualizado) é recusada pelo banco (erro 23505). O payWeek agora detecta o 23505 e devolve
  "Essa semana já está registrada." (reason 'dup') em vez do erro cru — vale pro funil (Comissões) E
  pro agente do Hall (reusam a mesma função). Sem mudança de schema.

---

✨ Novidade — trava no banco contra semana de comissão duplicada.
- Índice único uq_weekly_payments_deal_semana em weekly_payments(deal_id, numero_semana): a mesma
  semana de uma venda não pode ser lançada duas vezes (corrida de 2 cliques agora é recusada pelo banco).
- Migration 025 — JÁ APLICADA no banco por mim; o arquivo no repo é só documentação (NÃO rodar de novo).

---

✨ Novidade — Studio: nicho do material + sugestão por nicho do lead (Bloco 4, parte 3).
- Campo "nicho" no upload e no editar material, com autocompletar de nichos já usados em materiais E
  nos leads (leads.nicho). Tag de nicho no card + filtro de nicho na biblioteca.
- Aba Montar: com um lead selecionado, seção "Sugeridos para [nicho do lead]" lista os materiais cujo
  nicho casa (trim + case-insensitive); sem nicho no lead, a seção some. Não mexe em clients.

---

✨ Novidade — Studio: pastas de material (Bloco 4, parte 2).
- Campo "pasta" (texto livre) no upload (aplica aos próximos arquivos) e no editar material (lápis no
  card → modal), com autocompletar das pastas já usadas (datalist). Tag de pasta no card.
- Filtro de pasta na biblioteca (select: Todas / Sem pasta / cada pasta). Sem tabela nova (coluna `pasta`).

---

✨ Novidade — Studio: favoritos de material (Bloco 4, parte 1).
- Estrela (Lucide) em cada material da biblioteca pra marcar/desmarcar favorito (update no lugar, sem
  recarregar) + chip "Favoritos" pra listar só os marcados (compõe com busca e filtro de tipo).
- Migration 024 (PARA REVISÃO — NÃO RODADA) adiciona favorito/pasta/nicho em presentation_materials
  (+ índices) — uma migration cobre as 3 features do Bloco 4. Sem outra mudança de schema.

---

🔄 Mudança — 1ª carga das telas mais rápida (paralelização + cache + skeletons).
- Layout: as 4 queries em SÉRIE (getUser → profile → avatar → logo) viraram getUser + Promise.all
  (profile com name+avatar numa query só, em paralelo com a logo). getUser/profile passaram a ser
  cacheados por request (React cache) e reusados pelas páginas — somem as leituras duplicadas layout↔página.
- Páginas (Hall/Comercial/Clientes/Tarefas): queries independentes em Promise.all e reuso do user/profile
  cacheados (ex.: Comercial era leads→getUser→profile em série; agora leads ‖ getUser, profile cacheado).
- Skeletons Bento por seção (loading.tsx em hall/comercial/clientes/tarefas): a estrutura aparece na hora
  na 1ª visita, em vez de tela parada. Navegação entre telas segue instantânea (Router Cache); realtime,
  refresh-ao-voltar e tema intactos. Prefetch dos <Link> já era o default.
- Sem mudança de schema. (Medição foi estrutural — cadeias de await; ms reais ficam nos logs da Vercel.)

---

✨ Novidade — Agente do Hall: editar cliente, registrar pagamento de semana e reunião (com confirmação).
- 3 ações novas, TODAS pedindo confirmação antes de gravar:
  • editar_cliente — acha por nome (pergunta se ambíguo/não achar), mostra "campo: de X → Y", grava. NUNCA exclui.
  • registrar_pagamento — só p/ venda JÁ existente; acha a venda do cliente, calcula a PRÓXIMA semana não
    paga (teto 4, sem duplicar, só em_andamento), preview "semana N de 4 — US$ 25 — hoje". Não cria deal.
  • registrar_reuniao — vendedor ativo + cliente (ou avulsa), data própria, US$ 15 padrão.
- Regra de ouro (dinheiro): as ações chamam as MESMAS funções da UI — extraí payWeek/registerMeeting/
  updateClient pra src/lib/commission/actions.ts; Comissões (markWeek/addMeeting) e Clientes (edição)
  passaram a usá-las também. Zero regra duplicada. "Registrar venda" continua sendo mover o lead pra
  "Venda Fechada" (sem insert paralelo de deal). Cotação congelada vem da efetiva (/api/fx).
- Sem mudança de schema. Agente não exclui nada.

---

✨ Novidade — Comissões: visão "Por cliente" (recebido × falta) — regra 7, só exibição.
- Nova seção (Collapsible "Por cliente") mostra por venda/cliente: Recebido (semanas pagas), Falta
  (semanas restantes × valor enquanto em andamento; US$ 0 se interrompido/concluído), barra de progresso
  X/teto e status com cor só de significado (verde=concluído, neutro=andamento, vermelho=interrompido).
  USD principal; BRL discreto como estimativa (recebido pela cotação congelada de cada semana; falta
  pela cotação efetiva atual — nunca trava por falta de cotação).
- ACUMULADO por venda (vida do contrato), NÃO filtrado pelo seletor de mês: "recebido vs falta" é
  progresso do contrato, não do mês (o seletor de mês segue para o resumo mensal).
- Reusa dealTotal da engine (calc.ts) — NÃO recalcula comissão. Sem mudança de cálculo nem de schema.

---

✨ Novidade — tempo real dentro da página: Comercial, Clientes e Tarefas atualizam ao vivo.
- Generalizei o realtime do Hall num hook useRealtimeRows(table, setRows): assina postgres_changes
  (INSERT/UPDATE/DELETE) e aplica por MERGE POR id — adiciona se novo, substitui no lugar, remove.
  Aplicado em KanbanBoard (leads), ClientesClient (clients) e TarefasClient (tasks).
- Criar/mover/excluir numa aba reflete na outra AO VIVO, sem refresh nem trocar de página. O merge
  por id reconcilia o eco das próprias ações otimistas (não duplica nem pisca). O RevalidateOnFocus
  (volta após >1 min) fica como rede de segurança. Sem mudança de schema (tabelas já no publication
  supabase_realtime). Comissões ao vivo fica pra depois (deals/weekly_payments/meetings ainda fora do realtime).

---

🐛 Fix — navegação lenta: RevalidateOnFocus estava bustando o Router Cache do Next.
- O componente disparava router.refresh() no evento 'focus' do window + a cada 3 min → invalidava o
  Router Cache, então CADA navegação entre seções re-buscava tudo (~3s) e a página ainda recarregava
  sozinha de tempos em tempos ("forçada").
- Agora SÓ revalida quando a aba volta de escondida (visibilitychange hidden→visible) E ficou escondida
  por mais de 60s. Sem 'focus' do window, sem intervalo periódico → o cache do Next sobrevive: revisita
  de seção volta a ser instantânea; alt-tab rápido (<1 min) não recarrega; voltar depois de 1 min+
  atualiza sozinho. ThemeWatcher intacto (não usa router.refresh) → tema automático segue. Sem schema.

---

✨ Novidade — dashboard atualiza sozinho ao voltar pra aba + tema dia/noite ao vivo.
- Ao focar/voltar a ficar visível a aba (e a cada 3 min enquanto visível), os dados do servidor são
  re-buscados em segundo plano (router.refresh) SEM limpar a tela; Hall, Comercial, Clientes e Tarefas
  passam a refletir o dado fresco no lugar (sync props→estado). Throttle de 10s evita repetir em trocas
  rápidas. Hook reutilizável useOnFocusVisible + componente RevalidateOnFocus no shell.
- Tema 'auto' (escuro das 18h às 6h) agora vira sozinho ao cruzar o horário, SEM refresh (checa a cada
  1 min + ao focar). Manual (claro/escuro fixo) continua mandando; só troca o <html> quando o estado
  realmente muda (não pisca a tela nem perde foco). Componente ThemeWatcher no shell.
- Sem mudança de schema. (A preferência de tema já vivia em localStorage — sistema pré-existente; aqui
  só LEMOS pra respeitar o manual, sem introduzir novo localStorage.)

---

✨ Novidade — cotação USD→BRL automática + fallback nas Comissões (regra 5).
- Nova rota server-side /api/fx busca o dólar do dia (AwesomeAPI, campo bid) com cache diário (não
  rebusca se a referência já é de hoje no fuso de Brasília) e fallback: se a API falhar, usa a última
  cotação conhecida → manual → 5.40. Grava só fx_config.cotacao_referencia + updated_at; NÃO mexe na
  trava manual nem em nenhuma cotação congelada de lançamentos antigos.
- A tela Comissões usa essa referência como cotação automática (a trava manual continua mandando quando
  ligada) e NÃO trava mais lançamento por "cotação ausente" (a efetiva nunca é 0). O status mostra a
  origem ("automática (hoje)" / "manual (travada)" / "fallback — confira") + botão "Atualizar cotação agora".
- Sem mudança de schema (fx_config já tinha cotacao_referencia). Regra de ouro: só lançamentos NOVOS
  congelam a cotação corrente; históricos intactos.

---

✨ Novidade — migration 023 documenta o drift de schema (DOCUMENTAÇÃO, não aplicada).
- Arquivo idempotente que reconcilia objetos que JÁ existiam no banco mas faltavam no repo, pra
  uma instância nova conseguir reconstruir o schema do zero. Cobre o drift real: leads.stage_changed_at,
  deals.lead_id (+ FK → leads + índice), sellers.photo_url, e as tabelas presentations e
  presentation_materials (com RLS authenticated). Não altera o banco atual (que já tem tudo) — no-op lá.

---

🐛 Fix — aba Vendedores: dono do deal dinâmico + esconde métricas legadas.
- A automação Venda Fechada atribuía o deal ao "primeiro vendedor ativo" OU a um id FIXO de
  fallback (constante mágica) — o deal podia virar órfão (sem aparecer em nenhum vendedor). Agora
  o deal vai pro vendedor ativo resolvido dinamicamente (hoje há 1; TODO p/ multi-vendedor). Sem
  vendedor ativo, NÃO cria deal e avisa ("nenhum vendedor ativo configurado"). Resto da automação
  inalterado (US$ 100 / 4 semanas / 1ª paga / idempotência por lead_id).
- O card do vendedor escondeu "Leads atribuídos" (e as legadas conversion_rate/total_sales), que
  nasciam 0 e nunca atualizavam. Vendas/comissão seguem vindo do monthlySummary (engine real). Sem SQL.

---

🔄 Mudança — Comercial: segmentação Brasil/EUA removida + relógios melhorados.
- O filtro Todos/Brasil/EUA e o campo "Operação" do lead já não existiam na UI; agora todo lead
  nasce EUA por padrão. Migration 022 (PARA REVISÃO) converte leads existentes brasil→eua e muda
  o default da coluna (sem derrubar a coluna).
- Os 4 relógios de fuso (Brasília principal em lime + EUA Leste/Mont./Oeste) ficaram no padrão
  Bento: hora em JetBrains Mono, Brasília destacada, EUA visíveis a partir de telas médias.

🔄 Mudança — Funil: caixas de fase um pouco menores.
- Largura das caixas reduzida (240→208px) e número menor. Tocar numa fase para abrir a lista de
  leads já funcionava (continua); mover de fase por toque (card "Mover para" + seletor no detalhe
  do lead) e por arrastar no mobile seguem disponíveis. Cores e confirmação de Venda Fechada mantidas.

✨ Novidade — Hall: histórico em modal + popover de quem está online.
- "Atividade Recente" e "Mural de Avisos" ganharam um botão de ampliar (ícone) que abre uma view
  maior em modal, com botão "Ver histórico" que carrega o histórico PERSISTIDO completo (tabelas
  activities/notices — já persistiam; só passamos a consumir tudo).
- O indicador "X online" do topo agora é clicável e abre um popover com quem está online (presença
  via Supabase Realtime; reflete quem está com o Hall aberto). Não havia card "Online Agora" separado.

---

🐛 Fix — PDF grande renderiza sem mancha preta nem falha (limita canvas/dpr por página, erro gracioso).
- A correção HiDPI anterior estourava o limite de canvas do navegador (lado ~16384px / área ~16M px
  no Safari) em páginas grandes → mancha preta (overflow parcial) ou falha total. Pior: o try/catch
  envolvia o loop INTEIRO, então 1 página com erro apagava TODOS os canvas ("Não foi possível renderizar").
- Agora cada página tem a escala REDUZIDA automaticamente se passar do limite seguro (lado 8192 /
  área 16M px): páginas pequenas seguem em 2x (nítidas), grandes caem o suficiente pra caber. Cada
  página é isolada num try/catch — a que falhar vira placeholder ("Página X não pôde ser exibida"),
  sem derrubar as outras. Só falha em ABRIR o documento inteiro mostra erro geral.

---

🐛 Fix — preview de PDF nítido no Studio (renderização HiDPI / devicePixelRatio).
- O PDF no "Visualizar" (e no modo apresentação) era um <iframe> nativo que, em telas Retina
  (dpr 2/3), o Chrome rasterizava a 1x → borrado. Agora o PDF é renderizado por nós via pdf.js
  num <canvas> HiDPI: backing store = viewport × devicePixelRatio (dpr limitado a 2), exibição
  em 1x → nítido. Páginas renderizam sob demanda (IntersectionObserver) — seguro p/ PDFs grandes.
- Nova dependência pdfjs-dist (chunk dinâmico, só carrega ao abrir um PDF); worker casado com a
  versão via unpkg. Imagens e outros tipos de material ficam inalterados.

---

🐛 Fix — apresentar só na aba Apresentar + controles do modo apresentação visíveis.
- Removido o botão "Apresentar" do rodapé da aba Montar (ao lado do Salvar). Apresentar agora
  existe só na aba Apresentar, pelo play ▶ de cada apresentação salva. Montar tem só "Salvar".
- Modo apresentação (tela cheia, fundo escuro): o painel lateral de slides usava bg-bento-panel
  (theme-aware → quase preto no tema escuro, sumia no fundo) → agora bg-zinc-900/95 + borda +
  sombra, item ativo em lime com anel. As setas anterior/próximo eram bg-white/10 (contraste
  baixíssimo) → agora bg-black/60 + anel branco + sombra, visíveis sobre slide claro OU escuro.
  O ☰ do topo abre/fecha o painel (comportamento já estava certo; faltava o painel ser visível).

---

🔄 Mudança — pacote "saúde do código" (4 itens do code review).
- 🐛 Agente do Hall usa o supabase do REQUEST atual (antes era um singleton preso à sessão/
  cookies do 1º request → leituras podiam usar sessão velha). Importante agora que o agente age.
- ⏰ Scheduler/cron: endpoint aceita GET (exigência do Vercel Cron) + POST, validando CRON_SECRET
  por `Authorization: Bearer` ou `x-cron-secret`. Criado `vercel.cron.example.json` com agendamento
  CONSERVADOR (1x/dia), mas DESATIVADO (não há `vercel.json`) — só ativa após o Lucas confirmar o
  que roda. Obs: pra rodar de verdade, o cron precisa de um client SERVICE_ROLE (sem sessão, o RLS
  bloqueia as queries).
- 🧹 Removidos 3 arquivos mortos: CommissionModal, PipelineTab, AgendaTab.
- 🧱 Formatadores de moeda/data consolidados em `src/lib/format.ts` (usd, brl, usdCompact, ymd, ddmm),
  reusados por ~10 arquivos. Refactor puro — mesmos formatos de saída.

---

✨ Novidade — o Agente IA do Hall agora MOVE leads no funil (confirmação só pra Venda Fechada).
- 3ª ação do agente: "move o Sandro pra reunião", "o João fechou", "manda o lead X pra proposta".
  Ele acha o lead pelo nome (pede esclarecimento se houver ambiguidade) e muda o estágio.
- Estágios normais movem DIRETO, sem confirmar ("Pronto! Movi o Sandro pra Reunião Agendada").
- Venda Fechada PEDE confirmação (mexe em dinheiro): avisa que vai registrar a comissão
  (deal US$ 100, 1ª semana paga) e só move após o Confirmar.
- Usa a MESMA função do funil (moveLead/won-flow), extraída pra um módulo compartilhado —
  então fechar pelo agente dispara os mesmos efeitos (deal + cliente + 1ª semana, idempotente)
  que arrastar no funil. Sem duplicar lógica nem update solto que pule a automação.
- Escopo: só mover (criar lead/tarefa já existiam). Registrar comissão/pagamento e editar/deletar
  ficam pra depois. Sem mudança de banco.

---

🐛 Fix — agente do Hall com tool use estava falhando (modelo indisponível → 404).
- Ao pedir pra criar lead/tarefa, o Agente IA respondia sempre "A IA demorou para responder...".
  Causa real: o modelo das ações era claude-3-5-sonnet-20241022, que NÃO está habilitado nesta
  conta Anthropic — a API devolvia 404 not_found a cada chamada. O tool use em si estava correto.
- Troquei pra claude-sonnet-4-6 (disponível na conta e faz function calling normalmente).
- De quebra: o erro real agora é logado e devolvido ao chat (o catch genérico escondia o motivo).
  Sem mudança de banco.

---

✨ Novidade — o Agente IA do Hall agora EXECUTA ações (criar lead, criar tarefa), com confirmação.
- No Hall › Agente, além de responder perguntas, ele entende pedidos como "cria um lead chamado
  João da Construtora Silva" ou "me lembra de ligar pro Sandro amanhã 10h" e propõe a ação.
- Confirmação obrigatória: mostra um preview do que vai criar e só grava após o botão "Confirmar"
  (ou você responder "sim"/"confirma"). "não/cancela" cancela; qualquer outra resposta vira
  correção (ex: "não, a empresa é Souza") e ele refaz o preview. Nada toca o banco antes disso.
- Criar lead: nome (obrigatório) + empresa/telefone/nicho/valor/notas → entra no funil como Novo,
  atribuído a você. Criar tarefa: título (obrigatório) + data/hora (entende "amanhã", "sexta",
  "semana que vem") + vínculo opcional a um lead pelo nome.
- Usa tool use (function calling) da API; modelo Sonnet decide a ferramenta. Esta fase é só
  criar lead/tarefa (sem mover funil, comissão ou exclusões). Sem mudança de banco.

---

🐛 Fix — cliente fica ativo ao fechar venda (reativa se estava inativo).
- Na automação Venda Fechada → deal, quando o cliente vinculado já existia como 'inativo',
  o status era mantido 'inativo'. Agora, ao fechar a venda, o cliente vinculado SEMPRE
  termina 'ativo': cliente novo já nasce ativo; cliente reusado é reativado se preciso.
- Mexe só no cliente daquela venda — nenhum outro cliente é alterado.

---

✨ Novidade — tarefas vinculadas aparecem no detalhe do lead no funil.
- Abrir um lead (card expandido no funil OU painel de detalhe) agora mostra uma seção
  "Tarefas (N)" com as tarefas ligadas àquele lead (tasks.linked_type='lead'): título +
  data/hora + status. Concluídas ficam riscadas/esmaecidas com check verde; pendentes
  primeiro, depois concluídas, ordenadas por data.
- Dá pra concluir/reabrir clicando no check e criar tarefa rápida ("+ Nova") já vinculada
  ao lead — sem ir até a página Tarefas. Vale desktop e mobile (mesma seção nos dois).
- Só exibição/atalho; o CRUD completo continua na página Tarefas. Sem mudança de banco.

---

🔄 Mudança — seletor de fase do lead em caixinha compacta (era pills espalhados).
- No card de lead expandido do funil, a seção "Mover para" agora é uma caixinha única,
  contida (borda sutil + fundo recuado), com as 10 fases em grid de 2 colunas — em vez
  dos pills soltos que se espalhavam e estouravam a altura da caixa estreita (240px).
- A fase ATUAL do lead aparece marcada (accent verde-limão + check) e não é clicável.
  As demais movem o lead ao clicar (mesma função de sempre). Só mudou a apresentação.

---

✨ Novidade — Venda Fechada cria deal de comissão automaticamente (idempotente).
- Mover um lead pra "Venda Fechada" agora LANÇA o deal no módulo de comissão sozinho:
  deal (seller ativo, client_id, client_name, lead_id, US$ 100 / 4 semanas / US$ 25,
  em_andamento, data_fechamento = hoje) + a 1ª semana já paga em weekly_payments
  (semana 1, US$ 25, paid_on = hoje, cotação vigente do fx_config). Semanas 2-4 seguem manuais.
- Idempotente: não duplica deal nem cliente se o lead sair e voltar pra Venda Fechada
  (dedup por lead_id, fallback client_name+seller). Cliente é reusado se já existir (por nome).
- Mover pra fora NÃO apaga o deal. O modal de comissão não abre mais automático (o deal já
  vem com os padrões; edição fica em Equipe e Comissões). Requer a migration 021 (deals.lead_id).

---

🐛 Fix — persistir interações de lead em lead_interactions (relatório de engajados estava zerado).
- O card do funil não gravava nada (Ligar/WhatsApp eram só links). Adicionei "Registrar
  contato" no card (Atendeu / Mensagem / Não atend.) que INSERE em lead_interactions
  (lead_id, type, created_at, created_by, score_delta) e atualiza o score/last_contact do
  lead. O painel do lead (LeadDiary) já persistia.
- Relatório: "engajados" = leads ÚNICOS com interação atendeu OU mensagem OU reunião no
  período (nao_atendeu/nota/sistema não contam). Reuniões agendadas passam a contar por
  met_on (data da reunião). Leads recebidos = leads.created_at (mantido).
- Retroativo: como lead_interactions estava vazia, semanas passadas vêm zeradas — passa a
  contar daqui pra frente conforme os contatos forem registrados. Sem SQL (tabela já existia).

---

✨ Novidade — relatório de atividades comerciais com histórico filtrável e exportação PDF.
- Na aba Tarefas, novo seletor "Tarefas | Relatório". O Relatório mostra 3 números do
  período em destaque: Leads recebidos, Leads engajados (responderam) e Reuniões agendadas,
  + a lista detalhada das atividades.
- Filtros de período: Dia / Semana / Mês / Semestre / Ano + intervalo personalizado. A
  semana é SEGUNDA a DOMINGO; padrão = semana atual.
- Botão "Gerar Relatório da Semana" calcula a semana ANTERIOR completa (segunda→domingo) —
  pronto pro chefe na segunda.
- Botão "PDF" exporta o período (cabeçalho DR Growth + os 3 números + lista) via jsPDF.
- Sem banco: leads recebidos = leads.created_at; engajados = leads distintos com interação
  "Atendeu"/"Mensagem" (lead_interactions); reuniões = meetings criadas — tudo por período.

---

🐛 Fix — header da fase do funil alterna abrir/fechar (não só o X).
- Clicar no cabeçalho de uma fase aberta agora FECHA a fase (o cabeçalho inteiro virou o
  toggle); o X segue como atalho visual. Fase fechada continua abrindo ao clicar em
  qualquer lugar dela.
- O corpo com os lead cards é independente: cliques nos leads/botões não fecham a fase.

---

🐛 Fix — funil neutro: cor só em Venda Fechada/Perdida e no status dos leads.
- Tirado o "carnaval" de cores das fases do funil (nomes ciano/laranja/roxo e dots
  coloridos por fase). Agora o nome da fase é neutro e o dot é cinza em todas as fases.
- Exceção (cor = significado): "Venda Fechada" verde (#22C55E) e "Venda Perdida" vermelho
  (#EF4444) — estados terminais de resultado.
- Mantidos: deal rotting nos lead cards (dot + badge "XD"), o tema verde da fase ABERTA
  (borda + gradiente), os heat dots do resumo e a legenda do rodapé.

---

🔄 Mudança — Studio de Apresentação vira andar próprio no menu lateral (saiu do Comercial).
- Nova rota /studio renderiza o Studio (sub-abas Materiais/Montar/Apresentar) — antes era
  uma aba dentro do Comercial. Item adicionado ao menu lateral (ícone Presentation), entre
  Comercial e Clientes; título no topbar "Studio de Apresentação".
- Comercial fica com 3 abas: Funil · Métricas · Equipe e Comissões.
- O componente ApresentacaoTab e toda a lógica (upload, montador, modo apresentar) não
  mudaram — só mudaram de lugar (é autossuficiente, carrega os próprios dados).

---

🐛 Fix — card do vendedor usa o mesmo cálculo de comissão do perfil (era US$ 0).
- O card de cada vendedor (Equipe e Comissões) mostrava "Vendas US$ 0" e "Comissão do mês
  US$ 0" porque lia fonte legada (campo total_sales e a tabela antiga commissions). Agora
  carrega os dados do módulo de comissão e chama a MESMA função monthlySummary do perfil,
  por vendedor → "Comissão do mês" bate com o perfil (ex.: US$ 335).
- O card passou a mostrar "Vendas (mês)" como CONTAGEM (igual ao topo do perfil), no lugar
  do valor legado zerado. Removidos a interface Commission e o helper monthKey órfãos.

---

🐛 Fix — limpeza geral: tabs unificadas, moeda US$, telefone US, campo Operação removido, labels corrigidos.
- Comercial: removidas as abas Agenda e Pipeline; o conteúdo da Pipeline foi unificado
  dentro de Métricas (KPIs + Funil por Etapa + Valor por Estágio + Valor por Vendedor +
  Resumo + Temperatura). Aba Vendedores renomeada para "Equipe e Comissões". Ordem final:
  Funil · Métricas · Studio de Apresentação · Equipe e Comissões.
- Moeda padronizada em US$ (form de lead, cards de vendedores, métricas). O módulo de
  Comissão segue mostrando US$/BRL de propósito.
- Form de lead: telefone com placeholder US (+1 (555) 123-4567); novos leads entram como
  operação "eua" por padrão (não havia campo "Operação" visível; sem mexer no banco).
- Topbar de /tarefas mostra "Tarefas" (antes "Dashboard").
- Hall: atividades de leads agora são clicáveis (abrem o lead no funil via
  /comercial?lead=id); as barras por tipo ganharam o rótulo "Atividades por tipo" pra não
  confundir contagem de atividades com a contagem real de leads.

---

🔄 Mudança — redesign visual do Studio de Apresentação com 3 abas e layout profissional.
- Reorganizado em 3 sub-abas (ícone + contador): Materiais (era Gaveta), Montar (o
  montador, antes um modal) e Apresentar (era Apresentações).
- Materiais: contagem + Upload, busca + chips de filtro (Todos/PDF/Imagem), grid de cards
  com thumbnail (140px), badge de tipo (PDF vermelho / IMG azul), nome + tamanho/data e
  zona de upload no último slot.
- Montar: 2 painéis — esquerda lista os materiais (com "+" pra adicionar); direita com
  seletor de cliente + nome, slides numerados com arrastar (drag handle) + subir/descer/
  remover, e rodapé Salvar/Apresentar.
- Apresentar: grid de cards (cliente em mono accent, nome em display, mini-slides, "X
  materiais · data" + botão play). Clicar apresenta em tela cheia.
- Tela cheia (modo único, mantido): topbar fina com nome + cliente + contador + fechar,
  menu lateral pra pular, setas e barra de progresso verde no rodapé.
- Lucide React, fontes display/tech, sem animações. Lógica e tabelas inalteradas.

---

🐛 Fix — ajustes finos do funil: conversão %, tema verde, badge de dias, scroll e rename.
- Conversão na barra de resumo estava 100% (só fechados/perdidos). Agora é
  fechados / (fechados + perdidos + ativos) — ex.: 2 / 11 = 18.2%.
- Tema verde da fase aberta reforçado (lime fixo #C2F73A na borda esquerda 3px, glow e
  gradiente; gradiente mais forte no light mode via html.light). Exceções: Venda Fechada
  verde (#22C55E), Venda Perdida vermelho (#EF4444).
- Badge "XD" (dias na fase) agora aparece sempre no card, com cor por temperatura
  (verde 0–1, amarelo 2–4, vermelho 5+). Com o backfill, começam "0D" verde.
- Caixa aberta com max-height (340px) e scroll interno — não cresce infinito.
- Aba do Comercial renomeada de "Apresentação" para "Studio de Apresentação".

---

🔄 Mudança — funil horizontal em níveis com fases colapsáveis e deal rotting.
- Funil do Comercial reconstruído: layout horizontal em 6 tiers (Novo Lead →
  Interagiu/Não Interagiu → Reunião Agendada → No-Show/Reagendamento/Proposta em Análise
  → Venda Fechada/Venda Perdida → Lixeira), com scroll esquerda→direita e conectores.
- Cada fase é uma caixa de 240px que começa FECHADA (nome, nº de leads, total US$ e
  heat dots) e abre ao clicar (tema verde; lista de leads com scroll). Mesmo tamanho aberta/fechada.
- Lead card colapsável: dot de deal rotting + nome + empresa + dias parado; ao abrir mostra
  responsável/nicho/temperatura/próxima ação, pills pra mover de fase e Ligar/Msg/Nota.
- Deal rotting por dias na fase (stage_changed_at): 0–1 quente, 2–4 atenção, 5+ esfriando.
  Venda Fechada/Perdida não têm rotting (dot fixo verde/vermelho).
- Lixeira arquiva o lead (sai dos outros tiers; dá pra restaurar movendo de volta, ou
  excluir de vez no painel do lead).
- Barra de resumo no rodapé (pipeline US$, conversão, ativos, fechados, perdidos + legenda).
- Mover lead: arrastar (drag) ou pills. Valores do funil passam a ser exibidos em US$.
- Fases renomeadas são só rótulo (chaves no banco inalteradas). Requer a migration 020.

---

🐛 Fix — campo de cliente da reunião e da venda mostra leads além de clientes (corrige Livia não aparecendo).
- Na aba Comissão, o campo de cliente (reunião e venda) sugeria só os clientes formais
  (tabela clients), então leads como a Livia não apareciam. Agora o datalist junta
  clientes + leads, sem repetir nome. Continua aceitando digitar um nome na mão.
- É só sugestão: o vínculo client_id continua vindo só de clients (não quebra a FK); um
  lead entra como nome livre (client_id vazio), o que já era permitido.

---

🐛 Fix — card "Atividades hoje" zera à meia-noite de Brasília (corrige contagem por fuso).
- A contagem usava a data em UTC, então atividades do fim da noite de ontem (após ~21h
  BRT) entravam no "hoje". Agora o dia é calculado no fuso America/Sao_Paulo (zera 00:00
  BRT). A lista de "Atividades Recentes" e o calendário não mudaram.

---

🔄 Mudança — botão de menu da apresentação à esquerda com cor do tema; apresentar exclusivo da apresentação montada.
- O botão de menu (☰) do player foi pro canto superior ESQUERDO, mais visível, com a
  cor do tema (verde-limão; hover mais escuro); a lista lateral agora abre pela esquerda.
- "Apresentar" deixou de existir na Gaveta e por material individual — virou exclusivo do
  card de uma apresentação montada (abre o player com o conjunto inteiro).
- Na Gaveta, cada material tem só "Visualizar" (pré-visualização do arquivo, reusando o
  MaterialFrame, sem o slideshow/tela cheia) e "Excluir".

---

🔄 Mudança — apresentação com modo único (sequência + menu lateral pra pular).
- Removidos os 3 modos (Sequência/Livre/Foco), a troca por 1/2/3 e a telinha
  "Como apresentar?". Clicar em "Apresentar" abre direto a apresentação.
- Modo único: navegação em sequência (setas ◀▶ sempre visíveis + teclado ←/→/espaço,
  Home/End) com contador "X de Y"; e um botão de menu no canto superior direito que
  abre/fecha uma lista lateral com os nomes — clicar num nome pula pra aquele material.
- Tela cheia de verdade (Fullscreen API + fallback + Safari) e ESC pra sair, como antes.

---

✨ Novidade — 3 modos de apresentação: Sequência, Livre e Foco (Bloco 3 do Studio).
- Cada apresentação salva ganha botão "Apresentar" → telinha "Como apresentar?" com 3 modos:
  Sequência (padrão, passa material por material), Livre (índice lateral sempre visível,
  pula pra qualquer um) e Foco (um por vez, sem distração; controles somem sozinhos).
- Tela cheia de verdade (Fullscreen API, com fallback e suporte Safari). Sai com ESC.
- Navegação por teclado (←/→/espaço, Home/End) e por setas clicáveis sempre na tela;
  troca de modo na hora com 1/2/3.
- Imagem: encaixada em fundo preto. PDF: visualizador nativo com a barra escondida
  (#toolbar=0). PDF multipágina = role dentro dele; ◀▶ troca de material.
- Card salvo agora tem ações separadas: Apresentar / Editar / Excluir.
- Novo componente PresentationPlayer.tsx; o MaterialFrame é reusado na Gaveta também.
- Só frontend — sem SQL e sem bucket (usa os arquivos dos Blocos 1 e 2).

---

✨ Novidade — Montador de apresentações (Bloco 2 do Studio).
- Na aba Apresentação (Comercial), novo seletor "Gaveta | Apresentações".
- Em "Apresentações": botão "Nova apresentação" abre o Montador — dá nome, escolhe o lead
  (com opção "Nenhum (sem vincular)"), adiciona materiais da Gaveta numerados na ordem,
  com remover (×) e reordenar (↑/↓). Salva na tabela presentations.
- Lista das apresentações salvas (nome, lead ou "Sem lead", nº de materiais, data);
  clicar abre de novo pra editar/re-salvar; excluir em 2 toques.
- Excluir uma apresentação NÃO apaga os materiais da Gaveta. Materiais excluídos da
  Gaveta somem da apresentação sem quebrar; lead excluído vira "Sem lead" (on delete set null).
- Requer a migration 019 (tabela presentations) no Supabase.

---

🐛 Fix — limite de upload da Gaveta alinhado em 50 MB (bucket e app).
- O bucket "materiais" foi para 50 MB no Supabase, mas o app ainda barrava em 25 MB
  ("passa de 25 MB") antes de tentar subir. Limite do código e as mensagens de aviso
  agora estão em 50 MB, batendo com o bucket.

---

✨ Novidade — Gaveta de materiais com armazenamento real (Bloco 1 do Studio de Apresentação).
- A aba Apresentação (Comercial) agora SALVA de verdade: cada arquivo sobe pro bucket
  "materiais" (Storage) e vira uma linha em `presentation_materials` — antes ficava só
  na memória do navegador e sumia ao recarregar a página.
- Ao abrir, LISTA os materiais salvos (mais recentes primeiro), com estado "Carregando...".
- Upload de PDF/PPT/imagens com limite real de 25 MB por arquivo (aviso amigável se passar);
  vários de uma vez. Antes dizia "sem limite de tamanho".
- Excluir em 2 toques (Cancelar/Excluir, padrão do sistema): apaga do bucket E da tabela.
- "Apresentar" em tela cheia continua igual, agora usando a URL real do arquivo salvo.
- Pastas/favoritos/nicho ficam para blocos futuros.

---

🔄 Mudança — Metas & Remuneração em USD, indicador de meta e salário unificado.
- Salário unificado: fonte única passa a ser `seller_salaries` (USD, com vigência,
  da aba Comissão). A aba Metas deixou de editar o campo fantasma
  `sellers.fixed_salary` (que não afetava a comissão) e agora só MOSTRA o salário
  vigente (USD + BRL), com nota "definido na aba Comissão". Coluna antiga fica sem
  uso (sem SQL, sem perda de dado). Removido o `FixoTab` morto (também mexia nela).
- Meta mensal vira meta de COMISSÃO em USD (com conversão BRL na exibição).
  ⚠️ valores de meta antigos foram digitados em R$ → agora lidos como USD (redigitar).
- Indicador: comissão do mês vs meta — VERDE se atingiu, LARANJA se abaixo (com barra).

---

🔄 Mudança — topo do perfil do vendedor com 4 métricas reais do mês (módulo de comissão).
- Substitui os KPIs antigos/desligados (Vendas/Comissão/Conversão do modelo velho)
  por 4 indicadores do mês atual, calculados com a MESMA função do Resumo (batem):
  Comissão do mês (USD) com % vs mês anterior (verde +/vermelho −; "novo" quando o
  mês anterior foi zero, sem divisão por zero), Vendas (mês), Reuniões (mês) e
  Salário fixo vigente. (O painel carrega seus próprios dados; atualiza ao reabrir.)

---

✨ Novidade — editar dados do vendedor (aba Dados).
- Botão "Editar dados" no perfil → edita nome, cargo, e-mail, telefone. Cargo virou
  lista (SDR, Closer, Gestor, Coordenador, Vendedor + "Outro"). Grava em `sellers`.
  Antes a aba Dados era só leitura.

---

🔄 Mudança — cada venda e reunião viram itens recolhíveis (aba Comissão).
- Na lista de Vendas, cada venda começa FECHADA com resumo no cabeçalho (cliente ·
  valor · status · X/Y pagas); abre pra ver detalhes (semanas, status) e os botões
  editar/excluir. Cada reunião idem (cliente · data · valor → abre p/ editar/excluir).

---

✨ Novidade — nicho do lead como lista (+ "Outro").
- No Novo Lead, "Nicho / Segmento" virou lista (Construction, House Cleaning … Pest
  Control) + "Outro" (revela campo de texto). Leads antigos mantêm o valor (texto);
  a lista só limita os novos cadastros.

---

🔄 Mudança — caixas da aba Comissão recolhíveis (começam fechadas, com espiada).
- As 5 seções (Resumo, Vendas, Reuniões, Salário, Cotação) viram recolhíveis
  (cabeçalho clicável, padrão do Hall), começando FECHADAS, com espiada no
  cabeçalho: Resumo→total do mês; Vendas→nº de vendas + pendentes; Reuniões→nº no
  mês; Salário→salário vigente; Cotação→cotação em uso. O seletor de mês fica no
  cabeçalho do Resumo (acessível mesmo fechado).

---

✨ Novidade — botão "Gerar PDF do mês" da comissão (jsPDF, um clique).
- No Resumo da aba Comissão, gera um PDF do mês selecionado do vendedor aberto:
  cabeçalho (DR Growth, vendedor, mês, data de geração), TOTAL A PAGAR em USD e
  BRL (com a cotação), decomposição (salário/reuniões/vendas) e tabela linha a
  linha (Dia · Ação · Cliente · Valor). Conta SÓ o recebido/realizado no mês — sem
  previsões. Layout claro/profissional com acento verde-limão. jsPDF carregado sob
  demanda (não entra no bundle da página). Deps: jspdf, jspdf-autotable.

---

✨ Novidade — semanas pré-programadas pela data de fechamento (aba Comissão).
- Cada semana da venda mostra a data PREVISTA (S1 = fechamento, depois +7/+14/+21),
  calculada na hora (sem guardar nada; ajusta sozinha se mudar o fechamento). Os
  chips diferenciam "prevista" (ícone de calendário + "prev.") de "paga" (check
  verde + data real), com legenda. Ao marcar uma semana como recebida, o campo de
  data já vem preenchido com a data prevista (ajustável).

---

✨ Novidade — reunião com cliente visível e editável (aba Comissão).
- A reunião já guardava o cliente no cadastro; agora a lista mostra "Reunião ·
  {cliente}" e o editar inclui o campo cliente (texto livre com sugestões dos
  clientes existentes). Sem SQL — a coluna `client_name` já existia.

---

✨ Novidade — editar e excluir venda e reunião na aba Comissão (sem SQL; RLS já
permitia update/delete nessas tabelas).
- Venda (DealCard): ícones de editar e excluir no cabeçalho. Excluir com
  confirmação em 2 passos → apaga a venda e as semanas dela (FK cascade), sem
  órfãs. Editar (cliente, valor total, nº de semanas, data) recalcula o valor/
  semana só p/ o futuro; semanas já pagas mantêm o valor congelado. Bloqueia
  reduzir o nº de semanas abaixo das já pagas (pede pra desmarcar antes).
- Reunião (novo MeetingRow): editar (data/valor) e excluir AGORA com confirmação
  em 2 passos (antes o excluir era direto). Cotação congelada permanece.
- Tudo via useSave (otimista + rollback + toast). Arquivo: CommissionSection.tsx.

---

✨ Novidade — excluir vendedor de vez (perfil do vendedor).
- Botão "Excluir vendedor" na seção Dados, separado do "Desativar", com
  confirmação em 2 passos. Apaga via delete em `sellers` (RLS de DELETE liberada
  por SQL manual). Quem tem dados ligados (vendas/reuniões/salário) é BLOQUEADO
  pelo banco (FKs on delete restrict) → mostra mensagem amigável "...tem vendas/
  comissões registradas. Desative-o em vez de excluir." em vez do erro cru.
  Sucesso → fecha e tira do grid.

---

✨ Novidade — excluir lead de vez (painel do lead).
- Botão "Excluir lead" no rodapé do LeadDiary, com confirmação em 2 passos
  ("Tem certeza? Esta ação não pode ser desfeita"). Apaga via delete em `leads`
  (RLS de DELETE liberada por SQL manual) → o banco cascateia o histórico de
  interações. Fecha o painel e tira o lead do funil. Toast em erro/sucesso.

---

🔄 Mudança — aba Atividades do Hall reorganizada (só layout, sem SQL).
- Removido o card "Online agora" (duplicava o "X online" do topo, que fica).
- Topo: dois resumos compactos lado a lado — "Atividades hoje" (nº + total) e
  "Agenda" (eventos da semana + total no calendário).
- "Agenda · esta semana" (gráfico) virou caixa recolhível, começa FECHADA com
  espiada no cabeçalho ("{n} eventos · {n} hoje / nada agendado para hoje").
- "Atividade recente" mostra as 3 mais recentes + botão "Ver mais" que expande o
  resto (dos 20 já carregados) — só mostra/esconde, sem nova query.
- Mural de Avisos intocado. Mesmo estilo Bento.

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
