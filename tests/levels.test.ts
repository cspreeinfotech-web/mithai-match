import { describe, it, expect } from 'vitest';
import { validateAllLevels } from '../src/core';
import { LEVELS } from '../src/levels';

describe('level set', () => {
  it('ships exactly 50 levels, uniquely and sequentially numbered', () => {
    expect(LEVELS).toHaveLength(50);
    expect(LEVELS.map((l) => l.id)).toEqual(Array.from({ length: 50 }, (_, i) => i + 1));
  });

  it('every level passes the design validator', () => {
    const problems = validateAllLevels(LEVELS);
    if (problems.size > 0) {
      const details = [...problems.entries()].map(([id, errs]) => `level ${id}: ${errs.join('; ')}`).join('\n');
      throw new Error(`Invalid levels:\n${details}`);
    }
  });
});
