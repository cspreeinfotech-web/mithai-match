import type { Board, CascadeStep, LevelConfig, LevelGoal } from './types';
import { countIce } from './board';

export interface GoalProgress {
  goal: LevelGoal;
  current: number;
}

export function initGoalProgress(config: LevelConfig, startingBoard: Board): GoalProgress[] {
  return config.goals.map((goal) => ({
    goal,
    // 'clear-ice' counts DOWN from the starting ice count to 0.
    current: goal.type === 'clear-ice' ? countIce(startingBoard) : 0,
  }));
}

export function applyStepToGoals(progress: GoalProgress[], step: CascadeStep): void {
  for (const p of progress) {
    switch (p.goal.type) {
      case 'score':
        p.current += step.scoreGained;
        break;
      case 'collect':
        p.current += step.cleared.filter((c) => c.sweet === p.goal.sweet).length;
        break;
      case 'clear-ice':
        p.current = Math.max(0, p.current - step.iceCleared);
        break;
      case 'drop-ingredients':
        p.current += step.ingredientsDropped;
        break;
    }
  }
}

export function allGoalsMet(progress: GoalProgress[]): boolean {
  return progress.every((p) => (p.goal.type === 'clear-ice' ? p.current <= 0 : p.current >= p.goal.target));
}

/** 1 star for winning at all; 2nd and 3rd for clearing the level's score thresholds. */
export function calculateStars(config: LevelConfig, finalScore: number, won: boolean): 0 | 1 | 2 | 3 {
  if (!won) return 0;
  if (finalScore >= config.starThresholds[1]) return 3;
  if (finalScore >= config.starThresholds[0]) return 2;
  return 1;
}
