-- Rode este script DEPOIS de criar os 4 usuários no Supabase Auth Dashboard
-- Substitua os UUIDs pelos IDs reais gerados pelo Supabase

-- Para criar os usuários: Authentication > Users > Add User
-- daniel@drgrowth.com  | senha: DRGrowth@2025
-- lucas@drgrowth.com   | senha: DRGrowth@2025
-- gabriel@drgrowth.com | senha: DRGrowth@2025
-- thamyris@drgrowth.com| senha: DRGrowth@2025

-- Após criar, atualize os perfis com nome e role corretos:
update public.profiles set name = 'Daniel',   role = 'admin'      where email = 'daniel@drgrowth.com';
update public.profiles set name = 'Lucas',    role = 'comercial'  where email = 'lucas@drgrowth.com';
update public.profiles set name = 'Gabriel',  role = 'trafego'    where email = 'gabriel@drgrowth.com';
update public.profiles set name = 'Thamyris', role = 'financeiro' where email = 'thamyris@drgrowth.com';
