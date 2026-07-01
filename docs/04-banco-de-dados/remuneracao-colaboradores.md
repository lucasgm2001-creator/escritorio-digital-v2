# Remuneracao por colaboradores e vendedores

## Objetivo

Documentar o modelo futuro de remuneracao por colaborador/vendedor do Escritorio Digital v2, preservando dados reais existentes e preparando uma evolucao segura do modulo de vendedores, comissoes, dashboards e metricas.

Esta documentacao nao altera banco, UI ou codigo runtime. Ela serve como referencia para migrations, services e telas futuras.

## Modelo atual de comissoes

O sistema atual possui dois modelos convivendo:

- Modelo legado: `commissions`.
- Modelo atual principal: `sellers`, `seller_salaries`, `deals`, `weekly_payments`, `meetings` e `client_payments`.

No modelo atual:

- `sellers` guarda o cadastro do vendedor/colaborador.
- `seller_salaries` guarda salario fixo mensal por vigencia.
- `deals` representa contratos/vendas associados a um vendedor.
- `weekly_payments` representa comissao por semana recebida de um contrato.
- `meetings` representa comissao por reuniao.
- `client_payments` representa receita real paga pelo cliente.
- `plans` guarda planos comerciais e pode guardar percentual de comissao por plano.

O calculo mensal fica principalmente em `src/lib/commission/calc.ts`, na funcao `monthlySummary()`, que soma:

- salario fixo vigente;
- reunioes realizadas no mes;
- semanas de comissao pagas no mes.

## Problemas do modelo atual

O modelo atual funciona para a regra simples, mas nao e suficiente para remuneracao personalizada por colaborador:

- Comissao de reuniao ainda e tratada como valor fixo, normalmente USD 15.
- Comissao por contrato depende de snapshots em `deals` e `weekly_payments`, mas nao existe uma configuracao completa por vendedor.
- Bonus de renovacao ainda nao existe como regra estruturada.
- Comissao por upgrade de plano ainda nao existe como regra estruturada.
- Regra de pagamento ainda nao diferencia claramente pagamento semanal conforme cliente paga versus acumulado no mes seguinte.
- `leads.assigned_to` e `clients.assigned_to` apontam para `profiles.id`, enquanto comissoes usam `sellers.id`.
- `assigned_name` e usado para exibicao e agrupamentos, mas nao e uma chave confiavel para calculo financeiro.
- Lucas aparece como responsavel padrao em alguns fluxos, mas a relacao entre Lucas usuario, Lucas vendedor e dados reais ainda precisa ser formalizada.

## Novo modelo por colaborador/vendedor

O modelo recomendado e manter `sellers` como entidade operacional do colaborador/vendedor e criar uma tabela aditiva de configuracao de remuneracao.

Tabela futura sugerida:

```txt
collaborator_compensation_settings
```

Campos recomendados:

- `id`
- `team_id`
- `seller_id`
- `fixed_salary_enabled`
- `fixed_salary_monthly_usd`
- `contract_commission_enabled`
- `contract_commission_type`
- `contract_commission_value`
- `meeting_commission_enabled`
- `meeting_commission_type`
- `meeting_commission_value`
- `renewal_bonus_enabled`
- `renewal_bonus_type`
- `renewal_bonus_value`
- `upgrade_commission_enabled`
- `upgrade_commission_type`
- `upgrade_commission_value`
- `upgrade_commission_base`
- `payment_rule`
- `effective_from`
- `created_at`
- `updated_at`

Tipos recomendados:

```txt
commission_type:
- percentage
- fixed

upgrade_commission_base:
- full_value
- plan_difference

payment_rule:
- weekly_as_client_pays
- next_month_after_completion
```

Essa tabela deve ser versionada por vigencia, preservando historico. Mudancas futuras nao devem recalcular automaticamente pagamentos passados.

## Salario fixo

Regra desejada:

- Cada colaborador pode ter salario fixo mensal.
- O valor deve ser configuravel por colaborador.
- O valor deve possuir vigencia.
- Historico antigo deve permanecer imutavel.

