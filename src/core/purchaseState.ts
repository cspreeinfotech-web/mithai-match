// Pure purchase-state machine + "pending grant" retry queue. No billing library or network
// code here — src/services/billing/* drives this with real events; this module just says
// what state a purchase attempt is in and keeps the idempotent queue of unconsumed purchases
// so a crash/network-drop between "Google says purchased" and "server granted it" never
// loses or double-grants a purchase.

export type PurchaseStatus =
  | 'idle'
  | 'purchasing'
  | 'verifying'
  | 'granted'
  | 'pending'
  | 'cancelled'
  | 'network_error'
  | 'developer_error'
  | 'already_owned';

export interface PurchaseState {
  status: PurchaseStatus;
  productId: string | null;
  purchaseToken: string | null;
  error: string | null;
}

export type PurchaseEvent =
  | { type: 'START_PURCHASE'; productId: string }
  | { type: 'BILLING_CANCELLED' }
  | { type: 'BILLING_UNAVAILABLE' }
  | { type: 'ALREADY_OWNED' }
  | { type: 'BILLING_SUCCESS'; purchaseToken: string }
  | { type: 'BILLING_PENDING'; purchaseToken: string }
  | { type: 'VERIFY_START' }
  | { type: 'VERIFY_GRANTED' }
  | { type: 'VERIFY_FAILED'; error: string }
  | { type: 'RESET' };

export const INITIAL_PURCHASE_STATE: PurchaseState = {
  status: 'idle',
  productId: null,
  purchaseToken: null,
  error: null,
};

export function purchaseReducer(state: PurchaseState, event: PurchaseEvent): PurchaseState {
  switch (event.type) {
    case 'START_PURCHASE':
      return { status: 'purchasing', productId: event.productId, purchaseToken: null, error: null };
    case 'BILLING_CANCELLED':
      return { ...state, status: 'cancelled' };
    case 'BILLING_UNAVAILABLE':
      return { ...state, status: 'developer_error', error: 'Billing unavailable on this device' };
    case 'ALREADY_OWNED':
      return { ...state, status: 'already_owned' };
    case 'BILLING_SUCCESS':
      return { ...state, status: 'verifying', purchaseToken: event.purchaseToken };
    case 'BILLING_PENDING':
      return { ...state, status: 'pending', purchaseToken: event.purchaseToken };
    case 'VERIFY_START':
      return { ...state, status: 'verifying' };
    case 'VERIFY_GRANTED':
      return { ...state, status: 'granted' };
    case 'VERIFY_FAILED':
      return { ...state, status: 'network_error', error: event.error };
    case 'RESET':
      return INITIAL_PURCHASE_STATE;
  }
}

export interface PendingGrant {
  productId: string;
  purchaseToken: string;
  addedAt: number;
}

/** Adds a purchase to the local "needs server grant" queue — idempotent: a token already
 *  queued is never added twice. */
export function enqueuePendingGrant(queue: PendingGrant[], grant: Omit<PendingGrant, 'addedAt'>, now: number): PendingGrant[] {
  if (queue.some((g) => g.purchaseToken === grant.purchaseToken)) return queue;
  return [...queue, { ...grant, addedAt: now }];
}

/** Removes a token from the queue once the server has confirmed the grant — safe to call
 *  for a token that isn't (or is no longer) in the queue. */
export function dequeuePendingGrant(queue: PendingGrant[], purchaseToken: string): PendingGrant[] {
  return queue.filter((g) => g.purchaseToken !== purchaseToken);
}
