-- COMPRUKI · cuentas de comprador (tienda)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql y 002_catalog_orders.sql.

create table if not exists public.customer_profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  display_name text not null default '',
  phone text not null default '',
  email_order_updates boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists customer_profiles_tenant_idx
  on public.customer_profiles (tenant_id);

create table if not exists public.customer_cart_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sku text not null,
  quantity integer not null check (quantity > 0 and quantity <= 5),
  variant text not null default '',
  size_kind text,
  updated_at timestamptz not null default now(),
  unique (user_id, tenant_id, sku, variant)
);

create index if not exists customer_cart_items_user_idx
  on public.customer_cart_items (user_id, tenant_id);

alter table public.orders
  add column if not exists customer_user_id uuid references auth.users (id) on delete set null;

create index if not exists orders_tenant_customer_idx
  on public.orders (tenant_id, customer_user_id)
  where customer_user_id is not null;

alter table public.customer_profiles enable row level security;
alter table public.customer_cart_items enable row level security;

drop policy if exists customer_profiles_own on public.customer_profiles;
create policy customer_profiles_own on public.customer_profiles
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists customer_cart_items_own on public.customer_cart_items;
create policy customer_cart_items_own on public.customer_cart_items
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Miembros del panel pueden leer perfiles de su tenant (soporte).
drop policy if exists customer_profiles_member_select on public.customer_profiles;
create policy customer_profiles_member_select on public.customer_profiles
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = customer_profiles.tenant_id and m.user_id = auth.uid()
    )
  );
