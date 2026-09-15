begin;

create extension if not exists pgtap with schema extensions;
select plan(16);

select has_table('public', 'users', 'users table exists');
select has_table('public', 'creator_profiles', 'creator profiles table exists');
select has_table('public', 'brand_profiles', 'brand profiles table exists');
select has_table('public', 'social_accounts', 'social accounts table exists');
select has_table('public', 'usage_limits', 'usage limits table exists');
select has_table('public', 'offer_revisions', 'offer revisions table exists');

select ok((select relrowsecurity from pg_class where oid = 'public.users'::regclass), 'users RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.creator_profiles'::regclass), 'creator profile RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.brand_profiles'::regclass), 'brand profile RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.social_accounts'::regclass), 'social account RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.offers'::regclass), 'offers RLS is enabled');
select ok((select relrowsecurity from pg_class where oid = 'public.deal_analyses'::regclass), 'analysis RLS is enabled');

select ok(
  not has_table_privilege('authenticated', 'public.offer_revisions', 'INSERT'),
  'authenticated clients cannot insert offer revisions directly'
);
select ok(
  not has_table_privilege('authenticated', 'public.subscriptions', 'UPDATE'),
  'authenticated clients cannot activate subscriptions directly'
);
select ok(
  has_function_privilege('authenticated', 'public.complete_creator_onboarding(jsonb,jsonb)', 'EXECUTE'),
  'creator onboarding RPC is available to authenticated users'
);
select ok(
  not has_function_privilege('anon', 'public.complete_creator_onboarding(jsonb,jsonb)', 'EXECUTE'),
  'anonymous users cannot execute creator onboarding'
);

select * from finish();
rollback;
