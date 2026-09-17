-- Keep the raw purge helper private and expose only a password-gated deletion RPC.

revoke all on function public.purge_current_account_data() from public, anon, authenticated;

create or replace function public.delete_current_account_with_password(candidate text)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $$
declare
  verification jsonb;
begin
  if auth.uid() is null then
    return jsonb_build_object('deleted', false, 'valid', false, 'reason', 'AUTH_REQUIRED');
  end if;

  verification := public.verify_payment_password(candidate);
  if coalesce((verification ->> 'valid')::boolean, false) is not true then
    return verification || jsonb_build_object('deleted', false);
  end if;

  perform public.purge_current_account_data();
  return jsonb_build_object('deleted', true, 'valid', true, 'reason', 'OK');
end;
$$;

revoke all on function public.delete_current_account_with_password(text) from public, anon;
grant execute on function public.delete_current_account_with_password(text) to authenticated;
