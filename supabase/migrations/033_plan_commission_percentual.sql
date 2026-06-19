-- 033_plan_commission_percentual.sql
-- Comissão configurável por plano (Fase 2A). Idempotente.
-- ⚠️ JÁ aplicada em produção via MCP — este arquivo existe só pra o REPO bater com o banco.
--    NÃO precisa rodar de novo.
--
-- comissao_percentual = % do valor semanal do plano que vira comissão do vendedor.
--   - plans.comissao_percentual  → configurado na tela de Planos (Configurações).
--   - deals.comissao_percentual  → foto do % usado no fechamento (auditoria).
-- null = LEGADO: comissão segue US$25/semana fixo. NÃO recalcula nada existente.

alter table public.plans add column if not exists comissao_percentual numeric;
alter table public.deals add column if not exists comissao_percentual numeric;
