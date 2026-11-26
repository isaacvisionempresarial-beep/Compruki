-- COMPRUKI · Inbox WhatsApp + pipeline CRM (Fase 2)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 013_followup_tasks, 014_followup_pipeline, 018_whatsapp_meta.

create table if not exists public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  phone text not null,
  contact_name text not null default '',
  status text not null default 'open' check (status in ('open', 'pending', 'closed')),
  pipeline_stage text not null default 'nuevo'
    check (pipeline_stage in ('nuevo', 'contactar', 'espera', 'negociacion', 'pedido', 'postventa')),
  last_message_at timestamptz not null default now(),
  last_message_preview text not null default '',
  last_direction text not null default 'inbound' check (last_direction in ('inbound', 'outbound')),
  unread_count integer not null default 0 check (unread_count >= 0),
  assigned_to text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, phone)
);

create index if not exists whatsapp_conversations_tenant_last_idx
  on public.whatsapp_conversations (tenant_id, last_message_at desc);

create index if not exists whatsapp_conversations_tenant_stage_idx
  on public.whatsapp_conversations (tenant_id, status, pipeline_stage, last_message_at desc);

alter table public.whatsapp_messages
  add column if not exists conversation_id uuid references public.whatsapp_conversations (id) on delete set null;

create index if not exists whatsapp_messages_conversation_idx
  on public.whatsapp_messages (conversation_id, created_at asc);

-- Pipeline CRM ampliado en followups
alter table public.followup_tasks drop constraint if exists followup_tasks_stage_check;
alter table public.followup_tasks
  add constraint followup_tasks_stage_check
  check (stage in ('nuevo', 'contactar', 'espera', 'negociacion', 'pedido', 'postventa'));

-- Estado de invitación en membresías (usuarios)
alter table public.memberships
  add column if not exists invite_status text not null default 'active'
    check (invite_status in ('pending', 'active'));

alter table public.memberships
  add column if not exists invited_email text not null default '';

alter table public.memberships
  add column if not exists invited_at timestamptz;

alter table public.whatsapp_conversations enable row level security;

drop policy if exists whatsapp_conversations_member on public.whatsapp_conversations;
create policy whatsapp_conversations_member on public.whatsapp_conversations
  for all
  using (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = whatsapp_conversations.tenant_id and m.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.memberships m
      where m.tenant_id = whatsapp_conversations.tenant_id and m.user_id = auth.uid()
    )
  );

-- Backfill: una conversación por teléfono con mensajes existentes
insert into public.whatsapp_conversations (
  tenant_id, phone, contact_name, status, last_message_at, last_message_preview, last_direction, unread_count
)
select
  m.tenant_id,
  m.phone,
  coalesce(nullif(max(m.contact_name), ''), ''),
  'open',
  max(m.created_at),
  left(coalesce((
    select body from public.whatsapp_messages x
    where x.tenant_id = m.tenant_id and x.phone = m.phone
    order by x.created_at desc limit 1
  ), ''), 180),
  coalesce((
    select direction from public.whatsapp_messages x
    where x.tenant_id = m.tenant_id and x.phone = m.phone
    order by x.created_at desc limit 1
  ), 'inbound'),
  0
from public.whatsapp_messages m
where m.phone <> ''
  and m.message_type <> 'status'
group by m.tenant_id, m.phone
on conflict (tenant_id, phone) do nothing;

update public.whatsapp_messages msg
set conversation_id = c.id
from public.whatsapp_conversations c
where msg.conversation_id is null
  and c.tenant_id = msg.tenant_id
  and c.phone = msg.phone;
