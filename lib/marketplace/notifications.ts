import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotificationItem } from '@/components/notifications/notification-center';

export async function getNotifications(client: SupabaseClient): Promise<NotificationItem[]> { const { data, error } = await client.from('notifications').select('id,type,title,body,action_url,read_at,created_at').order('created_at', { ascending: false }).limit(100); if (error) throw new Error('Notifications are temporarily unavailable.'); return (data ?? []).map((row) => ({ id: String(row.id), type: String(row.type), title: String(row.title), body: String(row.body), actionUrl: row.action_url as string | null, readAt: row.read_at as string | null, createdAt: String(row.created_at) })); }
