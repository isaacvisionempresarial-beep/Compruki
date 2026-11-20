-- COMPRUKI · conexión Dropi y cola de envío (Etapa 3)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql. No guarda contraseñas ni tokens.
-- Dropi sigue sin estar conectado: la cola nace bloqueada.

create table if not exists public.provider_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null check (provider in ('dropi')),
  status text not null default 'sin_autorizacion' check (status in ('sin_autorizacion', 'lista_para_oauth', 'autorizada')),
  scopes text not null default '',
  credential_ref text,
  last_checked_at timestamptz,
  detail text not null default '',
  unique (tenant_id, provider)
);

create table if not exists public.provider_order_links (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  order_id text not null,
  order_number text not null,
  provider text not null check (provider in ('dropi')),
  external_order_id text,
  idempotency_key text not null,
  sync_status text not null default 'bloqueado' check (sync_status in ('bloqueado', 'listo', 'enviado', 'incidencia')),
  created_at timestamptz not null default now(),
  unique (tenant_id, provider, order_id),
  unique (tenant_id, provider, idempotency_key)
);

create index if not exists provider_order_links_tenant_idx on public.provider_order_links (tenant_id, created_at desc);

create table if not exists public.integration_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  job_type text not null check (job_type in ('enviar_pedido')),
  status text not null default 'bloqueado' check (status in ('bloqueado', 'listo', 'enviado', 'incidencia')),
  attempts integer not null default 0 check (attempts >= 0),
  next_run_at timestamptz,
  correlation_id text not null,
  order_number text not null,
  idempotency_key text not null,
  last_detail text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, idempotency_key)
);

create index if not exists integration_jobs_tenant_idx on public.integration_jobs (tenant_id, created_at desc);

alter table public.provider_connections enable row level security;
alter table public.provider_order_links enable row level security;
alter table public.integration_jobs enable row level security;

drop policy if exists provider_connections_member on public.provider_connections;
create policy provider_connections_member on public.provider_connections
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = provider_connections.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = provider_connections.tenant_id and m.user_id = auth.uid()
    )
  );

drop policy if exists provider_order_links_member on public.provider_order_links;
create policy provider_order_links_member on public.provider_order_links
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = provider_order_links.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = provider_order_links.tenant_id and m.user_id = auth.uid()
    )
  );

drop policy if exists integration_jobs_member on public.integration_jobs;
create policy integration_jobs_member on public.integration_jobs
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = integration_jobs.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = integration_jobs.tenant_id and m.user_id = auth.uid()
    )
  );

insert into public.provider_connections (tenant_id, provider, status, scopes, detail)
select t.id, 'dropi', 'sin_autorizacion', '', 'Sin autorización. No hay token ni contraseña guardados. La cola no crea órdenes en Dropi.'
from public.tenants t
where t.slug = 'tienda-piloto'
on conflict (tenant_id, provider) do nothing;
