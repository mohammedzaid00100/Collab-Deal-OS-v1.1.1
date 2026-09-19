import Link from 'next/link';
import { ArrowLeft, Bot, CalendarClock, IndianRupee, ListChecks, Package, ShieldCheck } from 'lucide-react';
import { OfferActionPanel } from './offer-action-panel';
import { OfferStatus } from './offer-status';
import { formatInr } from '@/lib/utils';
import type { AccountType } from '@/types/domain';
import type { OfferEvent, OfferFeedItem, OfferRevision } from '@/types/offers';
import type { OfferInput } from '@/lib/validation/offer';

export function OfferDetails({ role, accountId, offer, revisions, events }: { role: AccountType; accountId: string; offer: OfferFeedItem; revisions: OfferRevision[]; events: OfferEvent[] }) {
  const otherName = role === 'creator' ? offer.brandName : offer.creatorName;
  const otherImage = role === 'creator' ? offer.brandLogoUrl : offer.creatorAvatarUrl;
  const initialValues: OfferInput = {
    cashPayment: offer.cashPayment, productName: offer.productName ?? '', productValue: offer.productValue,
    dealType: offer.dealType, deliverables: offer.deliverables.map((item) => ({ ...item, notes: item.notes ?? '' })),
    usageRights: offer.usageRights ?? '', usageDurationDays: offer.usageDurationDays ?? undefined,
    paidAdRights: offer.paidAdRights, exclusivity: offer.exclusivity,
    exclusivityDurationDays: offer.exclusivityDurationDays ?? undefined,
    deadline: offer.deadline ? new Date(offer.deadline).toISOString().slice(0, 16) : '',
    territory: offer.territory ?? '', notes: offer.notes ?? '',
  };

  return <>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-[#5A5870] transition hover:text-[#0D0C1D] dark:text-[#9CA1BA] dark:hover:text-[#F3F4F8]" href={`/${role}/offers`}>
      <ArrowLeft className="size-4" />Offers
    </Link>
    <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex items-start gap-4">
        <span
          className="flex size-14 shrink-0 items-center justify-center rounded-[10px] border-2 border-[#0D0C1D] bg-[#EEF2FF] bg-cover bg-center text-lg font-bold text-[#4F46E5] shadow-[3px_3px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-[3px_3px_0_#000000]"
          style={otherImage ? { backgroundImage: `url(${JSON.stringify(otherImage).slice(1, -1)})` } : undefined}
        >
          {!otherImage ? otherName.slice(0, 1).toUpperCase() : null}
        </span>
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <OfferStatus status={offer.status} />
            <span className="rounded-[6px] border border-[#0D0C1D] bg-[#F5F2EA] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#F3F4F8] dark:shadow-none">
              Version {offer.version}
            </span>
          </div>
          <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[#0D0C1D] sm:text-3xl dark:text-[#F3F4F8]">
            Offer with {otherName}
          </h1>
          <p className="mt-2 text-sm font-medium text-[#5A5870] dark:text-[#9CA1BA]">
            {offer.campaignTitle ?? 'Standalone collaboration offer'} · {direction(role, offer)}
          </p>
        </div>
      </div>
    </div>

    <section className="mt-7 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
      <Summary icon={IndianRupee} label="Cash payment" value={formatInr(offer.cashPayment)} detail="Current version" />
      <Summary icon={Package} label="Product value" value={offer.productValue ? formatInr(offer.productValue) : 'None'} detail={offer.productName ?? 'No product included'} />
      <Summary icon={IndianRupee} label="Combined value" value={formatInr(offer.cashPayment + offer.productValue)} detail={offer.dealType.replaceAll('_', ' ')} />
      <Summary icon={Bot} label="Latest AI score" value={offer.latestAnalysisScore != null ? `${offer.latestAnalysisScore}/100` : 'Not analyzed'} detail="Personal analysis history" />
    </section>

    <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1.25fr)_360px]">
      <div className="grid content-start gap-6">
        <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none">
              <ListChecks className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] dark:text-[#818CF8]">Current offer</p>
              <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Deliverables</h2>
            </div>
          </div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {offer.deliverables.map((item, index) => (
              <div className="flex items-start justify-between gap-3 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-4 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none" key={`${item.type}-${index}`}>
                <div>
                  <strong className="text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{item.type}</strong>
                  {item.notes ? <p className="mt-1 text-xs leading-5 text-[#5A5870] dark:text-[#9CA1BA]">{item.notes}</p> : null}
                </div>
                <span className="shrink-0 rounded-[6px] border border-[#0D0C1D] bg-white px-2.5 py-1 text-xs font-bold text-[#0D0C1D] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-none">
                  ×{item.quantity}
                </span>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-[8px] border-2 border-[#0D0C1D] bg-[#F0FDF4] text-emerald-700 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#142A1E] dark:text-emerald-300 dark:shadow-none">
              <ShieldCheck className="size-5" />
            </span>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-700 dark:text-emerald-400">Terms & Protection</p>
              <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Rights, timing, and conditions</h2>
            </div>
          </div>
          <dl className="mt-5 grid gap-3 sm:grid-cols-2">
            <Detail label="Usage rights" value={offer.usageRights ?? 'Not specified'} />
            <Detail label="Usage duration" value={offer.usageDurationDays != null ? `${offer.usageDurationDays} days` : 'Not specified'} />
            <Detail label="Paid advertising" value={offer.paidAdRights ? 'Included' : 'Not included'} />
            <Detail label="Exclusivity" value={offer.exclusivity ? `${offer.exclusivityDurationDays ?? '—'} days` : 'Not included'} />
            <Detail label="Territory" value={offer.territory ?? 'Not specified'} />
            <Detail label="Decision deadline" value={offer.deadline ? formatDate(offer.deadline) : 'Not specified'} />
          </dl>
          {offer.notes ? (
            <div className="mt-5 rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-4 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none">
              <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">Structured context</p>
              <p className="mt-2 text-sm font-medium leading-6 text-[#0D0C1D] dark:text-[#F3F4F8]">{offer.notes}</p>
            </div>
          ) : null}
        </section>

        <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000] sm:p-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] dark:text-[#818CF8]">Audit trail</p>
            <h2 className="mt-1 text-lg font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Offer revisions</h2>
            <p className="mt-1 text-xs text-[#5A5870] dark:text-[#9CA1BA]">Original Offer → revisions → current offer. Records are immutable.</p>
          </div>
          {revisions.length ? (
            <div className="mt-5 grid gap-4">
              {revisions.map((revision) => (
                <article className="rounded-[8px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[3px_3px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[3px_3px_0_#000000]" key={revision.id}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <strong className="text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Revision {revision.toVersion - 1}</strong>
                      <span className="rounded-[4px] border border-[#0D0C1D] bg-[#EEF2FF] px-1.5 py-0.5 text-xs font-bold text-[#4F46E5] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8]">
                        v{revision.fromVersion} → v{revision.toVersion}
                      </span>
                    </div>
                    <span className="text-[10px] font-semibold text-[#5A5870] dark:text-[#9CA1BA]">
                      {revision.changedBy === accountId ? 'Changed by you' : `Changed by ${otherName}`} · {formatDate(revision.createdAt)}
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {revision.changedFields.map((field) => (
                      <div className="rounded-[6px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-3 shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none" key={field}>
                        <span className="text-[10px] font-bold uppercase tracking-[0.06em] text-[#5A5870] dark:text-[#9CA1BA]">{fieldLabel(field)}</span>
                        <div className="mt-2 grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-xs">
                          <span className="truncate text-[#5A5870] dark:text-[#9CA1BA]">{formatRevisionValue(revision.oldValues[field], field)}</span>
                          <span className="font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">→</span>
                          <strong className="truncate font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{formatRevisionValue(revision.newValues[field], field)}</strong>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-[8px] border-2 border-dashed border-[#0D0C1D] bg-[#F5F2EA] p-4 text-sm font-medium text-[#5A5870] dark:border-[#262A3D] dark:bg-[#1E2134] dark:text-[#9CA1BA]">
              This is the original offer. No term revisions have been submitted.
            </div>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-6 xl:sticky xl:top-24">
        <OfferActionPanel offerId={offer.offerId} version={offer.version} role={role} status={offer.status} pendingWith={offer.pendingWith} initialValues={initialValues} />
        
        <section className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-5 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
          <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[#4F46E5] dark:text-[#818CF8]">Decision history</p>
          <h2 className="mt-1 text-sm font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">Shared status events</h2>
          <div className="mt-4 grid gap-3">
            {events.map((event) => (
              <div className="grid grid-cols-[10px_1fr] items-start gap-3" key={event.id}>
                <span className="mt-1 size-2.5 rounded-full border border-[#0D0C1D] bg-[#4F46E5] shadow-[1px_1px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#6366F1]" />
                <div>
                  <strong className="block text-xs font-bold text-[#0D0C1D] dark:text-[#F3F4F8]">{fieldLabel(event.eventType)}</strong>
                  <span className="mt-0.5 block text-[10px] font-medium text-[#5A5870] dark:text-[#9CA1BA]">
                    v{event.version} · {event.actorUserId ? (event.actorUserId === accountId ? 'You' : otherName) : 'System'} · {formatDate(event.createdAt)}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {offer.campaignId ? (
          <Link
            className="flex min-h-11 items-center justify-between rounded-[8px] border-2 border-[#0D0C1D] bg-white px-4 text-xs font-bold text-[#0D0C1D] shadow-[3px_3px_0_#0D0C1D] transition-all hover:translate-x-[1.5px] hover:translate-y-[1.5px] hover:shadow-[1.5px_1.5px_0_#0D0C1D] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none dark:border-[#262A3D] dark:bg-[#161826] dark:text-[#F3F4F8] dark:shadow-[3px_3px_0_#000000]"
            href={role === 'brand' ? `/brand/campaigns/${offer.campaignId}` : `/creator/opportunities/${offer.campaignId}`}
          >
            View linked campaign
            <CalendarClock className="size-4 text-[#5A5870] dark:text-[#9CA1BA]" />
          </Link>
        ) : null}
      </aside>
    </div>
  </>;
}

function Summary({ icon: Icon, label, value, detail }: { icon: typeof IndianRupee; label: string; value: string; detail: string }) {
  return (
    <div className="rounded-[10px] border-2 border-[#0D0C1D] bg-white p-4 shadow-[4px_4px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#161826] dark:shadow-[4px_4px_0_#000000]">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-[0.06em] text-[#5A5870] dark:text-[#9CA1BA]">{label}</span>
        <span className="flex size-8 items-center justify-center rounded-[6px] border-2 border-[#0D0C1D] bg-[#EEF2FF] text-[#4F46E5] shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E1F3B] dark:text-[#818CF8] dark:shadow-none">
          <Icon className="size-4" aria-hidden="true" />
        </span>
      </div>
      <strong className="mt-3 block truncate text-xl font-bold tracking-[-0.03em] text-[#0D0C1D] dark:text-[#F3F4F8] sm:text-2xl">{value}</strong>
      <span className="mt-1 block truncate text-xs font-medium text-[#5A5870] dark:text-[#9CA1BA]">{detail}</span>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[8px] border-2 border-[#0D0C1D] bg-[#F5F2EA] p-3.5 shadow-[2px_2px_0_#0D0C1D] dark:border-[#262A3D] dark:bg-[#1E2134] dark:shadow-none">
      <dt className="text-[10px] font-bold uppercase tracking-[0.08em] text-[#5A5870] dark:text-[#9CA1BA]">{label}</dt>
      <dd className="mt-1 text-sm font-bold leading-6 text-[#0D0C1D] dark:text-[#F3F4F8]">{value}</dd>
    </div>
  );
}

function direction(role: AccountType, offer: OfferFeedItem) {
  if (!offer.pendingWith) return 'Decision recorded';
  return offer.pendingWith === role ? 'Your action required' : `Awaiting ${offer.pendingWith}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

function fieldLabel(value: string) {
  return value.replaceAll('_', ' ').replace(/^./, (letter) => letter.toUpperCase());
}

function formatRevisionValue(value: unknown, field: string) {
  if (value == null || value === '') return 'None';
  if (field.includes('payment') || field.includes('value')) return formatInr(Number(value));
  if (typeof value === 'boolean') return value ? 'Included' : 'Not included';
  if (Array.isArray(value)) return `${value.length} item${value.length === 1 ? '' : 's'}`;
  if (field === 'deadline') return formatDate(String(value));
  return String(value);
}

