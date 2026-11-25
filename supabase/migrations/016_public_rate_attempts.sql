-- COMPRUKI · contador compartido de intentos públicos (anti multi-réplica Railway)
-- Ejecutar en Supabase → SQL Editor → New query → Run
-- Solo service role. No guarda IP/correo en claro (key_hash).

create table if not exists public.public_rate_attempts (
  id bigserial primary key,
  bucket text not null,
  key_hash text not null,
  attempted_at timestamptz not null default now()
);

create index if not exists public_rate_attempts_lookup_idx
  on public.public_rate_attempts (bucket, key_hash, attempted_at desc);

alter table public.public_rate_attempts enable row level security;

-- Sin políticas para authenticated/anon: solo service role (bypass RLS).

create or replace function public.take_public_rate_attempt(
  p_bucket text,
  p_key_hash text,
  p_limit integer,
  p_window_seconds integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  recent_count integer;
  window_secs integer := greatest(coalesce(p_window_seconds, 1), 1);
  max_hits integer := greatest(coalesce(p_limit, 1), 1);
begin
  if p_bucket is null or length(trim(p_bucket)) = 0 then
    return false;
  end if;
  if p_key_hash is null or length(trim(p_key_hash)) < 8 then
    return false;
  end if;

  delete from public.public_rate_attempts
  where bucket = p_bucket
    and key_hash = p_key_hash
    and attempted_at < now() - make_interval(secs => window_secs * 2);

  select count(*)::integer into recent_count
  from public.public_rate_attempts
  where bucket = p_bucket
    and key_hash = p_key_hash
    and attempted_at >= now() - make_interval(secs => window_secs);

  if recent_count >= max_hits then
    return false;
  end if;

  insert into public.public_rate_attempts (bucket, key_hash)
  values (p_bucket, p_key_hash);

  return true;
end;
$$;

revoke all on function public.take_public_rate_attempt(text, text, integer, integer) from public;
grant execute on function public.take_public_rate_attempt(text, text, integer, integer) to service_role;
