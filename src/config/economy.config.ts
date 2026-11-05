// Every coin/life price lives here (mirrored in the Supabase economy_config table so these
// can be tweaked server-side without a release; the client falls back to these values offline).
export const ECONOMY = {
  startingCoins: 100,
  startingLives: 5,
  maxLives: 5,
  lifeRegenMinutes: 25,

  coinsPerWin: 10,
  coinsPerStar: 5,

  boosterPrices: {
    hammer: 60,
    shuffle: 40,
    extraStriped: 80,
    extraMoves3: 50,
  },

  lifeRefillCoins: 120,
  // Continue-after-fail: price rises on each repeat within the same attempt, max 3 continues.
  continueMovesCoinPrices: [80, 140, 220] as const,
  continueMovesGranted: 5,
  maxContinuesPerAttempt: 3,
} as const;

export type BoosterId = keyof typeof ECONOMY.boosterPrices;
