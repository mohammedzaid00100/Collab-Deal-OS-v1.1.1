import type { Metadata } from 'next';
import Link from 'next/link';
import { Check, Gift, Link2, MessageCircle } from 'lucide-react';
import { PublicHeader } from '@/components/public/public-header';
import { PublicFooter } from '@/components/public/public-footer';

export const metadata: Metadata = {
  title: 'Pricing & Free Early Access',
  description:
    'Collab Deal OS is currently free for creators and brands. Discover collaboration deals, connect directly, message privately, and manage campaigns and offers without a paid subscription.',
  alternates: {
    canonical: '/pricing',
  },
  openGraph: {
    title: 'Pricing & Free Early Access | Collab Deal OS',
    description:
      'Use Collab Deal OS for free during early access. Creators and brands can discover deals, connect, message, and manage collaborations without a paid plan.',
    url: '/pricing',
    type: 'website',
    images: ['/og.png'],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Pricing & Free Early Access | Collab Deal OS',
    description:
      'Use Collab Deal OS for free during early access. Creators and brands can discover deals, connect, message, and manage collaborations without a paid plan.',
    images: ['/og.png'],
  },
};

const included = [
  'Brand and creator accounts',
  'Published collaboration deals',
  'Creator interest comments',
  'Private brand–creator messaging',
  'Campaign and offer tools',
  'Creator discovery and analytics',
];

export default function PricingPage() {
  return (
    <div className="min-h-svh bg-slate-50">
      <PublicHeader />
      <main className="mx-auto w-[min(960px,calc(100%-32px))] py-16 sm:py-24">
        <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-slate-950 px-6 py-10 text-white sm:px-10 sm:py-14">
            <span className="inline-flex items-center gap-2 rounded-full bg-emerald-400/10 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.1em] text-emerald-300"><Gift className="size-3.5" />Early access</span>
            <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-[-0.055em] sm:text-5xl">Everything is free for creators and brands right now.</h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-300 sm:text-base">Collab Deal OS is focusing on making brand–creator connections work well before introducing any paid plans. There is currently no subscription required to use the product.</p>
          </div>
          <div className="grid gap-8 p-6 sm:p-10 lg:grid-cols-[1fr_320px]">
            <div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Included for everyone</p><ul className="mt-5 grid gap-3 sm:grid-cols-2">{included.map((item) => <li className="flex items-start gap-2.5 text-sm text-slate-700" key={item}><Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />{item}</li>)}</ul></div>
            <aside className="rounded-2xl bg-slate-50 p-5"><div className="flex items-center gap-2 text-sm font-bold text-slate-950"><Link2 className="size-4 text-violet-600" />Connect first</div><p className="mt-2 text-xs leading-5 text-slate-500">Brands post real deals. Creators comment when interested. Brands can then open a private conversation.</p><div className="mt-4 flex items-center gap-2 text-sm font-bold text-slate-950"><MessageCircle className="size-4 text-blue-600" />No paid tier required</div><div className="mt-5 grid gap-2"><Link className="inline-flex min-h-11 items-center justify-center rounded-xl bg-slate-950 px-4 text-sm font-semibold text-white" style={{ color: '#fff' }} href="/signup?role=creator">Join as creator</Link><Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800" href="/signup?role=brand">Join as brand</Link></div></aside>
          </div>
        </section>
      </main>
      <PublicFooter />
    </div>
  );
}
