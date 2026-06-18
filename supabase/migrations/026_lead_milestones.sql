-- 026_lead_milestones.sql  (PARA REVISÃO — NÃO RODADO)
-- Marcos do ciclo do lead p/ o RELATÓRIO (1x por lead por marco). NÃO mexe em dinheiro/comissão.
-- Idempotente.

create table if not exists public.lead_milestones (
  id          uuid primary key default gen_random_uuid(),
  lead_id     uuid not null references public.leads(id) on delete cascade,
  marco       text not null check (marco in ('interagiu','reuniao','fechou')),
  achieved_on timestamptz not null default now(),
  unique (lead_id, marco)
);
alter table public.lead_milestones enable row level security;

do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_milestones' and policyname='Auth le marcos') then
    create policy "Auth le marcos" on public.lead_milestones for select using (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_milestones' and policyname='Auth insere marcos') then
    create policy "Auth insere marcos" on public.lead_milestones for insert with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_milestones' and policyname='Auth atualiza marcos') then
    create policy "Auth atualiza marcos" on public.lead_milestones for update using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='lead_milestones' and policyname='Auth deleta marcos') then
    create policy "Auth deleta marcos" on public.lead_milestones for delete using (auth.role() = 'authenticated');
  end if;
end $$;

create index if not exists idx_lead_milestones_marco_data on public.lead_milestones (marco, achieved_on);

-- Vínculo reunião -> lead, p/ marcar 'reuniao' ao REGISTRAR uma reunião. NÃO muda a comissão.
alter table public.meetings add column if not exists lead_id uuid references public.leads(id) on delete set null;
create index if not exists idx_meetings_lead_id on public.meetings (lead_id);
