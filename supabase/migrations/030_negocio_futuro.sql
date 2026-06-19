-- 030_negocio_futuro.sql
-- Semeia a fase "Negócio Futuro" no funil configurável (funnel_stages, criada em 028).
-- OPCIONAL / idempotente: a aba "Fases" no Comercial também cria fases pela UI.
-- NÃO mexe em dinheiro: nasce neutra (is_won/is_lost/is_system = false), então não
-- dispara o won-flow nem entra em qualquer cálculo de comissão.
-- Posição = fim do funil (max+1); reordene pela aba Fases depois.

insert into public.funnel_stages
  (slug, nome, posicao, is_won, is_lost, is_system, conta_interagiu, conta_reuniao, conta_fechou, arquivada)
select
  'negocio_futuro', 'Negócio Futuro',
  coalesce((select max(posicao) from public.funnel_stages), 0) + 1,
  false, false, false,
  true,  false, false,   -- conta como "interagiu" no relatório; reunião/fechou = não
  false
where not exists (
  select 1 from public.funnel_stages where slug = 'negocio_futuro'
);
