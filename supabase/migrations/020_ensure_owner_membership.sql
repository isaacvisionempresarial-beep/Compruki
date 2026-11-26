-- COMPRUKI · repara membresía del propietario si Auth existe pero memberships no.
-- Ejecutar en Supabase → SQL Editor si /ingresar dice «sin membresía».
-- Cambia el correo si tu propietario usa otro.
-- Recomendado: correr antes 019_panel_roles.sql (si aún no).

do $$
declare
  v_user_id uuid;
  v_tenant_id uuid;
  v_owner_role_id uuid;
  v_has_role_id boolean;
begin
  select id into v_user_id
  from auth.users
  where lower(email) = lower('isaacvisionempresarial@gmail.com')
  limit 1;

  if v_user_id is null then
    raise exception 'No existe auth.users con ese correo. Revisa Authentication → Users.';
  end if;

  select id into v_tenant_id
  from public.tenants
  where slug = 'tienda-piloto'
  limit 1;

  if v_tenant_id is null then
    raise exception 'No existe el tenant tienda-piloto. Corre 001_tenants.sql.';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'memberships'
      and column_name = 'role_id'
  ) into v_has_role_id;

  if v_has_role_id then
    select id into v_owner_role_id
    from public.panel_roles
    where tenant_id = v_tenant_id and key = 'owner'
    limit 1;

    insert into public.memberships (tenant_id, user_id, role, role_id)
    values (v_tenant_id, v_user_id, 'owner', v_owner_role_id)
    on conflict (tenant_id, user_id) do update
      set role = 'owner',
          role_id = coalesce(excluded.role_id, public.memberships.role_id);
  else
    insert into public.memberships (tenant_id, user_id, role)
    values (v_tenant_id, v_user_id, 'owner')
    on conflict (tenant_id, user_id) do update
      set role = 'owner';
  end if;

  raise notice 'Membresía owner OK para % en tenant %', v_user_id, v_tenant_id;
end $$;
