-- Keep conversation inbox ordering current and restrict message mutation to read state.

create or replace function public.touch_conversation_after_message()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  update public.conversations
  set updated_at = now()
  where id = new.conversation_id;
  return new;
end;
$$;

create trigger conversation_messages_touch_conversation
after insert on public.conversation_messages
for each row execute function public.touch_conversation_after_message();

revoke update on public.conversation_messages from authenticated;
grant update (read_at) on public.conversation_messages to authenticated;
