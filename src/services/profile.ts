import { ECONOMY, type BoosterId } from '../config/economy.config';
import type { Language } from './i18n';
import { loadJson, saveJson } from './storage';

export interface PlayerProfile {
  coins: number;
  lives: number;
  livesUpdatedAt: number; // epoch ms, local-monotonic fallback (Date.now())
  currentLevel: number; // next level to unlock/play
  starsByLevel: Record<number, 0 | 1 | 2 | 3>;
  inventory: Record<BoosterId, number>;
  dailyStreak: number;
  lastDailyClaim: number | null; // epoch ms
  purchasedDecorations: string[];
  language: Language;
  soundOn: boolean;
  musicOn: boolean;
  hapticsOn: boolean;
}

const KEY = 'profile';

function defaultProfile(): PlayerProfile {
  return {
    coins: ECONOMY.startingCoins,
    lives: ECONOMY.startingLives,
    livesUpdatedAt: Date.now(),
    currentLevel: 1,
    starsByLevel: {},
    inventory: { hammer: 0, shuffle: 0, extraStriped: 0, extraMoves3: 0 },
    dailyStreak: 0,
    lastDailyClaim: null,
    purchasedDecorations: [],
    language: 'en',
    soundOn: true,
    musicOn: true,
    hapticsOn: true,
  };
}

export function loadProfile(): PlayerProfile {
  return loadJson(KEY, defaultProfile());
}

export function saveProfile(profile: PlayerProfile): void {
  saveJson(KEY, profile);
}

export function recordLevelWin(profile: PlayerProfile, levelId: number, stars: 0 | 1 | 2 | 3, coinsAwarded: number): PlayerProfile {
  const best = profile.starsByLevel[levelId] ?? 0;
  const next: PlayerProfile = {
    ...profile,
    coins: profile.coins + coinsAwarded,
    starsByLevel: { ...profile.starsByLevel, [levelId]: Math.max(best, stars) as 0 | 1 | 2 | 3 },
    currentLevel: Math.max(profile.currentLevel, levelId + 1),
  };
  saveProfile(next);
  return next;
}

export function spendLife(profile: PlayerProfile): PlayerProfile {
  const next = { ...profile, lives: Math.max(0, profile.lives - 1), livesUpdatedAt: Date.now() };
  saveProfile(next);
  return next;
}

export function spendCoins(profile: PlayerProfile, amount: number): PlayerProfile | null {
  if (profile.coins < amount) return null;
  const next = { ...profile, coins: profile.coins - amount };
  saveProfile(next);
  return next;
}

export function addCoins(profile: PlayerProfile, amount: number): PlayerProfile {
  const next = { ...profile, coins: profile.coins + amount };
  saveProfile(next);
  return next;
}

export function addBooster(profile: PlayerProfile, booster: BoosterId, qty = 1): PlayerProfile {
  const next = { ...profile, inventory: { ...profile.inventory, [booster]: profile.inventory[booster] + qty } };
  saveProfile(next);
  return next;
}

export function useBooster(profile: PlayerProfile, booster: BoosterId): PlayerProfile | null {
  if (profile.inventory[booster] <= 0) return null;
  const next = { ...profile, inventory: { ...profile.inventory, [booster]: profile.inventory[booster] - 1 } };
  saveProfile(next);
  return next;
}

export function buyDecoration(profile: PlayerProfile, decorationId: string, cost: number): PlayerProfile | null {
  if (profile.purchasedDecorations.includes(decorationId)) return null;
  const spent = spendCoins(profile, cost);
  if (!spent) return null;
  const next = { ...spent, purchasedDecorations: [...spent.purchasedDecorations, decorationId] };
  saveProfile(next);
  return next;
}
