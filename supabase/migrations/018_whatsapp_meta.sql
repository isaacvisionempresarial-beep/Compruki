-- COMPRUKI · WhatsApp Meta Cloud API (Fase 1)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql.
-- Credenciales sensibles van en Railway (META_WA_*). Aquí solo estado y mensajes.

create table if not exists public.whatsapp_connections (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  provider text not null default 'meta_cloud' check (provider in ('meta_cloud')),
  status text not null default 'sin_configurar'
    check (status in ('sin_configurar', 'configurada', 'verificada', 'error')),
  phone_number_id text,
  business_account_id text,
  display_phone_number text not null default '',
  verified_name text not null default '',
  quality_rating text not null default '',
  last_checked_at timestamptz,
  last_inbound_at timestamptz,
  last_error text not null default '',
  detail text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, provider)
);

create table if not exists public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  wa_message_id text not null,
  direction text not null check (direction in ('inbound', 'outbound')),
  phone text not null,
  contact_name text not null default '',
  body text not null default '',
  message_type text not null default 'text',
  delivery_status text not null default 'received'
    check (delivery_status in ('received', 'sent', 'delivered', 'read', 'failed', 'ignored')),
  delivery_detail text not null default '',
  created_by text not null default '',
  created_at timestamptz not null default now(),
  unique (tenant_id, wa_message_id)
);

create index if not exists whatsapp_messages_tenant_created_idx
  on public.whatsapp_messages (tenant_id, created_at desc);

create index if not exists whatsapp_messages_tenant_phone_idx
  on public.whatsapp_messages (tenant_id, phone, created_at desc);

alter table public.whatsapp_connections enable row level security;
alter table public.whatsapp_messages enable row level security;

drop policy if exists whatsapp_connections_member on public.whatsapp_connections;
create policy whatsapp_connections_member on public.whatsapp_connections
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = whatsapp_connections.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = whatsapp_connections.tenant_id and m.user_id = auth.uid()
    )
  );

drop policy if exists whatsapp_messages_member on public.whatsapp_messages;
create policy whatsapp_messages_member on public.whatsapp_messages
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = whatsapp_messages.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = whatsapp_messages.tenant_id and m.user_id = auth.uid()
    )
  );

insert into public.whatsapp_connections (tenant_id, provider, status, detail)
select
  t.id,
  'meta_cloud',
  'sin_configurar',
  'Sin Meta Cloud API. Configura META_WA_* en Railway y verifica desde el panel.'
from public.tenants t
where t.slug = 'tienda-piloto'
on conflict (tenant_id, provider) do nothing;
