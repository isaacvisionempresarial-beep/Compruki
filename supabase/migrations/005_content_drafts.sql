-- COMPRUKI · borradores de contenido (AG-03, plantillas; sin OpenAI)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql

create table if not exists public.content_drafts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_sku text not null,
  channel text not null check (channel in ('ficha', 'anuncio', 'whatsapp')),
  title text not null default '',
  body text not null default '',
  cta text not null default '',
  source text not null default 'plantilla',
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists content_drafts_tenant_sku_idx
  on public.content_drafts (tenant_id, product_sku, created_at desc);

alter table public.content_drafts enable row level security;

drop policy if exists content_drafts_member on public.content_drafts;
create policy content_drafts_member on public.content_drafts
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = content_drafts.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = content_drafts.tenant_id and m.user_id = auth.uid()
    )
  );
