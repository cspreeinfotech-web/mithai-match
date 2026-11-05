import { describe, it, expect } from 'vitest';
import { canClaimDaily, claimDaily } from '../src/core';

const DAY = 24 * 60 * 60 * 1000;

describe('daily reward', () => {
  it('can claim on first ever login', () => {
    expect(canClaimDaily({ dailyStreak: 0, lastDailyClaim: null }, Date.now())).toBe(true);
  });

  it('cannot claim twice on the same calendar day', () => {
    const now = 10 * DAY + 1000;
    const result = claimDaily({ dailyStreak: 0, lastDailyClaim: null }, now);
    expect(result).not.toBeNull();
    const second = claimDaily({ dailyStreak: result!.dailyStreak, lastDailyClaim: result!.lastDailyClaim }, now + 1000);
    expect(second).toBeNull();
  });

  it('advances the streak on consecutive days', () => {
    let state = { dailyStreak: 0, lastDailyClaim: null as number | null };
    const day0 = claimDaily(state, 5 * DAY)!;
    expect(day0.streakDay).toBe(1);
    state = day0;
    const day1 = claimDaily(state, 6 * DAY)!;
    expect(day1.streakDay).toBe(2);
    expect(day1.dailyStreak).toBe(2);
  });

  it('resets the streak if a day is missed', () => {
    const state = { dailyStreak: 3, lastDailyClaim: 5 * DAY };
    const result = claimDaily(state, 8 * DAY)!; // skipped day 6 and 7
    expect(result.streakDay).toBe(1);
    expect(result.dailyStreak).toBe(1);
  });

  it('wraps the streak tier after day 7', () => {
    const state = { dailyStreak: 7, lastDailyClaim: 5 * DAY };
    const result = claimDaily(state, 6 * DAY)!;
    expect(result.streakDay).toBe(1);
    expect(result.dailyStreak).toBe(8);
  });
});
