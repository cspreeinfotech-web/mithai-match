# Supabase backend

## Schema

Run the migrations in `supabase/migrations/` in order (they're numbered). Tables:
`profiles`, `level_progress`, `inventory`, `purchases`, `economy_config`, `shop_upgrades`,
plus a `leaderboard` view. Every table has RLS enabled with a `select own row(s)` policy and
**no** client insert/update/delete policy — all writes go through the `SECURITY DEFINER`
RPC functions in `0007_rpc_functions.sql` / `0008_purchase_grant.sql`, which derive the
acting user from `auth.uid()` (never a client-supplied id), so a player can never edit
someone else's row or write their own coin balance directly.

`0011_upi_payments.sql` adds the UPI payment system (`admins`, `plans`, `payment_settings`,
`payment_orders`, `blocked_txn_ids`, `subscriptions`, `settings_audit`, `settings_version`,
`app_mode`) and a `private` schema of helper/activation functions, following the same
RLS-locked-tables-plus-RPC pattern. Run `supabase/tests/upi_payments_test.sql` against a
project that has it applied to exercise the rules (reference matching, UTR reuse, the
daily auto-activation cap, revocation, admin authorization, and price snapshotting) — it
runs inside a transaction that always rolls back, so it never leaves test data behind.
The admin panel that controls this system lives in `admin/` (its own Next.js app/deploy).

## Required secrets (Edge Functions)

Set these with the Supabase CLI or dashboard (**Project Settings → Edge Functions → Secrets**):

| Secret | What it is |
|---|---|
| `GOOGLE_SERVICE_ACCOUNT_JSON` | The whole JSON key of the Google Cloud service account with Play Developer API access (see `MANUAL_STEPS.md`), as one string. |
| `ANDROID_PACKAGE_NAME` | Your app's application ID, e.g. `com.example.mithaimatch`. |
| `UPI_WEBHOOK_SECRET` | Random string shared with a future bank/payment-gateway webhook (`upi-webhook` function) — only needed once you wire one up; the UPI flow itself works without it via in-app reporting. |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically
to every Edge Function by the platform — you don't set those yourself.

## CLI commands

```bash
# One-time: link this repo to your project (replace with your project ref)
npx supabase link --project-ref <your-project-ref>

# Apply all migrations
npx supabase db push

# Set the two secrets above
npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON='<paste the whole JSON key>'
npx supabase secrets set ANDROID_PACKAGE_NAME=com.example.mithaimatch

# Deploy the Edge Functions
npx supabase functions deploy verify-purchase
npx supabase functions deploy server-time
npx supabase functions deploy delete-my-data
npx supabase functions deploy play-rtdn
```

## Auth

Anonymous sign-in must be enabled (**Authentication → Providers → Anonymous**) — see
`MANUAL_STEPS.md` for the click path. Every new install calls `supabase.auth.signInAnonymously()`
on first launch; a `profiles` row is created automatically by the `on_auth_user_created`
trigger in `0001_profiles.sql`.

## `play-rtdn` is a stub

Its schema is ready (`purchases.status` already has a `'voided'` state) but the actual Pub/Sub
signature verification and void-handling logic are `TODO`s in the function — see the comments
in `supabase/functions/play-rtdn/index.ts` and the setup steps in `MANUAL_STEPS.md`.
