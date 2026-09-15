import Link from 'next/link';
import { BrandLogo } from '@/components/brand-logo';

export function PublicFooter() {
  return <footer className="border-t border-slate-200 bg-white"><div className="mx-auto flex w-[min(1180px,calc(100%-32px))] flex-col gap-5 py-8 sm:flex-row sm:items-center sm:justify-between"><BrandLogo /><nav className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-slate-500" aria-label="Footer navigation"><Link href="/pricing">Pricing</Link><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/setup">Setup status</Link></nav><p className="text-xs text-slate-400">© 2026 Collab Deal OS</p></div></footer>;
}
