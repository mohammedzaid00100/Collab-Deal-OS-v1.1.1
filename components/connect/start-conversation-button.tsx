'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { MessageCircle } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function StartConversationButton({ campaignId, creatorProfileId }: { campaignId: string; creatorProfileId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function startConversation() {
    setLoading(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Messaging is not configured yet.');
      setLoading(false);
      return;
    }

    const { data, error: rpcError } = await supabase.rpc('start_connect_conversation', {
      target_creator_profile_id: creatorProfileId,
      target_campaign_id: campaignId,
    });

    if (rpcError || !data) {
      setError(rpcError?.message ?? 'Could not start the conversation.');
      setLoading(false);
      return;
    }

    router.push(`/brand/messages/${data}`);
    router.refresh();
  }

  return (
    <div>
      <button className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-slate-950 px-3.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50" type="button" onClick={startConversation} disabled={loading}><MessageCircle className="size-4" />{loading ? 'Opening…' : 'Message creator'}</button>
      {error ? <p className="mt-2 max-w-xs text-[11px] font-medium text-red-600" role="alert">{error}</p> : null}
    </div>
  );
}
