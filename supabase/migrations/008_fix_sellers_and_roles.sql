-- 008_fix_sellers_and_roles.sql
-- Execute este script no Supabase SQL Editor se:
--   (a) A aba Vendedores travar em "Carregando..."
--   (b) O botão "Adicionar Vendedor" não aparecer para Daniel

-- ============================================================
-- 1. Garante que a tabela sellers existe com todos os campos
-- ============================================================
create table if not exists public.sellers (
  id                uuid default gen_random_uuid() primary key,
  name              text not null,
  email             text,
  cargo             text,
  phone             text,
  status            text not null default 'ativo' check (status in ('ativo', 'inativo')),
  total_sales       numeric not null default 0,
  total_commissions numeric not null default 0,
  leads_assigned    integer not null default 0,
  conversion_rate   numeric not null default 0,
  created_at        timestamptz default now()
);

-- Coluna cargo (caso a tabela já existia sem ela)
alter table public.sellers add column if not exists cargo text;

-- RLS
alter table public.sellers enable row level security;

-- Remove políticas antigas para recriar limpas
drop policy if exists "Auth lê sellers"      on public.sellers;
drop policy if exists "Auth insere sellers"  on public.sellers;
drop policy if exists "Auth atualiza sellers" on public.sellers;

create policy "Auth lê sellers"       on public.sellers for select using (auth.role() = 'authenticated');
create policy "Auth insere sellers"   on public.sellers for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza sellers" on public.sellers for update using (auth.role() = 'authenticated');

-- ============================================================
-- 2. Corrige o role de Daniel para 'admin'
-- ============================================================
update public.profiles
set role = 'admin'
where email = 'daniel@drgrowth.com';

-- Verificação — deve retornar name='Daniel', role='admin'
select name, email, role from public.profiles where email = 'daniel@drgrowth.com';
