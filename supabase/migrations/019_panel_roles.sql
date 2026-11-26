-- COMPRUKI · roles parametrizables + memberships.role_id
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql.

create table if not exists public.panel_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  key text not null,
  label text not null,
  description text not null default '',
  permissions jsonb not null default '{}'::jsonb,
  is_system boolean not null default false,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, key),
  check (key ~ '^[a-z][a-z0-9_]{1,40}$'),
  check (char_length(trim(label)) between 2 and 80)
);

create index if not exists panel_roles_tenant_idx
  on public.panel_roles (tenant_id, active, label);

alter table public.memberships
  add column if not exists role_id uuid references public.panel_roles (id);

-- Semilla por tenant: Propietario / Operador / Atención
insert into public.panel_roles (tenant_id, key, label, description, permissions, is_system, active)
select
  t.id,
  'owner',
  'Propietario',
  'Acceso completo a la tienda y al equipo.',
  '{
    "orders_money": true,
    "catalog_manage": true,
    "agents_manage": true,
    "store_settings": true,
    "users_manage": true,
    "backups": true,
    "whatsapp_manage": true
  }'::jsonb,
  true,
  true
from public.tenants t
on conflict (tenant_id, key) do nothing;

insert into public.panel_roles (tenant_id, key, label, description, permissions, is_system, active)
select
  t.id,
  'operator',
  'Operador',
  'Pedidos y operación diaria sin dinero sensible ni catálogo crítico.',
  '{
    "orders_money": false,
    "catalog_manage": false,
    "agents_manage": false,
    "store_settings": false,
    "users_manage": false,
    "backups": false,
    "whatsapp_manage": true
  }'::jsonb,
  true,
  true
from public.tenants t
on conflict (tenant_id, key) do nothing;

insert into public.panel_roles (tenant_id, key, label, description, permissions, is_system, active)
select
  t.id,
  'atencion',
  'Atención',
  'Pedidos, clientes y WhatsApp. Sin dinero, catálogo sensible ni equipo.',
  '{
    "orders_money": false,
    "catalog_manage": false,
    "agents_manage": false,
    "store_settings": false,
    "users_manage": false,
    "backups": false,
    "whatsapp_manage": true
  }'::jsonb,
  false,
  true
from public.tenants t
on conflict (tenant_id, key) do nothing;

-- Enlaza membresías existentes al rol sembrado según memberships.role
update public.memberships m
set role_id = r.id
from public.panel_roles r
where m.role_id is null
  and r.tenant_id = m.tenant_id
  and r.key = case when m.role = 'owner' then 'owner' else 'operator' end;

-- Cualquier membresía huérfana cae a operator del tenant
update public.memberships m
set role_id = r.id,
    role = 'operator'
from public.panel_roles r
where m.role_id is null
  and r.tenant_id = m.tenant_id
  and r.key = 'operator';

alter table public.panel_roles enable row level security;

drop policy if exists panel_roles_member_select on public.panel_roles;
create policy panel_roles_member_select on public.panel_roles
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = panel_roles.tenant_id and m.user_id = auth.uid()
    )
  );

-- Gestión de compañeros: solo service role en Server Actions (evita RLS recursivo en memberships).
