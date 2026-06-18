-- 027_news.sql  (JÁ APLICADA no banco — documentação, idempotente)
-- Notícias automáticas do setor (web_search). Escrita SÓ via service-role (rota /api/news/refresh).
-- NÃO mexe em dinheiro.

create table if not exists public.news (
  id           uuid primary key default gen_random_uuid(),
  titulo       text not null,
  categoria    text,                              -- licencas | construcao | imigracao | house_cleaning | servicos
  estados      text[] not null default '{}',      -- ['MA','NJ',...] ou ['US']
  severidade   text not null default 'media' check (severidade in ('critico','alta','media')),
  resumo       text,
  impacto      text,
  fonte_url    text,
  fonte_nome   text,
  published_at timestamptz,
  fetched_at   timestamptz not null default now(),
  created_at   timestamptz not null default now()
);
alter table public.news enable row level security;

-- Leitura: qualquer autenticado. Escrita: SÓ service-role (ignora RLS) → sem policy de insert de propósito.
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='news' and policyname='Auth le news') then
    create policy "Auth le news" on public.news for select using (auth.role() = 'authenticated');
  end if;
end $$;

-- Dedup: 1 matéria por URL (índice parcial — ignora linhas sem url).
create unique index if not exists uq_news_fonte_url on public.news (fonte_url) where fonte_url is not null;
create index if not exists idx_news_fetched   on public.news (fetched_at desc);
create index if not exists idx_news_published  on public.news (published_at desc);
create index if not exists idx_news_categoria  on public.news (categoria);

-- Realtime: adiciona news na publication (guarda se já estiver lá).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'news'
  ) then
    alter publication supabase_realtime add table public.news;
  end if;
end $$;
