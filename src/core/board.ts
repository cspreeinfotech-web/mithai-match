import { Rng } from './rng';
import { SWEET_TYPES, type Board, type Cell, type LevelConfig, type SweetType, type Tile } from './types';
import { hasAnyMatch, findMatches } from './match';

function randomSweet(rng: Rng): SweetType {
  return SWEET_TYPES[rng.int(SWEET_TYPES.length)]!;
}

function makeTile(sweet: SweetType): Tile {
  return { sweet, special: null, blocker: null, ingredient: false };
}

function cloneBoard(board: Board): Board {
  return {
    width: board.width,
    height: board.height,
    cells: board.cells.map((row) => row.map((c) => (c ? { ...c } : null))),
  };
}

/** Swapping these two cells would complete a match (used by generation + valid-move checks). */
function swapCreatesMatch(board: Board, a: { row: number; col: number }, b: { row: number; col: number }): boolean {
  const trial = cloneBoard(board);
  const tmp = trial.cells[a.row]![a.col]!;
  trial.cells[a.row]![a.col] = trial.cells[b.row]![b.col]!;
  trial.cells[b.row]![b.col] = tmp;
  return hasAnyMatch(trial);
}

export function hasValidMove(board: Board): boolean {
  return findAnyValidMove(board) !== null;
}

/** Finds one legal swap, for the "pulse a valid move" hint after idle time. */
export function findAnyValidMove(board: Board): { a: { row: number; col: number }; b: { row: number; col: number } } | null {
  for (let row = 0; row < board.height; row++) {
    for (let col = 0; col < board.width; col++) {
      if (col + 1 < board.width && swapCreatesMatch(board, { row, col }, { row, col: col + 1 })) {
        return { a: { row, col }, b: { row, col: col + 1 } };
      }
      if (row + 1 < board.height && swapCreatesMatch(board, { row, col }, { row: row + 1, col })) {
        return { a: { row, col }, b: { row: row + 1, col } };
      }
    }
  }
  return null;
}

/** Builds a level's starting board: no pre-existing match, and at least one legal move. */
export function generateBoard(config: LevelConfig): Board {
  const rng = new Rng(config.seed);
  let board: Board;

  // Regenerate (same seed, next draws) until both invariants hold — boards this small
  // converge in a handful of attempts in practice.
  for (let attempt = 0; attempt < 200; attempt++) {
    const cells: Cell[][] = [];
    for (let row = 0; row < config.height; row++) {
      const rowCells: Cell[] = [];
      for (let col = 0; col < config.width; col++) {
        let sweet: SweetType;
        do {
          sweet = randomSweet(rng);
        } while (
          (col >= 2 && rowCells[col - 1]?.sweet === sweet && rowCells[col - 2]?.sweet === sweet) ||
          (row >= 2 && cells[row - 1]![col]?.sweet === sweet && cells[row - 2]![col]?.sweet === sweet)
        );
        rowCells.push(makeTile(sweet));
      }
      cells.push(rowCells);
    }
    board = { width: config.width, height: config.height, cells };
    applyBlockersAndIngredients(board, config);
    if (!hasAnyMatch(board) && hasValidMove(board)) return board;
  }
  return board!; // extremely unlikely fallback; still a legal (if unlucky) board
}

function applyBlockersAndIngredients(board: Board, config: LevelConfig): void {
  for (const b of config.blockers ?? []) {
    const tile = board.cells[b.row]?.[b.col];
    if (tile) tile.blocker = b.type;
  }
  for (const ing of config.ingredients ?? []) {
    const tile = board.cells[ing.row]?.[ing.col];
    if (tile) tile.ingredient = true;
  }
}

/** Gravity: compact each column downward, leaving nulls (empty slots) at the top. */
export function applyGravity(board: Board): void {
  for (let col = 0; col < board.width; col++) {
    const stack: Cell[] = [];
    for (let row = board.height - 1; row >= 0; row--) {
      if (board.cells[row]![col]) stack.push(board.cells[row]![col]!);
    }
    for (let row = board.height - 1; row >= 0; row--) {
      board.cells[row]![col] = stack[board.height - 1 - row] ?? null;
    }
  }
}

/** Refills every empty slot from the top with a fresh random sweet. */
export function refill(board: Board, rng: Rng): void {
  for (let col = 0; col < board.width; col++) {
    for (let row = 0; row < board.height; row++) {
      if (!board.cells[row]![col]) {
        board.cells[row]![col] = makeTile(randomSweet(rng));
      }
    }
  }
}

/** Reshuffles existing tiles in place until the board has at least one legal move
 *  and no pre-existing match ("No moves — shuffling!"). */
export function shuffleBoard(board: Board, rng: Rng): void {
  const flat = board.cells.flat().filter((c): c is NonNullable<Cell> => !!c);
  for (let attempt = 0; attempt < 200; attempt++) {
    for (let i = flat.length - 1; i > 0; i--) {
      const j = rng.int(i + 1);
      [flat[i], flat[j]] = [flat[j]!, flat[i]!];
    }
    let idx = 0;
    for (let row = 0; row < board.height; row++) {
      for (let col = 0; col < board.width; col++) {
        board.cells[row]![col] = flat[idx++]!;
      }
    }
    if (!hasAnyMatch(board) && hasValidMove(board)) return;
  }
}

export function countIce(board: Board): number {
  let count = 0;
  for (const row of board.cells) {
    for (const tile of row) {
      if (tile?.blocker === 'ice1' || tile?.blocker === 'ice2') count++;
    }
  }
  return count;
}

export { findMatches };
