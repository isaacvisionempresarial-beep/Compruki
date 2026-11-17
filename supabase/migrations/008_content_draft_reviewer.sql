-- COMPRUKI · quién revisó el borrador y cuándo
-- Ejecutar en Supabase → SQL Editor si 007 ya corrió.

alter table public.content_drafts
  add column if not exists reviewed_by text,
  add column if not exists reviewed_at timestamptz;
