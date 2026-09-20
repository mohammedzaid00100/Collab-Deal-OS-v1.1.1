-- Collab Deal OS: Allow message sender to delete their own conversation messages.
-- Participant RLS: only sender_user_id = auth.uid() can delete.
-- Foreign key reply_to_message_id has ON DELETE SET NULL, preserving reply thread integrity.

create policy conversation_messages_delete_sender
on public.conversation_messages for delete to authenticated
using (
  sender_user_id = auth.uid()
);

grant delete on public.conversation_messages to authenticated;
