# Collab Deal OS

Neutral creator-brand deal intelligence: discover opportunities, structure terms, evaluate fair value, revise offers, and accept clearer partnerships. There is no chat, DM inbox, or messaging system.

## Implemented

- Role-first Supabase authentication, email/password recovery, Google OAuth plumbing, creator/brand onboarding, protected dashboards, profile editing and preferences.
- Campaign creation/lifecycle, opportunities, creator discovery, explainable matching, private assets, and saved opportunities.
- Structured offers, immutable revisions, accept/reject/counter workflows, notifications, and audit history.
- Deterministic INR pricing engine, strict OpenAI explanations, saved results/history, server-side quotas, five lifetime free evaluations, and failure-safe refunds.
- Creator/brand billing pages, verified Razorpay checkout/webhooks, idempotent cancellation, and scheduled subscription reconciliation.
- Resend delivery outbox, opt-in PostHog events, exact account activity counts, responsive navigation, PWA assets, and Capacitor Android project/build workflow.

These are implemented workflows, not a claim of a live production launch. Credentials are absent, paid AI allowances await approval, and live provider/device tests remain outstanding. See [PROJECT_STATUS.md](PROJECT_STATUS.md).

## Stack

React 19, strict TypeScript, Tailwind 4, Next.js-compatible App Router through Vinext/Sites, Supabase Auth/PostgreSQL/Storage, Zod, Vitest, and Capacitor 8. Privileged AI, billing, email, and database work stays server-side.

## Local development

Use Node 22.13+ and npm:

```bash
npm ci
npm run setup
npm run dev
```

Copy `.env.example` to ignored `.env.local` and supply credentials from accounts you control. The setup command reports missing configuration without printing values. Public pages render without credentials; account workflows show setup-required states.

For a disposable local Supabase database, install its CLI/container prerequisites, then run `supabase start` and `supabase db reset`. Never reset a production database. Configure Auth redirects and email/Google providers separately.

The dev server prints its URL, normally `http://localhost:3000`. This Windows session also has an ignored portable Node installation in `.tools/node-v22.23.2-win-x64`; it is a local convenience, not part of deployment.

## Verification

```bash
npm run typecheck
npm run lint
npm test
npm run test:db
npm run build
npm run setup -- --check-database
```

`test:db` executes every migration and selected billing, RLS, quota, and delivery flows in disposable PGlite PostgreSQL. Its test-only Auth/Storage stubs and SHA-256 adapter do not replace hosted Supabase/pgTAP or concurrent multi-connection testing. Hosted security tests are in `supabase/tests`.

Production dependency audit: `npm audit --omit=dev`. Review the complete dependency audit separately; development tooling can have advisories too.

## Configuration and delivery

- [Deployment and provider operations](docs/DEPLOYMENT.md)
- [Android build, signing, and device-test requirements](docs/ANDROID.md)
- [Security notes](SECURITY.md)
- [Current progress and blockers](PROJECT_STATUS.md)

Thirteen ordered SQL migrations are the database source of truth. Paid monthly limits are intentionally NULL until approved; the five free evaluations remain enforced server-side. No fake users, revenue, provider verdicts, or paid entitlements are shown as production facts.

## Routes

Public: `/`, `/pricing`, `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/privacy`, `/terms`, `/setup`.

Creator: dashboard, opportunities/detail, offers/detail, AI advisor, analysis/detail, analytics, subscription, profile, settings, and notifications beneath `/creator`.

Brand: dashboard, campaigns/new/detail, creators/detail, matches, offers/new/detail, AI advisor, analysis/detail, analytics, subscription, profile, settings, and notifications beneath `/brand`.

Health: `GET /api/health`. Provider webhooks and authenticated maintenance use separate server-only endpoints. No secret should ever use a `NEXT_PUBLIC_` prefix.
