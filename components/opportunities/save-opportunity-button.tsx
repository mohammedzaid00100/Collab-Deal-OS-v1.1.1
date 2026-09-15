'use client';

import { useState } from 'react';
import { Bookmark } from 'lucide-react';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import { cn } from '@/lib/utils';

export function SaveOpportunityButton({ creatorProfileId, campaignId, initiallySaved, compact = false }: { creatorProfileId: string; campaignId: string; initiallySaved: boolean; compact?: boolean }) {
  const [saved, setSaved] = useState(initiallySaved);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) {
      setError('Supabase is not connected.');
      setPending(false);
      return;
    }
    const result = saved
      ? await supabase.from('saved_opportunities').delete().eq('creator_profile_id', creatorProfileId).eq('campaign_id', campaignId)
      : await supabase.from('saved_opportunities').upsert({ creator_profile_id: creatorProfileId, campaign_id: campaignId });
    if (result.error) setError(result.error.message);
    else setSaved((value) => !value);
    setPending(false);
  }

  return <div className="grid gap-1"><button className={cn('inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border px-3 text-xs font-semibold transition disabled:opacity-50', saved ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300', compact && 'size-10 px-0')} type="button" disabled={pending} onClick={toggle} aria-pressed={saved} aria-label={compact ? (saved ? 'Remove saved opportunity' : 'Save opportunity') : undefined}><Bookmark className={cn('size-4', saved && 'fill-current')} />{compact ? null : saved ? 'Saved' : 'Save'}</button>{error ? <span className="text-[10px] text-red-600" role="alert">{error}</span> : null}</div>;
}
