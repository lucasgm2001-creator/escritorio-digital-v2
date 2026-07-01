# Auditoria de código — Escritório Digital v2

- **Data:** 2026-06-27
- **Método:** revisão read-only (4 revisores paralelos: dinheiro · cron/API/segurança · métricas/estado · calendário/morto/perf) + inspeção direta de RLS/policies no Supabase. **Nada foi editado, buildado nem commitado.**
- **Escopo:** repositório inteiro (`src/`, `supabase/migrations/`, `vercel.json`) + policies do banco.
- **Formato de cada achado:** `[SEV] arquivo:linha — problema — impacto — toca dinheiro/arquivo travado? — precisa decisão do Lucas?`

### Premissas (pra não gerar falso-positivo)
- Arquivos de dinheiro **congelados de propósito** (`calc.ts`, `commission/actions.ts`, `leadActions.ts`, `WonPlanModal.tsx`) — bugs são **apontados**, não reescritos.
- **Câmbio travado de propósito** (cotação manual fixa). "Auto-câmbio não roda" é decisão, não bug.
- App é **single-user hoje, vai virar multiusuário** (Daniel/Lucas/Gabriel/Thamyris) — dívidas de RLS/multi-tenant apontadas pensando nisso.
- **Já corrigido (não relistado):** `googleCalendar` usa `events.patch`; `TaskModal` não envia `is_meeting`; `TarefasClient` usa `deletedIds`; Mapa pinta lilás só por `status==='novo'`; `calendar-sync` valida `task.user_id` no branch `taskId`.

### Contagem por severidade
- 🔴 **Crítico:** 3
- 🟠 **Alto:** 8
- 🟡 **Médio:** 18
- 🟢 **Baixo/limpeza:** 26

---

## 🔴 Crítico

- [Crítico] `src/app/(dashboard)/comercial/leadActions.ts:54-59` — `runWonFlow` cria cliente com `plan_weekly:0`, sem `plano_id` e sem `dia_pagamento_semana` — cobrança automática NUNCA dispara (cron filtra `dia_pagamento_semana != null`) e a receita cai no default US$140 — dinheiro/travado: **sim** — decisão do Lucas: **sim**
- [Crítico] `src/lib/commission/actions.ts:87` — `resolveClientPlan` cai em `valorUsd=140` quando `plan_weekly<=0` e sem `plano_id` — todo cliente do won-flow gera **receita-fantasma de US$140/semana não contratada** em `client_payments` — dinheiro/travado: **sim** — decisão: **sim**
- [Crítico] `src/app/api/cron/auto-weeks/route.ts:14-19` + `vercel.json` — cobrança semanal só roda no GET com `Authorization: Bearer CRON_SECRET`; a memória do projeto registra "cron 401" → a **marcação semanal de receita/comissão NÃO roda sozinha**, depende de clique manual (`commission/auto` pela UI) — dinheiro: **sim** — decisão: **sim (verificar se `CRON_SECRET` está setado na Vercel)**

## 🟠 Alto

- [Alto] **RLS** `pg_policies` (migrations 003/004/017) — todas as tabelas de negócio **exceto `tasks`** usam só `auth.role()='authenticated'`, sem `user_id`/team; `seller_salaries`, `weekly_payments`, `client_payments`, `meetings` ficam world-read/write a qualquer logado e o PIN da aba "Equipe e Comissões" é **só client-side** — ao entrar Daniel/Gabriel/Thamyris, todos veem/editam dinheiro/leads/clientes de todos — dinheiro: **sim** — decisão: **sim**
- [Alto] `src/lib/commission/actions.ts:98-101` — `deriveCommission` pega o deal em_andamento mais recente (`data_fechamento desc limit 1`) — cliente com 2 deals credita a **comissão no deal errado** — dinheiro/travado: **sim** — decisão: **sim**
- [Alto] `src/lib/commission/actions.ts:193` — `voidClientWeek` estorna no deal mais recente (sem filtrar status) — em cliente com 2 deals, **anula a weekly_payment do deal errado** — dinheiro/travado: **sim** — decisão: **sim**
- [Alto] `src/app/(dashboard)/comercial/leadActions.ts:119-132` — semana 1 (receita+comissão) gravada por insert direto com `paid_on=today`, não via `payClientWeek`/`dueDateFor` — mês de competência e cotação congelada divergem; receita da semana 1 pode **duplicar/deslocar** quando o auto rodar — dinheiro/travado: **sim** — decisão: **sim**
- [Alto] `src/lib/funnelMetrics.ts:9-12` + `HallClient.tsx:284` + `KanbanBoard.tsx:324` — Conversão geral (Funil+Mapa) **inclui** `origem='cliente_existente'` (e `mapLeads` nem seleciona `origem` p/ filtrar) — diverge da definição de Métricas/Relatório, que **excluem** — nº de conversão artificial — dinheiro: não — decisão: **sim**
- [Alto] `src/app/(dashboard)/comercial/tabs/MetricasTab.tsx:26 vs :85-87` — mesma aba usa **2 bases**: KPIs do período excluem `cliente_existente`, mas o snapshot/Resumo inclui — dois "Fechados" divergentes na MESMA tela — dinheiro: não — decisão: **sim**
- [Alto] `src/lib/googleCalendar.ts:180` — `createEvent` grava `google_event_id` sem checar erro do UPDATE — se o write falhar, o próximo sync cria um **evento DUPLICADO** e o 1º vira órfão eterno — dinheiro: não — decisão: **sim**
- [Alto] `src/lib/googleCalendar.ts:171` + `TarefasClient.tsx:230` — delete do evento é best-effort sem retry/fila/reconciliação; falha deixa **evento órfão permanente** no Google (id já apagado junto com a tarefa) — dinheiro: não — decisão: **sim**

