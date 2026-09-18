'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  BarChart3,
  FilePlus2,
  Handshake,
  Link2,
  MessageCircle,
  Moon,
  Plus,
  Radio,
  Sparkles,
  Sun,
  WalletCards,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { AccountType } from '@/types/domain';

interface AppFabProps {
  role: AccountType;
}

export function AppFab({ role }: AppFabProps) {
  const [open, setOpen] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const pathname = usePathname();
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const current = document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
    setTheme(current);
  }, []);

  // Close when pathname changes
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Handle escape key and click outside
  useEffect(() => {
    if (!open) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }

    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);

  function toggleTheme() {
    const next = theme === 'dark' ? 'light' : 'dark';
    document.documentElement.dataset.theme = next;
    if (next === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
    try {
      window.localStorage.setItem('collab-deal-os-theme', next);
    } catch {
      // ignore
    }
    setTheme(next);
  }

  const creatorItems = [
    { label: 'Browse Deals', href: '/creator/connect', icon: Radio, highlight: true },
    { label: 'Messages', href: '/creator/messages', icon: MessageCircle },
    { label: 'Active Offers', href: '/creator/offers', icon: Handshake },
    { label: 'Wallet', href: '/creator/wallet', icon: WalletCards },
    { label: 'Analytics', href: '/creator/analytics', icon: BarChart3 },
  ];

  const brandItems = [
    { label: 'New Campaign', href: '/brand/campaigns/new', icon: FilePlus2, highlight: true },
    { label: 'Connect Marketplace', href: '/brand/connect', icon: Link2 },
    { label: 'Messages', href: '/brand/messages', icon: MessageCircle },
    { label: 'Review Offers', href: '/brand/offers', icon: Handshake },
    { label: 'Wallet', href: '/brand/wallet', icon: WalletCards },
  ];

  const items = role === 'creator' ? creatorItems : brandItems;
  const isDark = theme === 'dark';

  return (
    <div className="fixed bottom-6 right-6 z-50" ref={menuRef}>
      {/* Backdrop overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px] transition-opacity animate-in fade-in"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* Speed Dial Menu Popover */}
      {open && (
        <div
          role="menu"
          aria-label="Quick Actions"
          className="absolute bottom-16 right-0 z-50 mb-2 w-60 rounded-2xl border-2 border-[#0D0C1D] bg-white p-2.5 shadow-[6px_6px_0_#0D0C1D] transition-all animate-in slide-in-from-bottom-3 dark:border-[#2D334D] dark:bg-[#171927] dark:shadow-[6px_6px_0_#000000]"
        >
          <div className="mb-2 flex items-center justify-between border-b border-[#E0DACE] px-2.5 pb-2 text-[11px] font-bold uppercase tracking-wider text-[#5A5870] dark:border-[#2D334D] dark:text-[#9CA1BA]">
            <span>Quick Actions</span>
            <span className="rounded bg-[#EEF2FF] px-1.5 py-0.5 text-[10px] text-[#4F46E5] dark:bg-[#1E1F3B] dark:text-[#A5B4FC]">
              {role}
            </span>
          </div>

          <div className="grid gap-1">
            {items.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  role="menuitem"
                  onClick={() => setOpen(false)}
                  className={cn(
                    'flex items-center gap-3 rounded-[8px] px-3 py-2 text-sm font-semibold transition-all',
                    item.highlight
                      ? 'border border-[#0D0C1D] bg-[#4F46E5] text-white shadow-[2px_2px_0_#0D0C1D] hover:bg-[#4338CA] dark:border-[#2D334D] dark:bg-[#6366F1] dark:shadow-[2px_2px_0_#000]'
                      : 'text-[#0D0C1D] hover:bg-[#F5F2EA] dark:text-[#F3F4F8] dark:hover:bg-[#222538]',
                  )}
                >
                  <Icon className="size-4 shrink-0" aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              );
            })}

            {/* In-FAB Theme Switcher */}
            <button
              type="button"
              onClick={toggleTheme}
              className="mt-1 flex w-full items-center justify-between rounded-[8px] border-t border-[#E0DACE] px-3 pt-2 text-xs font-semibold text-[#5A5870] hover:text-[#0D0C1D] dark:border-[#2D334D] dark:text-[#9CA1BA] dark:hover:text-[#F3F4F8]"
            >
              <span className="flex items-center gap-2">
                {isDark ? <Sun className="size-4 text-amber-400" /> : <Moon className="size-4 text-indigo-500" />}
                <span>{isDark ? 'Light mode' : 'Dark mode'}</span>
              </span>
              <span className="rounded bg-[#F5F2EA] px-2 py-0.5 text-[10px] uppercase font-bold text-[#0D0C1D] dark:bg-[#222538] dark:text-[#F3F4F8]">
                {theme}
              </span>
            </button>
          </div>
        </div>
      )}

      {/* Main Floating Action Button with Premium Rotating Glowing Border */}
      <div className="relative fab-border-glow-wrapper z-50">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          aria-haspopup="menu"
          aria-label={open ? 'Close quick actions' : 'Open quick actions'}
          className={cn(
            'relative z-10 flex h-14 items-center gap-2 rounded-full px-4 font-bold transition-all hover:translate-x-[0.5px] hover:translate-y-[0.5px] active:translate-x-[1.5px] active:translate-y-[1.5px]',
            open
              ? 'bg-[#0D0C1D] text-white dark:bg-[#F3F4F8] dark:text-[#0D0C1D]'
              : 'bg-[#0D0C1D] text-white dark:bg-[#11131E] dark:text-[#F3F4F8]',
          )}
        >
          <span className="flex size-6 items-center justify-center transition-transform duration-200">
            {open ? <X className="size-5" /> : <Plus className="size-5 stroke-[2.5]" />}
          </span>
          <span className="pr-1 text-sm tracking-tight">{open ? 'Close' : 'Quick Actions'}</span>
        </button>
      </div>
    </div>
  );
}
