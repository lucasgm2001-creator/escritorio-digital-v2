-- Garante que Daniel tem role 'admin' na tabela profiles
-- Rode este script no Supabase SQL Editor se o botão "Adicionar Vendedor" não aparecer

update public.profiles
set role = 'admin'
where email = 'daniel@drgrowth.com';

-- Verificação: deve retornar name='Daniel', role='admin'
select name, email, role from public.profiles where email = 'daniel@drgrowth.com';
