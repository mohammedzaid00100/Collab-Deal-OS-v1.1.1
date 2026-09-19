# Collab Deal OS — Payment Removal & Future Reintroduction Blueprint

> **Notice:** This document serves as the permanent architectural record and reference blueprint for Collab Deal OS following the removal of all payment, wallet, and payment-password functionality in September 2026.

---

## 1. Why Payments Were Removed

The creator and founder of Collab Deal OS is currently 16 years old. Under Indian law and financial regulations (including RBI guidelines and standard merchant agreements for gateways such as Razorpay, Cashfree, and Stripe), a minor cannot legally execute merchant agreements, hold a commercial merchant gateway account, or process third-party financial transactions without formal business guardianship or majority age (18 years old).

For the next 1.5 to 2 years (until approximately 2028), Collab Deal OS will focus entirely on its core value proposition:
1. **Brand–Creator Discovery & Marketplace (Connect)**
2. **Deal Collaboration & Messaging**
3. **Structured Offer Negotiation (Cash + Product Perks)**
4. **AI-Assisted Deal Pricing Analysis & Scoring**
5. **Campaign Deliverable Management**

All pricing terms, cash payment amounts, product perk values, and campaign budgets remain **100% active and supported** within the application as negotiated collaboration terms between brands and creators. Only the internal simulated wallet, prototype transactions, and payment gateway subscriptions were retired.

---

## 2. Preserved Reference Blueprint (Where the Code Lives)

The entire payment and wallet system as of September 2026 has been permanently preserved in git history and pushed to GitHub.

- **GitHub Repository:** `mohammedzaid00100/Collab-Deal-OS-v1.1.1`
- **Base Commit Hash:** `c058479d3cd1766fb556b7d1dfd6057bc661cf7e`
- **Permanent Archive Branch:** `archive/payment-version-2026`
- **Permanent Git Tag:** `pre-payment-removal-v1`

You can inspect or checkout the preserved version at any time using:
```bash
# View the preserved tag without modifying current main
git checkout pre-payment-removal-v1

# Or inspect specific files from the archive branch
git show archive/payment-version-2026:lib/prototype-wallet.ts
git show archive/payment-version-2026:lib/billing/razorpay.ts
git show archive/payment-version-2026:components/wallet/wallet-prototype.tsx
```

---

## 3. CRITICAL WARNING: Do NOT Restore Database Backups

> [!CAUTION]
> **NEVER RESTORE AN OLD DATABASE DUMP OR HISTORICAL MIGRATION SNAPSHOT OVER A FUTURE PRODUCTION DATABASE!**

When reintroducing payments in 2028:
- The preserved branch and tag are **CODE AND ARCHITECTURE BLUEPRINTS ONLY**.
- Over the next 2 years, your production database will accumulate real user accounts, verified creator profiles, active campaigns, genuine brand-creator conversations, and negotiated deals.
- Restoring an old database backup or running destructive rollback scripts will **permanently wipe out** all real production data and break active user relationships.
- Future reintroduction must be strictly **ADDITIVE** via forward SQL migrations and newly integrated code modules.

---

## 4. Architecture of the 2026 Payment & Security System

The system removed in September 2026 consisted of four integrated layers:

### A. Prototype Wallet & Earnings Rail
- **Files:** `lib/prototype-wallet.ts`, `components/wallet/wallet-prototype.tsx`, `components/wallet/pay-creator-prototype.tsx`
- **Routes:** `/creator/wallet`, `/brand/wallet`
- **Database Tables:**
  - `public.prototype_withdrawal_requests`: tracked creator payout requests (minimum ₹100), bank account / UPI IDs, and payout statuses (`PENDING`, `PROCESSED`, `CANCELLED`).
  - `public.prototype_deal_events`: tracked deal escrow simulations, creator payouts, and earnings events tied to conversations and offers.

