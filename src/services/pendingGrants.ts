// Local persistence for the core/purchaseState.ts pending-grant queue: purchases Google
// confirmed but our server hasn't granted yet (no network, app killed mid-flow, etc.).
// Retried on next launch and on "Restore purchases".
import { enqueuePendingGrant, dequeuePendingGrant, type PendingGrant } from '../core';
import { loadJson, saveJson } from './storage';

const KEY = 'pendingGrants';

export function loadPendingGrants(): PendingGrant[] {
  return loadJson(KEY, [] as PendingGrant[]);
}

export function addPendingGrant(productId: string, purchaseToken: string): void {
  const next = enqueuePendingGrant(loadPendingGrants(), { productId, purchaseToken }, Date.now());
  saveJson(KEY, next);
}

export function clearPendingGrant(purchaseToken: string): void {
  const next = dequeuePendingGrant(loadPendingGrants(), purchaseToken);
  saveJson(KEY, next);
}
