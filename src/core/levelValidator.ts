import { generateBoard, countIce, hasValidMove } from './board';
import { hasAnyMatch } from './match';
import type { LevelConfig } from './types';

/** Rough per-move upside used only to sanity-check that a goal isn't impossible within the
 *  move budget — not a gameplay balance tool, just a validator guard. */
const SCORE_PER_MOVE_UPPER_BOUND = 250;
const SWEETS_PER_MOVE_UPPER_BOUND = 4;

export function validateLevel(config: LevelConfig): string[] {
  const errors: string[] = [];

  if (config.width < 7 || config.width > 9) errors.push(`width ${config.width} out of 7-9 range`);
  if (config.height < 7 || config.height > 9) errors.push(`height ${config.height} out of 7-9 range`);
  if (config.moves < 5 || config.moves > 60) errors.push(`moves ${config.moves} is not sane (5-60)`);
  if (config.goals.length === 0) errors.push('level has no goals');
  if (config.starThresholds[0] >= config.starThresholds[1])
    errors.push('starThresholds must be strictly increasing (2-star < 3-star)');

  for (const goal of config.goals) {
    if (goal.type === 'score' && goal.target > config.moves * SCORE_PER_MOVE_UPPER_BOUND) {
      errors.push(`score goal ${goal.target} looks unreachable in ${config.moves} moves`);
    }
    if (goal.type === 'collect' && goal.target > config.moves * SWEETS_PER_MOVE_UPPER_BOUND) {
      errors.push(`collect goal ${goal.target} looks unreachable in ${config.moves} moves`);
    }
    if (goal.type === 'collect' && !goal.sweet) {
      errors.push("collect goal is missing 'sweet'");
    }
    if (goal.type === 'drop-ingredients' && (config.ingredients?.length ?? 0) < goal.target) {
      errors.push(`drop-ingredients goal ${goal.target} exceeds the ${config.ingredients?.length ?? 0} ingredients placed`);
    }
  }

  const hasClearIceGoal = config.goals.some((g) => g.type === 'clear-ice');
  const board = generateBoard(config);
  if (hasClearIceGoal && countIce(board) === 0) {
    errors.push("clear-ice goal present but the level places no ice blockers");
  }

  if (hasAnyMatch(board)) errors.push('generated board already has a match');
  if (!hasValidMove(board)) errors.push('generated board has no legal move');

  return errors;
}

export function validateAllLevels(configs: LevelConfig[]): Map<number, string[]> {
  const results = new Map<number, string[]>();
  for (const config of configs) {
    const errors = validateLevel(config);
    if (errors.length > 0) results.set(config.id, errors);
  }
  return results;
}
