'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Archive, CircleStop, Pause, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { PublishCampaignButton } from './publish-campaign-button';

export function CampaignLifecycleActions({ campaignId, status }: { campaignId: string; status: string }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function change(nextStatus: 'PAUSED' | 'CLOSED' | 'ARCHIVED') {
    setPending(nextStatus);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return finishWithError('Supabase is not connected.');
    const { error: mutationError } = await supabase.rpc('set_campaign_lifecycle', {
      target_campaign_id: campaignId,
      next_status: nextStatus,
    });
    if (mutationError) return finishWithError(mutationError.message);
    setPending(null);
    router.refresh();
  }

  async function deleteDraft() {
    if (!window.confirm('Delete this draft campaign? This cannot be undone.')) return;
    setPending('DELETE');
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return finishWithError('Supabase is not connected.');
    const { error: mutationError } = await supabase.rpc('delete_draft_campaign', { target_campaign_id: campaignId });
    if (mutationError) return finishWithError(mutationError.message);
    router.push('/brand/campaigns');
    router.refresh();
  }

  function finishWithError(message: string) {
    setError(message);
    setPending(null);
  }

  return <div className="grid justify-items-end gap-2">
    <div className="flex flex-wrap justify-end gap-2">
      {status === 'DRAFT' || status === 'PAUSED' ? <PublishCampaignButton campaignId={campaignId} /> : null}
      {status === 'PUBLISHED' ? <Button type="button" variant="secondary" loading={pending === 'PAUSED'} disabled={Boolean(pending)} onClick={() => change('PAUSED')}><Pause className="size-4" />Pause</Button> : null}
      {status === 'PUBLISHED' || status === 'PAUSED' ? <Button type="button" variant="secondary" loading={pending === 'CLOSED'} disabled={Boolean(pending)} onClick={() => change('CLOSED')}><CircleStop className="size-4" />Close</Button> : null}
      {status === 'DRAFT' || status === 'CLOSED' ? <Button type="button" variant="secondary" loading={pending === 'ARCHIVED'} disabled={Boolean(pending)} onClick={() => change('ARCHIVED')}><Archive className="size-4" />Archive</Button> : null}
      {status === 'DRAFT' ? <Button type="button" variant="danger" loading={pending === 'DELETE'} disabled={Boolean(pending)} onClick={deleteDraft}><Trash2 className="size-4" />Delete draft</Button> : null}
    </div>
    {error ? <span className="max-w-md text-right text-xs text-red-600" role="alert">{error}</span> : null}
  </div>;
}