## 🟡 Médio

- [Médio] **RLS** `tasks` (migration 015) — é a ÚNICA tabela owner-scoped (`auth.uid()=user_id`); todo o resto é global — inconsistência: ao virar multiusuário, tarefas isolam por dono mas leads/clients/dinheiro NÃO — dinheiro: não — decisão: **sim**
- [Médio] `src/app/api/agent/scheduler/route.ts:43` — `runScheduler` usa `createClient()` (sessão) mas é cron sem sessão → RLS bloqueia; e não está no `vercel.json` (desligado) — automações do SuperAgent (resumo diário/semanal, alertas) não rodam; se ligar sem trocar p/ service-role, falham em silêncio — dinheiro: não — decisão: **sim (antes de ativar)**
- [Médio] `src/lib/rate-limit.ts:2-3` — bucket é `Map` em memória por instância serverless — o limite (inclusive `verify-password` 5/15min) só vale por instância; com várias instâncias o brute-force/abuso de IA escala — dinheiro: não (IA=custo) — decisão: **sim (store compartilhado: Upstash/KV)**
- [Médio] `src/app/api/tasks/calendar-sync/route.ts:21-24` — branch `deleteEventId` apaga evento do Google por id cru **SEM checar dono** (só `taskId` valida) — IDOR no Google Agenda quando multiusuário — dinheiro: não — decisão: **sim**
- [Médio] `auto-weeks/route.ts:30` vs `commission/auto/route.ts:27-29` vs `leadActions.ts:120` — três caminhos resolvem a cotação efetiva diferente (`referencia ?? manual ?? 5.40` vs `resolveRate(auto)` vs `resolveRate(fxc, manual ?? 0)` ignorando `cotacao_referencia`) — BRL congelado pode sair inconsistente entre caminhos (não-travada) — dinheiro: **sim** — decisão: **sim**
- [Médio] `src/lib/commission/actions.ts:103` — `deriveCommission` retorna `'capped'` (sem comissão) após `teto_semanas`, mas a receita já foi inserida sem teto — da semana 5+ há **receita sem comissão correspondente**, silencioso — dinheiro: **sim** — decisão: **sim (verificar se intencional)**
- [Médio] `src/lib/commission/actions.ts:163` vs `auto-weeks:39` — `payDueWeeks` tolera `dia` nulo (fallback dow do start) mas o cron exige `dia_pagamento_semana != null` — cliente sem o dia NUNCA é cobrado pelo cron, só pelo botão manual — dinheiro: **sim** — decisão: **sim**
- [Médio] `MetricasTab.tsx:65-67` vs `RelatorioComercial.tsx:83` — "Recebidos"(Métricas) não filtra Lixeira/`incluir_no_relatorio`/`cliente_existente`; "Chegaram"(Relatório) filtra os 3 — dois números de "quantos chegaram" divergentes no mesmo período — dinheiro: não — decisão: **sim**
- [Médio] `MetricasTab.tsx:70-77` — Fechados/Conversão do período via `lead_milestones` sem excluir lixeira/`cliente_existente` nos marcos — `convRate` conta fechamentos que snapshot/Relatório não contam — dinheiro: não — decisão: **sim**
- [Médio] `HallClient.tsx:282` / `ConfiguracoesClient.tsx:593` — "Leads novos" usa `created_at>=now-7d` enquanto o Mapa pinta lilás por `status==='novo'` — card "Leads novos" ≠ lilás "Novo Lead" do mapa ao lado; e inclui `cliente_existente` (mapLeads sem `origem`) — dinheiro: não — decisão: **sim**
- [Médio] `HallClient.tsx:240-255` — `mapLeads`/`mapClients` sem realtime (refetch manual em mount/focus/visibility) vs Comercial com `useRealtimeRows` — métricas do Hall defasam vs Comercial até um foco; refetch redundante a cada alt-tab — dinheiro: não — decisão: não
- [Médio] `vercel.json` — só há cron p/ `/api/cron/auto-weeks` (diário 09:00 UTC); **não há cron p/ `/api/news/refresh` nem `/api/fx`** — notícias do Hall e cotação-referência só atualizam por page-load, nunca sozinhas — dinheiro: não (fx só referência; câmbio travado) — decisão: **sim**
- [Médio] `TaskModal.tsx:183` + `calendar-sync/route.ts:37` — sync de calendário 100% silencioso (fire-and-forget `.catch(()=>{})` + rota sempre `{ok:true}`) — usuário acha que a reunião foi pro Google quando não foi; sem reconciliação periódica — dinheiro: não — decisão: **sim**
- [Médio] `src/app/(dashboard)/tarefas/types.ts:21` + coluna `tasks.is_meeting` — campo aposentado, não lido em lugar nenhum — limpar do type + `DROP COLUMN` — dinheiro: não — decisão: **sim (DROP é decisão)**
- [Médio] `hall/dateBR.ts:5` — "hoje em Brasília" reimplementado em `hall/briefing:32`, `auto-weeks:12` e `actions.ts:141` (4 cópias); `dayBR` preso no Hall (não em `src/lib`) — risco de divergência de fuso — dinheiro: não — decisão: **sim (mover p/ lib: variante client vs server)**
- [Médio] `funnelMetrics.ts:9` (oficial) vs `MetricasTab.tsx:76` (inline) vs `RelatorioComercial.tsx:55` (à mão) — 3 fórmulas de "conversão" — confunde qual é a oficial (geral vs período pode ser intencional) — dinheiro: não — decisão: **sim**
- [Médio] `KanbanBoard.tsx:39` `isTerminal` reimplementado em `MetricasTab:19`, `MapaTab:20`, `HallClient:281`, `Config:592` (5 lugares) — mudar a lista de status terminal exige editar todos — dinheiro: não — decisão: não
- [Médio] `comercial/page.tsx:12,14` + `hall/page.tsx:15` — `leads/clients/tasks.select('*')` sem `limit`/`range` em tabelas que só crescem — todo registro histórico vem em cada abertura; piora linear — dinheiro: não — decisão: **sim**

