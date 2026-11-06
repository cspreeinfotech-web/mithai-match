// Email sign-in via Supabase's 6-digit OTP (no password, no deep link to wire up).
// Google sign-in stays behind ENABLE_GOOGLE_SIGNIN (see app.config.ts) until that's set up.
import { getSupabase } from './supabaseClient';

export interface AuthStatus {
  isAnonymous: boolean;
  email: string | null;
}

export async function getAuthStatus(): Promise<AuthStatus> {
  const supabase = getSupabase();
  if (!supabase) return { isAnonymous: true, email: null };
  const { data } = await supabase.auth.getUser();
  const user = data.user;
  if (!user) return { isAnonymous: true, email: null };
  return { isAnonymous: !!user.is_anonymous, email: user.email ?? null };
}

type Result = { ok: true; linking: boolean } | { ok: false; error: string };

/** Sends the code. If currently anonymous, this LINKS the email to the existing (anonymous)
 *  user id, keeping all progress. Otherwise it's a plain sign-in code for an existing account
 *  (cloudSync's merge-on-connect then pulls that account's server progress in). */
export async function requestEmailCode(email: string): Promise<Result> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Cloud sync is not set up yet.' };
  const { data } = await supabase.auth.getUser();
  const linking = !!data.user?.is_anonymous;
  const { error } = linking
    ? await supabase.auth.updateUser({ email })
    : await supabase.auth.signInWithOtp({ email });
  if (error) return { ok: false, error: error.message };
  return { ok: true, linking };
}

export async function verifyEmailCode(email: string, code: string, linking: boolean): Promise<{ ok: true } | { ok: false; error: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: 'Cloud sync is not set up yet.' };
  const { error } = await supabase.auth.verifyOtp({ email, token: code, type: linking ? 'email_change' : 'email' });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
