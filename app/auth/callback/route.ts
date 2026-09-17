import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSafeInternalPath } from '@/lib/utils';
import { accountHome } from '@/lib/auth/account';
import type { AccountType } from '@/types/domain';

interface AccountCallbackRow {
  account_type: AccountType;
  onboarding_complete: boolean;
}

function parseRole(value: string | null | undefined): AccountType | null {
  return value === 'creator' || value === 'brand' ? value : null;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const queryRole = parseRole(url.searchParams.get('role'));
  const cookieRole = parseRole(request.cookies.get('collab-deal-os-role')?.value);
  const requestedRole = queryRole ?? cookieRole;
  const supabase = await createSupabaseServerClient();

  if (!supabase) {
    return NextResponse.redirect(new URL('/login?error=service_not_configured', url.origin));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=invalid_callback', url.origin));
  }

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) {
    return NextResponse.redirect(new URL('/login?error=authentication_failed', url.origin));
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  const metadataRole = parseRole(user?.user_metadata?.account_type as string | undefined);
  const role = requestedRole ?? metadataRole;

  if (role) {
    const { data: claimedRole, error: roleError } = await supabase.rpc('claim_account_role', { desired_role: role });
    if (roleError) {
      return clearRoleCookie(NextResponse.redirect(new URL(`/login?role=${role}&error=account_unavailable`, url.origin)));
    }

    if (claimedRole !== role) {
      await supabase.auth.signOut();
      return clearRoleCookie(NextResponse.redirect(new URL(`/login?role=${role}&error=role_mismatch`, url.origin)));
    }
  }

  if (isSafeInternalPath(next)) {
    return clearRoleCookie(NextResponse.redirect(new URL(next, url.origin)));
  }

  const { data, error: accountError } = await supabase
    .from('account_state')
    .select('account_type,onboarding_complete')
    .eq('id', user?.id ?? '')
    .maybeSingle();
  const account = data as AccountCallbackRow | null;

  if (accountError) {
    return clearRoleCookie(NextResponse.redirect(new URL('/login?error=account_unavailable', url.origin)));
  }

  if (!account?.account_type) {
    return clearRoleCookie(NextResponse.redirect(new URL('/signup?error=role_required', url.origin)));
  }

  return clearRoleCookie(NextResponse.redirect(new URL(accountHome({
    accountType: account.account_type,
    onboardingComplete: account.onboarding_complete,
  }), url.origin)));
}

function clearRoleCookie(response: NextResponse) {
  response.cookies.set('collab-deal-os-role', '', {
    path: '/',
    maxAge: 0,
    sameSite: 'lax',
  });
  return response;
}