### B. Payment Password Security System
- **Files:** `lib/prototype-payment-security.ts`, `components/wallet/payment-password-gate.tsx`, `components/account/payment-password-recovery-dialog.tsx`
- **Routes:** `/api/payment-password/recovery`
- **Database Tables & RPCs:**
  - `public.payment_security`: stored Argon2id password hashes, salts, attempt counters, and lockout timestamps.
  - `public.payment_password_resets`: stored HMAC-hashed single-use 6-digit recovery codes with 15-minute expirations.
  - RPCs: `has_payment_password`, `create_payment_password`, `verify_payment_password`, `admin_reset_payment_password`.

### C. Razorpay Subscription Billing
- **Files:** `lib/billing/` (`account.ts`, `config.ts`, `http.ts`, `razorpay.ts`, `reconcile.ts`, `webhook.ts`), `lib/validation/billing.ts`
- **Routes:** `/api/billing/subscriptions`, `/api/billing/subscriptions/verify`, `/api/billing/subscriptions/cancel`, `/api/webhooks/razorpay`
- **Database Tables:**
  - `public.subscriptions`: tracks account plan tiers (`FREE`, `PRO`, `PREMIUM`), statuses, and current periods. (Note: table retained in database to keep user plan state intact).
  - `public.provider_webhook_events`: deduplicated and recorded idempotency keys for webhook deliveries.
  - `public.checkout_attempts`: guarded checkout sessions against concurrent double charges.

### D. Account Deletion Decoupling
- **Previous behavior:** Account deletion called `delete_current_account_with_password`, which required the user's payment password to purge the account.
- **Current active behavior:** Account deletion is now completely independent of payments. In `app/api/account/close/route.ts` and `components/account/account-closure-card.tsx`, users confirm deletion by typing `DELETE MY ACCOUNT`. The server calls the clean `delete_current_account(confirmation_text)` RPC created in migration `20260920000000_remove_payment_system_2026.sql`.
- **Future requirement:** Even when payments return, account deletion must **never** be gated on an active payment password alone, ensuring users can always close their accounts cleanly.

---

## 5. Step-by-Step Guide for Reintroducing Payments (2028+)

When you turn 18 and are legally ready to operate financial services in Collab Deal OS, follow this structured roadmap:

### Phase 1: Business & Regulatory Prerequisites
1. **Legal Entity:** Register a recognized business entity (Sole Proprietorship, LLP, or Private Limited) in India.
2. **Bank Account:** Open a dedicated current account in the entity's name.
3. **PAN & GST:** Obtain entity PAN and GSTIN registration (if required by turnover/regulations).
4. **Merchant Onboarding:** Apply for Razorpay / Cashfree / Stripe India merchant accounts and complete full KYC verification.
5. **Escrow & Nodal Compliance:** If operating an escrow-style payout model (holding brand funds until milestone completion), comply with RBI guidelines on Payment Aggregators (PA) or use an authorized marketplace settlement flow (e.g. Razorpay Route).

### Phase 2: Additive Database Migrations
Create a new timestamped migration (e.g., `supabase/migrations/20280101000000_reintroduce_payment_gateway.sql`). Do not modify historical migrations.
- Create payout ledger and withdrawal request tables.
- Re-add payment security tables if separate PIN/password authorization is required.
- Add indexes and RLS policies enforcing tenant isolation and user ownership.

### Phase 3: Modern Backend Integration
- Install the latest SDK of your chosen payment provider.
- Implement checkout session generation with cryptographic payload signing.
- Implement webhook handlers verifying raw body HMAC signatures.
- Implement transactional payout triggers using provider payouts/transfers API.

### Phase 4: Frontend UI & Dashboards
- Reintroduce `/creator/wallet` and `/brand/wallet` pages using the Neo-Brutalism design system.
- Re-add Wallet quick links to `components/app/app-shell.tsx` and floating action button (`components/app/app-fab.tsx`).
- Re-add payout method forms (UPI VPA, IMPS/NEFT account details) with validation.

### Phase 5: Verification & Safety Suite
- Run `npm run test:db` to verify forward migration integrity.
- Write unit and integration tests for webhook verification, signature validation, and payout edge cases.
- Perform end-to-end sandbox checkout and payout testing before switching provider keys to production mode.

---

*Collab Deal OS — Built for real creators and real brands.*