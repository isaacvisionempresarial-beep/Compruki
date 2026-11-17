-- COMPRUKI · esquema mínimo multi-tenant (Etapa 1)
-- Ejecutar en Supabase → SQL Editor → New query → Run

create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  created_at timestamptz not null default now()
);

create table if not exists public.memberships (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null check (role in ('owner', 'operator')),
  created_at timestamptz not null default now(),
  unique (tenant_id, user_id)
);

create index if not exists memberships_user_id_idx on public.memberships (user_id);
create index if not exists memberships_tenant_id_idx on public.memberships (tenant_id);

alter table public.tenants enable row level security;
alter table public.memberships enable row level security;

-- Un usuario solo ve tenants donde es miembro.
drop policy if exists tenants_select_member on public.tenants;
create policy tenants_select_member on public.tenants
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = tenants.id and m.user_id = auth.uid()
    )
  );

drop policy if exists memberships_select_own on public.memberships;
create policy memberships_select_own on public.memberships
  for select
  using (user_id = auth.uid());

-- Tenant piloto (ajusta el nombre si quieres).
insert into public.tenants (name, slug)
values ('Tienda piloto', 'tienda-piloto')
on conflict (slug) do nothing;
