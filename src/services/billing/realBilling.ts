// Real Google Play Billing via cordova-plugin-purchase (Billing Library 7+, consumables).
// The plugin attaches itself to `window.CdvPurchase` as a global (classic Cordova plugin
// loading, not an ES import) after `deviceready`, which Capacitor's Cordova-compatibility
// layer fires too — so this only works inside the native Android app, never in a browser.
//
// shortcut: typed as `any` against window.CdvPurchase rather than importing the plugin's
// ~7000-line ambient .d.ts, since there's no device/Play Store in this environment to
// exercise it against anyway — tighten the types once you can test on a real device.
import { PRODUCTS, getProduct } from '../../config/products.config';
import { verifyPurchaseOnServer, grantLocally } from './verifyPurchase';
import { addPendingGrant, clearPendingGrant, loadPendingGrants } from '../pendingGrants';
import type { BillingProvider, PurchaseOutcome } from './types';

declare global {
  interface Window {
    CdvPurchase?: {
      store: CdvStore;
      Platform: { GOOGLE_PLAY: string };
      ProductType: { CONSUMABLE: string };
    };
  }
}

interface CdvTransaction {
  products: { id: string }[];
  parentReceipt: { purchaseToken?: string; orderId?: string };
  finish(): Promise<void>;
}

interface CdvProduct {
  id: string;
  pricing?: { price?: string };
  getOffer?: () => { order: () => Promise<{ code: number; message: string } | undefined> } | undefined;
}

interface CdvStore {
  register(products: { id: string; type: string; platform: string }[]): void;
  initialize(platforms: string[]): Promise<unknown[]>;
  when(): {
    approved(cb: (t: CdvTransaction) => void): unknown;
    pending(cb: (t: CdvTransaction) => void): unknown;
  };
  error(cb: (err: { code: number; message: string }) => void): void;
  get(id: string): CdvProduct | undefined;
  restorePurchases(): Promise<void>;
}

const resolvers = new Map<string, (outcome: PurchaseOutcome) => void>();

function waitForDeviceReady(): Promise<void> {
  return new Promise((resolve) => {
    if (window.CdvPurchase) return resolve();
    document.addEventListener('deviceready', () => resolve(), { once: true });
  });
}

export class RealBillingProvider implements BillingProvider {
  private store: CdvStore | null = null;

  async initialize(): Promise<void> {
    await waitForDeviceReady();
    const cdv = window.CdvPurchase;
    if (!cdv) return; // not running inside the native app (e.g. `npm run dev` in a browser)
    this.store = cdv.store;

    this.store.register(
      PRODUCTS.map((p) => ({ id: p.id, type: cdv.ProductType.CONSUMABLE, platform: cdv.Platform.GOOGLE_PLAY })),
    );

    this.store.when().approved((transaction) => this.handleApproved(transaction));
    this.store.when().pending((transaction) => {
      const resolve = resolvers.get(transaction.products[0]?.id ?? '');
      resolve?.({ kind: 'pending' });
    });
    this.store.error((err) => {
      // A bare error with no in-flight purchase() call to resolve just gets logged — the
      // plugin also surfaces failures directly to order()'s own promise, which purchase()
      // below already handles.
      console.error('Billing error', err.code, err.message);
    });

    await this.store.initialize([cdv.Platform.GOOGLE_PLAY]);

    // Re-process anything left over from a previous session that never reached our server.
    await this.retryPendingGrants();
  }

  getLocalizedPrice(productId: string): string | null {
    const product = this.store?.get(productId);
    return product?.pricing?.price ?? null;
  }

  async purchase(productId: string): Promise<PurchaseOutcome> {
    if (!this.store) return { kind: 'error', message: 'Billing unavailable on this device' };
    const product = this.store.get(productId);
    const offer = product?.getOffer?.();
    if (!offer) return { kind: 'error', message: 'Billing unavailable on this device' };

    return new Promise<PurchaseOutcome>((resolve) => {
      resolvers.set(productId, resolve);
      offer
        .order()
        .then((err) => {
          if (!err) return; // success resolves via the `approved` handler instead
          // code 6777006 is cordova-plugin-purchase's CANCELLED; treat anything else as an error.
          const outcome: PurchaseOutcome =
            err.code === 6777006 ? { kind: 'cancelled' } : { kind: 'error', message: err.message };
          resolvers.get(productId)?.(outcome);
          resolvers.delete(productId);
        })
        .catch((e: Error) => {
          resolvers.get(productId)?.({ kind: 'error', message: e.message });
          resolvers.delete(productId);
        });
    });
  }

  async restorePurchases(): Promise<void> {
    await this.store?.restorePurchases();
    await this.retryPendingGrants();
  }

  private async handleApproved(transaction: CdvTransaction): Promise<void> {
    const productId = transaction.products[0]?.id;
    const purchaseToken = transaction.parentReceipt.purchaseToken;
    if (!productId || !purchaseToken) return;

    const product = getProduct(productId);
    if (!product) return;

    addPendingGrant(productId, purchaseToken);
    const outcome = await this.grantAndFinish(productId, purchaseToken, product.coins, product.lives, transaction);
    resolvers.get(productId)?.(outcome);
    resolvers.delete(productId);
  }

  private async grantAndFinish(
    productId: string,
    purchaseToken: string,
    coins: number,
    lives: number,
    transaction: CdvTransaction,
  ): Promise<PurchaseOutcome> {
    const serverOutcome = await verifyPurchaseOnServer(productId, purchaseToken, coins, lives);

    if (serverOutcome === null) {
      // No backend configured — grant locally so a real purchase is never lost, keep it
      // queued for a future retry once a backend exists.
      grantLocally(coins, lives);
      await transaction.finish();
      return { kind: 'granted', coins, lives };
    }

    if (serverOutcome.kind === 'granted') {
      clearPendingGrant(purchaseToken);
      await transaction.finish(); // consumes/acknowledges with Google — only after server success
    }
    // 'pending' and 'error' outcomes deliberately do NOT finish() — the purchase stays
    // unconsumed and in the pending-grant queue, retried on next launch/restore (Google
    // auto-refunds an unconsumed purchase after 3 days, which is the correct behavior here:
    // we must not finish() until we're sure the player was credited).
    return serverOutcome;
  }

  private async retryPendingGrants(): Promise<void> {
    for (const grant of loadPendingGrants()) {
      const product = getProduct(grant.productId);
      if (!product) continue;
      const outcome = await verifyPurchaseOnServer(grant.productId, grant.purchaseToken, product.coins, product.lives);
      if (outcome?.kind === 'granted') clearPendingGrant(grant.purchaseToken);
    }
  }
}
