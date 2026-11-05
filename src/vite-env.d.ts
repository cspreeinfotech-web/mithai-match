/// <reference types="vite/client" />

/** Injected by vite.config.ts's `define`, from package.json's version. */
declare const __APP_VERSION__: string;

interface ImportMetaEnv {
  /** Public Supabase project URL + anon key. Unset in Phase 5 until the project exists
   *  (see MANUAL_STEPS.md) — the app runs fully offline without them. */
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
