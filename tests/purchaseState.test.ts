import { describe, it, expect } from 'vitest';
import {
  purchaseReducer,
  INITIAL_PURCHASE_STATE,
  enqueuePendingGrant,
  dequeuePendingGrant,
  type PurchaseState,
} from '../src/core';

describe('purchase state machine', () => {
  it('walks the happy path: purchasing -> verifying -> granted', () => {
    let state = purchaseReducer(INITIAL_PURCHASE_STATE, { type: 'START_PURCHASE', productId: 'coins_300' });
    expect(state.status).toBe('purchasing');
    state = purchaseReducer(state, { type: 'BILLING_SUCCESS', purchaseToken: 'tok-1' });
    expect(state.status).toBe('verifying');
    expect(state.purchaseToken).toBe('tok-1');
    state = purchaseReducer(state, { type: 'VERIFY_GRANTED' });
    expect(state.status).toBe('granted');
  });

  it('handles user cancellation', () => {
    let state = purchaseReducer(INITIAL_PURCHASE_STATE, { type: 'START_PURCHASE', productId: 'coins_300' });
    state = purchaseReducer(state, { type: 'BILLING_CANCELLED' });
    expect(state.status).toBe('cancelled');
  });

  it('handles billing unavailable', () => {
    const state = purchaseReducer(INITIAL_PURCHASE_STATE, { type: 'BILLING_UNAVAILABLE' });
    expect(state.status).toBe('developer_error');
    expect(state.error).toBeTruthy();
  });

  it('handles already-owned', () => {
    const state = purchaseReducer(INITIAL_PURCHASE_STATE, { type: 'ALREADY_OWNED' });
    expect(state.status).toBe('already_owned');
  });

  it('handles a pending purchase (e.g. awaiting external payment) without granting', () => {
    let state = purchaseReducer(INITIAL_PURCHASE_STATE, { type: 'START_PURCHASE', productId: 'coins_300' });
    state = purchaseReducer(state, { type: 'BILLING_PENDING', purchaseToken: 'tok-2' });
    expect(state.status).toBe('pending');
  });

  it('handles a network/server failure after a successful purchase, keeping the token for retry', () => {
    let state = purchaseReducer(INITIAL_PURCHASE_STATE, { type: 'START_PURCHASE', productId: 'coins_300' });
    state = purchaseReducer(state, { type: 'BILLING_SUCCESS', purchaseToken: 'tok-3' });
    state = purchaseReducer(state, { type: 'VERIFY_FAILED', error: 'network down' });
    expect(state.status).toBe('network_error');
    expect(state.purchaseToken).toBe('tok-3'); // not lost — the pending-grant queue retries it
  });

  it('resets back to idle', () => {
    const state: PurchaseState = { status: 'granted', productId: 'x', purchaseToken: 'y', error: null };
    expect(purchaseReducer(state, { type: 'RESET' })).toEqual(INITIAL_PURCHASE_STATE);
  });
});

describe('pending grant queue (retry + idempotency)', () => {
  it('queues a new purchase token', () => {
    const queue = enqueuePendingGrant([], { productId: 'coins_300', purchaseToken: 'tok-a' }, 1000);
    expect(queue).toHaveLength(1);
    expect(queue[0]!.purchaseToken).toBe('tok-a');
  });

  it('never queues the same token twice (duplicate token handling)', () => {
    let queue = enqueuePendingGrant([], { productId: 'coins_300', purchaseToken: 'tok-a' }, 1000);
    queue = enqueuePendingGrant(queue, { productId: 'coins_300', purchaseToken: 'tok-a' }, 2000);
    expect(queue).toHaveLength(1);
  });

  it('dequeues once the server confirms the grant', () => {
    let queue = enqueuePendingGrant([], { productId: 'coins_300', purchaseToken: 'tok-a' }, 1000);
    queue = dequeuePendingGrant(queue, 'tok-a');
    expect(queue).toHaveLength(0);
  });

  it('dequeuing an unknown token is a safe no-op', () => {
    const queue = enqueuePendingGrant([], { productId: 'coins_300', purchaseToken: 'tok-a' }, 1000);
    expect(dequeuePendingGrant(queue, 'does-not-exist')).toHaveLength(1);
  });

  it('keeps multiple distinct pending purchases for retry on next launch', () => {
    let queue = enqueuePendingGrant([], { productId: 'coins_300', purchaseToken: 'tok-a' }, 1000);
    queue = enqueuePendingGrant(queue, { productId: 'lives_refill_5', purchaseToken: 'tok-b' }, 1500);
    expect(queue).toHaveLength(2);
  });
});
