-- COMPRUKI · Storage de fotos/videos de producto (Etapa 2b)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'product-media',
  'product-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'video/mp4']
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Lectura: miembros del tenant (ruta: {tenant_id}/...)
drop policy if exists product_media_select_member on storage.objects;
create policy product_media_select_member on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'product-media'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- Escritura: miembros del tenant
drop policy if exists product_media_write_member on storage.objects;
create policy product_media_write_member on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'product-media'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'product-media'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id::text = (storage.foldername(name))[1]
    )
  );

-- La app sirve media con service role (omite RLS) vía /tienda/imagen y /panel/imagen.
