# Mithai Match

A match-3 puzzle game with an Indian mithai (sweets) theme. Built with Phaser 3 + Vite + Capacitor (Android), Supabase backend, Google Play Billing.

**Status: all 7 phases built.** 50 levels, boosters, the Mithai Shop meta-game, daily
rewards, lives, settings/i18n (English + Hinglish), a full Supabase schema + Edge Functions
(not yet applied to a live project — see below), and billing (verified end-to-end against
MockBilling; real Google Play Billing is wired but device-unverified). See `ASSUMPTIONS.md`
for every decision made along the way and exactly what is/isn't verified, and
`MANUAL_STEPS.md` for everything that needs your action (creating the Supabase project, Play
Console, keystore, service accounts).

## What's genuinely done vs. what still needs you

✅ **Fully working and tested**: the match-3 engine (board generation, matching, specials,
cascades, combos, blockers, 50 levels — 45 Vitest cases), the full gameplay loop (swap, win,
lose, continue, boosters), the level map / shop / daily reward / settings screens, and the
MockBilling purchase flow — all verified by running the actual game in a browser, not just by
reading the code. `android-debug.yml` is green and produces an installable APK.

🟡 **Written and locally reasoned through, but unverified against the real thing**: the
Supabase schema/RPCs/Edge Functions (no live project exists — see `MANUAL_STEPS.md` §Phase 5)
and real Google Play Billing (`RealBillingProvider` — no Play Console or test device here).

⬜ **Needs you, documented in `MANUAL_STEPS.md`**: creating the Supabase project (one approval
away), the Play Console app + 6 in-app products + license testers, the release keystore,
hosting the privacy policy, and supplying real audio files (the game is fully playable
without them — see `src/services/sound.ts`).

## Run locally

```bash
npm install
npm run dev
```

Opens the Phaser game in your browser at the Vite dev server URL.

## Build the web bundle

```bash
npm run build
```

## Run tests

```bash
npm test
```

## Build the Android app

Requires JDK 21 and the Android SDK locally (CI does this for you automatically on every push — see below).

```bash
npm run build
npx cap sync android
cd android && ./gradlew assembleDebug
```

## Download a build without installing anything locally

Every push to `main` triggers `.github/workflows/android-debug.yml`, which builds a debug APK (with MockBilling enabled) and uploads it as a workflow artifact named `mithai-match-debug.apk`. Go to the repo's **Actions** tab → latest `android-debug` run → **Artifacts** → download.

Pushing a tag like `v0.1.0`, or running `android-release.yml` manually, builds a signed release AAB + APK (needs the four signing secrets — see `MANUAL_STEPS.md`) and attaches them to a GitHub Release.
