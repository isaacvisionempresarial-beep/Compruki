-- COMPRUKI · revisión humana de borradores (AG-03)
-- Ejecutar en Supabase → SQL Editor si 005 ya corrió.
-- Los borradores existentes se marcan approved para no saturar la bandeja.

alter table public.content_drafts
  add column if not exists review_status text;

update public.content_drafts
set review_status = 'approved'
where review_status is null;

alter table public.content_drafts
  alter column review_status set default 'pending';

alter table public.content_drafts
  alter column review_status set not null;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'content_drafts_review_status_check'
  ) then
    alter table public.content_drafts
      add constraint content_drafts_review_status_check
      check (review_status in ('pending', 'approved', 'rejected'));
  end if;
end $$;

create index if not exists content_drafts_tenant_review_idx
  on public.content_drafts (tenant_id, review_status, created_at desc);
