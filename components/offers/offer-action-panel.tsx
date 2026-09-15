'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { BadgeCheck, Bot, CircleAlert, CircleX, FilePenLine, Send, SquareCheckBig } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import type { AccountType } from '@/types/domain';
import type { OfferStatus } from '@/types/offers';
import type { OfferInput } from '@/lib/validation/offer';
import { OfferTermsForm } from './offer-terms-form';

export function OfferActionPanel({ offerId, version, role, status, pendingWith, initialValues }: { offerId: string; version: number; role: AccountType; status: OfferStatus; pendingWith: AccountType | null; initialValues: OfferInput }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [revising, setRevising] = useState(false);
  const yourTurn = pendingWith === role && ['SENT', 'UNDER_REVIEW', 'REVISED'].includes(status);

  async function call(name: string, args: Record<string, unknown>, success?: () => void) {
    setPending(name);
    setError(null);
    const supabase = createSupabaseBrowserClient();
    if (!supabase) return finish('Supabase is not connected.');
    const { error: rpcError } = await supabase.rpc(name, args);
    if (rpcError) return finish(rpcError.message);
    setPending(null);
    success?.();
    router.refresh();
  }

  function finish(message: string) { setError(message); setPending(null); }
  function decide(decision: 'ACCEPT' | 'REJECT') {
    if (decision === 'REJECT' && !window.confirm('Reject the current offer? This records a final decision for this version.')) return;
    void call('decide_structured_offer', { target_offer_id: offerId, expected_version: version, decision });
  }

  return <>
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-[10px] font-bold uppercase tracking-[0.12em] text-violet-700">Structured actions</p><h2 className="mt-1 text-lg font-bold text-slate-950">{actionTitle(role, status, pendingWith)}</h2><p className="mt-2 text-xs leading-5 text-slate-500">Decisions and term changes are recorded in the offer history. There is no chat thread.</p><div className="mt-5 grid gap-2">
      {status === 'DRAFT' && role === 'brand' ? <><Button type="button" loading={pending === 'send_structured_offer'} onClick={() => call('send_structured_offer', { target_offer_id: offerId, expected_version: version })}><Send className="size-4" />Send offer</Button><Button type="button" variant="secondary" onClick={() => setRevising((value) => !value)}><FilePenLine className="size-4" />Edit private draft</Button></> : null}
      {yourTurn ? <><Button type="button" loading={pending === 'decide_structured_offer'} onClick={() => decide('ACCEPT')}><BadgeCheck className="size-4" />{role === 'brand' ? 'Accept revision' : 'Accept offer'}</Button><Button type="button" variant="secondary" onClick={() => setRevising((value) => !value)}><FilePenLine className="size-4" />{role === 'brand' ? 'Revise again' : 'Revise offer'}</Button><Button type="button" variant="danger" loading={pending === 'decide_structured_offer'} onClick={() => decide('REJECT')}><CircleX className="size-4" />{role === 'brand' ? 'Reject revision' : 'Reject offer'}</Button></> : null}
      {role === 'creator' && pendingWith === 'creator' && (status === 'SENT' || status === 'REVISED') ? <Button type="button" variant="secondary" loading={pending === 'mark_offer_under_review'} onClick={() => call('mark_offer_under_review', { target_offer_id: offerId, expected_version: version })}><Bot className="size-4" />Mark under review</Button> : null}
      {role === 'brand' && status === 'ACCEPTED' ? <Button type="button" loading={pending === 'complete_structured_offer'} onClick={() => call('complete_structured_offer', { target_offer_id: offerId, expected_version: version })}><SquareCheckBig className="size-4" />Close completed deal</Button> : null}
      {!yourTurn && status !== 'DRAFT' && status !== 'ACCEPTED' ? <div className="rounded-xl bg-slate-50 p-3 text-xs leading-5 text-slate-500">{status === 'COMPLETED' ? 'This deal is closed.' : status === 'REJECTED' ? 'This offer was rejected.' : status === 'EXPIRED' ? 'This offer has expired.' : `Awaiting ${pendingWith ?? 'a recorded decision'}.`}</div> : null}
    </div>{error ? <div className="mt-3 flex gap-2 rounded-xl bg-red-50 p-3 text-xs text-red-700" role="alert"><CircleAlert className="size-4 shrink-0" />{error}</div> : null}</section>
    {revising ? <div className="mt-6"><div className="mb-4"><p className="text-xs font-bold uppercase tracking-[0.1em] text-violet-700">{status === 'DRAFT' ? 'Private draft' : 'New revision'}</p><h2 className="mt-1 text-xl font-bold tracking-[-0.03em] text-slate-950">{status === 'DRAFT' ? 'Edit draft terms' : 'Revise structured terms'}</h2></div><OfferTermsForm role={role} mode={status === 'DRAFT' ? 'edit-draft' : 'revise'} offerId={offerId} expectedVersion={version} initialValues={initialValues} /></div> : null}
  </>;
}

function actionTitle(role: AccountType, status: OfferStatus, pendingWith: AccountType | null) { if (status === 'DRAFT') return 'Ready to send'; if (status === 'ACCEPTED') return role === 'brand' ? 'Accepted—close when complete' : 'Offer accepted'; if (status === 'COMPLETED') return 'Deal closed'; if (status === 'REJECTED') return 'Offer rejected'; if (status === 'EXPIRED') return 'Offer expired'; return pendingWith === role ? 'Your decision is required' : `Awaiting ${pendingWith ?? 'decision'}`; }
