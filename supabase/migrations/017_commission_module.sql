-- 017_commission_module.sql
-- Módulo de Comissão — Fase 1 (schema). Modelo "long": uma linha por evento,
-- com a cotação USD->BRL CONGELADA em cada comissão (histórico imutável).
-- Moeda real do sistema = USD; BRL é só exibição (USD x cotação na data).
-- Idempotente. Rodar manualmente no Supabase. NÃO mexe na tabela `commissions` antiga.

-- ============================================================
-- 1. fx_config — cotação USD->BRL GLOBAL (linha única)
-- ============================================================
create table if not exists public.fx_config (
  id integer primary key default 1 check (id = 1),
  cotacao_manual numeric,                          -- valor manual (nullable)
  cotacao_travada boolean not null default false,  -- true = usa a manual em novos registros
  cotacao_referencia numeric,                      -- último valor automático conhecido (opcional)
  updated_at timestamptz default now()
);
insert into public.fx_config (id, cotacao_travada) values (1, false)
  on conflict (id) do nothing;

alter table public.fx_config enable row level security;
drop policy if exists "Auth lê fx_config"       on public.fx_config;
drop policy if exists "Auth insere fx_config"   on public.fx_config;
drop policy if exists "Auth atualiza fx_config" on public.fx_config;
create policy "Auth lê fx_config"       on public.fx_config for select using (auth.role() = 'authenticated');
create policy "Auth insere fx_config"   on public.fx_config for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza fx_config" on public.fx_config for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ============================================================
-- 2. seller_salaries — salário fixo (USD) por vendedor, COM VIGÊNCIA.
--    Aumento vale só pra frente; meses passados usam o valor da época.
-- ============================================================
create table if not exists public.seller_salaries (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid not null references public.sellers(id) on delete restrict,
  valor_usd numeric not null default 0,          -- salário mensal em USD
  effective_from date not null,                  -- 1º dia do mês em que passa a valer
  created_at timestamptz default now(),
  unique (seller_id, effective_from)
);
create index if not exists idx_seller_salaries_seller on public.seller_salaries (seller_id, effective_from);

alter table public.seller_salaries enable row level security;
drop policy if exists "Auth lê seller_salaries"       on public.seller_salaries;
drop policy if exists "Auth insere seller_salaries"   on public.seller_salaries;
drop policy if exists "Auth atualiza seller_salaries" on public.seller_salaries;
drop policy if exists "Auth deleta seller_salaries"   on public.seller_salaries;
create policy "Auth lê seller_salaries"       on public.seller_salaries for select using (auth.role() = 'authenticated');
create policy "Auth insere seller_salaries"   on public.seller_salaries for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza seller_salaries" on public.seller_salaries for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth deleta seller_salaries"   on public.seller_salaries for delete using (auth.role() = 'authenticated');

-- ============================================================
-- 3. deals — vendas (contratos de comissão). Valores em USD.
-- ============================================================
create table if not exists public.deals (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid not null references public.sellers(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  valor_total_usd numeric not null default 100,
  teto_semanas integer not null default 4 check (teto_semanas > 0),
  valor_por_semana_usd numeric not null default 25,  -- = valor_total / teto, congelado
  status text not null default 'em_andamento' check (status in ('em_andamento','interrompido','concluido')),
  data_fechamento date not null,                     -- informativo; NÃO define o mês das semanas
  created_at timestamptz default now()
);
create index if not exists idx_deals_seller on public.deals (seller_id);
create index if not exists idx_deals_status on public.deals (status);

alter table public.deals enable row level security;
drop policy if exists "Auth lê deals"       on public.deals;
drop policy if exists "Auth insere deals"   on public.deals;
drop policy if exists "Auth atualiza deals" on public.deals;
drop policy if exists "Auth deleta deals"   on public.deals;
create policy "Auth lê deals"       on public.deals for select using (auth.role() = 'authenticated');
create policy "Auth insere deals"   on public.deals for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza deals" on public.deals for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth deleta deals"   on public.deals for delete using (auth.role() = 'authenticated');

-- ============================================================
-- 4. weekly_payments — cada semana RECEBIDA (paid_on define o mês).
-- ============================================================
create table if not exists public.weekly_payments (
  id uuid default gen_random_uuid() primary key,
  deal_id uuid not null references public.deals(id) on delete cascade,
  numero_semana integer not null check (numero_semana >= 1),
  valor_usd numeric not null,                   -- = valor_por_semana, congelado
  paid_on date not null,                        -- data que o cliente pagou -> define o mês
  cotacao_usd_brl numeric not null,             -- cotação congelada no recebimento
  created_at timestamptz default now(),
  unique (deal_id, numero_semana)
);
create index if not exists idx_weekly_payments_deal    on public.weekly_payments (deal_id);
create index if not exists idx_weekly_payments_paid_on on public.weekly_payments (paid_on);

alter table public.weekly_payments enable row level security;
drop policy if exists "Auth lê weekly_payments"       on public.weekly_payments;
drop policy if exists "Auth insere weekly_payments"   on public.weekly_payments;
drop policy if exists "Auth atualiza weekly_payments" on public.weekly_payments;
drop policy if exists "Auth deleta weekly_payments"   on public.weekly_payments;
create policy "Auth lê weekly_payments"       on public.weekly_payments for select using (auth.role() = 'authenticated');
create policy "Auth insere weekly_payments"   on public.weekly_payments for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza weekly_payments" on public.weekly_payments for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth deleta weekly_payments"   on public.weekly_payments for delete using (auth.role() = 'authenticated');

-- ============================================================
-- 5. meetings — reuniões realizadas (met_on define o mês).
-- ============================================================
create table if not exists public.meetings (
  id uuid default gen_random_uuid() primary key,
  seller_id uuid not null references public.sellers(id) on delete restrict,
  client_id uuid references public.clients(id) on delete set null,
  client_name text,
  met_on date not null,                         -- data da reunião -> define o mês
  valor_usd numeric not null default 15,
  cotacao_usd_brl numeric not null,             -- cotação congelada
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_meetings_seller_met on public.meetings (seller_id, met_on);

alter table public.meetings enable row level security;
drop policy if exists "Auth lê meetings"       on public.meetings;
drop policy if exists "Auth insere meetings"   on public.meetings;
drop policy if exists "Auth atualiza meetings" on public.meetings;
drop policy if exists "Auth deleta meetings"   on public.meetings;
create policy "Auth lê meetings"       on public.meetings for select using (auth.role() = 'authenticated');
create policy "Auth insere meetings"   on public.meetings for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza meetings" on public.meetings for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "Auth deleta meetings"   on public.meetings for delete using (auth.role() = 'authenticated');

-- ============================================================
-- Verificação: deve listar as 5 tabelas novas.
-- ============================================================
select table_name from information_schema.tables
where table_schema = 'public'
  and table_name in ('fx_config','seller_salaries','deals','weekly_payments','meetings')
order by table_name;
