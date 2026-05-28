create table if not exists public.clients (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  plan_weekly numeric not null default 140,
  status text not null default 'ativo' check (status in ('ativo', 'inativo', 'prospect')),
  start_date date,
  end_date date,
  end_reason text,
  assigned_to uuid references public.profiles(id),
  assigned_name text,
  jobs text[],
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.clients enable row level security;
create policy "Auth lê clientes" on public.clients for select using (auth.role() = 'authenticated');
create policy "Auth insere clientes" on public.clients for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza clientes" on public.clients for update using (auth.role() = 'authenticated');

alter publication supabase_realtime add table public.clients;
