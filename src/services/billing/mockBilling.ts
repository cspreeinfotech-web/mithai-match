// Debug-only billing provider (never used in a release build — see billing/index.ts, which
// selects this only when USE_MOCK_BILLING is true, itself only true outside production mode).
// Lets the whole purchase UI and grant flow be exercised without the Play Store: no real
// purchase token exists, so there's nothing for a server to verify — it grants locally and
// still exercises the same purchase-state machine (core/purchaseState.ts) and idempotency
// path (pendingGrants.ts) that RealBilling uses, via a synthetic token.
import { getProduct } from '../../config/products.config';
import { grantLocally } from './verifyPurchase';
import { addPendingGrant, clearPendingGrant } from '../pendingGrants';
import type { BillingProvider, PurchaseOutcome } from './types';

/** Forces the next purchase() call's outcome — for manual QA of each state the spec lists
 *  (cancelled, billing unavailable, pending, network error, already owned). Exposed on
 *  `window.__mockBilling` in dev builds only; defaults to always succeeding. */
export type MockOutcome = 'granted' | 'pending' | 'cancelled' | 'already_owned' | 'error';
let forcedOutcome: MockOutcome = 'granted';

export class MockBillingProvider implements BillingProvider {
  async initialize(): Promise<void> {
    // Nothing to do — there's no real store connection in mock mode.
  }

  getLocalizedPrice(productId: string): string | null {
    const product = getProduct(productId);
    return product ? `₹${product.fallbackPriceInr} (mock)` : null;
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    const product = getProduct(productId);
    if (!product) return { kind: 'error', message: 'unknown product' };

    await new Promise((resolve) => setTimeout(resolve, 500)); // simulate the billing dialog

    if (forcedOutcome === 'cancelled') return { kind: 'cancelled' };
    if (forcedOutcome === 'already_owned') return { kind: 'already_owned' };
    if (forcedOutcome === 'error') return { kind: 'error', message: 'Simulated network error' };
    if (forcedOutcome === 'pending') return { kind: 'pending' };

    const purchaseToken = `mock-${productId}-${Date.now()}`;
    addPendingGrant(productId, purchaseToken);
    grantLocally(product.coins, product.lives);
    clearPendingGrant(purchaseToken); // granted immediately in mock mode — queue briefly exercised above
    return { kind: 'granted', coins: product.coins, lives: product.lives };
  }

  async restorePurchases(): Promise<void> {
    // No real store to query in mock mode — nothing to restore.
  }
}

export function setMockOutcome(outcome: MockOutcome): void {
  forcedOutcome = outcome;
}
