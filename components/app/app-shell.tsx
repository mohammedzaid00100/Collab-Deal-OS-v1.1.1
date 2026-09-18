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
import { AppFab } from './app-fab';
import { ThemeQuickToggle } from '@/components/account/theme-quick-toggle';
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

  return (
    <div data-app-shell className="min-h-svh bg-[#F8F9FA] text-[#0D0C1D] transition-colors dark:bg-[#0B0C14] dark:text-[#F3F4F8] lg:grid lg:grid-cols-[250px_minmax(0,1fr)]">
      <PaymentPasswordGate role={role} />
      <a className="fixed left-3 top-3 z-50 -translate-y-20 rounded-lg bg-[#0D0C1D] px-3 py-2 text-sm font-semibold text-white focus:translate-y-0 dark:bg-[#F3F4F8] dark:text-[#0D0C1D]" href="#app-main">Skip to content</a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[250px] border-r-2 border-[#0D0C1D] bg-white px-4 py-5 transition-colors dark:border-[#262A3D] dark:bg-[#11131E] lg:flex lg:flex-col">
        <BrandLogo className="px-2" />
        <span className="mx-2 mt-4 w-fit rounded-[6px] border-2 border-[#0D0C1D] bg-slate-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.09em] text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1F2235] dark:text-[#F3F4F8] dark:shadow-[2px_2px_0_#000000]">{role} workspace</span>
        <nav className="mt-7 grid gap-1" aria-label={`${role} navigation`}>
          {navItems.map(([label, href, Icon]) => {
            const active = pathname === href || (href !== `/${role}/dashboard` && pathname.startsWith(`${href}/`));
            return (
              <Link
                className={cn(
                  'flex min-h-11 items-center gap-3 rounded-[8px] px-3 text-sm font-semibold transition-all',
                  active
                    ? 'border-2 border-[#0D0C1D] bg-[#0D0C1D] text-white shadow-[2px_2px_0_rgba(0,0,0,0.3)] dark:border-[#6366F1] dark:bg-[#6366F1] dark:text-white dark:shadow-[2px_2px_0_#000]'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-950 dark:text-slate-300 dark:hover:bg-[#1F2235] dark:hover:text-white',
                )}
                href={href}
                key={href}
                aria-current={active ? 'page' : undefined}
              >
                <Icon className="size-[18px]" aria-hidden="true" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto border-t-2 border-slate-200 pt-4 dark:border-[#262A3D]">
          <div className="mb-2 flex items-center gap-3 rounded-[8px] px-3 py-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-sm font-bold text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#A5B4FC] dark:shadow-[2px_2px_0_#000000]">
              {displayName.slice(0, 1).toUpperCase()}
            </span>
            <span className="min-w-0">
              <strong className="block truncate text-xs text-slate-950 dark:text-white">{displayName}</strong>
              <span className="mt-0.5 block truncate text-[11px] text-slate-500 dark:text-slate-400">{email}</span>
            </span>
          </div>
          <LogoutButton />
        </div>
      </aside>

      <div className="min-w-0 lg:col-start-2">
        <header className="sticky top-0 z-20 flex min-h-16 items-center justify-between border-b-2 border-[#0D0C1D] bg-white px-4 transition-colors dark:border-[#262A3D] dark:bg-[#11131E] sm:px-6 lg:px-8">
          <BrandLogo className="lg:hidden" />
          <div className="hidden items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-400 lg:flex">
            <Gauge className="size-4" aria-hidden="true" />
            Real brands. Real creators. Clear deals.
          </div>
          <div className="flex items-center gap-2">
            <ThemeQuickToggle />
            <Link
              className="inline-flex min-h-10 items-center gap-2 rounded-[8px] border-2 border-[#0D0C1D] bg-white px-3 text-xs font-bold text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:text-white dark:shadow-[2px_2px_0_#000000]"
              href={`/${role}/wallet`}
              aria-label={`${role} wallet`}
            >
              <WalletCards className="size-[18px]" />
              <span className="hidden sm:inline">Wallet</span>
            </Link>
            <Link
              className="relative flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-white text-[#0D0C1D] shadow-[2px_2px_0_#0D0C1D] transition-all hover:translate-x-[1px] hover:translate-y-[1px] dark:border-[#262A3D] dark:bg-[#161826] dark:text-white dark:shadow-[2px_2px_0_#000000]"
              href={`/${role}/notifications`}
              aria-label="Notifications"
            >
              <Bell className="size-[19px]" />
              <span className="absolute right-2 top-2 size-1.5 rounded-full bg-[#4F46E5] dark:bg-[#6366F1]" />
            </Link>
            <span className="lg:hidden">
              <LogoutButton compact />
            </span>
          </div>
        </header>
        <main id="app-main" className="mx-auto w-full max-w-[1420px] px-4 py-6 pb-20 sm:px-6 lg:px-8 lg:py-8 lg:pb-12">
          {children}
        </main>
      </div>

      {/* Floating Action Button replaces the fixed bottom tab bar */}
      <AppFab role={role} />
    </div>
  );
}

