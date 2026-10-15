import { describe, it, expect } from 'vitest';
import { formatEur } from '../../src/format.js';

const N = ' ';

describe('format.js', () => {
  it('F-01 formats 57290 cents', () => {
    expect(formatEur(57290)).toBe(`572,90${N}€`);
  });
  it('F-02 groups thousands with nbsp', () => {
    expect(formatEur(123456)).toBe(`1${N}234,56${N}€`);
  });
  it('F-03 pads small values', () => {
    expect(formatEur(0)).toBe(`0,00${N}€`);
    expect(formatEur(5)).toBe(`0,05${N}€`);
    expect(formatEur(100)).toBe(`1,00${N}€`);
  });
  it('F-04 formats the max total paid', () => {
    expect(formatEur(1203103797)).toBe(`12${N}031${N}037,97${N}€`);
  });
});
