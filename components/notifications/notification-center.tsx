'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Bell, Bot, CircleAlert, CircleCheck, Handshake, Sparkles, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
}

export function NotificationCenter({ initialItems }: { initialItems: NotificationItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const unread = items.filter((item) => !item.readAt).length;

  async function markRead(id?: string) {
    setPending(true);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return finish('Supabase is not connected.');
    let query = supabase.from('notifications').update({ read_at: new Date().toISOString() }).is('read_at', null);
    if (id) query = query.eq('id', id);
    const { error: updateError } = await query;
    if (updateError) return finish(updateError.message);
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => (!id || item.id === id) ? { ...item, readAt } : item));
    setPending(false);
  }

  function finish(message: string) { setError(message); setPending(false); }

  return <><div className="mt-6 flex items-center justify-between gap-3"><p className="text-xs font-semibold text-slate-500">{unread} unread · {items.length} recent</p>{unread ? <Button type="button" variant="secondary" loading={pending} onClick={() => markRead()}>Mark all read</Button> : null}</div>{error ? <div className="mt-3 rounded-xl bg-red-50 p-3 text-xs text-red-700" role="alert">{error}</div> : null}<section className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm" aria-label="Notifications">{items.map((item) => { const Icon = iconFor(item.type); const content = <><span className={item.readAt ? 'bg-slate-100 text-slate-500' : 'bg-violet-50 text-violet-700'}><Icon className="size-5" /></span><span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><strong className="text-sm text-slate-900">{item.title}</strong><time className="shrink-0 text-[10px] text-slate-400">{formatDate(item.createdAt)}</time></span><span className="mt-1 block text-xs leading-5 text-slate-500">{item.body}</span></span>{!item.readAt ? <span className="mt-2 size-2 shrink-0 rounded-full bg-violet-600" aria-label="Unread" /> : null}</>; return item.actionUrl ? <Link className="flex gap-3 border-b border-slate-100 p-4 transition last:border-0 hover:bg-slate-50 sm:p-5 [&>span:first-child]:flex [&>span:first-child]:size-10 [&>span:first-child]:shrink-0 [&>span:first-child]:items-center [&>span:first-child]:justify-center [&>span:first-child]:rounded-xl" href={item.actionUrl} onClick={() => { if (!item.readAt) void markRead(item.id); }} key={item.id}>{content}</Link> : <article className="flex gap-3 border-b border-slate-100 p-4 last:border-0 sm:p-5 [&>span:first-child]:flex [&>span:first-child]:size-10 [&>span:first-child]:shrink-0 [&>span:first-child]:items-center [&>span:first-child]:justify-center [&>span:first-child]:rounded-xl" key={item.id}>{content}</article>; })}</section></>;
}

function iconFor(type: string) { if (type.includes('OFFER')) return Handshake; if (type.includes('AI')) return Bot; if (type.includes('CAMPAIGN')) return UsersRound; if (type.includes('SUBSCRIPTION')) return Sparkles; if (type.includes('FAILED') || type.includes('EXHAUSTED')) return CircleAlert; if (type.includes('ACCEPTED') || type.includes('READY')) return CircleCheck; return Bell; }
function formatDate(value: string) { return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
