import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Public by design: the anon key is meant to be embedded in client code (it only grants
// what RLS allows — see supabase/migrations). Never put the service-role key here.
const URL = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

let client: SupabaseClient | null = null;
if (URL && ANON_KEY) {
  client = createClient(URL, ANON_KEY);
}

/** Null until VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY are configured (see MANUAL_STEPS.md) —
 *  the game is fully playable offline without them; cloud sync is best-effort on top. */
export function getSupabase(): SupabaseClient | null {
  return client;
}
