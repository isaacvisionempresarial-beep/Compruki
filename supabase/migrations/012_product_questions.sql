-- COMPRUKI · preguntas de ficha derivadas a humano (AG-05 lite)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql. No conecta OpenAI ni WhatsApp.

create table if not exists public.product_questions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  product_sku text not null,
  question text not null,
  auto_reply text not null default '',
  status text not null default 'open' check (status in ('open', 'answered', 'dismissed')),
  answered_line text not null default '',
  resolved_by text not null default '',
  resolved_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists product_questions_tenant_open_idx
  on public.product_questions (tenant_id, status, created_at desc);

create index if not exists product_questions_tenant_sku_idx
  on public.product_questions (tenant_id, product_sku, created_at desc);

alter table public.product_questions enable row level security;

drop policy if exists product_questions_member on public.product_questions;
create policy product_questions_member on public.product_questions
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = product_questions.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = product_questions.tenant_id and m.user_id = auth.uid()
    )
  );

-- AG-05 activo en piloto local (sin OpenAI).
insert into public.agent_configs (tenant_id, agent_id, enabled, monthly_budget_cop, notes)
select t.id, 'AG-05', true, 0, 'Piloto local: handoff humano de preguntas de ficha. OpenAI no está conectado.'
from public.tenants t
where t.slug = 'tienda-piloto'
on conflict (tenant_id, agent_id) do nothing;