## 🟢 Baixo / limpeza

**Segurança / robustez (baixo)**
- [Baixo] `src/app/api/leads/transcript/route.ts:45` — `console.log` do payload BRUTO do webhook (nome/telefone/email/transcrição) sem flag (`inbound` tem `INBOUND_DEBUG`, transcript não) — PII de lead nos logs de prod — dinheiro: não — decisão: **sim**
- [Baixo] `src/app/api/commission/auto/route.ts:32-49` — aceita `body.clientId` sem validar formato; qualquer logado dispara marcação de semanas (dinheiro) de QUALQUER cliente por id — dinheiro: **sim** — decisão: **sim (quando multiusuário)**
- [Baixo] `news/refresh:53-58` + `leads/briefing` + `hall/briefing` — rotas de IA atrás de `requireAuth()` mas sem checagem de role/dono; leem via service-role (ignora RLS) — quando multiusuário, qualquer logado dispara IA de qualquer lead — dinheiro: não (custo IA) — decisão: **sim (multiusuário)**
- [Baixo] `src/lib/googleCalendar.ts:49,146` — log de `client_email` + presença/comprimento da `GOOGLE_SERVICE_ACCOUNT_KEY` a cada sync — não vaza a chave, mas é ruído/metadado em prod — dinheiro: não — decisão: não
- [Baixo] `commission/auto/route.ts` `handleRunAuto` em `ClientesClient.tsx:399` lê `j.result` que a rota nunca retorna — toast nunca mostra o resultado real do auto — dinheiro: não — decisão: não
- [Baixo] `src/lib/agents/SuperAgent.ts:200` — caminho `'sonnet'` aponta p/ `claude-3-5-sonnet-20241022` (404 nesta conta) — `gerarResumoDiario`/`RelatorioSemanal` quebrariam se acionados por esse caminho — dinheiro: não — decisão: não

