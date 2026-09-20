'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle, Loader2 } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

type CreatorCommentActionProps = {
  campaignId: string;
  targetCreatorProfileId: string;
  targetCreatorName?: string;
};

export function CreatorCommentAction({
  campaignId,
  targetCreatorProfileId,
  targetCreatorName = 'creator',
}: CreatorCommentActionProps) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleConnect() {
    setLoading(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Messaging is not configured yet.');
      setLoading(false);
      return;
    }

    const { data: conversationId, error: rpcError } = await supabase.rpc(
      'start_creator_connect_conversation',
      {
        target_creator_profile_id: targetCreatorProfileId,
        target_campaign_id: campaignId,
      }
    );

    if (rpcError || !conversationId) {
      setError(rpcError?.message ?? 'Could not start conversation with this creator.');
      setLoading(false);
      return;
    }

    router.push(`/creator/messages/${conversationId}`);
    router.refresh();
  }

  return (
    <div className="mt-2.5 flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleConnect}
        disabled={loading}
        aria-label={`Message ${targetCreatorName}`}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-[6px] border-2 border-[#0D0C1D] bg-white px-3 py-1 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] active:translate-x-[2px] active:translate-y-[2px] active:shadow-none disabled:opacity-60 dark:border-[#383E5E] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]"
      >
        {loading ? (
          <Loader2 className="size-3.5 animate-spin text-[#4F46E5] dark:text-[#818CF8]" />
        ) : (
          <MessageCircle className="size-3.5 text-[#4F46E5] dark:text-[#818CF8]" />
        )}
        <span>{loading ? 'Opening chat…' : 'Message creator'}</span>
      </button>
      {error ? (
        <p className="max-w-xs text-[11px] font-bold text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
