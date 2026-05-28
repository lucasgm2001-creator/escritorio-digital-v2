-- Tabela de perfis vinculada ao Supabase Auth
create table if not exists public.profiles (
  id uuid references auth.users(id) on delete cascade primary key,
  name text not null,
  role text not null check (role in ('admin', 'comercial', 'trafego', 'financeiro')),
  avatar text,
  email text,
  created_at timestamptz default now()
);

-- RLS
alter table public.profiles enable row level security;

create policy "Usuário lê próprio perfil" on public.profiles
  for select using (auth.uid() = id);

create policy "Usuário atualiza próprio perfil" on public.profiles
  for update using (auth.uid() = id);

-- Admin lê todos os perfis
create policy "Admin lê todos" on public.profiles
  for select using (
    exists (
      select 1 from public.profiles where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger: cria perfil automaticamente ao criar usuário
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, name, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'role', 'comercial')
  );
  return new;
end;
$$;

create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
