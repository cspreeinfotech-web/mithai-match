import type { Board, SpecialType } from './types';

interface Run {
  cells: { row: number; col: number }[];
  orientation: 'h' | 'v';
}

export interface ClassifiedMatch {
  cells: { row: number; col: number }[];
  special: SpecialType;
  /** Cell the new special (if any) should land on. */
  landingCell: { row: number; col: number };
}

function key(row: number, col: number): string {
  return `${row},${col}`;
}

/** A cell can be matched if it holds a tile and isn't a (sweet-less) locked rock. */
function isMatchable(board: Board, row: number, col: number): boolean {
  const tile = board.cells[row]?.[col];
  return !!tile && tile.blocker !== 'locked';
}

function sweetAt(board: Board, row: number, col: number): string | null {
  return board.cells[row]?.[col]?.sweet ?? null;
}

function findRuns(board: Board): Run[] {
  const runs: Run[] = [];

  for (let row = 0; row < board.height; row++) {
    let runStart = 0;
    for (let col = 1; col <= board.width; col++) {
      const prevMatchable = isMatchable(board, row, col - 1);
      const sameAsStart =
        col < board.width &&
        isMatchable(board, row, col) &&
        prevMatchable &&
        sweetAt(board, row, col) === sweetAt(board, row, runStart);
      if (!sameAsStart) {
        const length = col - runStart;
        if (length >= 3 && prevMatchable) {
          runs.push({
            orientation: 'h',
            cells: Array.from({ length }, (_, i) => ({ row, col: runStart + i })),
          });
        }
        runStart = col;
      }
    }
  }

  for (let col = 0; col < board.width; col++) {
    let runStart = 0;
    for (let row = 1; row <= board.height; row++) {
      const prevMatchable = isMatchable(board, row - 1, col);
      const sameAsStart =
        row < board.height &&
        isMatchable(board, row, col) &&
        prevMatchable &&
        sweetAt(board, row, col) === sweetAt(board, runStart, col);
      if (!sameAsStart) {
        const length = row - runStart;
        if (length >= 3 && prevMatchable) {
          runs.push({
            orientation: 'v',
            cells: Array.from({ length }, (_, i) => ({ row: runStart + i, col })),
          });
        }
        runStart = row;
      }
    }
  }

  return runs;
}

/** Finds every match on the board right now and classifies the special each group creates. */
export function findMatches(board: Board): ClassifiedMatch[] {
  const runs = findRuns(board);
  if (runs.length === 0) return [];

  // Union runs that share a cell into groups (an L/T/+ shape is a shared-cell union of
  // a horizontal + vertical run).
  const parent = runs.map((_, i) => i);
  const find = (i: number): number => (parent[i] === i ? i : (parent[i] = find(parent[i]!)));
  const union = (a: number, b: number): void => {
    const ra = find(a);
    const rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  };

  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const setB = new Set(runs[j]!.cells.map((c) => key(c.row, c.col)));
      if (runs[i]!.cells.some((c) => setB.has(key(c.row, c.col)))) union(i, j);
    }
  }

  const groups = new Map<number, Run[]>();
  runs.forEach((run, i) => {
    const root = find(i);
    const list = groups.get(root) ?? [];
    list.push(run);
    groups.set(root, list);
  });

  const matches: ClassifiedMatch[] = [];
  for (const groupRuns of groups.values()) {
    const cellSet = new Map<string, { row: number; col: number }>();
    for (const run of groupRuns) {
      for (const c of run.cells) cellSet.set(key(c.row, c.col), c);
    }
    const cells = [...cellSet.values()];
    const maxRunLength = Math.max(...groupRuns.map((r) => r.cells.length));
    const hasHorizontal = groupRuns.some((r) => r.orientation === 'h');
    const hasVertical = groupRuns.some((r) => r.orientation === 'v');

    let special: SpecialType = null;
    let landingCell = cells[Math.floor(cells.length / 2)]!;

    if (maxRunLength >= 5) {
      special = 'colorbomb';
      const longest = groupRuns.find((r) => r.cells.length === maxRunLength)!;
      landingCell = longest.cells[Math.floor(longest.cells.length / 2)]!;
    } else if (hasHorizontal && hasVertical) {
      special = 'wrapped';
      // Landing cell is the intersection shared by a horizontal and vertical run.
      const hCells = new Set(
        groupRuns.filter((r) => r.orientation === 'h').flatMap((r) => r.cells.map((c) => key(c.row, c.col))),
      );
      landingCell = cells.find((c) => hCells.has(key(c.row, c.col)) && groupRuns.some((r) =>
        r.orientation === 'v' && r.cells.some((rc) => rc.row === c.row && rc.col === c.col),
      )) ?? landingCell;
    } else if (maxRunLength === 4) {
      const run4 = groupRuns.find((r) => r.cells.length === 4)!;
      special = run4.orientation === 'h' ? 'striped-h' : 'striped-v';
      landingCell = run4.cells[Math.floor(run4.cells.length / 2)]!;
    }

    matches.push({ cells, special, landingCell });
  }

  return matches;
}

export function hasAnyMatch(board: Board): boolean {
  return findMatches(board).length > 0;
}