Compatibilidade:

- `seller_salaries` ja atende parte dessa regra.
- A tabela futura pode substituir ou complementar `seller_salaries`.
- Uma primeira migration pode manter `seller_salaries` como fonte atual e criar a nova configuracao sem apagar nada.

## Comissao por contrato

Regra desejada:

- Cada colaborador pode ter comissao por contrato.
- Tipo pode ser porcentagem ou valor fixo.
- Valor deve ser configuravel por colaborador.

Exemplos:

- Porcentagem: 10% do valor semanal ou total definido pela regra do contrato.
- Valor fixo: USD 25 por semana recebida ou valor fixo por contrato, conforme regra definida no service.

Compatibilidade:

- Hoje `deals.valor_por_semana_usd` e `weekly_payments.valor_usd` congelam valores.
- O novo modelo deve congelar snapshots no momento da geracao do evento financeiro.
- Pagamentos antigos nao devem ser recalculados.

## Comissao por reuniao

Regra desejada:

- Pode ser habilitada ou desabilitada por colaborador.
- Tipo pode ser porcentagem ou valor fixo.
- Valor deve ser configuravel.

Compatibilidade:

- Hoje `meetings.valor_usd` guarda um valor congelado.
- O novo modelo pode continuar gravando o valor final em `meetings.valor_usd`.
- A diferenca e que o valor passa a ser calculado pelo service a partir da configuracao do colaborador.

## Bonus de renovacao de contrato

Regra desejada:

- Pode ser habilitado ou desabilitado por colaborador.
- Tipo pode ser porcentagem ou valor fixo.
- Valor deve ser configuravel.
- Deve estar vinculado a um evento de renovacao de contrato.

Necessidade futura:

- Criar uma forma estruturada de registrar renovacoes.
- Evitar misturar renovacao com venda inicial.
- Preservar snapshots do valor calculado no momento do evento.

## Comissao de upgrade de plano

Regra desejada:

- Pode ser habilitada ou desabilitada por colaborador.
- Tipo pode ser porcentagem ou valor fixo.
- Pode incidir sobre a diferenca entre planos.

Exemplo:

```txt
Plano anterior: USD 140
Plano novo:     USD 190
Diferenca:      USD 50
Comissao:       percentual ou valor fixo sobre USD 50
```

Modelo recomendado:

- Registrar evento de upgrade com plano anterior, plano novo, valor anterior, valor novo e diferenca.
- Calcular comissao no service.
- Gravar o resultado final como snapshot financeiro.

## Regra de pagamento

Cada colaborador deve poder ter uma regra de pagamento:

```txt
weekly_as_client_pays
```

Paga conforme o cliente paga semanalmente. Essa e a regra mais proxima do comportamento atual com `client_payments` e `weekly_payments`.

```txt
next_month_after_completion
```

Acumula a comissao e paga tudo no mes seguinte apos o cliente terminar de pagar.

Essa regra exige cuidado porque muda o momento de reconhecimento da comissao. O ideal e separar:

- evento que gera direito a comissao;
- evento que marca comissao como pagavel;
- evento que marca comissao como paga.

## `seller_id` em leads e clients

Recomendacao:

- Adicionar `seller_id` nullable em `leads`.
- Adicionar `seller_id` nullable em `clients`.
- Manter `assigned_to` e `assigned_name` temporariamente por compatibilidade.

Motivo:

- `assigned_to` aponta para `profiles.id`.
- Comissoes, vendas, reunioes e dashboards usam `sellers.id`.
- Para calculo financeiro confiavel, leads e clientes precisam apontar para o vendedor operacional.

Modelo transitorio:

```txt
leads.assigned_to     -> profiles.id, legado/compatibilidade
leads.assigned_name   -> texto de exibicao
leads.seller_id       -> sellers.id, fonte futura para comissoes

clients.assigned_to   -> profiles.id, legado/compatibilidade
clients.assigned_name -> texto de exibicao
clients.seller_id     -> sellers.id, fonte futura para comissoes
```

