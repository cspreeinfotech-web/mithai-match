import { Rng } from './rng';
import { applyGravity, hasValidMove, refill, shuffleBoard } from './board';
import { findMatches } from './match';
import type { Board, CascadeStep, SpecialType, SwapResult, Tile } from './types';

const BASE_SCORE_PER_TILE = 10;

interface Pos {
  row: number;
  col: number;
}

function cloneBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    cells: board.cells.map((row) => row.map((c) => (c ? { ...c } : null))),
  };
}

function isAdjacent(a: Pos, b: Pos): boolean {
  return (Math.abs(a.row - b.row) === 1 && a.col === b.col) || (Math.abs(a.col - b.col) === 1 && a.row === b.row);
}

/** Cells cleared by firing a special at `pos` (does not itself recurse into other specials
 *  it happens to clear along the way — the cascade loop picks those up as separate matches). */
function specialClearCells(board: Board, pos: Pos, special: SpecialType): Pos[] {
  const cells: Pos[] = [];
  if (special === 'striped-h') {
    for (let col = 0; col < board.width; col++) cells.push({ row: pos.row, col });
  } else if (special === 'striped-v') {
    for (let row = 0; row < board.height; row++) cells.push({ row, col: pos.col });
  } else if (special === 'wrapped') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const r = pos.row + dr;
        const c = pos.col + dc;
        if (r >= 0 && r < board.height && c >= 0 && c < board.width) cells.push({ row: r, col: c });
      }
    }
  } else if (special === 'colorbomb') {
    const sweet = board.cells[pos.row]?.[pos.col]?.sweet;
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        if (board.cells[row]![col]?.sweet === sweet) cells.push({ row, col });
      }
    }
  }
  return cells;
}

/** Clearing two specials together (swapped into each other) — the four combos the spec requires. */
function comboClearCells(board: Board, a: Pos, b: Pos): Pos[] | null {
  const specialA = board.cells[a.row]?.[a.col]?.special ?? null;
  const specialB = board.cells[b.row]?.[b.col]?.special ?? null;
  if (!specialA && !specialB) return null;

  const isStriped = (s: SpecialType) => s === 'striped-h' || s === 'striped-v';

  if (specialA === 'colorbomb' || specialB === 'colorbomb') {
    // Colour bomb + any: clear every tile of the OTHER tile's sweet (or, bomb+bomb, clear the board).
    if (specialA === 'colorbomb' && specialB === 'colorbomb') {
      const all: Pos[] = [];
      for (let row = 0; row < board.height; row++)
        for (let col = 0; col < board.width; col++) all.push({ row, col });
      return all;
    }
    const bombAt = specialA === 'colorbomb' ? a : b;
    const otherAt = specialA === 'colorbomb' ? b : a;
    const sweet = board.cells[otherAt.row]?.[otherAt.col]?.sweet;
    const cells: Pos[] = [];
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        if (board.cells[row]![col]?.sweet === sweet) cells.push({ row, col });
      }
    }
    cells.push(bombAt);
    return cells;
  }

  if (isStriped(specialA) && isStriped(specialB)) {
    // Striped + striped: cross clear (both the full row and the full column through the swap point).
    const rowCells = Array.from({ length: board.width }, (_, col) => ({ row: a.row, col }));
    const colCells = Array.from({ length: board.height }, (_, row) => ({ row, col: a.col }));
    return [...rowCells, ...colCells];
  }

  if ((specialA === 'wrapped' && isStriped(specialB)) || (specialB === 'wrapped' && isStriped(specialA))) {
    // Blast + striped: 3 rows and 3 columns centred on the swap point.
    const center = specialA === 'wrapped' ? a : b;
    const cells: Pos[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      const row = center.row + dr;
      if (row >= 0 && row < board.height) for (let col = 0; col < board.width; col++) cells.push({ row, col });
    }
    for (let dc = -1; dc <= 1; dc++) {
      const col = center.col + dc;
      if (col >= 0 && col < board.width) for (let row = 0; row < board.height; row++) cells.push({ row, col });
    }
    return cells;
  }

  if (specialA === 'wrapped' && specialB === 'wrapped') {
    // Blast + blast: a larger 5x5 blast.
    const cells: Pos[] = [];
    for (let dr = -2; dr <= 2; dr++) {
      for (let dc = -2; dc <= 2; dc++) {
        const r = a.row + dr;
        const c = a.col + dc;
        if (r >= 0 && r < board.height && c >= 0 && c < board.width) cells.push({ row: r, col: c });
      }
    }
    return cells;
  }

  return null;
}

function dedupe(cells: Pos[]): Pos[] {
  const seen = new Map<string, Pos>();
  for (const c of cells) seen.set(`${c.row},${c.col}`, c);
  return [...seen.values()];
}

/** Clears `cells`, honouring ice/locked blockers, ingredient drops are counted by the caller
 *  after gravity settles. Returns how many ice layers were fully cleared this pass. */
function clearCells(board: Board, cells: Pos[]): { cleared: { row: number; col: number; sweet: Tile['sweet'] }[]; iceCleared: number } {
  const cleared: { row: number; col: number; sweet: Tile['sweet'] }[] = [];
  let iceCleared = 0;
  const clearedSet = new Set<string>();

  for (const { row, col } of cells) {
    const tile = board.cells[row]![col];
    if (!tile) continue;
    const k = `${row},${col}`;
    if (clearedSet.has(k)) continue;

    if (tile.blocker === 'ice2') {
      tile.blocker = 'ice1'; // one layer down; tile stays put, not yet cleared
      continue;
    }
    if (tile.blocker === 'ice1') iceCleared++;
    board.cells[row]![col] = null;
    clearedSet.add(k);
    cleared.push({ row, col, sweet: tile.sweet });

    // Locked (rock) tiles have no sweet and can't be matched directly, but clear when a
    // match happens in an adjacent cell.
    for (const [dr, dc] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) {
      const nr = row + dr;
      const nc = col + dc;
      const neighbor = board.cells[nr]?.[nc];
      if (neighbor?.blocker === 'locked') {
        board.cells[nr]![nc] = null;
      }
    }
  }

  return { cleared, iceCleared };
}

