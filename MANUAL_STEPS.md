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

## Later phases (placeholders — filled in as those phases land)

- **Google Play Console**: creating the app, uploading the first AAB to Internal testing, creating the 6 in-app products, adding license testers.
- **Google Cloud service account** for server-side purchase verification, stored as a Supabase secret.
- **Release keystore**: generate it yourself (`keytool`) and add it + 3 passwords as 4 GitHub Actions secrets (`ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`). I will never generate or hold this keystore for you — back it up yourself; losing it means you can never update the app on Play again (unless you're on Play App Signing, which is why you should opt into it).
- **Supabase secrets** (`GOOGLE_SERVICE_ACCOUNT_JSON`, `ANDROID_PACKAGE_NAME`) and enabling anonymous sign-ins.
- **Hosting the privacy policy** at a public URL and filling in the Data Safety form / content rating.
- **Changing the application ID / app name / icon** away from the placeholder `com.example.mithaimatch`.
- **AdMob** app creation and real ad unit IDs, if you ever flip `ENABLE_ADS` on.
