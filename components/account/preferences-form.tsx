'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export function PreferencesForm({ userId, initialEmail, initialAnalytics }: { userId: string; initialEmail: boolean; initialAnalytics: boolean }) {
  const [email, setEmail] = useState(initialEmail);
  const [analytics, setAnalytics] = useState(initialAnalytics);
  const [pending, setPending] = useState(false);
  const [status, setStatus] = useState('');
  async function save() {
    setPending(true); setStatus('');
    try {
      const client = createSupabaseBrowserClient();
      if (!client) throw new Error('Service unavailable');
      const { data, error } = await client.from('account_preferences')
        .update({ email_notifications: email, product_analytics: analytics }).eq('user_id', userId).select('user_id').single();
      setStatus(error || !data ? 'Preferences could not be saved. Please retry.' : 'Preferences saved.');
    } catch { setStatus('Preferences could not be saved. Please retry.'); }
    finally { setPending(false); }
  }
  return <section className="rounded-2xl border border-slate-200 bg-white p-6"><h2 className="text-lg font-bold text-slate-950">Notifications and privacy</h2><div className="my-6 space-y-5"><label className="flex min-h-12 gap-3"><input className="mt-1 size-5 accent-violet-600" type="checkbox" checked={email} onChange={(event) => setEmail(event.target.checked)} /><span><strong className="text-sm">Email notifications</strong><span className="mt-1 block text-sm leading-6 text-slate-500">Receive deal, comment, message, payment-status, and account updates. Authentication and payment-provider messages are handled separately.</span></span></label><label className="flex min-h-12 gap-3"><input className="mt-1 size-5 accent-violet-600" type="checkbox" checked={analytics} onChange={(event) => setAnalytics(event.target.checked)} /><span><strong className="text-sm">Help improve the product</strong><span className="mt-1 block text-sm leading-6 text-slate-500">Share limited feature-use events. We exclude email addresses, private messages, profile content, and deal terms from analytics.</span></span></label></div><Button loading={pending} onClick={save}>Save preferences</Button>{status ? <p className="mt-4 text-sm text-slate-600" role="status">{status}</p> : null}</section>;
}
