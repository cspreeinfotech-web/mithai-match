// Google Play one-time products — all consumable. These IDs must match exactly what's
// created in Play Console (see MANUAL_STEPS.md) and the mapping in
// supabase/functions/verify-purchase/index.ts (duplicated there since Edge Functions run in
// a separate Deno runtime that can't import this file — keep the two in sync).
export interface ProductDef {
  id: string;
  coins: number;
  lives: number; // 0 unless the product grants lives directly
  /** Fallback display price if the Play Store price hasn't loaded yet. Never shown once the
   *  real localized price comes back from Google Play. */
  fallbackPriceInr: number;
}

export const PRODUCTS: ProductDef[] = [
  { id: 'coins_300', coins: 300, lives: 0, fallbackPriceInr: 29 },
  { id: 'coins_900', coins: 900, lives: 0, fallbackPriceInr: 79 },
  { id: 'coins_2200', coins: 2200, lives: 0, fallbackPriceInr: 149 },
  { id: 'coins_5500', coins: 5500, lives: 0, fallbackPriceInr: 299 },
  { id: 'lives_refill_5', coins: 0, lives: 5, fallbackPriceInr: 19 },
  { id: 'continue_moves_5', coins: 0, lives: 0, fallbackPriceInr: 19 },
];

export function getProduct(id: string): ProductDef | undefined {
  return PRODUCTS.find((p) => p.id === id);
}
