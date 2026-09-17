-- Payment-password recovery for Collab Deal OS.
-- Password creation is allowed once from the signed-in session. Later replacement
-- is restricted to the server/service role after email-code verification.

create table if not exists public.payment_password_resets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  code_hash text not null,
  reset_token_hash text,
  expires_at timestamptz not null,
  reset_token_expires_at timestamptz,
  verified_at timestamptz,
  consumed_at timestamptz,
  attempts_remaining integer not null default 5 check (attempts_remaining between 0 and 5),
  created_at timestamptz not null default now()
);

create index if not exists payment_password_resets_user_created_idx
  on public.payment_password_resets (user_id, created_at desc);

alter table public.payment_password_resets enable row level security;
revoke all on table public.payment_password_resets from public, anon, authenticated;
grant all on table public.payment_password_resets to service_role;

create or replace function public.create_payment_password(new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  uid uuid := auth.uid();
  cleaned text := coalesce(new_password, '');
begin
  if uid is null then raise exception 'Authentication required'; end if;
  if length(cleaned) < 6 or length(cleaned) > 128 then
    raise exception 'Payment password must be between 6 and 128 characters';
  end if;
  if exists (select 1 from public.payment_security where user_id = uid) then
    raise exception 'Payment password is already configured';
  end if;

  insert into public.payment_security (user_id, password_hash, failed_attempts, locked_until, updated_at)
  values (uid, extensions.crypt(cleaned, extensions.gen_salt('bf', 10)), 0, null, now());
  return true;
end;
$$;

revoke all on function public.create_payment_password(text) from public, anon;
grant execute on function public.create_payment_password(text) to authenticated;

-- Existing set_payment_password can no longer be called directly by signed-in users.
-- This prevents bypassing the email recovery challenge when a password already exists.
revoke all on function public.set_payment_password(text) from public, anon, authenticated;
grant execute on function public.set_payment_password(text) to service_role;

create or replace function public.admin_reset_payment_password(target_user_id uuid, new_password text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  cleaned text := coalesce(new_password, '');
begin
  if auth.role() <> 'service_role' then raise exception 'Service role required'; end if;
  if target_user_id is null then raise exception 'User required'; end if;
  if length(cleaned) < 6 or length(cleaned) > 128 then
    raise exception 'Payment password must be between 6 and 128 characters';
  end if;

  insert into public.payment_security (user_id, password_hash, failed_attempts, locked_until, updated_at)
  values (target_user_id, extensions.crypt(cleaned, extensions.gen_salt('bf', 10)), 0, null, now())
  on conflict (user_id) do update
    set password_hash = excluded.password_hash,
        failed_attempts = 0,
        locked_until = null,
        updated_at = now();
  return true;
end;
$$;

revoke all on function public.admin_reset_payment_password(uuid, text) from public, anon, authenticated;
grant execute on function public.admin_reset_payment_password(uuid, text) to service_role;
