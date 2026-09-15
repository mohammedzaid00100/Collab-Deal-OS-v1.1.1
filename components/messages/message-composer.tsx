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
    <div className="border-t border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-end gap-2">
        <textarea className="min-h-11 max-h-36 flex-1 resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100" maxLength={4000} rows={1} placeholder="Write a message…" value={body} onChange={(event) => setBody(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendMessage(); } }} />
        <button className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white disabled:opacity-50" type="button" disabled={sending || !body.trim()} onClick={sendMessage} aria-label="Send message"><Send className="size-4" /></button>
      </div>
      {error ? <p className="mt-2 text-xs font-medium text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