/** Honey (level 20+ blocker): untouched honey tiles spread to one random plain neighbour
 *  each time a swap resolves without clearing them.
 *  shortcut: spreads to exactly one neighbour per resolution rather than a tunable rate —
 *  revisit if playtesting shows it grows too fast/slow. */
function growHoney(board: Board, clearedKeys: Set<string>, rng: Rng): void {
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      const tile = board.cells[row]![col];
      if (tile?.blocker !== 'honey' || clearedKeys.has(`${row},${col}`)) continue;
      const neighbors = ([[-1, 0], [1, 0], [0, -1], [0, 1]] as const)
        .map(([dr, dc]) => ({ row: row + dr, col: col + dc }))
        .filter((p) => board.cells[p.row]?.[p.col] && board.cells[p.row]![p.col]!.blocker === null);
      if (neighbors.length > 0) {
        const pick = neighbors[rng.int(neighbors.length)]!;
        board.cells[pick.row]![pick.col]!.blocker = 'honey';
      }
    }
  }
}

function countIngredientsOnBottomRow(board: Board): Pos[] {
  const row = board.height - 1;
  const found: Pos[] = [];
  for (let col = 0; col < board.width; col++) {
    if (board.cells[row]![col]?.ingredient) found.push({ row, col });
  }
  return found;
}

/**
 * Resolves a full swap: validates it, clears matches/combos, cascades gravity+refills, and
 * keeps going while new matches keep forming. `rng` drives refills/honey growth so the result
 * is reproducible given the same board+seed.
 */
export function resolveSwap(board: Board, a: Pos, b: Pos, rng: Rng): SwapResult {
  if (!isAdjacent(a, b)) return { valid: false, steps: [], totalScore: 0, boardAfter: board, shuffled: false };

  const working = cloneBoard(board);
  const tileA = working.cells[a.row]![a.col];
  const tileB = working.cells[b.row]![b.col];
  if (!tileA || !tileB || tileA.blocker === 'locked' || tileB.blocker === 'locked') {
    return { valid: false, steps: [], totalScore: 0, boardAfter: board, shuffled: false };
  }

  const combo = comboClearCells(working, a, b);
  working.cells[a.row]![a.col] = tileB;
  working.cells[b.row]![b.col] = tileA;

  const steps: CascadeStep[] = [];
  let totalScore = 0;
  let multiplier = 1;
  const touchedByClearing = new Set<string>();

  if (combo) {
    const toClear = dedupe(combo);
    const { cleared, iceCleared } = clearCells(working, toClear);
    cleared.forEach((c) => touchedByClearing.add(`${c.row},${c.col}`));
    const scoreGained = cleared.length * BASE_SCORE_PER_TILE * multiplier;
    totalScore += scoreGained;
    applyGravity(working);
    refill(working, rng);
    steps.push({
      cleared,
      specialsCreated: [],
      multiplier,
      scoreGained,
      ingredientsDropped: 0,
      iceCleared,
      boardAfterStep: cloneBoard(working),
    });
    multiplier++;
  } else {
    // A normal swap must create a match by itself, or it's invalid (bounce back).
    const immediate = findMatches(working);
    if (immediate.length === 0) {
      return { valid: false, steps: [], totalScore: 0, boardAfter: board, shuffled: false };
    }
  }

  // Cascade loop: keep clearing/creating specials until the board settles.
  for (;;) {
    const matches = findMatches(working);
    if (matches.length === 0) break;

    const allCells = dedupe(matches.flatMap((m) => m.cells));
    const { cleared, iceCleared } = clearCells(working, allCells);
    cleared.forEach((c) => touchedByClearing.add(`${c.row},${c.col}`));

    const specialsCreated: { row: number; col: number; special: SpecialType }[] = [];
    for (const m of matches) {
      if (m.special) {
        const sweet = board.cells[m.landingCell.row]?.[m.landingCell.col]?.sweet ?? working.cells.flat().find((t) => t)?.sweet;
        working.cells[m.landingCell.row]![m.landingCell.col] = {
          sweet: (sweet ?? 'laddu') as never,
          special: m.special,
          blocker: null,
          ingredient: false,
        };
        specialsCreated.push({ ...m.landingCell, special: m.special });
      }
    }

    const scoreGained = cleared.length * BASE_SCORE_PER_TILE * multiplier;
    totalScore += scoreGained;

    applyGravity(working);

    let ingredientsDropped = 0;
    const droppedIngredients = countIngredientsOnBottomRow(working);
    if (droppedIngredients.length > 0) {
      ingredientsDropped = droppedIngredients.length;
      for (const { row, col } of droppedIngredients) working.cells[row]![col] = null;
      applyGravity(working);
    }

    refill(working, rng);
    steps.push({
      cleared,
      specialsCreated,
      multiplier,
      scoreGained,
      ingredientsDropped,
      iceCleared,
      boardAfterStep: cloneBoard(working),
    });
    multiplier++;
  }

  growHoney(working, touchedByClearing, rng);

  const shuffled = !hasValidMove(working);
  if (shuffled) shuffleBoard(working, rng);

  return { valid: true, steps, totalScore, boardAfter: working, shuffled };
}
