import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireDeveloperAccess() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/login');

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) redirect('/login');

  const configured = (process.env.DEVELOPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const email = user.email?.trim().toLowerCase() ?? '';
  const allowed = process.env.NODE_ENV !== 'production' || (email && configured.includes(email));

  if (!allowed) redirect('/');
  return user;
}

export async function canUseDeveloperApi() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) return false;

  const configured = (process.env.DEVELOPER_ADMIN_EMAILS ?? '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  const email = user.email?.trim().toLowerCase() ?? '';
  return process.env.NODE_ENV !== 'production' || Boolean(email && configured.includes(email));
}
