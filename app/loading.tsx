import { BrandLogo } from '@/components/brand-logo';

export default function Loading() {
  return <main className="min-h-svh bg-slate-50"><header className="border-b border-slate-200 bg-white px-5 py-5"><BrandLogo /></header><div className="mx-auto w-[min(1100px,calc(100%-32px))] animate-pulse py-10"><div className="h-3 w-28 rounded-full bg-slate-200" /><div className="mt-4 h-9 w-72 max-w-full rounded-xl bg-slate-200" /><div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{[0, 1, 2, 3].map((value) => <div className="h-28 rounded-2xl bg-slate-200" key={value} />)}</div><div className="mt-6 h-72 rounded-2xl bg-slate-200" /></div><span className="sr-only" role="status">Loading Collab Deal OS…</span></main>;
}
