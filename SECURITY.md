# Security policy and implementation notes

- Never commit `.env.local` or real provider credentials.
- Only `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` (or its legacy anon fallback), Razorpay's public key ID, and PostHog public project configuration may enter browser bundles.
- Supabase RLS and database grants are mandatory. Client-side route guards are UX, not authorization.
- Account roles are `creator` or `brand`. Administrative authority must use trusted server-controlled claims; it must never rely on mutable user metadata.
- Offer revisions, completed analyses, subscription state, usage counters, and payment webhooks are server-controlled and audit logged.
- Storage buckets are private and object paths begin with the owning user UUID.
- AI pricing inputs and deterministic results are computed server-side. OpenAI may explain those values but must not invent or silently replace them.
- An Android APK is assumed to be reversible. It will not contain service-role, OpenAI, Razorpay secret, webhook, or email keys.

Report suspected security issues privately to the production security contact once that address is configured. Do not place sensitive reports in public issue trackers.

## Billing and delivery controls

- Same-origin mutation checks, bounded request bodies, strict input schemas, and server-held plan mappings protect checkout endpoints.
- Raw-body HMAC verification supports webhook secret rotation. Browser payment success never grants paid access. Stored subscription IDs, provider GET snapshots, transactional locks, event deduplication, and stale/terminal-state guards govern activation.
- Provider API reconciliation is marked separately from signed webhook verification. Uncertain provider creation is quarantined instead of retried blindly.
- Email retries reuse a frozen request and stable idempotency key; they stop before the provider deduplication window expires. Analytics delivery rechecks opt-in and omits deal content and contact data.
- Native configuration contains only a public HTTPS origin. Remote-hosted WebView operation, custom-scheme OAuth, payment intents, and store distribution still need device and production review.

## Verification limits

Local unit and PGlite checks are not an independent security audit. Live Supabase RLS/Storage, multi-connection races, provider test-mode workflows, rate-limit/load behavior, data retention/deletion, and operational monitoring remain release gates. As of 14 September 2026, npm reports zero production dependency vulnerabilities and three moderate development-tool advisories in the Capacitor CLI xcode/uuid chain. Review that chain before using the CLI for iOS work; do not apply an untested forced downgrade to silence the audit.
