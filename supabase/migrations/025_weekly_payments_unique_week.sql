-- 025_weekly_payments_unique_week.sql
-- JA APLICADA no banco — arquivo de DOCUMENTACAO (NAO RODAR de novo).
-- Trava no banco contra semana duplicada do mesmo deal: uma semana (numero_semana)
-- só pode existir uma vez por venda (deal_id). Recusa corrida de 2 cliques / duplicação.
-- Idempotente.

create unique index if not exists uq_weekly_payments_deal_semana
  on public.weekly_payments (deal_id, numero_semana);
