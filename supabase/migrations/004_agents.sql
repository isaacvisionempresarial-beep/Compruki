-- COMPRUKI · config y corridas de agentes (P0-IA esqueleto)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql. No conecta OpenAI ni Dropi.

create table if not exists public.agent_configs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id text not null,
  enabled boolean not null default false,
  monthly_budget_cop integer not null default 0 check (monthly_budget_cop >= 0),
  notes text not null default '',
  updated_at timestamptz not null default now(),
  unique (tenant_id, agent_id)
);

create index if not exists agent_configs_tenant_id_idx on public.agent_configs (tenant_id);

create table if not exists public.agent_runs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  agent_id text not null,
  status text not null check (status in ('queued', 'running', 'succeeded', 'failed', 'cancelled', 'awaiting_approval')),
  summary text not null default '',
  cost_estimate_cop integer not null default 0 check (cost_estimate_cop >= 0),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists agent_runs_tenant_created_idx on public.agent_runs (tenant_id, created_at desc);

alter table public.agent_configs enable row level security;
alter table public.agent_runs enable row level security;

drop policy if exists agent_configs_member on public.agent_configs;
create policy agent_configs_member on public.agent_configs
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = agent_configs.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = agent_configs.tenant_id and m.user_id = auth.uid()
    )
  );

drop policy if exists agent_runs_member on public.agent_runs;
create policy agent_runs_member on public.agent_runs
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = agent_runs.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = agent_runs.tenant_id and m.user_id = auth.uid()
    )
  );

-- Semilla de roles P0-IA deshabilitados para el tenant piloto.
insert into public.agent_configs (tenant_id, agent_id, enabled, monthly_budget_cop, notes)
select t.id, a.agent_id, false, 0, 'Esqueleto. OpenAI no está conectado.'
from public.tenants t
cross join (
  values
    ('AG-01'),
    ('AG-02'),
    ('AG-03'),
    ('AG-04')
) as a(agent_id)
where t.slug = 'tienda-piloto'
on conflict (tenant_id, agent_id) do nothing;
