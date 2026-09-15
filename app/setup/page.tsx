import type { Metadata } from 'next';
import { CheckCircle2, CircleDashed, ExternalLink, ShieldCheck } from 'lucide-react';
import { PublicHeader } from '@/components/public/public-header';
import { PublicFooter } from '@/components/public/public-footer';
import { isSupabaseConfigured } from '@/lib/supabase/config';
import { isRazorpayCheckoutConfigured } from '@/lib/billing/config';

export const metadata: Metadata = { title: 'Connection checklist' };
export const dynamic = 'force-dynamic';

export default function SetupPage() {
  const detailed = process.env.NODE_ENV !== 'production' || process.env.ENABLE_SETUP_STATUS === 'true';
  if (!detailed) {
    return <div className="min-h-svh bg-slate-50"><PublicHeader /><main className="mx-auto flex min-h-[65svh] w-[min(680px,calc(100%-32px))] items-center py-14"><section className="rounded-2xl border border-slate-200 bg-white p-7 shadow-sm"><ShieldCheck className="size-6 text-violet-700" /><h1 className="mt-5 text-3xl font-bold tracking-[-0.04em] text-slate-950">Setup status is restricted</h1><p className="mt-3 text-sm leading-6 text-slate-600">Detailed provider configuration is available only in development or to an explicitly enabled administration environment.</p></section></main><PublicFooter /></div>;
  }
  const services = [
    ['Supabase', isSupabaseConfigured(), 'Authentication, PostgreSQL, and private file storage'],
    ['OpenAI', Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL), 'Server-side AI verdict explanations'],
    ['Razorpay', (['creator', 'brand'] as const).every((role) => (['PRO', 'PREMIUM'] as const).every((plan) => isRazorpayCheckoutConfigured(role, plan))), 'Credentials and plan mappings; paid allowances and live verification are checked separately'],
    ['Google OAuth', process.env.GOOGLE_OAUTH_CONFIGURED === 'true', 'Authorized in Supabase and Google Cloud'],
    ['Email', Boolean(process.env.RESEND_API_KEY), 'Transactional notifications through Resend'],
    ['Analytics', Boolean(process.env.NEXT_PUBLIC_POSTHOG_KEY), 'Privacy-aware product analytics through PostHog'],
  ] as const;

  return <div className="min-h-svh bg-slate-50"><PublicHeader /><main className="mx-auto w-[min(900px,calc(100%-32px))] py-14 sm:py-20"><div className="max-w-2xl"><span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-700"><ShieldCheck className="size-3.5" />Secrets stay server-side</span><h1 className="mt-5 text-4xl font-bold tracking-[-0.05em] text-slate-950">Integration setup</h1><p className="mt-3 text-base leading-7 text-slate-600">This safe checklist shows only whether each service is configured. It never displays a full secret or places privileged keys in the browser or Android build.</p></div><div className="mt-10 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">{services.map(([name, connected, description]) => <div className="flex items-center gap-4 border-b border-slate-100 p-4 last:border-0 sm:p-5" key={name}><span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-400'}`}>{connected ? <CheckCircle2 className="size-5" /> : <CircleDashed className="size-5" />}</span><div className="min-w-0 flex-1"><strong className="text-sm text-slate-900">{name}</strong><p className="mt-1 text-xs leading-5 text-slate-500">{description}</p></div><span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.06em] ${connected ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{connected ? 'Configured' : 'Not connected'}</span></div>)}</div><div className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5 text-sm leading-6 text-blue-900"><strong>Next step</strong><p className="mt-1 text-blue-800">Copy <code className="rounded bg-white/70 px-1.5 py-0.5">.env.example</code> to <code className="rounded bg-white/70 px-1.5 py-0.5">.env.local</code>, add values from accounts you control, then run the setup check. Google login also requires one authorization in Supabase and Google Cloud.</p><a className="mt-3 inline-flex items-center gap-2 font-semibold" href="/api/health">Open safe health response<ExternalLink className="size-4" /></a></div></main><PublicFooter /></div>;
}
