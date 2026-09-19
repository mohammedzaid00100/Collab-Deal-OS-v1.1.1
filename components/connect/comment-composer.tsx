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
    <div className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
      <div className="flex items-center gap-2 text-base font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">
        <span className="flex size-7 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[1.5px_1.5px_0_#0D0C1D] dark:border-[#383E5E] dark:bg-[#1E1F3B] dark:text-[#818CF8]">
          <MessageSquareText className="size-3.5" />
        </span>
        Interested in this deal?
      </div>
      <p className="mt-1.5 text-xs font-medium leading-5 text-[#5A5870] dark:text-[#9CA1BA]">
        Introduce yourself, explain your fit, and keep contact details inside Collab Deal OS.
      </p>
      <textarea
        className="mt-4 min-h-28 w-full resize-y rounded-[8px] border-2 border-[#0D0C1D] bg-[#FBF9F5] p-3 text-sm font-medium text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] outline-none transition focus:border-[#4F46E5] focus:bg-white dark:border-[#383E5E] dark:bg-[#111322] dark:text-[#F3F4F8] dark:shadow-none dark:focus:border-[#818CF8]"
        maxLength={1000}
        placeholder="Tell the brand why you are a strong fit for this collaboration…"
        value={body}
        onChange={(event) => setBody(event.target.value)}
      />
      <div className="mt-3 flex items-center justify-between gap-3">
        <span className="text-xs font-semibold text-[#5A5870] dark:text-[#9CA1BA]">{body.length}/1000</span>
        <button
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-[#4F46E5] px-4 text-xs font-bold text-white shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#383E5E] dark:bg-[#6366F1] dark:shadow-[2px_2px_0_#000000]"
          type="button"
          disabled={saving || !body.trim()}
          onClick={submit}
        >
          <Send className="size-3.5" />
          {saving ? 'Posting…' : 'Post comment'}
        </button>
      </div>
      {error ? (
        <p className="mt-3 flex items-center gap-2 rounded-[6px] border-2 border-red-500 bg-red-50 p-2.5 text-xs font-bold text-red-700 shadow-[2px_2px_0_#DC2626] dark:border-red-900 dark:bg-red-950/40 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
