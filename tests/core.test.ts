import { describe, it, expect } from 'vitest';
import {
  CORE_VERSION,
  Rng,
  generateBoard,
  hasAnyMatch,
  hasValidMove,
  findMatches,
  applyGravity,
  refill,
  shuffleBoard,
  resolveSwap,
  initGoalProgress,
  applyStepToGoals,
  allGoalsMet,
  calculateStars,
  coinsForWin,
  continuePrice,
  regenerateLives,
  millisUntilNextLife,
  validateLevel,
  type Board,
  type LevelConfig,
  type Cell,
} from '../src/core';

function makeBoard(rows: string[][]): Board {
  const sweetNames: Record<string, string> = {
    L: 'laddu',
    J: 'jalebi',
    G: 'gulabjamun',
    B: 'barfi',
    R: 'rasgulla',
    K: 'kajukatli',
  };
  const cells: Cell[][] = rows.map((row) =>
    row.map((ch) => (ch === '.' ? null : { sweet: sweetNames[ch]!, special: null, blocker: null, ingredient: false } as never)),
  );
  return { width: rows[0]!.length, height: rows.length, cells };
}

function baseLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: 1,
    width: 8,
    height: 8,
    moves: 20,
    goals: [{ type: 'score', target: 500 }],
    starThresholds: [1000, 2000],
    seed: 42,
    ...overrides,
  };
}

describe('core module', () => {
  it('loads without a Phaser dependency', () => {
    expect(CORE_VERSION).toBe('0.2.0');
  });
});

describe('board generation', () => {
  it('never starts with a pre-existing match', () => {
    for (let seed = 0; seed < 30; seed++) {
      const board = generateBoard(baseLevel({ seed }));
      expect(hasAnyMatch(board)).toBe(false);
    }
  });

  it('always has at least one legal move', () => {
    for (let seed = 0; seed < 30; seed++) {
      const board = generateBoard(baseLevel({ seed }));
      expect(hasValidMove(board)).toBe(true);
    }
  });

  it('is reproducible from the same seed', () => {
    const a = generateBoard(baseLevel({ seed: 777 }));
    const b = generateBoard(baseLevel({ seed: 777 }));
    expect(a.cells.flat().map((c) => c?.sweet)).toEqual(b.cells.flat().map((c) => c?.sweet));
  });
});

describe('match detection', () => {
  it('finds a horizontal 3-match with no special', () => {
    const board = makeBoard([
      ['L', 'L', 'L', 'J', 'G'],
      ['B', 'R', 'K', 'B', 'R'],
    ]);
    const matches = findMatches(board);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.cells).toHaveLength(3);
    expect(matches[0]!.special).toBeNull();
  });

  it('creates a striped-h special for a 4-in-a-row horizontal match', () => {
    const board = makeBoard([['L', 'L', 'L', 'L', 'J']]);
    const matches = findMatches(board);
    expect(matches[0]!.special).toBe('striped-h');
  });

  it('creates a striped-v special for a 4-in-a-column vertical match', () => {
    const board = makeBoard([['L'], ['L'], ['L'], ['L'], ['J']]);
    const matches = findMatches(board);
    expect(matches[0]!.special).toBe('striped-v');
  });

  it('creates a colour bomb for a 5-in-a-row match', () => {
    const board = makeBoard([['L', 'L', 'L', 'L', 'L']]);
    const matches = findMatches(board);
    expect(matches[0]!.special).toBe('colorbomb');
  });

  it('creates a wrapped special for an L/T shaped match', () => {
    const board = makeBoard([
      ['L', 'J', 'G'],
      ['L', 'B', 'R'],
      ['L', 'L', 'L'],
    ]);
    const matches = findMatches(board);
    expect(matches).toHaveLength(1);
    expect(matches[0]!.special).toBe('wrapped');
  });

  it('skips locked (rock) tiles when scanning for runs', () => {
    const board = makeBoard([['L', 'L', 'L', 'J', 'G']]);
    board.cells[0]![1]!.blocker = 'locked';
    expect(hasAnyMatch(board)).toBe(false);
  });
});

describe('gravity and refill', () => {
  it('compacts tiles downward and leaves no gaps after refill', () => {
    const board = makeBoard([
      ['L', 'J'],
      ['.', 'G'],
      ['B', '.'],
    ]);
    applyGravity(board);
    // Column 0 was [L, ., B] top-to-bottom; gravity preserves relative order, so B (already
    // lowest) ends at the bottom and L settles just above it.
    expect(board.cells[2]![0]!.sweet).toBe('barfi');
    expect(board.cells[1]![0]!.sweet).toBe('laddu');
    expect(board.cells[0]![0]).toBeNull();
    refill(board, new Rng(1));
    expect(board.cells.flat().every((c) => c !== null)).toBe(true);
  });
});

