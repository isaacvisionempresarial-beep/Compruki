-- COMPRUKI · CRM / pipeline profesional (asignación + vencimiento)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 013_followup_tasks, 014_followup_pipeline, 021_whatsapp_inbox_crm.

alter table public.followup_tasks
  add column if not exists assigned_to text not null default '';

alter table public.followup_tasks
  add column if not exists due_at timestamptz;

alter table public.followup_tasks
  add column if not exists priority text not null default 'normal'
    check (priority in ('low', 'normal', 'high'));

-- Etapas ampliadas (por si 021 aún no corrió en followups)
alter table public.followup_tasks drop constraint if exists followup_tasks_stage_check;
alter table public.followup_tasks
  add constraint followup_tasks_stage_check
  check (stage in ('nuevo', 'contactar', 'espera', 'negociacion', 'pedido', 'postventa'));

create index if not exists followup_tasks_tenant_assignee_idx
  on public.followup_tasks (tenant_id, status, assigned_to, due_at asc nulls last);

create index if not exists followup_tasks_tenant_due_idx
  on public.followup_tasks (tenant_id, status, due_at asc nulls last)
  where status = 'open';
