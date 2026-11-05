import { APP_ID } from '../../config/app.config';
import { getSupabase } from '../supabaseClient';
import { addCoins, loadProfile, saveProfile } from '../profile';
import { ECONOMY } from '../../config/economy.config';
import type { PurchaseOutcome } from './types';

interface VerifyResponse {
  status: 'purchased' | 'pending' | 'canceled';
  granted: boolean;
  error?: string;
}

/** Calls the verify-purchase Edge Function (see supabase/functions/verify-purchase). Never
 *  trusts the client's own idea of what was purchased — the server independently checks with
 *  the Google Play Developer API. Returns null (not an outcome) if there's no backend
 *  configured at all, so the caller can fall back sensibly. */
export async function verifyPurchaseOnServer(
  productId: string,
  purchaseToken: string,
  coins: number,
  lives: number,
): Promise<PurchaseOutcome | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase.functions.invoke<VerifyResponse>('verify-purchase', {
    body: { productId, purchaseToken, packageName: APP_ID },
  });

  if (error) return { kind: 'error', message: error.message };
  if (!data) return { kind: 'error', message: 'empty response from verify-purchase' };

  if (data.status === 'pending') return { kind: 'pending' };
  if (data.status === 'canceled') return { kind: 'cancelled' };
  if (!data.granted) return { kind: 'error', message: data.error ?? 'verification failed' };

  // continue_moves_5 has no coins/lives field server-side (see verify-purchase/index.ts) —
  // the caller applies its effect (e.g. +5 moves) locally once granted is true.
  if (productId === 'continue_moves_5') return { kind: 'granted', coins: 0, lives: 0 };

  return { kind: 'granted', coins, lives };
}

/** No backend configured: credits coins/lives straight into the local profile. This is the
 *  fallback for both MockBilling (always) and RealBilling (if verify-purchase can't be
 *  reached) — a real purchase was still made with real money, so the player must not lose
 *  it; it's queued (see pendingGrants.ts) and re-verified with the server once possible. */
export function grantLocally(coins: number, lives: number): void {
  let profile = loadProfile();
  if (coins > 0) profile = addCoins(profile, coins);
  if (lives > 0) profile = { ...profile, lives: Math.min(ECONOMY.maxLives, profile.lives + lives) };
  saveProfile(profile);
}
