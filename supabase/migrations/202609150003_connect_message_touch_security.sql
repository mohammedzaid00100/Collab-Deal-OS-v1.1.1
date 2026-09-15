-- The message trigger only touches its own parent conversation and must work
-- without granting clients direct conversation update permission.

create or replace function public.touch_conversation_after_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

revoke all on function public.touch_conversation_after_message() from public, anon, authenticated;
