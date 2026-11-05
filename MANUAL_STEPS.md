# Manual steps — things only you can do

This file grows as each phase adds new manual requirements. Nothing in this project touches these for you; it is written here exactly so nothing is silently skipped.

## Phase 1 — Foundation

### 0. Push this repo to GitHub

I don't have a GitHub CLI (`gh`), a GitHub token, or Java/Android SDK on this machine, and the GitHub MCP connector failed to authenticate — none of that blocks the game build itself (GitHub Actions supplies its own JDK/Android SDK), but *creating the GitHub repo and the first push* needs one of:

1. **Easiest**: you create an empty repo at <https://github.com/new> (no README/license/.gitignore — this project already has them), then tell me its URL and I'll add the remote and push what's committed locally.
2. Or run these yourself from this folder once the repo exists:
   ```bash
   git remote add origin https://github.com/<you>/mithai-match.git
   git push -u origin main
   ```
3. Or install/auth `gh` (`gh auth login`) in this environment and tell me — I'll then create the repo and push myself.

Everything else below assumes the repo exists and Actions is enabled on it (it is, by default).

## Phase 5 — Supabase backend

### 1. Create the Supabase project (blocked on your approval)

I wrote the full schema (`supabase/migrations/`) and Edge Functions (`supabase/functions/`),
but creating the actual Supabase project is a billing-adjacent action my environment's auto-mode
classifier blocks without your explicit say-so (even though it's a free-tier project — $0/month
unless you later upgrade). Two ways to unblock this:

- **Tell me to go ahead** and I'll create a free project named `mithai-match` via the Supabase
  MCP tools right away, then apply the migrations and deploy the functions myself.
- **Or create it yourself**: go to <https://supabase.com/dashboard/new>, create a project named
  `mithai-match` (any region), then give me the project URL and anon key (**Project Settings →
  API**) and I'll wire everything else up.

### 2. Once the project exists

1. **Apply the migrations**: `supabase/migrations/0001...0008*.sql`, in order. Easiest via the
   Supabase CLI (`npx supabase link --project-ref <ref>` then `npx supabase db push`), or paste
   each file into the dashboard's **SQL Editor** in order.
2. **Enable anonymous sign-in**: **Authentication → Sign In / Providers → Anonymous Sign-Ins** → toggle on.
3. **(Optional, for "Link account")**: **Authentication → Sign In / Providers → Google** → enable
   and fill in a Google OAuth client ID/secret from Google Cloud Console (only needed once you
   flip `ENABLE_GOOGLE_SIGNIN` on in `src/config/app.config.ts`).
4. **Add the 2 GitHub Actions secrets** so CI builds embed the public client config:
   **Settings → Secrets and variables → Actions → New repository secret**:
   - `VITE_SUPABASE_URL` — your project's API URL
   - `VITE_SUPABASE_ANON_KEY` — your project's anon/public key
   (Both are public-safe values — RLS is what actually protects data — but keeping them in
   secrets avoids hardcoding environment-specific URLs in the workflow files.)
5. **Google Cloud service account** (for `verify-purchase` to call the Play Developer API):
   1. Go to [console.cloud.google.com](https://console.cloud.google.com), select/create the
      project linked to your Play Console app.
   2. **IAM & Admin → Service Accounts → Create Service Account** (any name, e.g. `mithai-match-billing`).
   3. **Keys → Add Key → Create new key → JSON** — downloads a `.json` file. Keep it secret.
   4. In **Play Console → Users and permissions → Invite new users**, invite that service
      account's email with **Finance → View financial data** permission (needed to verify purchases).
   5. Set it as a Supabase secret (never commit the file):
      ```bash
      npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat path/to/key.json)"
      npx supabase secrets set ANDROID_PACKAGE_NAME=com.example.mithaimatch
      ```
6. **Deploy the Edge Functions**:
   ```bash
   npx supabase functions deploy verify-purchase
   npx supabase functions deploy server-time
   npx supabase functions deploy delete-my-data
   npx supabase functions deploy play-rtdn
   ```

See `supabase/README.md` for the full command reference.

## Phase 6 — Billing: create these exact 6 products in Play Console

Billing code (`src/services/billing/`) is written and works end-to-end against **MockBilling**
(verified in-browser — purchasing credits coins instantly). It can't be tested against **real**
Google Play Billing from here (no Play Console access, no physical device signed into a test
account), so treat `RealBillingProvider` as carefully-written-but-device-unverified until you
try it on Internal Testing.

Once you have a Play Console app (see the Phase 7 section below), go to **Monetize → Products →
In-app products → Create product** and create exactly these 6, **all as one-time, consumable
products** (the IDs must match `src/config/products.config.ts` exactly):

| Product ID | What it grants |
|---|---|
| `coins_300` | 300 coins |
| `coins_900` | 900 coins |
| `coins_2200` | 2,200 coins |
| `coins_5500` | 5,500 coins |
| `lives_refill_5` | Full 5 lives instantly |
| `continue_moves_5` | +5 moves on the current level |

Set whatever prices you like in Play Console — the app reads the real localized price from
Google Play at runtime (`src/services/billing/realBilling.ts`'s `getLocalizedPrice`), falling
back to the placeholder in `products.config.ts` only until that loads. After creating each
one, click **Activate**. Also add yourself as a **license tester** (**Setup → License testing**)
so you can test purchases without being charged real money.

## Later phases (placeholders — filled in as those phases land)

- **Google Play Console**: creating the app, uploading the first AAB to Internal testing, adding license testers (see Phase 6 above for the 6 products specifically).
- **Release keystore**: generate it yourself (`keytool`) and add it + 3 passwords as 4 GitHub Actions secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). I will never generate or hold this keystore for you — back it up yourself; losing it means you can never update the app on Play again (unless you're on Play App Signing, which is why you should opt into it).
- **Hosting the privacy policy** at a public URL and filling in the Data Safety form / content rating.
- **Changing the application ID / app name / icon** away from the placeholder `com.example.mithaimatch`.
- **AdMob** app creation and real ad unit IDs, if you ever flip `ENABLE_ADS` on.
