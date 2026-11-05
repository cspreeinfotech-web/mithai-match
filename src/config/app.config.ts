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

// Feature flags.
export const ENABLE_ADS = false;
export const ENABLE_GOOGLE_SIGNIN = false;

// Set true only in local/dev builds (never in a release build) to use MockBilling
// instead of real Google Play Billing.
export const USE_MOCK_BILLING = import.meta.env.MODE !== 'production';
