-- COMPRUKI · Cache de media entrante del Inbox WhatsApp
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Requiere 001_tenants.sql
-- Evita depender de los ~7 días que Meta guarda el media_id.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'whatsapp-inbox-media',
  'whatsapp-inbox-media',
  false,
  16777216,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/gif',
    'video/mp4',
    'video/3gpp',
    'audio/ogg',
    'audio/mpeg',
    'audio/mp4',
    'audio/aac',
    'audio/amr',
    'application/pdf',
    'application/octet-stream'
  ]
)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- La app sirve con service role (omite RLS) vía /panel/inbox/media/[messageId].
drop policy if exists whatsapp_inbox_media_select_member on storage.objects;
create policy whatsapp_inbox_media_select_member on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'whatsapp-inbox-media'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id::text = (storage.foldername(name))[1]
    )
  );

drop policy if exists whatsapp_inbox_media_write_member on storage.objects;
create policy whatsapp_inbox_media_write_member on storage.objects
  for all
  to authenticated
  using (
    bucket_id = 'whatsapp-inbox-media'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id::text = (storage.foldername(name))[1]
    )
  )
  with check (
    bucket_id = 'whatsapp-inbox-media'
    and exists (
      select 1 from public.memberships m
      where m.user_id = auth.uid()
        and m.tenant_id::text = (storage.foldername(name))[1]
    )
  );
