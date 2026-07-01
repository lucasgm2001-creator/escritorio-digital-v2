# Estado atual do schema de equipes

Documento criado antes de qualquer nova migration para registrar o estado atual do banco e reduzir risco de perda de dados reais.

## Estado atual das tabelas de equipes

O Supabase atual ja possui estrutura de equipes no banco real, embora essa estrutura ainda nao esteja completamente versionada nas migrations do repositorio.

Tabelas encontradas no banco:

- `teams`: existe e possui 1 registro.
- `team_members`: existe e possui 1 registro.
- `team_invites`: existe e esta vazia.

Equipe atual:

- Nome atual no banco: `DR Growth`
- Nome desejado: `DR Growth M.`
- `team_id`: `7cf9b5d3-e42f-48d7-bfdf-575736e72827`
- `owner_id`: `623dd724-ddeb-426c-956a-4c71f6653fa5`

Membro atual:

- Usuario: Lucas
- E-mail: `lucasgm2001@gmail.com`
- `user_id`: `623dd724-ddeb-426c-956a-4c71f6653fa5`
- Role em `team_members`: `owner`
- Regra desejada: Lucas continua como admin/owner da equipe inicial.

## Dados reais vinculados ao team_id atual

Os dados abaixo sao reais e nao devem ser apagados, recriados ou sobrescritos.

- `leads`: 59 registros, todos com `team_id`.
- `lead_interactions`: 63 registros, todos com `team_id`.
- `clients`: 6 registros, todos com `team_id`.
- `sellers`: 1 registro, com `team_id`.
- `tasks`: 54 registros, todos com `team_id`.
- `activities`: 104 registros, todos com `team_id`.
- `calendar_events`: 0 registros.
- `seller_salaries`: 2 registros, todos com `team_id`.
- `deals`: 6 registros, todos com `team_id`.
- `weekly_payments`: 15 registros, todos com `team_id`.
- `meetings`: 10 registros, todos com `team_id`.
- `lead_milestones`: 60 registros, todos com `team_id`.
- `plans`: 3 registros, todos com `team_id`.
- `client_payments`: 17 registros, todos com `team_id`.
- `presentations`: 2 registros, todos com `team_id`.
- `presentation_materials`: 6 registros, todos com `team_id`.
- `news`: 8 registros, todos com `team_id`.
- `funnel_stages`: 12 registros, todos com `team_id`.
- `nichos`: 2 registros, todos com `team_id`.
- `client_integrations`: 1 registro, com `team_id`.
- `stage_events`: 153 registros; 151 com `team_id` e 2 sem `team_id`.

Observacao: `commissions`, `payments`, `campaigns` e `expenses` aparecem em migrations antigas, mas nao foram encontrados no schema publico atual consultado.

## Tabelas que ja tem team_id

Estas tabelas devem ser tratadas como dados de equipe:

- `team_members`
- `team_invites`
- `leads`
- `lead_interactions`
- `clients`
- `client_payments`
- `client_integrations`
- `sellers`
- `seller_salaries`
- `deals`
- `weekly_payments`
- `meetings`
- `tasks`
- `calendar_events`
- `activities`
- `notices`
- `news`
- `lead_milestones`
- `plans`
- `presentations`
- `presentation_materials`
- `funnel_stages`
- `nichos`
- `stage_events`
- `fx_config`

## Tabelas que nao devem ter team_id

- `profiles`: nao deve receber `team_id`, porque um usuario pode participar de mais de uma equipe. O vinculo correto e via `team_members`.
- `teams`: e a entidade raiz da equipe, nao deve apontar para si mesma.
- `google_oauth_tokens`: hoje e uma integracao por usuario. Deve continuar user-scoped ate decisao explicita de transformar Google Calendar em integracao por equipe.

## Riscos de perda de dados

Riscos principais:

- Criar uma nova equipe e mover dados sem preservar o `team_id` atual.
- Apagar/recriar tabelas ja populadas.
- Rodar migrations antigas que tenham `drop table`, `truncate` ou recriacao de schema.
- Tornar `team_id` `not null` antes de corrigir registros sem equipe.
- Endurecer RLS antes do app filtrar e gravar corretamente por equipe ativa.
- Misturar dados quando um usuario participar de mais de uma equipe, caso o app continue fazendo consultas sem `team_id`.
- Criar funcoes/triggers de equipe diferentes dos objetos que ja existem no Supabase real sem reconciliar nomes e comportamento.

## Regra de seguranca

Nao apagar, truncar, recriar ou sobrescrever dados reais.

Toda migration desta fase deve ser:

- Aditiva.
- Idempotente.
- Compativel com dados existentes.
- Sem `drop table` em tabelas reais.
- Sem `truncate`.
- Sem troca de IDs existentes.
- Com `update` restrito apenas a backfill seguro de `team_id` nulo ou renomeacao controlada da equipe inicial.
- Com verificacoes antes e depois.

## Plano seguro de migracao

1. Versionar o schema atual de equipes que ja existe no Supabase real:
   - `teams`
   - `team_members`
   - `team_invites`
   - funcoes como `create_team` e `redeem_invite`, se confirmadas no banco
   - triggers de carimbo de `team_id`, se confirmados no banco

2. Preservar a equipe atual:
   - manter o mesmo `team_id`
   - renomear `DR Growth` para `DR Growth M.`
   - manter Lucas como `owner`

3. Fazer backfill seguro:
   - preencher os 2 `stage_events` sem `team_id` com o `team_id` da equipe inicial, se forem dados da DR Growth M.
   - verificar se ha outras tabelas com `team_id` nulo antes de qualquer constraint

4. Criar camada de equipe ativa no app:
   - resolver a equipe ativa do usuario
   - usar fallback temporario para a unica equipe quando o usuario tiver apenas uma
   - preparar alternancia futura entre equipes

5. Atualizar leituras por modulo:
   - Hall
   - Comercial
   - Clientes
   - Tarefas
   - Comissoes
   - Studio
   - Configuracoes

6. Atualizar escritas por modulo:
   - todo insert deve receber `team_id` da equipe ativa
   - triggers podem existir como protecao secundaria, nao como unica garantia

7. Endurecer RLS somente depois:
   - usuario ve dados das equipes onde e membro
   - membro comum entra por codigo
   - apenas admin/owner promove, rebaixa ou remove membros

8. Criar UI em Configuracoes > Equipes:
   - ver equipes atuais
   - criar equipe
   - ver/copiar codigo de acesso
   - inserir codigo
   - gerenciar membros
   - promover/rebaixar membros
   - remover acesso

## Ordem recomendada de commits

1. `docs: document current team schema state`
2. `fix: add safe team schema reconciliation migration`
3. `fix: assign existing data to initial team`
4. `feat: add active team resolution helper`
5. `feat: filter dashboard reads by active team`
6. `feat: stamp writes with active team`
7. `feat: add team settings section`
8. `feat: manage team members`
9. `fix: harden team rls policies`
10. `chore: validate team data integrity`
