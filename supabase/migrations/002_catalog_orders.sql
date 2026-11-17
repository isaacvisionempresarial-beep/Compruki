-- COMPRUKI · catálogo y pedidos por tenant (Etapa 2)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql ya aplicado.

create table if not exists public.products (
  id text primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  sku text not null,
  published boolean not null default false,
  available boolean not null default true,
  updated_at timestamptz not null default now(),
  document jsonb not null,
  unique (tenant_id, sku)
);

create index if not exists products_tenant_id_idx on public.products (tenant_id);
create index if not exists products_tenant_published_idx on public.products (tenant_id, published);

create table if not exists public.orders (
  id text primary key,
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  number text not null,
  phone text not null,
  idempotency_key text not null,
  created_at timestamptz not null default now(),
  document jsonb not null,
  unique (tenant_id, number),
  unique (tenant_id, idempotency_key)
);

create index if not exists orders_tenant_id_idx on public.orders (tenant_id);
create index if not exists orders_tenant_created_idx on public.orders (tenant_id, created_at desc);
create index if not exists orders_tenant_phone_idx on public.orders (tenant_id, phone);

alter table public.products enable row level security;
alter table public.orders enable row level security;

-- Miembros del tenant: lectura y escritura del catálogo.
drop policy if exists products_select_member on public.products;
create policy products_select_member on public.products
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = products.tenant_id and m.user_id = auth.uid()
    )
  );

drop policy if exists products_write_member on public.products;
create policy products_write_member on public.products
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = products.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = products.tenant_id and m.user_id = auth.uid()
    )
  );

-- Miembros del tenant: lectura y escritura de pedidos.
drop policy if exists orders_select_member on public.orders;
create policy orders_select_member on public.orders
  for select
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = orders.tenant_id and m.user_id = auth.uid()
    )
  );

drop policy if exists orders_write_member on public.orders;
create policy orders_write_member on public.orders
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = orders.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = orders.tenant_id and m.user_id = auth.uid()
    )
  );

-- La tienda pública y las Server Actions usan service role (omite RLS).
-- Las políticas de arriba protegen acceso directo con la clave anon.
