import type { LevelConfig } from '../core/types';

// Vite's glob import means dropping a new level_###.json file here needs zero code changes.
const modules = import.meta.glob('./level_*.json', { eager: true }) as Record<string, { default: LevelConfig }>;

export const LEVELS: LevelConfig[] = Object.values(modules)
  .map((m) => m.default)
  .sort((a, b) => a.id - b.id);

export function getLevel(id: number): LevelConfig | undefined {
  return LEVELS.find((l) => l.id === id);
}
