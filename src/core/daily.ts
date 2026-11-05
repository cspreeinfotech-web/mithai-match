import { ECONOMY } from '../config/economy.config';

const DAY_MS = 24 * 60 * 60 * 1000;

function dayNumber(epochMs: number): number {
  return Math.floor(epochMs / DAY_MS);
}

export interface DailyClaimState {
  dailyStreak: number; // 0 = never claimed
  lastDailyClaim: number | null; // epoch ms
}

export function canClaimDaily(state: DailyClaimState, now: number): boolean {
  if (state.lastDailyClaim === null) return true;
  return dayNumber(now) > dayNumber(state.lastDailyClaim);
}

export interface DailyClaimResult extends DailyClaimState {
  reward: (typeof ECONOMY.dailyRewards)[number];
  streakDay: number; // 1-7, which reward tier was granted
}

/** Advances the streak (or resets it if a calendar day was skipped) and returns the reward
 *  for the new day. Caller applies `reward` to the player's coins/inventory and persists
 *  the returned state. Pure — `now` is injected so this is reproducible in tests. */
export function claimDaily(state: DailyClaimState, now: number): DailyClaimResult | null {
  if (!canClaimDaily(state, now)) return null;

  const missedADay = state.lastDailyClaim !== null && dayNumber(now) - dayNumber(state.lastDailyClaim) > 1;
  const nextStreak = state.lastDailyClaim === null || missedADay ? 1 : state.dailyStreak + 1;
  const streakDay = ((nextStreak - 1) % ECONOMY.dailyRewards.length) + 1;
  const reward = ECONOMY.dailyRewards[streakDay - 1]!;

  return { dailyStreak: nextStreak, lastDailyClaim: now, reward, streakDay };
}
