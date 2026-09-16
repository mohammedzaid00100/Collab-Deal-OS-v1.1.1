-- Harden the internal developer-admin helper against anonymous RPC access.
revoke execute on function public.is_developer_admin() from anon;
revoke execute on function public.is_developer_admin() from public;
grant execute on function public.is_developer_admin() to authenticated;
