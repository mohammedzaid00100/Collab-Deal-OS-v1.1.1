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
  return (
    <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-6 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
      <h2 className="text-lg font-bold text-slate-950 dark:text-white">Notifications and privacy</h2>
      <div className="my-6 space-y-5">
        <label className="flex min-h-12 cursor-pointer gap-3">
          <input
            className="mt-1 size-5 accent-[#4F46E5]"
            type="checkbox"
            checked={email}
            onChange={(event) => setEmail(event.target.checked)}
          />
          <span>
            <strong className="text-sm text-slate-950 dark:text-white">Email notifications</strong>
            <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-400">
              Receive deal, comment, message, payment-status, and account updates. Authentication and payment-provider messages are handled separately.
            </span>
          </span>
        </label>
        <label className="flex min-h-12 cursor-pointer gap-3">
          <input
            className="mt-1 size-5 accent-[#4F46E5]"
            type="checkbox"
            checked={analytics}
            onChange={(event) => setAnalytics(event.target.checked)}
          />
          <span>
            <strong className="text-sm text-slate-950 dark:text-white">Help improve the product</strong>
            <span className="mt-1 block text-sm leading-6 text-slate-600 dark:text-slate-400">
              Share limited feature-use events. We exclude email addresses, private messages, profile content, and deal terms from analytics.
            </span>
          </span>
        </label>
      </div>
      <Button loading={pending} onClick={save}>Save preferences</Button>
      {status ? <p className="mt-4 text-sm font-medium text-emerald-600 dark:text-emerald-400" role="status">{status}</p> : null}
    </section>
  );
}
