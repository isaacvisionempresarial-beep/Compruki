-- COMPRUKI · nombre de quien lanzó la corrida
-- Ejecutar en Supabase → SQL Editor. created_by sigue siendo el uuid.

alter table public.agent_runs
  add column if not exists actor_name text;
