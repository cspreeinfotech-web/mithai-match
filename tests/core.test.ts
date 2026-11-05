import { describe, it, expect } from 'vitest';
import { CORE_VERSION } from '../src/core';

describe('core module', () => {
  it('loads without a Phaser dependency', () => {
    expect(CORE_VERSION).toBe('0.1.0');
  });
});
