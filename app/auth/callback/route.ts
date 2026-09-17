import { NextResponse, type NextRequest } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { isSafeInternalPath } from '@/lib/utils';
import { accountHome } from '@/lib/auth/account';
import type { AccountType } from '@/types/domain';

interface AccountCallbackRow {
  account_type: AccountType;
  onboarding_complete: boolean;
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = url.searchParams.get('next');
  const requestedRole = url.searchParams.get('role');
  const role: AccountType | null = requestedRole === 'creator' || requestedRole === 'brand' ? requestedRole : null;
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

  if (role) {
    const { data: claimedRole, error: roleError } = await supabase.rpc('claim_account_role', { desired_role: role });
    if (roleError) {
      return NextResponse.redirect(new URL(`/login?role=${role}&error=account_unavailable`, url.origin));
    }

    if (claimedRole !== role) {
      await supabase.auth.signOut();
      return NextResponse.redirect(new URL(`/login?role=${role}&error=role_mismatch`, url.origin));
    }
  }

  if (isSafeInternalPath(next)) return NextResponse.redirect(new URL(next, url.origin));

  const { data, error: accountError } = await supabase
    .from('account_state')
    .select('account_type,onboarding_complete')
    .maybeSingle();
  const account = data as AccountCallbackRow | null;

  if (accountError) {
    return NextResponse.redirect(new URL('/login?error=account_unavailable', url.origin));
  }

  if (!account?.account_type) {
    return NextResponse.redirect(new URL('/signup?error=role_required', url.origin));
  }

  return NextResponse.redirect(new URL(accountHome({
    accountType: account.account_type,
    onboardingComplete: account.onboarding_complete,
  }), url.origin));
}
