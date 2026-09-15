'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { LoaderCircle } from 'lucide-react';

export function AnalysisPending() {
  const router = useRouter();
  useEffect(() => {
    const timer = window.setInterval(() => router.refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [router]);
  return <section className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-blue-50 p-8 text-center"><LoaderCircle className="mx-auto size-8 animate-spin text-violet-700" /><h2 className="mt-4 text-lg font-bold text-slate-950">Your evaluation is processing</h2><p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">The pricing range is fixed before the provider explanation runs. This page checks for the completed result automatically.</p></section>;
}
