import { redirect } from 'next/navigation';
import { createSupabaseServerClient } from '@/lib/supabase/server';

export async function requireDeveloperAccess() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) redirect('/login');

  const { data, error } = await supabase.auth.getUser();
  const user = data.user;
  if (error || !user) redirect('/login');

  const { data: adminResult, error: adminError } = await supabase.rpc('is_developer_admin');
  if (adminError || adminResult !== true) redirect('/');
  return user;
}

export async function canUseDeveloperApi() {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return false;
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;

  const { data: adminResult, error: adminError } = await supabase.rpc('is_developer_admin');
  return !adminError && adminResult === true;
}
