import { ECONOMY } from '../config/economy.config';

export function coinsForWin(stars: 0 | 1 | 2 | 3): number {
  if (stars === 0) return 0;
  return ECONOMY.coinsPerWin + stars * ECONOMY.coinsPerStar;
}

/** Price of the Nth continue (1-indexed) within one level attempt, or null past the cap. */
export function continuePrice(continueNumber: number): number | null {
  const prices = ECONOMY.continueMovesCoinPrices;
  if (continueNumber < 1 || continueNumber > prices.length) return null;
  return prices[continueNumber - 1]!;
}

export interface LifeState {
  lives: number;
  lastUpdatedAt: number; // epoch ms
}

/** Regenerates lives based on elapsed time: 1 every lifeRegenMinutes, capped at maxLives.
 *  `now` is injected so callers can pass server time (online) or local monotonic time (offline). */
export function regenerateLives(state: LifeState, now: number): LifeState {
  if (state.lives >= ECONOMY.maxLives) return { lives: state.lives, lastUpdatedAt: now };
  const intervalMs = ECONOMY.lifeRegenMinutes * 60_000;
  const elapsed = now - state.lastUpdatedAt;
  if (elapsed <= 0) return state;

  const gained = Math.floor(elapsed / intervalMs);
  if (gained <= 0) return state;

  const lives = Math.min(ECONOMY.maxLives, state.lives + gained);
  // Leftover time carries over so partial progress toward the next life isn't lost.
  const consumedMs = (lives - state.lives) * intervalMs;
  return { lives, lastUpdatedAt: state.lastUpdatedAt + consumedMs };
}

export function millisUntilNextLife(state: LifeState, now: number): number {
  if (state.lives >= ECONOMY.maxLives) return 0;
  const intervalMs = ECONOMY.lifeRegenMinutes * 60_000;
  const elapsed = now - state.lastUpdatedAt;
  return Math.max(0, intervalMs - elapsed);
}
