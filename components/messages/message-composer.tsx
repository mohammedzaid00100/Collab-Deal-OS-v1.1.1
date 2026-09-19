'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Send } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function MessageComposer({ conversationId, senderUserId }: { conversationId: string; senderUserId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);

  async function sendMessage() {
    const message = body.trim();
    if (!message) return;
    if (message.length > 4000) {
      setError('Keep messages under 4,000 characters.');
      return;
    }

    setSending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Messaging is not configured yet.');
      setSending(false);
      return;
    }

    const { error: insertError } = await supabase.from('conversation_messages').insert({
      conversation_id: conversationId,
      sender_user_id: senderUserId,
      body: message,
    });

    if (insertError) {
      setError(insertError.message);
      setSending(false);
      return;
    }

    setBody('');
    setSending(false);
    router.refresh();
  }

  return (
    <div className="border-t-2 border-[#0D0C1D] bg-white p-3 sm:p-4 dark:border-[#262A3D] dark:bg-[#161826]">
      <div className="flex items-end gap-2">
        <textarea
          className="min-h-11 max-h-36 flex-1 resize-y rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA]/40 px-3 py-2.5 text-sm font-medium text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] outline-none transition placeholder:text-[#8D8BA7] focus:bg-white focus:shadow-[3px_3px_0_#4F46E5] dark:border-[#262A3D] dark:bg-[#11131E] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000] dark:focus:shadow-[3px_3px_0_#6366F1]"
          maxLength={4000}
          rows={1}
          placeholder="Write a message…"
          value={body}
          onChange={(event) => setBody(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter' && !event.shiftKey) {
              event.preventDefault();
              void sendMessage();
            }
          }}
        />
        <button
          className="flex size-11 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] text-white shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] disabled:opacity-50 dark:border-[#262A3D] dark:bg-[#6366F1] dark:shadow-[2px_2px_0_#000000]"
          style={{ color: '#fff' }}
          type="button"
          disabled={sending || !body.trim()}
          onClick={sendMessage}
          aria-label="Send message"
        >
          <Send className="size-4" />
        </button>
      </div>
      {error ? <p className="mt-2 text-xs font-semibold text-red-600 dark:text-red-400" role="alert">{error}</p> : null}
    </div>
  );
}
