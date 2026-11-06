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

### Done already (I did this for you once you approved it)

- **Project created**: `mithai-match`, region `ap-south-1`, project ref `fuwtdoiucxtgpjpjbiuo`
  (<https://supabase.com/dashboard/project/fuwtdoiucxtgpjpjbiuo>), on the free tier ($0/month).
- **All 10 migrations applied** (`supabase/migrations/0001` through `0010`), confirmed: 6 tables,
  all with RLS enabled, `economy_config` seeded with 11 rows. A security advisor pass caught and
  fixed two real issues before I called it done: `apply_purchase` (meant only for the
  `verify-purchase` Edge Function) was callable directly by any signed-in client via PostgREST —
  now locked to `service_role` only (migrations 0009-0010) — and `leaderboard` had picked up
  `SECURITY DEFINER` implicitly, now explicitly `SECURITY INVOKER`.
- **All 4 Edge Functions deployed**: `verify-purchase`, `server-time`, `delete-my-data`,
  `play-rtdn`.
- **`.env.local`** written locally (gitignored) with the real URL + anon key — confirmed the
  client connects: `signInAnonymously()` reaches the project and gets back the *expected*
  "Anonymous sign-ins are disabled" error (see the one toggle below), not a connection failure.

### What's left (all one-click/one-paste, no account creation needed)

1. **Enable anonymous sign-in** — the one thing an API key can't do, needs the dashboard:
   **Authentication → Sign In / Providers → Anonymous Sign-Ins** → toggle on. Nothing else works
   until this is on (confirmed above).
2. **Add 2 GitHub Actions secrets** — I'm blocked from writing repo secrets myself (same
   auto-mode guard as before). Go to **Settings → Secrets and variables → Actions → New
   repository secret** on the repo and add exactly these two (safe to paste — the anon key is a
   public-facing value; RLS is what actually protects data):
   - `VITE_SUPABASE_URL` → `https://fuwtdoiucxtgpjpjbiuo.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` → `eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZ1d3Rkb2l1Y3h0Z3BqcGpiaXVvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM4ODg3MjQsImV4cCI6MjEwOTQ2NDcyNH0.EEw4mHnBy4U9mq4iTYBgm85sot28eaYXT7_gqAbi9WE`
3. **(Optional, for "Link account")**: **Authentication → Sign In / Providers → Google** → enable
   and fill in a Google OAuth client ID/secret from Google Cloud Console (only needed once you
   flip `ENABLE_GOOGLE_SIGNIN` on in `src/config/app.config.ts`).
4. **Google Cloud service account** (for `verify-purchase` to call the Play Developer API —
   can't test this one without it, and it can't be done via API/CLI, only the console):
   1. Go to [console.cloud.google.com](https://console.cloud.google.com), select/create the
      project linked to your Play Console app.
   2. **IAM & Admin → Service Accounts → Create Service Account** (any name, e.g. `mithai-match-billing`).
   3. **Keys → Add Key → Create new key → JSON** — downloads a `.json` file. Keep it secret.
   4. In **Play Console → Users and permissions → Invite new users**, invite that service
      account's email with **Finance → View financial data** permission (needed to verify purchases).
   5. Set it as a Supabase secret (never commit the file) — I can run this one for you if you
      paste the JSON into chat, or run it yourself:
      ```bash
      npx supabase link --project-ref fuwtdoiucxtgpjpjbiuo
      npx supabase secrets set GOOGLE_SERVICE_ACCOUNT_JSON="$(cat path/to/key.json)"
      npx supabase secrets set ANDROID_PACKAGE_NAME=com.example.mithaimatch
      ```
5. **`play-rtdn`'s JWT verification needs turning off** once you wire up real Pub/Sub (it's a
   stub until then, so this doesn't matter yet): Google's push requests carry their own OIDC
   token, not a Supabase one, so the function's default "Enforce JWT Verification" would reject
   them. Toggle it off for this one function in **Edge Functions → play-rtdn → Settings** when
   you get to that point.

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
- **Play Console store listing "Support email"** and the Data Safety form's contact field: use `help.mithaimatch@gmail.com` (same address as `PRIVACY_POLICY.md`'s Contact section and the in-app Settings screen).
- **Changing the application ID / app name / icon** away from the placeholder `com.example.mithaimatch`.
- **AdMob** app creation and real ad unit IDs, if you ever flip `ENABLE_ADS` on.

## Background music

Done. `src/assets/audio/bg-music-loop.wav` is "Happy Clappy Loop" by OwlishMedia
(opengameart.org/content/happy-clappy-loop), **CC0 (public domain)** — free for any use,
including commercial, with no attribution required. `sound.startMusic()`/`stopMusic()` loop it
via WebAudio at a lower gain than SFX, and the Settings screen's Music toggle starts/stops it
live. If you'd rather use a different track, swap that file and keep the same filename — no
code changes needed.
