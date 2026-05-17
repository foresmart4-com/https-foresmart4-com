# Backend Requirements — ForeSmart

> Status: **Not Connected**. The current build is a frontend MVP with local state, Mock data, and Simulation. This document defines what a real Backend must provide before any production payment or real trading is enabled.

---

## 1. Why we need a Backend

The MVP frontend is sufficient to demonstrate the product, but the following cannot be safely delivered without a Backend:

- **Persistence** — users, portfolios, journal entries and review queues currently live in memory / localStorage and disappear on logout or device change.
- **Multi-user** — admins cannot review another user's deposits/withdrawals if the data never leaves the user's browser.
- **Auditability** — `before/after` state of admin actions must be tamper-evident, not user-editable.
- **Secrets handling** — Market data, payments, and broker API keys cannot live in the frontend (`VITE_*`) bundle.
- **Webhooks** — Payment providers (Stripe / Moyasar / PayTabs / Tap) need a public, signature-verified endpoint to confirm deposits.
- **AI / Market intelligence** — production-grade data and reasoning require server-side keys, rate-limit handling, and caching.
- **Compliance** — KYC, AML and financial reporting all require a server-of-record.

---

## 2. Tables (proposed schema)

All tables enforce Row-Level Security. Roles live in a dedicated `user_roles` table — **never** on the profile.

| Table | Purpose | Key columns |
|---|---|---|
| `users` (managed by auth) | Auth identity | `id` (uuid) |
| `profiles` | Display info, preferences | `id`, `display_name`, `preferred_currency`, `lang` |
| `user_roles` | RBAC | `user_id`, `role` (`admin`/`moderator`/`user`) |
| `portfolios` | User portfolios | `id`, `user_id`, `name`, `base_currency`, `created_at` |
| `assets` | Positions within a portfolio | `id`, `portfolio_id`, `symbol`, `category`, `qty`, `avg_cost` |
| `transactions` | Buys/sells, transfers, fees | `id`, `portfolio_id`, `type`, `symbol`, `qty`, `price`, `fee`, `created_at` |
| `deposit_requests` | Manual + gateway deposits | `id` (`DEP-YYYY-NNNN`), `user_id`, `amount`, `fee`, `method`, `status`, `reviewed_by`, `payment_event_id` |
| `withdrawal_requests` | Manual withdrawals | `id` (`WDR-YYYY-NNNN`), `user_id`, `amount`, `fee`, `bank`, `iban`, `status`, `reviewed_by` |
| `trading_journal` | Unified audit log | `id` (`JRN-YYYY-NNNN`), `user_id`, `actor`, `severity`, `source`, `event_kind`, `linked_ref_id`, `before_state` (jsonb), `after_state` (jsonb), `created_at` |
| `ai_decisions` | Generated AI recommendations | `id`, `asset`, `confidence`, `risk_level`, `reasons` (jsonb), `created_at` |
| `simulation_orders` | Paper-trading orders | `id`, `decision_id`, `asset`, `action`, `confidence`, `status`, `created_at` |
| `subscriptions` | Plan + period info | `id`, `user_id`, `plan`, `status`, `current_period_end`, `trial_ends_at` |
| `payment_events` | Webhook payload history | `id`, `provider`, `event_type`, `payload` (jsonb), `signature_ok`, `processed_at` |
| `admin_actions` | What admins changed and why | `id`, `admin_id`, `target_type`, `target_id`, `action`, `before_state`, `after_state`, `note` |
| `system_status` | Health snapshots | `id`, `component`, `state`, `note`, `checked_at` |

> Constraint: business validations that involve time (e.g. `expire_at > now()`) must be enforced via **validation triggers**, not `CHECK` constraints.

---

## 3. Suggested API endpoints

All endpoints are TanStack server functions (`createServerFn`) unless they receive external webhooks, in which case they live under `src/routes/api/public/`.

