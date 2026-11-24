-- COMPRUKI · seguimientos CRM lite (AG-07)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql. No conecta WhatsApp ni envía mensajes.

create table if not exists public.followup_tasks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  phone text not null,
  customer_name text not null default '',
  order_number text not null default '',
  note text not null default '',
  status text not null default 'open' check (status in ('open', 'done', 'dismissed')),
  created_by text not null default '',
  resolved_by text not null default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists followup_tasks_tenant_open_idx
  on public.followup_tasks (tenant_id, status, created_at desc);

create index if not exists followup_tasks_tenant_phone_idx
  on public.followup_tasks (tenant_id, phone, created_at desc);

alter table public.followup_tasks enable row level security;

drop policy if exists followup_tasks_member on public.followup_tasks;
create policy followup_tasks_member on public.followup_tasks
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = followup_tasks.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = followup_tasks.tenant_id and m.user_id = auth.uid()
    )
  );

-- AG-07 activo en piloto local.
insert into public.agent_configs (tenant_id, agent_id, enabled, monthly_budget_cop, notes)
select t.id, 'AG-07', true, 0, 'Piloto local: borradores y seguimientos CRM. WhatsApp no está conectado.'
from public.tenants t
where t.slug = 'tienda-piloto'
on conflict (tenant_id, agent_id) do nothing;
