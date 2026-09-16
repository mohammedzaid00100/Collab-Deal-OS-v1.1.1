import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/lib/supabase/server';

const COMMISSION_RATE = 0.08;

export async function POST(request: Request) {
  const supabase = await createSupabaseServerClient();
  if (!supabase) return NextResponse.json({ ok: false, message: 'Supabase is not configured.' }, { status: 503 });

  const { data: authData, error: authError } = await supabase.auth.getUser();
  const user = authData.user;
  if (authError || !user) return NextResponse.json({ ok: false, message: 'Sign in required.' }, { status: 401 });

  const body = await request.json().catch(() => null) as {
    conversationId?: string;
    campaignId?: string;
    creatorProfileId?: string;
    creatorAmount?: number;
  } | null;

  const conversationId = body?.conversationId ?? '';
  const campaignId = body?.campaignId ?? '';
  const creatorProfileId = body?.creatorProfileId ?? '';
  const creatorAmount = Number(body?.creatorAmount ?? 0);
  if (!conversationId || !campaignId || !creatorProfileId || !Number.isFinite(creatorAmount) || creatorAmount <= 0) {
    return NextResponse.json({ ok: false, message: 'Invalid prototype deal payment.' }, { status: 400 });
  }

  const { data: conversation, error: conversationError } = await supabase
    .from('conversations')
    .select('id,campaign_id,brand_profile_id,creator_profile_id')
    .eq('id', conversationId)
    .maybeSingle();
  if (conversationError || !conversation) return NextResponse.json({ ok: false, message: 'Conversation is unavailable.' }, { status: 404 });
  if (conversation.campaign_id !== campaignId || conversation.creator_profile_id !== creatorProfileId) {
    return NextResponse.json({ ok: false, message: 'Deal payment does not match this conversation.' }, { status: 409 });
  }

  const { data: brandProfile } = await supabase
    .from('brand_profiles')
    .select('user_id')
    .eq('id', conversation.brand_profile_id)
    .eq('user_id', user.id)
    .maybeSingle();
  if (!brandProfile) return NextResponse.json({ ok: false, message: 'Brand access required.' }, { status: 403 });

  const platformFee = Math.round(creatorAmount * COMMISSION_RATE * 100) / 100;
  const brandTotal = Math.round((creatorAmount + platformFee) * 100) / 100;

  const { data, error } = await supabase
    .from('prototype_deal_events')
    .insert({
      conversation_id: conversationId,
      campaign_id: campaignId,
      brand_user_id: user.id,
      creator_profile_id: creatorProfileId,
      creator_amount_inr: creatorAmount,
      commission_rate: COMMISSION_RATE,
      platform_fee_inr: platformFee,
      brand_total_inr: brandTotal,
      status: 'COMPLETED',
    })
    .select('id,creator_amount_inr,platform_fee_inr,brand_total_inr,created_at')
    .single();

  if (error) return NextResponse.json({ ok: false, message: 'Could not record the prototype deal completion.' }, { status: 500 });
  return NextResponse.json({ ok: true, deal: data }, { status: 201 });
}
