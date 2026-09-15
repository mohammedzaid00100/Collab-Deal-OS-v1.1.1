import { createClient } from '@supabase/supabase-js';

export function createSupabaseAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const secretKey = process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  if (!url || !secretKey) return null;

  return createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function createPrivateAssetUrl(bucket: string, path: string | null, expiresIn = 900) {
  if (!path) return null;
  const admin = createSupabaseAdminClient();
  if (!admin) return null;
  const { data, error } = await admin.storage.from(bucket).createSignedUrl(path, expiresIn);
  return error ? null : data.signedUrl;
}
