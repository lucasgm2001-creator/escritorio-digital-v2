create table if not exists public.leads (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  company text,
  email text,
  phone text,
  value numeric default 0,
  status text not null default 'novo' check (status in ('novo','interagiu','reuniao','proposta','fechado','nao_interagiu','perdido')),
  score integer not null default 500,
  operation text not null default 'brasil' check (operation in ('brasil', 'eua')),
  assigned_to uuid references public.profiles(id),
  assigned_name text,
  notes text,
  last_contact_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Interações com o lead
create table if not exists public.lead_interactions (
  id uuid default gen_random_uuid() primary key,
  lead_id uuid references public.leads(id) on delete cascade not null,
  type text not null check (type in ('atendeu','nao_atendeu','mensagem','reuniao','proposta','nota','sistema')),
  note text,
  score_delta integer default 0,
  created_by uuid references public.profiles(id),
  created_by_name text,
  created_at timestamptz default now()
);

alter table public.leads enable row level security;
alter table public.lead_interactions enable row level security;

create policy "Auth lê leads" on public.leads for select using (auth.role() = 'authenticated');
create policy "Auth insere leads" on public.leads for insert with check (auth.role() = 'authenticated');
create policy "Auth atualiza leads" on public.leads for update using (auth.role() = 'authenticated');

create policy "Auth lê interações" on public.lead_interactions for select using (auth.role() = 'authenticated');
create policy "Auth insere interações" on public.lead_interactions for insert with check (auth.role() = 'authenticated');

-- Realtime
alter publication supabase_realtime add table public.leads;
alter publication supabase_realtime add table public.lead_interactions;
