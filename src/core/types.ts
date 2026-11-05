// Pure data types for the match-3 core. No Phaser dependency anywhere in src/core.

export const SWEET_TYPES = ['laddu', 'jalebi', 'gulabjamun', 'barfi', 'rasgulla', 'kajukatli'] as const;
export type SweetType = (typeof SWEET_TYPES)[number];

export type SpecialType = 'striped-h' | 'striped-v' | 'colorbomb' | 'wrapped' | null;

// Blocker layered ON TOP of a normal sweet tile (a cell can be a sweet + a blocker).
export type BlockerType = 'ice1' | 'ice2' | 'locked' | 'honey' | null;

export interface Tile {
  sweet: SweetType;
  special: SpecialType;
  blocker: BlockerType;
  /** Ingredient tiles must fall to the bottom row to be collected; null = not an ingredient. */
  ingredient: boolean;
}

export type Cell = Tile | null; // null = empty slot (mid-cascade, before refill)

export interface Board {
  width: number;
  height: number;
  cells: Cell[][]; // cells[row][col], row 0 = top
}

export type GoalType = 'score' | 'collect' | 'clear-ice' | 'drop-ingredients';

export interface LevelGoal {
  type: GoalType;
  target: number;
  sweet?: SweetType; // for 'collect'
}

export interface LevelConfig {
  id: number;
  width: number;
  height: number;
  moves: number;
  goals: LevelGoal[];
  /** Per-cell blocker layout, sparse: "row,col" -> blocker/ingredient seed. */
  blockers?: { row: number; col: number; type: Exclude<BlockerType, null> }[];
  ingredients?: { row: number; col: number }[];
  /** Score thresholds for 2-star and 3-star, in addition to the 1-star "goal met". */
  starThresholds: [number, number];
  seed: number;
}

export interface MatchGroup {
  cells: { row: number; col: number }[];
  sweet: SweetType;
}

export interface CascadeStep {
  /** Cells cleared this step (score source), before gravity. Sweet is captured pre-clear
   *  so 'collect N of a sweet' goals can be tallied after the fact. */
  cleared: { row: number; col: number; sweet: SweetType }[];
  /** Specials created this step, with the cell they land on. */
  specialsCreated: { row: number; col: number; special: SpecialType }[];
  /** Score multiplier applied to this step (1 for the first match, escalating per cascade). */
  multiplier: number;
  scoreGained: number;
  ingredientsDropped: number;
  iceCleared: number;
  /** Board state once this step's clear + gravity + refill has settled, for the renderer
   *  to animate toward one step at a time. */
  boardAfterStep: Board;
}

export interface SwapResult {
  valid: boolean;
  steps: CascadeStep[];
  totalScore: number;
  boardAfter: Board;
  /** True if the board had no legal move after settling and was auto-reshuffled
   *  ("No moves — shuffling!"). */
  shuffled: boolean;
}
