# Deployment and operations

The website and Android wrapper use the same Supabase data and server endpoints. Local configuration, implemented integrations, and verified live operation are separate milestones. No provider credentials are included.

## Database and identity

1. Provision a Supabase project you control. Apply all numbered files in `supabase/migrations` in order; use `supabase db push` only after linking the intended project. Never run `db reset` against production.
2. `supabase/seed.sql` contains development benchmark configuration. Inspect it before loading; benchmarks are internal assumptions, not independently verified market rates. PGlite test fixtures are isolated and never seed production users or subscriptions.
3. Configure `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, and server-only `SUPABASE_SECRET_KEY` in the hosting secret manager. Legacy anon/service-role variables remain fallback-only for older projects.
4. Set `NEXT_PUBLIC_SITE_URL` to the exact HTTPS application origin. Enable email/password and Google in Supabase, configure custom SMTP for Auth emails, and configure the Google consent screen/client separately.
5. Allow the production `/auth/callback`, `/auth/mobile-callback`, and `/reset-password` URLs in Supabase. For local development allow `http://localhost:3000/auth/callback` and `/reset-password`. Keep the Google Cloud redirect URI set to the callback supplied by Supabase, not the mobile custom scheme.
6. Run `npm run setup -- --check-database` with local environment values to perform read-only database checks. This does not test Google login or external provider calls.

Public browser configuration is built into browser assets. Rebuild when those values change. Private credentials belong only in server runtime secrets. Confirm hosted runtime environment injection and Supabase connectivity after deployment.

## AI

Set `OPENAI_API_KEY` and an explicit `OPENAI_MODEL` supporting Responses API strict structured output. Use a scoped project key and configure provider spending alerts. No model is silently selected.

The pricing engine computes all monetary outputs first. The model explains the stored snapshot; it cannot override deterministic prices, verdict, or counteroffer. Free accounts receive five lifetime successful evaluations, not five per month. Failed requests refund reservations once; scheduled maintenance sweeps abandoned requests. The database is authoritative for quotas and idempotency.

## Subscriptions

Pro costs INR 299/month and Premium INR 599/month for either role. Their AI allowances remain intentionally unconfigured pending the product owner's decision. Set approved positive values in `plan_entitlements.ai_evaluations_per_period` for `PRO` and `PREMIUM` using a reviewed migration. These two allowances are currently shared across creator and brand accounts. Do not copy test-fixture allowances into production.

In Razorpay, create monthly INR plans and set all four role/tier plan IDs from `.env.example`. The same provider plan may be mapped to both roles if commercially appropriate. The checkout endpoint verifies actual provider amount, currency, and interval before creating a subscription. Set the explicit `RAZORPAY_SUBSCRIPTION_TOTAL_COUNT` after deciding the maximum billing duration; it is not an unlimited subscription.

Set Razorpay keys and webhook secret. Register `POST /api/webhooks/razorpay` for subscription lifecycle and payment events. Keep test and live credentials separate. Optionally set `RAZORPAY_ACCOUNT_ID` to check the merchant account and retain the previous webhook secret during retry-safe rotation. Complete provider KYC before live billing.

The browser callback validates the checkout signature but never grants paid access. A verified webhook or authenticated provider reconciliation applies canonical state. Duplicate, stale, and superseded events are ignored. Paid access requires an active, unexpired billing period. Cancellation is requested at period end; a failed/pending provider payment pauses paid AI access.

If subscription creation times out after the provider may have accepted it, the checkout is marked `UNCERTAIN` and another create is blocked. An operator must inspect Razorpay using the checkout-attempt UUID in subscription notes, link the exact matching subscription, or confirm no subscription exists before releasing the attempt. Never blindly retry an uncertain provider POST. Known provider subscriptions are periodically reconciled; provider-less uncertain attempts require this manual check.

## Email, analytics, and maintenance

- Verify the Resend sending domain and configure `RESEND_API_KEY` and `RESEND_FROM_EMAIL`. Supabase Auth mail is configured separately. No real email has been sent during local tests.
- Configure the appropriate PostHog ingestion host and public project key. Analytics is opt-in in Settings and consent is checked again at delivery. No names, emails, offer bodies, or AI inputs are sent to PostHog.
- Configure a random `MAINTENANCE_JOB_SECRET` of at least 32 characters. Schedule authenticated `POST /api/jobs/maintenance` every five minutes. The included GitHub workflow needs repository secrets `SITE_ORIGIN` and `MAINTENANCE_JOB_SECRET`; creating the file alone does not activate a scheduler.
- Maintenance sweeps failed AI reservations, sends at most three jobs per configured channel, and reconciles three known subscriptions per invocation. Increase scheduling capacity with measured load. GitHub cron can be delayed; production billing should use a monitored reliable scheduler.
- Email provider requests are frozen before sending and retried with a stable idempotency key. Jobs stop after eight attempts or 22 hours to stay within the provider's 24-hour idempotency window. Inspect `delivery_outbox` FAILED jobs and `payment_webhook_events` errors; do not automatically replay expired email jobs because prior delivery may have succeeded.

Product events cover signup/role signup after consent, onboarding, discovery views, campaign creation, offer actions, AI starts/completions, free usage, upgrade views, subscriptions, and first conversion. Consent-time signup events are not a historical census. Derive activation from a first completed evaluation, acceptance rate from accepted versus rejected decisions, and churn from subscription lifecycle transitions. Validate these definitions and configure charts in your PostHog project; no hosted dashboard has been created.

## Website release gate

Run `npm ci`, `npm run typecheck`, `npm run lint`, `npm test`, `npm run test:db`, and `npm run build`. Sites/Vinext emits Worker-compatible `dist/server/index.js` and client assets. Use the Sites publishing flow for the configured project; do not upload `.env.local`, `node_modules`, or `.tools`.

Owner-only Sites previews cannot receive unauthenticated Razorpay webhooks or external scheduler calls. Production requires explicitly approved public access or a hosting arrangement that exposes those API routes securely. A private preview is not an activated billing deployment.

Before public launch: verify live Supabase RLS/Storage, both signup/onboarding journeys, Google OAuth, all offer transitions, AI failure/refund, the sixth-use guard, test-mode checkout/webhook/reconciliation/cancellation, email retries, analytics opt-out, responsive keyboard/touch use, and Android device launch. Finish privacy/terms entity/contact review, retention/deletion procedures, backups, rate limits, monitoring, and security review. `/api/health` distinguishes database connectivity from configuration; it does not certify launch readiness.
