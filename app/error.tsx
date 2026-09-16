'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CircleAlert, RotateCcw } from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { Button } from '@/components/ui/button';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const pathname = usePathname();
  useEffect(() => {
    console.error('Collab Deal OS route error', error.digest ?? error.name);
  }, [error]);

  const workspaceHome = pathname.startsWith('/creator')
    ? '/creator/dashboard'
    : pathname.startsWith('/brand')
      ? '/brand/dashboard'
      : '/';
  const returnLabel = workspaceHome === '/' ? 'Return home' : 'Return to dashboard';

  return <main className="flex min-h-svh flex-col bg-slate-50 p-5"><BrandLogo /><section className="m-auto w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:p-8"><span className="mx-auto flex size-12 items-center justify-center rounded-xl bg-red-50 text-red-700"><CircleAlert className="size-5" /></span><h1 className="mt-5 text-2xl font-bold tracking-[-0.035em] text-slate-950">This page is temporarily unavailable</h1><p className="mt-2 text-sm leading-6 text-slate-600">We could not load trusted account data. Try again in a moment. If you are already signed in, you can return to your workspace without choosing your role again.</p><div className="mt-6 flex flex-col justify-center gap-2 sm:flex-row"><Button type="button" onClick={reset}><RotateCcw className="size-4" />Try again</Button><Link className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-800" href={workspaceHome}>{returnLabel}</Link></div></section></main>;
}