**Dinheiro (baixo / verificar)**
- [Baixo] `commission/actions.ts:188-191` — `voidClientWeek` não checa se a semana existe nem se já estava anulada; anular semana inexistente reporta `ok:true` e ainda tenta deletar comissão — pode remover comissão de outra origem — dinheiro: **sim** — decisão: não
- [Baixo] `planCommission.ts:6` (default US$25) vs `actions.ts:87` (default US$140) — defaults desconectados; em cliente sem plano, receita 140 e comissão 25 não têm relação real — dinheiro: **sim** — decisão: **sim**
- [Baixo] `VendedoresTab.tsx:148-149` / `calc.ts:21` — passa `automaticRate=manual ?? 0`; salário em BRL nos KPIs do vendedor pode usar cotação 0 (BRL=0) sem manual definido — dinheiro: sim (exibição) — decisão: não
- [Baixo] `calc.ts:103` — `nextPayoutProjection` nunca chamada — projeção morta (arquivo de dinheiro) — dinheiro: sim — decisão: **sim**

**Código morto (remoção segura)**
- [Médio] `src/components/bento/Metric.tsx` — arquivo órfão (`Metric`/`MetricSize`/`MetricProps` nunca importados; todos os "Metric" do app são defs locais) — ~40 linhas; pode apagar — dinheiro: não — decisão: não
- [Médio] `src/lib/logo.ts:18` — `getSystemLogoUrl` nunca chamada + consts `SYSTEM_LOGO_DIR`/`SYSTEM_LOGO_FILE` só dela — função + 2 consts mortas — dinheiro: não — decisão: não
- [Baixo] `utils/score.ts:31` `SCORE_DELTAS` · `funnelStages.ts:52` `lostSlug` · `funnelStages.ts:88` `tiersFromColumns` · `utils/index.ts:20` `formatDateTime` · `period.ts:45` `MODES` · `SuperAgent.ts:261` param `userId` — zero referências — dinheiro: não — decisão: não
- [Baixo] exports redundantes (símbolo vivo só internamente): `score.ts` ScoreFaixa/ScoreInfo, `stageEvents.ts` StageEventInput, `commission/actions.ts` PayWeekReason/CommissionOutcome, `calc.ts` salaryForMonth/MonthlyInput, `SuperAgent.ts` AgentTurn, `funnelMetrics.ts` funnelConversionPct, `rate-limit.ts` RateLimitInfo/RateLimitOptions, `require-auth.ts` AuthRole — remover só o `export` — dinheiro: não — decisão: não

**Duplicação (deveria ser util compartilhado)**
- [Médio] `HallClient.tsx:281` bloco clientesAtivos/leadsAbertos/leadsNovos idêntico a `ConfiguracoesClient.tsx:591-593` (prévia) — Hall e Config divergem se a regra mudar — dinheiro: não — decisão: não
- [Médio] `googleCalendar.ts:60` `addDays(ISO)` duplicado em `CommissionSection.tsx:53` (local) e `actions.ts:142` (UTC) — 3 versões com fuso diferente → off-by-one divergente — dinheiro: não (actions é commission) — decisão: não
- [Baixo] `format.ts:5` `pad2` redefinido em 5+ lugares; `TaskModal.tsx:31` `todayLocal`/`ymd` reescrito 4x (alguns UTC, outros local); `calendarShared.ts:44` início-da-semana repetido 3x; `CommissionSection.tsx:34` formatação dd/mm em 5 lugares — dinheiro: não — decisão: não
- [Baixo] `MetricasTab.tsx:88` hot/warm/cold por score (`>650/400-650/≤400`) inline; cortes NÃO batem com `score.ts`/`leadSignals.ts` — 3ª definição de faixa de score divergente — dinheiro: não — decisão: **sim (pode ser proposital p/ 3 baldes)**
- [Baixo] `theme.ts:20` janela de horário-escuro duplicada no script inline de `layout.tsx:62` (inline não importa, mas fórmulas divergem se uma mudar) — dinheiro: não — decisão: não

