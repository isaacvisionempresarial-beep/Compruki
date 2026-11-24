-- COMPRUKI · pipeline CRM lite (etapas de seguimiento)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 013_followup_tasks.sql. No conecta WhatsApp.

alter table public.followup_tasks
  add column if not exists stage text not null default 'nuevo';

-- Normaliza valores viejos / vacíos.
update public.followup_tasks
set stage = 'nuevo'
where stage is null or stage = '';

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'followup_tasks_stage_check'
  ) then
    alter table public.followup_tasks
      add constraint followup_tasks_stage_check
      check (stage in ('nuevo', 'contactar', 'espera'));
  end if;
end $$;

create index if not exists followup_tasks_tenant_stage_idx
  on public.followup_tasks (tenant_id, status, stage, created_at desc);