- **auth/** — sign-up, sign-in, recovery, magic link (handled by Supabase Auth).
- **portfolio/** — `getMyPortfolios`, `createPortfolio`, `addAsset`, `recordTransaction`.
- **markets/** — `getQuote`, `getHistory`, `getMacro` — server-side cached + key-protected.
- **ai-decisions/** — `getLatestForAsset`, `runDecision`, `listRecent` (`requireSupabaseAuth`).
- **deposits/** — `createDeposit`, `cancelDeposit`, `listMine`, `adminListReview`, `adminApprove`, `adminReject`.
- **withdrawals/** — same shape as deposits.
- **journal/** — `appendEvent` (server-validated), `listMine`, `adminListAll`, `exportAuditCSV`.
- **admin/** — `listUsers`, `setRole`, `reviewQueue`.
- **subscriptions/** — `getMySubscription`, `startCheckout`, `cancelAtPeriodEnd`.
- **webhooks/** (public, signature-verified):
  - `api/public/payments/webhook` — Stripe / generic
  - `api/public/moyasar-webhook` — Moyasar
  - `api/public/paytabs-webhook`, `api/public/tap-webhook`
  - `api/public/broker-webhook` (later)

Every server function: input validated with Zod, output typed, errors mapped to user-safe messages.

---

## 4. Security requirements

- Secrets (`STRIPE_SECRET_KEY`, `MOYASAR_API_KEY`, `ALPHA_VANTAGE_KEY`, `BROKER_API_KEY`, …) live in **Supabase secrets**, exposed via `process.env` inside `.handler()` only — never in `VITE_*`, never logged.
- Roles in `user_roles` only; use the `has_role(_user_id, _role)` `SECURITY DEFINER` function inside RLS policies to avoid recursion.
- All write endpoints: Zod validation, min/max sizes, regex on free-form strings, explicit allow-lists for enums.
- Rate limiting on `/api/public/*` (per IP + per user) and on AI / market endpoints.
- Audit any state-changing admin action into `admin_actions` and mirror it in `trading_journal` with `before_state`/`after_state`.
- Webhooks: **always** verify signature with `timingSafeEqual` **before** parsing the JSON body.

---

## 5. Payment requirements

- Provider choice: Stripe (global), Moyasar / PayTabs / Tap (KSA/GCC).
- A deposit goes: `created → review` (frontend) → `webhook verified → completed` (backend) → wallet credited.
- Reconciliation job: nightly compare `payment_events` vs `deposit_requests`; raise admin alerts for mismatches.
- Manual-review fallback persists exactly as today (admin approves/rejects). The webhook path simply skips the manual step on success.

---

## 6. Broker requirements

- Always **paper trading first** against the broker's sandbox.
- Required guards in the server function that submits an order:
  - Confidence ≥ user mode threshold (Conservative / Balanced / Aggressive).
  - Risk level ≠ `HIGH` for retail accounts.
  - Position size ≤ `riskRules.maxPositionPct` of equity.
  - Daily loss limit & max concurrent positions.
  - **Emergency stop** flag in `system_status` — if set, the order is refused and logged as `severity: "critical"`.
- Real execution endpoint is **never** enabled by default; it requires an explicit admin toggle plus a feature flag.

---

## 7. Migration path from this MVP

1. Stand up Lovable Cloud tables for `profiles`, `user_roles`, `deposit_requests`, `withdrawal_requests`, `trading_journal` (with `before_state` / `after_state` jsonb).
2. Replace local arrays in `WithdrawalSection`, `DepositPage`, and `AdminReviewPanel` with server functions.
3. Move `logEvent()` to call a server function that appends to `trading_journal` (keep the local fallback for offline UX).
4. Wire a single payment provider behind a feature flag; keep manual review as the default.
5. Add the broker integration last, sandbox-only, with the guards above.

Until step 4 ships, the system remains: **Simulation / Mock / Manual Review** — exactly what users see today.