**Performance**
- [Médio] `HallClient.tsx:249` — refetch de leads+clients em `focus`+`visibilitychange` sem throttle — recarrega tudo a cada alt-tab; redundante com mount e troca p/ aba Mapa — dinheiro: não — decisão: não
- [Baixo] `ClientesClient.tsx:335` + `MetricasTab.tsx:46` — `client_payments.select('*')` sem limit/janela (ledger só cresce) — busca o ledger inteiro de todos no mount — dinheiro: sim (valores) — decisão: **sim**
- [Baixo] `auto-weeks/route.ts:49` — loop `for(eligible)` com awaits por cliente (resolveClientPlan+client_payments+deals+payDueWeeks) serial — N+1; risco de timeout com muitos clientes — dinheiro: sim — decisão: **sim (verificar volume)**
- [Baixo] `SuperAgent.ts:241` — leads/clients/client_payments `select('*').limit(20)` serializados como JSON no prompt — custo de tokens + latência por msg — dinheiro: sim (custo API) — decisão: **sim**
- [Baixo] `FasesTab.tsx:109` `for(updates) await update()` (N+1 ao reordenar fases); `KanbanBoard.tsx:117` re-lê `funnel_stages` já vindo via `initialStages`; `TarefasClient.tsx:215` `router.refresh()` em toda ação (re-roda SSR do Hall) — dinheiro: não — decisão: não
- [Baixo] render sem `useMemo`: `ClientesClient.tsx:407` (filter/reduce/MRR a cada tecla), `MetricasTab.tsx:85` (snapshot do funil), `HallClient.tsx:293` (typeCounts) — recomputo a cada render — dinheiro: não — decisão: não

---

## Apêndice A — RLS / multi-tenant (estado atual do banco)

RLS **habilitado em todas as 22 tabelas** (`relrowsecurity=true`), mas o escopo das policies:

| Escopo | Tabelas |
|---|---|
| **Por dono** (`auth.uid()`) ✅ | `tasks`, `calendar_events`, `profiles` |
| **Só "authenticated"** (qualquer logado vê/edita tudo) ⚠️ | `leads`, `clients`, `deals`, `meetings`, `weekly_payments`, `client_payments`, `seller_salaries`, `sellers`, `lead_milestones`, `lead_interactions`, `stage_events`, `funnel_stages`, `fx_config`, `plans`, `news`, `notices`, `presentations`, `presentation_materials`, `activities` |

**Implicação multiusuário:** com Daniel/Lucas/Gabriel/Thamyris logados, todos têm acesso total de leitura **e escrita** a leads, clientes, deals, e — sensível — a `seller_salaries`, `weekly_payments`, `client_payments` e `meetings` de todos. O PIN da aba "Equipe e Comissões" é só client-side (uma query direta ao Supabase ignora). Antes de adicionar usuários, decidir o modelo: **time compartilhado** (leads/clients/funnel visíveis a todos — talvez OK) vs **dados sensíveis escopados** (salário/comissão por vendedor/dono).

Obs.: a policy de UPDATE de `fx_config` **permite** `authenticated` — então o write de sessão deveria funcionar; o uso de service-role na rota fx é robusto de qualquer forma (e necessário p/ cron sem sessão). (verificar se o bloqueio de RLS reportado antes era outra causa, ex.: linha inexistente exigindo INSERT.)

## Apêndice B — Top 5 pra atacar primeiro
1. **Cron `auto-weeks` 401 / `CRON_SECRET`** — confirmar o env na Vercel; sem ele a cobrança semanal não roda sozinha (a memória do projeto já registra "cron 401").
2. **`runWonFlow` cria cliente sem `dia_pagamento_semana`/plano + `resolveClientPlan`=140** — receita travada e/ou fantasma; combinar com o commit `a796dd6` (form) já em REVIEW GATE pra recuperação manual.
3. **RLS multi-tenant** — escopar `seller_salaries`/`weekly_payments`/`client_payments`/`meetings` (e decidir o modelo de leads/clients) ANTES de adicionar os 3 usuários; o PIN não protege no banco.
4. **deal-mais-recente em `deriveCommission`/`voidClientWeek`** — comissão/estorno no deal errado p/ cliente com 2 deals.
5. **Cadeia de calendário órfã** (createEvent dup, delete sem retry/reconciliação) — decidir estratégia (job de reconciliação ou aceitar best-effort com aviso ao usuário).