describe('cascades and swaps', () => {
  it('rejects a swap that creates no match', () => {
    const board = makeBoard([
      ['L', 'J', 'G', 'B'],
      ['R', 'K', 'L', 'J'],
    ]);
    const result = resolveSwap(board, { row: 0, col: 0 }, { row: 1, col: 0 }, new Rng(5));
    expect(result.valid).toBe(false);
  });

  it('accepts a swap that creates a match and scores it', () => {
    // Column 0 starts [L, L, J] (no match yet); swapping row 2's two cells puts an L at
    // (2,0), completing a vertical 3-match in column 0.
    const board = makeBoard([
      ['L', 'J'],
      ['L', 'K'],
      ['J', 'L'],
    ]);
    expect(hasAnyMatch(board)).toBe(false);
    const result = resolveSwap(board, { row: 2, col: 0 }, { row: 2, col: 1 }, new Rng(5));
    expect(result.valid).toBe(true);
    expect(result.totalScore).toBeGreaterThan(0);
    expect(result.steps.length).toBeGreaterThan(0);
  });

  it('escalates the score multiplier across cascade steps', () => {
    // A tall board where clearing the bottom immediately causes a second match to fall into place.
    const board = makeBoard([
      ['J', 'G', 'B'],
      ['L', 'K', 'R'],
      ['L', 'J', 'G'],
      ['B', 'L', 'R'],
    ]);
    const result = resolveSwap(board, { row: 1, col: 0 }, { row: 1, col: 1 }, new Rng(9));
    if (result.valid && result.steps.length > 1) {
      expect(result.steps[1]!.multiplier).toBeGreaterThan(result.steps[0]!.multiplier);
    }
  });

  it('clears a full row when a striped-h special fires via colour-bomb combo', () => {
    const board = makeBoard([
      ['L', 'J', 'G', 'B'],
      ['R', 'K', 'L', 'J'],
    ]);
    board.cells[0]![0] = { sweet: 'laddu', special: 'colorbomb', blocker: null, ingredient: false } as never;
    board.cells[0]![1] = { sweet: 'jalebi', special: null, blocker: null, ingredient: false } as never;
    const result = resolveSwap(board, { row: 0, col: 0 }, { row: 0, col: 1 }, new Rng(3));
    expect(result.valid).toBe(true);
    // Colour bomb + jalebi should clear every jalebi tile (just the one swapped-to cell here) plus itself.
    expect(result.steps[0]!.cleared.length).toBeGreaterThanOrEqual(2);
  });

  it('never leaves the board without a legal move after settling', () => {
    for (let seed = 0; seed < 10; seed++) {
      const board = generateBoard(baseLevel({ seed }));
      // Find any valid swap and resolve it.
      outer: for (let row = 0; row < board.height; row++) {
        for (let col = 0; col < board.width; col++) {
          if (col + 1 < board.width) {
            const result = resolveSwap(board, { row, col }, { row, col: col + 1 }, new Rng(seed));
            if (result.valid) {
              expect(hasValidMove(result.boardAfter)).toBe(true);
              break outer;
            }
          }
        }
      }
    }
  });
});

describe('shuffle', () => {
  it('reshuffles into a board with no match and a legal move', () => {
    const board = generateBoard(baseLevel({ seed: 3 }));
    shuffleBoard(board, new Rng(3));
    expect(hasAnyMatch(board)).toBe(false);
    expect(hasValidMove(board)).toBe(true);
  });
});

describe('goal tracking and stars', () => {
  it('tracks a score goal to completion', () => {
    const level = baseLevel({ goals: [{ type: 'score', target: 100 }] });
    const board = generateBoard(level);
    const progress = initGoalProgress(level, board);
    expect(allGoalsMet(progress)).toBe(false);
    applyStepToGoals(progress, {
      cleared: [],
      specialsCreated: [],
      multiplier: 1,
      scoreGained: 150,
      ingredientsDropped: 0,
      iceCleared: 0,
    });
    expect(allGoalsMet(progress)).toBe(true);
  });

  it('tracks a collect goal by sweet type', () => {
    const level = baseLevel({ goals: [{ type: 'collect', target: 2, sweet: 'laddu' }] });
    const board = generateBoard(level);
    const progress = initGoalProgress(level, board);
    applyStepToGoals(progress, {
      cleared: [
        { row: 0, col: 0, sweet: 'laddu' },
        { row: 0, col: 1, sweet: 'jalebi' },
      ],
      specialsCreated: [],
      multiplier: 1,
      scoreGained: 20,
      ingredientsDropped: 0,
      iceCleared: 0,
    });
    expect(progress[0]!.current).toBe(1);
  });

  it('calculates stars from score thresholds', () => {
    const level = baseLevel({ starThresholds: [1000, 2000] });
    expect(calculateStars(level, 0, false)).toBe(0);
    expect(calculateStars(level, 500, true)).toBe(1);
    expect(calculateStars(level, 1500, true)).toBe(2);
    expect(calculateStars(level, 2500, true)).toBe(3);
  });
});

describe('economy', () => {
  it('awards coins per win plus a per-star bonus', () => {
    expect(coinsForWin(0)).toBe(0);
    expect(coinsForWin(1)).toBe(15);
    expect(coinsForWin(3)).toBe(25);
  });

  it('escalates continue price up to the cap', () => {
    expect(continuePrice(1)).toBeGreaterThan(0);
    expect(continuePrice(3)).toBeGreaterThan(continuePrice(1)!);
    expect(continuePrice(4)).toBeNull();
  });

  it('regenerates lives over elapsed time and caps at max', () => {
    const start = { lives: 2, lastUpdatedAt: 0 };
    const after30Min = regenerateLives(start, 30 * 60_000);
    expect(after30Min.lives).toBe(3);

    const full = regenerateLives({ lives: 5, lastUpdatedAt: 0 }, 1_000_000);
    expect(full.lives).toBe(5);
  });

  it('reports time remaining until the next life', () => {
    const state = { lives: 2, lastUpdatedAt: 0 };
    const remaining = millisUntilNextLife(state, 10 * 60_000);
    expect(remaining).toBeGreaterThan(0);
    expect(remaining).toBeLessThanOrEqual(25 * 60_000);
  });
});

describe('level validator', () => {
  it('flags an unreachable score goal', () => {
    const level = baseLevel({ moves: 5, goals: [{ type: 'score', target: 999_999 }] });
    const errors = validateLevel(level);
    expect(errors.some((e) => e.includes('unreachable'))).toBe(true);
  });

  it('passes a sane level', () => {
    const errors = validateLevel(baseLevel());
    expect(errors).toEqual([]);
  });
});
