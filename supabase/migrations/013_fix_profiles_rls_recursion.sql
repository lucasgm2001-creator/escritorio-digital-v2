-- 013_fix_profiles_rls_recursion.sql
-- CRÍTICO. Corrige recursão infinita de RLS (Postgres 42P17) na tabela profiles.
--
-- A policy "Admin lê todos" (migration 001) fazia:
--     using ( exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') )
-- ou seja, uma subquery EM profiles dentro de uma policy DE profiles. Ao avaliar
-- qualquer SELECT em profiles, o Postgres reentra na própria policy → recursão →
-- ERRO "infinite recursion detected in policy for relation profiles". Resultado:
-- TODA leitura autenticada de profiles falha (o role nunca carrega), o que causava
-- o menu só-Hall e, com o hard-fail do layout, o loop de redirecionamento.
--
-- Solução: checar admin via função SECURITY DEFINER, que executa como owner e
-- NÃO dispara a RLS de profiles (sem recursão).
-- Idempotente.

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.profiles where id = auth.uid() and role = 'admin'
  )
$$;

revoke all on function public.is_admin() from public;
grant execute on function public.is_admin() to authenticated, anon;

-- Recria a policy de admin sem recursão.
drop policy if exists "Admin lê todos" on public.profiles;
create policy "Admin lê todos" on public.profiles
  for select using (public.is_admin());

-- A policy "Usuário lê próprio perfil" (auth.uid() = id) permanece e já cobre
-- o caso crítico do layout: cada usuário lê a própria linha (name, role).

-- Verificação: deve retornar SEM erro de recursão.
select id, email, role from public.profiles order by email;
