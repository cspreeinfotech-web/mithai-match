// Entry point for the pure-TS game logic module (no Phaser dependency).
export const CORE_VERSION = '0.2.0';

export * from './types';
export { Rng } from './rng';
export { findMatches, hasAnyMatch } from './match';
export { generateBoard, applyGravity, refill, shuffleBoard, hasValidMove, findAnyValidMove, countIce } from './board';
export { resolveSwap } from './cascade';
export { initGoalProgress, applyStepToGoals, allGoalsMet, calculateStars } from './levelRules';
export type { GoalProgress } from './levelRules';
export { coinsForWin, continuePrice, regenerateLives, millisUntilNextLife } from './economy';
export type { LifeState } from './economy';
export { validateLevel, validateAllLevels } from './levelValidator';
export { canClaimDaily, claimDaily } from './daily';
export type { DailyClaimState, DailyClaimResult } from './daily';
export { purchaseReducer, INITIAL_PURCHASE_STATE, enqueuePendingGrant, dequeuePendingGrant } from './purchaseState';
export type { PurchaseState, PurchaseStatus, PurchaseEvent, PendingGrant } from './purchaseState';
