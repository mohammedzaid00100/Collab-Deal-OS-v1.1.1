'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Rocket } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function PublishCampaignButton({ campaignId }: { campaignId: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function publish() {
    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not connected.');
      setPending(false);
      return;
    }
    const { error: publishError } = await supabase.rpc('publish_campaign_and_generate_matches', { target_campaign_id: campaignId });
    if (publishError) {
      setError(publishError.message);
      setPending(false);
      return;
    }
    router.refresh();
    setPending(false);
  }

  return <div className="grid justify-items-end gap-1.5"><Button type="button" loading={pending} onClick={publish}><Rocket className="size-4" />Publish & match</Button>{error ? <span className="max-w-xs text-right text-xs text-red-600" role="alert">{error}</span> : null}</div>;
}
