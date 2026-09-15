import type { Metadata } from 'next';
import { AppShell } from '@/components/app/app-shell';
import { NotificationsView } from '@/components/notifications/notifications-view';
import { ServiceState } from '@/components/ui/service-state';
import { requireAppAccount } from '@/lib/auth/protected-page';
import { getNotifications } from '@/lib/marketplace/notifications';
import { createSupabaseServerClient } from '@/lib/supabase/server';
export const metadata: Metadata = { title: 'Notifications' };
export default async function CreatorNotificationsPage() { const account = await requireAppAccount('creator'); if (!account) return <AppShell role="creator" displayName="Setup required" email="Supabase not connected" plan="FREE"><ServiceState /></AppShell>; const supabase = await createSupabaseServerClient(); const items = await getNotifications(supabase!); return <AppShell role="creator" displayName={account.displayName ?? 'Creator'} email={account.email} plan={account.plan}><NotificationsView items={items} /></AppShell>; }
