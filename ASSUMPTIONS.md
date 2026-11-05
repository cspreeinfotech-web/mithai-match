# Assumptions

Decisions made without stopping to ask, per the project brief's "don't stop unless truly blocked" rule.

1. **Package versions** (checked against npm registry on 2026-11-05): Phaser 3.90.0, Capacitor 8.0.3, Vite 8.0.5, Vitest 4.0.6, TypeScript 5.9.3, @supabase/supabase-js 2.75.0.
2. **Billing library**: `cordova-plugin-purchase` is the most actively maintained Capacitor-compatible Play Billing wrapper at time of writing (supports Billing Library 7+, consumables). Wired in Phase 6.
3. **Min/target/compile SDK**: min 24, target/compile = latest required by Play for new apps at time of writing (34+; the Android workflow pins the exact numbers — check `android/variables.gradle` once Phase 1 finishes, since Google's requirement changes yearly).
4. **Local toolchain**: this machine has Node/npm/git only — no `gh` CLI, no Java/Android SDK, no `adb`, and the GitHub MCP connector failed to authenticate. GitHub Actions supplies its own JDK 21 + Android SDK, so CI builds are unaffected. Creating the GitHub repo and the first push need one decision from you — see the open question in chat.
5. **Hinglish strings**: written in Roman-script Hindi transliteration by me (not a native-speaker review); flag any that read oddly and I'll adjust.
6. **Art**: all original SVG, generated in this repo — gradients/shapes described in-code, not traced from any existing game's assets.
7. **Audio**: Phase 7 implements `SoundService` with a documented list of filenames to supply, since I cannot legally source or generate finished music/SFX files inside this environment; placeholders are silent.
8. **Anonymous auth + optional Google linking** per spec section 6; Google Sign-In stays behind `ENABLE_GOOGLE_SIGNIN` (default false) until you complete its Play Console / Google Cloud setup (MANUAL_STEPS.md).
9. **Keystore**: I generate a *local test* keystore only for CI secrets I control (none — a release keystore must be generated and held by you; I will never generate or hold a Play App Signing keystore for you). See MANUAL_STEPS.md.
10. **Toolchain versions discovered by trial in CI** (document for future phases): `@capacitor/cli@8.6.0` requires Node ≥22 (the workflows originally pinned 20), and Capacitor's Android module compiles against Java 21 source/target (the workflows originally pinned JDK 17, which fails with "invalid source release: 21"). Both fixed in commit `2a27543`'s follow-up.
