'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  Bell,
  BriefcaseBusiness,
  Compass,
  FileText,
  Gauge,
  Handshake,
  LayoutDashboard,
  Link2,
  MessageCircle,
  Search,
  Settings,
  UserRound,
  UsersRound,
  WalletCards,
} from 'lucide-react';
import { BrandLogo } from '@/components/brand-logo';
import { PaymentPasswordGate } from '@/components/wallet/payment-password-gate';
import { LogoutButton } from './logout-button';
import { cn } from '@/lib/utils';
import type { AccountType, PlanTier } from '@/types/domain';

const creatorNav = [
  ['Dashboard', '/creator/dashboard', LayoutDashboard],
  ['Connect', '/creator/connect', Link2],
  ['Messages', '/creator/messages', MessageCircle],
  ['Opportunities', '/creator/opportunities', Compass],
  ['Offers', '/creator/offers', Handshake],
  ['Analytics', '/creator/analytics', BarChart3],
  ['Settings', '/creator/settings', Settings],
] as const;

const brandNav = [
  ['Dashboard', '/brand/dashboard', LayoutDashboard],
  ['Connect', '/brand/connect', Link2],
  ['Messages', '/brand/messages', MessageCircle],
  ['Campaigns', '/brand/campaigns', BriefcaseBusiness],
  ['Creator Discovery', '/brand/creators', Search],
  ['Matches', '/brand/matches', UsersRound],
  ['Offers', '/brand/offers', FileText],
  ['Analytics', '/brand/analytics', BarChart3],
  ['Settings', '/brand/settings', Settings],
] as const;

const creatorMobile = [creatorNav[0], creatorNav[1], creatorNav[2], creatorNav[3], ['Profile', '/creator/profile', UserRound]] as const;
const brandMobile = [brandNav[0], brandNav[1], brandNav[2], brandNav[3], ['Profile', '/brand/profile', UserRound]] as const;

interface AppShellProps {
  role: AccountType;
  displayName: string;
  email: string;
  plan: PlanTier;
  children: ReactNode;
}

export function AppShell({ role, displayName, email, children }: AppShellProps) {
  const pathname = usePathname();
  const navItems = role === 'creator' ? creatorNav : brandNav;
  const mobileItems = role === 'creator' ? creatorMobile : brandMobile;

  return (
    <div data-app-shell className="min-h-svh bg-slate-50 lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <PaymentPasswordGate role={role} />
      <a className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-slate-950 px-3 py-2 text-sm font-semibold text-white focus:translate-y-0" style={{ color: '#fff' }} href="#app-main">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] border-r border-slate-200 bg-white px-4 py-5 lg:flex lg:flex-col">
        <BrandLogo className="px-2" />
        <span className="mx-2 mt-4 w-fit rounded-full bg-violet-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-violet-700">{role} workspace</span>
        <nav className="mt-7 grid gap-1" aria-label={`${role} navigation`}>
          {navItems.map(([label, href, Icon]) => {
            const active = pathname === href || (href !== `/${role}/dashboard` && pathname.startsWith(`${href}/`));
            return <Link className={cn('flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition', active ? 'bg-slate-950 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950')} style={active ? { color: '#fff' } : undefined} href={href} key={href} aria-current={active ? 'page' : undefined}><Icon className="size-[18px]" aria-hidden="true" />{label}</Link>;
          })}
        </nav>
        <div className="mt-auto border-t border-slate-100 pt-4">
          <div className="mb-2 flex items-center gap-3 rounded-xl px-3 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-violet-100 to-blue-100 text-sm font-bold text-violet-700">{displayName.slice(0, 1).toUpperCase()}</span>
            <span className="min-w-0"><strong className="block truncate text-xs text-slate-900">{displayName}</strong><span className="mt-0.5 block truncate text-[11px] text-slate-400">{email}</span></span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b border-slate-200 bg-white/95 px-4 backdrop-blur sm:px-6 lg:px-8">
          <BrandLogo className="lg:hidden" />
          <div className="hidden items-center gap-2 text-xs font-semibold text-slate-500 lg:flex"><Gauge className="size-4" aria-hidden="true" />Real brands. Real creators. Clear deals.</div>
          <div className="flex items-center gap-2">
            <Link className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs font-bold text-slate-700 shadow-sm transition hover:border-violet-200 hover:text-violet-700" href={`/${role}/wallet`} aria-label={`${role} wallet`}><WalletCards className="size-[18px]" /><span className="hidden sm:inline">Wallet</span></Link>
            <Link className="relative flex size-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900" href={`/${role}/notifications`} aria-label="Notifications"><Bell className="size-[19px]" /><span className="absolute right-2.5 top-2.5 size-1.5 rounded-full bg-violet-600" /></Link>
            <span className="lg:hidden"><LogoutButton compact /></span>
            <span className="hidden rounded-full bg-amber-50 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.08em] text-amber-700 xl:block">Prototype</span>
          </div>
        </header>
        <main id="app-main" className="mx-auto w-full max-w-[1420px] px-4 py-6 pb-28 sm:px-6 lg:px-8 lg:py-8 lg:pb-10">{children}</main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-200 bg-white/98 px-1 pb-[max(6px,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-10px_30px_rgb(15_23_42/7%)] backdrop-blur lg:hidden" aria-label={`${role} mobile navigation`}>
        {mobileItems.map(([label, href, Icon]) => {
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return <Link className={cn('flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold', active ? 'text-violet-700' : 'text-slate-500')} href={href} key={href} aria-current={active ? 'page' : undefined}><Icon className="size-5" aria-hidden="true" /><span className="max-w-full truncate">{label}</span></Link>;
        })}
      </nav>
    </div>
  );
}
