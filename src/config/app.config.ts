import appConfig from './app.config.json';

// Single source of truth for the game's name and Android application ID: app.config.json.
// (Plain JSON, not .ts, because capacitor.config.ts has to read it too, and Capacitor's config
// loader runs under CommonJS — importing another .ts module there breaks; JSON import works both ways.)
// To rename: change appName. To re-brand for your own Play listing: change appId here, then
// follow the "Changing the application ID" section of MANUAL_STEPS.md (it also lives in
// android/app/build.gradle, android/app/src/main/AndroidManifest.xml via that id, and the
// Supabase ANDROID_PACKAGE_NAME secret used by verify-purchase).
export const APP_NAME = appConfig.appName;
export const APP_ID = appConfig.appId;
export const SUPPORT_EMAIL = appConfig.supportEmail;

// Feature flags.
export const ENABLE_ADS = false;
export const ENABLE_GOOGLE_SIGNIN = false;

// UPI for digital goods isn't allowed on Google Play unless enrolled in user choice billing.
// Build the Play Store AAB with VITE_PLAY_STORE=true (hides prices and the UPI flow); ship
// UPI only in the separately-distributed website APK, built with this unset/false.
export const PLAY_STORE = import.meta.env.VITE_PLAY_STORE === 'true';

// Set true only in local/dev builds (never in a release build) to use MockBilling
// instead of real Google Play Billing.
export const USE_MOCK_BILLING = import.meta.env.MODE !== 'production';
