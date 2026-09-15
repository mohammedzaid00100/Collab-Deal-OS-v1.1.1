import type { Metadata } from 'next';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/app/app-shell';
import { CampaignBuilderForm } from '@/components/campaigns/campaign-builder-form';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';

export const metadata: Metadata = { title: 'Create campaign' };

export default async function NewCampaignPage() {
  const account = await requireAppAccount('brand');
  if (!account) return <AppShell role="brand" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>;

  return <AppShell role="brand" displayName={account.displayName ?? 'Brand'} email={account.email} plan={account.plan}>
    <Link className="inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-slate-500 transition hover:text-slate-950" href="/brand/campaigns"><ArrowLeft className="size-4" />Campaigns</Link>
    <div className="mt-3"><p className="text-xs font-bold uppercase tracking-[0.1em] text-blue-700">Campaign builder</p><h1 className="mt-1 text-2xl font-bold tracking-[-0.035em] text-slate-950 sm:text-3xl">Create a structured campaign</h1><p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">Define creator fit, deal value, deliverables, rights, and timing before the matching engine evaluates eligible creators.</p></div>
    <CampaignBuilderForm />
  </AppShell>;
}
