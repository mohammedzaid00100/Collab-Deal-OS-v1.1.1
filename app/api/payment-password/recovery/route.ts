import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const CODE_TTL_MINUTES = 10;
const RESET_TTL_MINUTES = 10;
const MAX_CODE_ATTEMPTS = 5;
const RESEND_COOLDOWN_SECONDS = 60;

type RecoveryBody = {
  action?: 'request' | 'verify' | 'reset';
  email?: string;
  code?: string;
  resetToken?: string;
  newPassword?: string;
};

function getRecoverySecret() {
  return process.env.PAYMENT_PASSWORD_RESET_SECRET?.trim()
    || process.env.MAINTENANCE_JOB_SECRET?.trim()
    || process.env.SUPABASE_SECRET_KEY?.trim()
    || process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()
    || '';
}

function digest(secret: string, userId: string, value: string) {
  return createHmac('sha256', secret).update(`${userId}:${value}`).digest('hex');
}

function sameHash(a: string, b: string) {
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const secret = getRecoverySecret();
  if (!supabase || !admin || !secret) {
    return NextResponse.json({ ok: false, message: 'Payment-password recovery is not configured.' }, { status: 503 });
  }

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user || !user.email) {
    return NextResponse.json({ ok: false, message: 'Sign in is required.' }, { status: 401 });
  }

  const body = await request.json().catch(() => null) as RecoveryBody | null;
  if (!body?.action) {
    return NextResponse.json({ ok: false, message: 'Invalid recovery request.' }, { status: 400 });
  }

  if (body.action === 'request') {
    const enteredEmail = body.email?.trim().toLowerCase() ?? '';
    const accountEmail = user.email.trim().toLowerCase();
    if (!enteredEmail || enteredEmail !== accountEmail) {
      return NextResponse.json({
        ok: false,
        code: 'EMAIL_MISMATCH',
        message: 'Enter the same email address used for this Collab Deal OS account.',
      }, { status: 400 });
    }

    const resendKey = process.env.RESEND_API_KEY?.trim();
    const from = process.env.RESEND_FROM_EMAIL?.trim();
    if (!resendKey || !from) {
      return NextResponse.json({ ok: false, message: 'Verification email delivery is not configured yet.' }, { status: 503 });
    }

    const { data: recent } = await admin
      .from('payment_password_resets')
      .select('created_at')
      .eq('user_id', user.id)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (recent?.created_at) {
      const secondsAgo = (Date.now() - new Date(recent.created_at).getTime()) / 1000;
      if (secondsAgo < RESEND_COOLDOWN_SECONDS) {
        return NextResponse.json({ ok: false, message: 'A code was sent recently. Please wait a moment before requesting another.' }, { status: 429 });
      }
    }

    const code = String(randomInt(100000, 1000000));
    const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60_000).toISOString();
    const codeHash = digest(secret, user.id, code);

    await admin.from('payment_password_resets').delete().eq('user_id', user.id).is('consumed_at', null);
    const { data: resetRow, error: insertError } = await admin
      .from('payment_password_resets')
      .insert({
        user_id: user.id,
        code_hash: codeHash,
        expires_at: expiresAt,
        attempts_remaining: MAX_CODE_ATTEMPTS,
      })
      .select('id')
      .single();

    if (insertError || !resetRow) {
      return NextResponse.json({ ok: false, message: 'Could not start payment-password recovery.' }, { status: 500 });
    }

    const emailResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [accountEmail],
        subject: 'Collab Deal OS payment password verification code',
        text: `Your Collab Deal OS payment password verification code is ${code}. It expires in ${CODE_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
      }),
    });

    if (!emailResponse.ok) {
      await admin.from('payment_password_resets').delete().eq('id', resetRow.id);
      return NextResponse.json({ ok: false, message: 'Could not send the verification email. Please try again.' }, { status: 502 });
    }

    return NextResponse.json({ ok: true, message: 'Verification code sent.' });
  }

  if (body.action === 'verify') {
    const code = body.code?.trim() ?? '';
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ ok: false, message: 'Enter the 6-digit verification code.' }, { status: 400 });
    }

    const { data: row } = await admin
      .from('payment_password_resets')
      .select('id,code_hash,expires_at,attempts_remaining')
      .eq('user_id', user.id)
      .is('verified_at', null)
      .is('consumed_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (!row || new Date(row.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ ok: false, message: 'The verification code has expired. Request a new code.' }, { status: 410 });
    }
    if ((row.attempts_remaining ?? 0) <= 0) {
      return NextResponse.json({ ok: false, message: 'Too many incorrect code attempts. Request a new code.' }, { status: 423 });
    }

    const candidateHash = digest(secret, user.id, code);
    if (!sameHash(candidateHash, row.code_hash)) {
      const remaining = Math.max(0, Number(row.attempts_remaining ?? MAX_CODE_ATTEMPTS) - 1);
      await admin.from('payment_password_resets').update({ attempts_remaining: remaining }).eq('id', row.id);
      return NextResponse.json({
        ok: false,
        message: remaining > 0 ? `Incorrect code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.` : 'Too many incorrect code attempts. Request a new code.',
      }, { status: remaining > 0 ? 400 : 423 });
    }

    const resetToken = randomBytes(32).toString('hex');
    const resetTokenHash = digest(secret, user.id, resetToken);
    const resetTokenExpiresAt = new Date(Date.now() + RESET_TTL_MINUTES * 60_000).toISOString();
    const { error: verifyError } = await admin.from('payment_password_resets').update({
      verified_at: new Date().toISOString(),
      reset_token_hash: resetTokenHash,
      reset_token_expires_at: resetTokenExpiresAt,
      attempts_remaining: MAX_CODE_ATTEMPTS,
    }).eq('id', row.id);

    if (verifyError) {
      return NextResponse.json({ ok: false, message: 'Could not verify the code.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, resetToken });
  }

  const resetToken = body.resetToken?.trim() ?? '';
  const newPassword = body.newPassword ?? '';
  if (!resetToken) {
    return NextResponse.json({ ok: false, message: 'Verify your email before changing the payment password.' }, { status: 400 });
  }
  if (newPassword.length < 6 || newPassword.length > 128) {
    return NextResponse.json({ ok: false, message: 'Use a payment password between 6 and 128 characters.' }, { status: 400 });
  }

  const { data: row } = await admin
    .from('payment_password_resets')
    .select('id,reset_token_hash,reset_token_expires_at')
    .eq('user_id', user.id)
    .not('verified_at', 'is', null)
    .is('consumed_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!row?.reset_token_hash || !row.reset_token_expires_at || new Date(row.reset_token_expires_at).getTime() <= Date.now()) {
    return NextResponse.json({ ok: false, message: 'This password-reset session has expired. Start again.' }, { status: 410 });
  }

  const candidateTokenHash = digest(secret, user.id, resetToken);
  if (!sameHash(candidateTokenHash, row.reset_token_hash)) {
    return NextResponse.json({ ok: false, message: 'Invalid password-reset session.' }, { status: 403 });
  }

  const { data: resetResult, error: resetError } = await admin.rpc('admin_reset_payment_password', {
    target_user_id: user.id,
    new_password: newPassword,
  });
  if (resetError || resetResult !== true) {
    return NextResponse.json({ ok: false, message: 'Could not change the payment password.' }, { status: 500 });
  }

  await admin.from('payment_password_resets').update({ consumed_at: new Date().toISOString() }).eq('id', row.id);
  return NextResponse.json({ ok: true, message: 'Payment password changed successfully.' });
}
