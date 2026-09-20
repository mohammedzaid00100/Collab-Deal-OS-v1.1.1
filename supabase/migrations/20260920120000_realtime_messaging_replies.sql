-- Collab Deal OS: Realtime messaging & message replies upgrade
-- Adds reply threading, conversation-scoped reply integrity, replica identity,
-- and registers conversation_messages in the supabase_realtime publication.

-- 1. Add reply_to_message_id foreign key column
alter table public.conversation_messages
add column if not exists reply_to_message_id uuid
references public.conversation_messages(id) on delete set null;

create index if not exists conversation_messages_reply_to_idx
on public.conversation_messages (reply_to_message_id);

-- 2. Validate that a reply references a message within the same conversation
create or replace function public.validate_conversation_message_reply()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.reply_to_message_id is not null then
    if not exists (
      select 1
      from public.conversation_messages
      where id = new.reply_to_message_id
        and conversation_id = new.conversation_id
    ) then
      raise exception 'Referenced reply message does not belong to the same conversation';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists conversation_messages_validate_reply on public.conversation_messages;

create trigger conversation_messages_validate_reply
before insert or update of reply_to_message_id on public.conversation_messages
for each row execute function public.validate_conversation_message_reply();

revoke all on function public.validate_conversation_message_reply()
from public, anon, authenticated;

-- 3. Set replica identity to full so RLS filtering and payloads work reliably in Realtime
alter table public.conversation_messages replica identity full;

-- 4. Register conversation_messages in supabase_realtime publication
do $$
begin
  if not exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    create publication supabase_realtime;
  end if;
end $$;

do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'conversation_messages'
  ) then
    alter publication supabase_realtime add table public.conversation_messages;
  end if;
end $$;