## Lucas como vendedor padrao

Regra desejada:

- Lucas deve permanecer como vendedor padrao enquanto for o unico vendedor.
- Todos os leads e clientes atuais devem ser vinculados ao Lucas como responsavel comercial.
- Novos leads e clientes devem continuar usando Lucas como padrao ate existir outra regra de distribuicao.

Cuidados:

- Nao usar nome em texto como unica fonte para calculo financeiro.
- Garantir que existe um registro `sellers` para Lucas.
- Relacionar dados atuais ao `seller_id` do Lucas sem apagar nem sobrescrever historico sensivel.

## Backfill seguro dos dados atuais para Lucas

Futura migration deve ser aditiva e idempotente:

1. Garantir existencia do vendedor Lucas em `sellers`.
2. Adicionar `seller_id` nullable em `leads` e `clients`.
3. Fazer backfill apenas onde `seller_id is null`.
4. Preencher `seller_id` com o ID do vendedor Lucas.
5. Nao alterar registros que ja possuam `seller_id`.
6. Nao apagar `assigned_to` nem `assigned_name`.
7. Nao apagar ou recriar `deals`, `weekly_payments`, `meetings`, `client_payments` ou `commissions`.
8. Preservar todos os `team_id` existentes.

## Plano de migrations futuras

Ordem recomendada:

1. Criar tabela de configuracao de remuneracao por colaborador.
2. Criar configuracao inicial do Lucas equivalente ao comportamento atual.
3. Adicionar `seller_id` nullable em `leads` e `clients`.
4. Backfill seguro para Lucas apenas em registros sem `seller_id`.
5. Adicionar indices por `team_id` e `seller_id`.
6. Criar tabelas/eventos futuros para renovacao e upgrade se necessario.
7. Somente depois avaliar RLS especifica por equipe e vendedor.

Todas as migrations devem seguir:

- `create table if not exists`;
- `alter table add column if not exists`;
- backfill apenas em campos nulos;
- sem `drop table`;
- sem `truncate`;
- sem recriar tabelas reais;
- sem trocar IDs existentes.

## Plano de UI futura

Area planejada:

```txt
Configuracoes
└── Colaboradores
    └── [Nome do colaborador]
        └── Ajuste de recebimento
```

Controles desejados:

- Salario fixo mensal.
- Comissao por contrato.
- Comissao por reuniao.
- Bonus de renovacao.
- Comissao de upgrade.
- Regra de pagamento.
- Historico de vigencias.

A UI deve deixar claro:

- o que esta habilitado;
- qual tipo de calculo sera usado;
- qual valor esta configurado;
- desde quando a regra vale;
- se uma alteracao afeta apenas eventos futuros.

## Dashboards e metricas do vendedor

Adaptacoes futuras:

- O dashboard do vendedor deve ler a configuracao de remuneracao vigente.
- Metricas devem separar salario, contrato, reuniao, renovacao e upgrade.
- Graficos devem mostrar evolucao mensal por categoria.
- Relatorios devem explicar a regra aplicada em cada linha.
- Eventos antigos devem continuar mostrando valores congelados da epoca.

Indicadores recomendados:

- Total a receber no mes.
- Comissao por contratos.
- Comissao por reunioes.
- Bonus por renovacao.
- Comissao por upgrades.
- Salario fixo.
- Receita gerada por clientes do vendedor.
- Conversao de leads em clientes.
- Evolucao mensal.

## Primeira etapa segura de implementacao

Primeira etapa recomendada apos esta documentacao:

1. Criar migration aditiva para `collaborator_compensation_settings`.
2. Criar configuracao inicial para Lucas sem alterar calculos existentes.
3. Validar que a migration roda mais de uma vez sem efeito colateral.
4. Nao integrar UI ainda.
5. Nao recalcular historico.

Somente depois disso deve-se iniciar repositories/services de remuneracao e a UI de Ajuste de recebimento.
