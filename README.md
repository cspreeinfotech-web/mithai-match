# Mithai Match

A match-3 puzzle game with an Indian mithai (sweets) theme. Built with Phaser 3 + Vite + Capacitor (Android), Supabase backend, Google Play Billing.

Status: **Phase 1 — Foundation** (menu screen only; gameplay lands in later phases). See `ASSUMPTIONS.md` for decisions made along the way and `MANUAL_STEPS.md` for everything that needs your action (Play Console, keystore, Supabase secrets).

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
