-- Atividades do sistema (feed em tempo real)
create table if not exists public.activities (
  id uuid default gen_random_uuid() primary key,
  type text not null check (type in ('lead', 'client', 'payment', 'task', 'campaign', 'system')),
  description text not null,
  user_id uuid references public.profiles(id),
  user_name text,
  entity_id text,
  created_at timestamptz default now()
);

alter table public.activities enable row level security;
create policy "Todos leem atividades" on public.activities for select using (auth.role() = 'authenticated');
create policy "Autenticados inserem atividades" on public.activities for insert with check (auth.role() = 'authenticated');

-- Mural de avisos
create table if not exists public.notices (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  content text not null,
  priority text not null default 'info' check (priority in ('info', 'warning', 'urgent')),
  author_id uuid references public.profiles(id),
  author_name text,
  expires_at timestamptz,
  created_at timestamptz default now()
);

alter table public.notices enable row level security;
create policy "Todos leem avisos" on public.notices for select using (auth.role() = 'authenticated');
create policy "Admin e gestor inserem avisos" on public.notices for insert with check (
  exists (select 1 from public.profiles where id = auth.uid() and role in ('admin'))
);

-- Enable realtime
alter publication supabase_realtime add table public.activities;
alter publication supabase_realtime add table public.notices;
