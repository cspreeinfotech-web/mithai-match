export type PurchaseOutcome =
  | { kind: 'granted'; coins: number; lives: number }
  | { kind: 'pending' }
  | { kind: 'cancelled' }
  | { kind: 'already_owned' }
  | { kind: 'error'; message: string };

export interface BillingProvider {
  initialize(): Promise<void>;
  /** Localized price string from the store, or null if not loaded yet (caller shows the
   *  fallback price from products.config.ts in that case). */
  getLocalizedPrice(productId: string): string | null;
  purchase(productId: string): Promise<PurchaseOutcome>;
  /** Re-processes any unconsumed/unacknowledged purchases — called on launch and on
   *  "Restore purchases" in Settings. */
  restorePurchases(): Promise<void>;
}
