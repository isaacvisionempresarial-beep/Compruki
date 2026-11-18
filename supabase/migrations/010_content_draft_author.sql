-- COMPRUKI · nombre de quien guardó el borrador
-- Ejecutar en Supabase → SQL Editor. created_by sigue siendo el uuid.

alter table public.content_drafts
  add column if not exists author_name text;
