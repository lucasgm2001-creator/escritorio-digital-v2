-- Insere (ou atualiza) os perfis vinculando pelo id do auth.users
-- Execute no SQL Editor do Supabase Dashboard

insert into public.profiles (id, email, name, role)
select
  u.id,
  u.email,
  case u.email
    when 'daniel@drgrowth.com'   then 'Daniel'
    when 'lucas@drgrowth.com'    then 'Lucas'
    when 'gabriel@drgrowth.com'  then 'Gabriel'
    when 'thamyris@drgrowth.com' then 'Thamyris'
  end as name,
  case u.email
    when 'daniel@drgrowth.com'   then 'admin'
    when 'lucas@drgrowth.com'    then 'comercial'
    when 'gabriel@drgrowth.com'  then 'trafego'
    when 'thamyris@drgrowth.com' then 'financeiro'
  end as role
from auth.users u
where u.email in (
  'daniel@drgrowth.com',
  'lucas@drgrowth.com',
  'gabriel@drgrowth.com',
  'thamyris@drgrowth.com'
)
on conflict (id) do update set
  name  = excluded.name,
  role  = excluded.role,
  email = excluded.email;

-- Confirma o resultado
select id, email, name, role from public.profiles order by name;
