import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

describe('golden file', () => {
  it('S-00 smoke: golden file holds 8 cases', () => {
    const golden = JSON.parse(readFileSync('tests/golden/golden.json', 'utf8'));
    expect(golden).toHaveLength(8);
  });
});
