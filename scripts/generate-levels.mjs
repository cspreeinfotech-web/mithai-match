#!/usr/bin/env node
// Generates the 50 level JSON files under src/levels/, driven by a parametrized difficulty
// curve (see ASSUMPTIONS.md: these are generated + validated, not individually hand-tuned by
// a designer — re-run after editing the curve below, or hand-edit any single level_XXX.json
// afterward since they're just data).
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const SWEETS = ['laddu', 'jalebi', 'gulabjamun', 'barfi', 'rasgulla', 'kajukatli'];
const outDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'levels');
mkdirSync(outDir, { recursive: true });

function pick(arr, i) {
  return arr[i % arr.length];
}

function blockersFor(id, width, height) {
  const blockers = [];
  if (id >= 6 && id < 11) {
    // Introduce ice1 one tile at a time.
    const count = Math.min(3, id - 5);
    for (let i = 0; i < count; i++) blockers.push({ row: 1 + i, col: 2 + i, type: 'ice1' });
  } else if (id >= 11 && id < 16) {
    const count = Math.min(4, id - 10);
    for (let i = 0; i < count; i++) blockers.push({ row: i % height, col: (i * 2) % width, type: i % 2 === 0 ? 'ice1' : 'ice2' });
  } else if (id >= 16 && id < 20) {
    const count = Math.min(3, id - 15);
    for (let i = 0; i < count; i++) blockers.push({ row: 2 + i, col: 1 + i, type: 'locked' });
  } else if (id >= 20) {
    const iceCount = Math.min(4, Math.floor((id - 20) / 4) + 1);
    const lockedCount = Math.min(3, Math.floor((id - 20) / 6));
    const honeyCount = id >= 20 ? 1 : 0;
    for (let i = 0; i < iceCount; i++) blockers.push({ row: i % height, col: (i * 3) % width, type: i % 2 === 0 ? 'ice2' : 'ice1' });
    for (let i = 0; i < lockedCount; i++) blockers.push({ row: (i + 3) % height, col: (i + 1) % width, type: 'locked' });
    for (let i = 0; i < honeyCount; i++) blockers.push({ row: (height - 1) - i, col: (width - 1) - i, type: 'honey' });
  }
  return blockers;
}

function ingredientsFor(id, width) {
  if (id < 15 || id % 5 !== 0) return [];
  // Ingredients spawn near the top and must be walked down to the bottom row.
  return [{ row: 0, col: Math.floor(width / 2) }, { row: 0, col: Math.floor(width / 2) - 1 }];
}

function goalsFor(id) {
  if (id <= 5) return [{ type: 'score', target: 800 + id * 150 }];
  const mod = id % 4;
  if (mod === 1) return [{ type: 'score', target: 500 + id * 60 }];
  if (mod === 2) return [{ type: 'collect', target: 20 + Math.floor(id / 2), sweet: pick(SWEETS, id) }];
  // Only ask for clear-ice where blockersFor() actually places ice (see its id ranges below).
  if (mod === 3 && id >= 6 && id < 16) return [{ type: 'clear-ice', target: 0 }];
  if (mod === 0 && id >= 15 && id % 5 === 0) return [{ type: 'drop-ingredients', target: 2 }];
  return [{ type: 'score', target: 500 + id * 60 }];
}

const levels = [];
for (let id = 1; id <= 50; id++) {
  const width = id < 30 ? 8 : 8 + (id % 2); // mostly 8x8, a few 9-wide later for variety
  const height = 8;
  const moves = Math.max(15, 30 - Math.floor(id / 3)); // gentle downward curve, floor at 15
  const goals = goalsFor(id);
  const scoreGoal = goals.find((g) => g.type === 'score');
  const baseThreshold = scoreGoal ? scoreGoal.target : 1200 + id * 100;

  levels.push({
    id,
    width,
    height,
    moves,
    goals,
    blockers: blockersFor(id, width, height),
    ingredients: ingredientsFor(id, width),
    starThresholds: [Math.round(baseThreshold * 1.3), Math.round(baseThreshold * 1.6)],
    seed: 1000 + id * 37,
  });
}

for (const level of levels) {
  const path = join(outDir, `level_${String(level.id).padStart(3, '0')}.json`);
  writeFileSync(path, JSON.stringify(level, null, 2) + '\n');
}

writeFileSync(
  join(outDir, 'index.json'),
  JSON.stringify(levels.map((l) => l.id), null, 2) + '\n',
);

console.log(`Wrote ${levels.length} level files to ${outDir}`);
