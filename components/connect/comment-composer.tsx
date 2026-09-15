'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageSquareText, Send } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function CommentComposer({ campaignId, creatorProfileId }: { campaignId: string; creatorProfileId: string }) {
  const router = useRouter();
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    const message = body.trim();
    if (!message) return;
    if (message.length > 1000) {
      setError('Keep your comment under 1,000 characters.');
      return;
    }

    setSaving(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Connect storage is not configured yet.');
      setSaving(false);
      return;
    }

    const { error: insertError } = await supabase.from('campaign_comments').insert({
      campaign_id: campaignId,
      creator_profile_id: creatorProfileId,
      body: message,
    });

    if (insertError) {
      setError(insertError.message);
      setSaving(false);
      return;
    }

    setBody('');
    setSaving(false);
    router.refresh();
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="flex items-center gap-2 text-sm font-bold text-slate-950"><MessageSquareText className="size-4 text-violet-600" />Interested in this deal?</div>
      <p className="mt-1 text-xs leading-5 text-slate-500">Introduce yourself, explain your fit, and keep contact details inside Collab Deal OS.</p>
      <textarea className="mt-4 min-h-28 w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm text-slate-900 outline-none transition focus:border-violet-400 focus:bg-white focus:ring-4 focus:ring-violet-100" maxLength={1000} placeholder="Tell the brand why you are a strong fit for this collaboration…" value={body} onChange={(event) => setBody(event.target.value)} />
      <div className="mt-3 flex items-center justify-between gap-3"><span className="text-[11px] text-slate-400">{body.length}/1000</span><button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 text-xs font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" type="button" disabled={saving || !body.trim()} onClick={submit}><Send className="size-3.5" />{saving ? 'Posting…' : 'Post comment'}</button></div>
      {error ? <p className="mt-3 text-xs font-medium text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
