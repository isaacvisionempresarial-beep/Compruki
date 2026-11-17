-- COMPRUKI · activar P0-IA local por defecto (sin OpenAI)
-- Ejecutar en Supabase → SQL Editor si 004 dejó enabled=false.
-- Las herramientas deterministas quedan permitidas; el tope sigue en 0.

update public.agent_configs
set
  enabled = true,
  notes = case
    when coalesce(notes, '') = '' or notes = 'Esqueleto. OpenAI no está conectado.'
      then 'Piloto local activo. OpenAI no está conectado.'
    else notes
  end,
  updated_at = now()
where agent_id in ('AG-01', 'AG-02', 'AG-03', 'AG-04')
  and enabled = false
  and monthly_budget_cop = 0;
