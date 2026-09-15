import { Bell } from 'lucide-react';
import { EmptyState } from '@/components/app/empty-state';
import { NotificationCenter, type NotificationItem } from './notification-center';

export function NotificationsView({ items }: { items: NotificationItem[] }) { return <><div><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">Activity center</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Notifications</h1><p className="mt-2 max-w-2xl text-sm leading-6 text-slate-500">Offer decisions, campaign matches, AI results, and account events appear here. Notifications replace the need for a message inbox.</p></div>{items.length ? <NotificationCenter initialItems={items} /> : <section className="mt-7 rounded-2xl border border-slate-200 bg-white p-5"><EmptyState icon={Bell} title="You’re all caught up" description="Important structured deal and account activity will appear here." /></section>}</>; }
