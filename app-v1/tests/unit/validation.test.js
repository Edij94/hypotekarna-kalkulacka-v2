import { describe, it, expect } from 'vitest';
import { validate } from '../../src/validation.js';

const raw = (price = '150000', down = '20', rate = '4', years = '30') => ({ price, down, rate, years });
const only = (field, value) => ({ ...raw(), [field]: value });

describe('validation.js', () => {
  it('V-01 defaults', () => {
    const r = validate(raw());
    expect(r.ok).toBe(true);
    expect(r.values).toEqual({ price: 150000, downH: 2000, rateH: 400, years: 30 });
    expect(r.warnings).toEqual({});
  });

  it('V-02 V-03 comma and dot decimals', () => {
    expect(validate(only('rate', '4,5')).values.rateH).toBe(450);
    expect(validate(only('rate', '4.5')).values.rateH).toBe(450);
  });

  it('V-04 minimum bounds', () => {
    expect(validate(raw('10000', '0', '0', '1')).ok).toBe(true);
  });

  it('V-05 maximum bounds', () => {
    expect(validate(raw('2000000', '90', '15', '40')).ok).toBe(true);
  });

  it('V-06 out-of-range values give one error with min and max', () => {
    const cases = [
      ['price', '9999', ['10000', '2000000']],
      ['price', '2000001', ['10000', '2000000']],
      ['down', '-1', null],
      ['down', '90,01', ['0', '90']],
      ['rate', '-0,01', null],
      ['rate', '15,01', ['0', '15']],
      ['years', '0', ['1', '40']],
      ['years', '41', ['1', '40']],
    ];
    for (const [field, value, bounds] of cases) {
      const r = validate(only(field, value));
      expect(r.ok, `${field}=${value}`).toBe(false);
      expect(Object.keys(r.errors)).toEqual([field]);
      if (bounds) for (const b of bounds) expect(r.errors[field]).toContain(b);
    }
  });

  it('V-07 empty and blank are required', () => {
    for (const field of ['price', 'down', 'rate', 'years']) {
      for (const v of ['', '   ']) {
        expect(validate(only(field, v)).errors[field]).toContain('required');
      }
    }
  });

  it('V-08 garbage is an error on the field', () => {
    for (const v of ['abc', '12abc', '1e3', 'Infinity', 'NaN', '--5', '+4', '-0', '4,5,6', '1,234.5']) {
      const r = validate(only('rate', v));
      expect(r.ok, v).toBe(false);
      expect(r.errors.rate, v).toBeTruthy();
    }
  });

  it('V-09 price and years reject decimals', () => {
    expect(validate(only('price', '150000.50')).errors.price).toContain('whole number');
    expect(validate(only('years', '2,5')).errors.years).toContain('whole number');
  });

  it('V-10 rate takes at most 2 decimals', () => {
    expect(validate(only('rate', '4,12')).ok).toBe(true);
    expect(validate(only('rate', '4,123')).errors.rate).toContain('max 2 decimals');
  });

  it('V-11 down payment takes at most 2 decimals', () => {
    expect(validate(only('down', '12,5')).values.downH).toBe(1250);
    expect(validate(only('down', '12,555')).errors.down).toContain('max 2 decimals');
  });

  it('V-12 trims and accepts leading zeros', () => {
    expect(validate(only('rate', ' 4 ')).values.rateH).toBe(400);
    expect(validate(only('years', '007')).values.years).toBe(7);
  });

  it('V-13 space-like thousand separators', () => {
    for (const sep of [' ', ' ', ' ']) {
      expect(validate(only('price', `150${sep}000`)).values.price).toBe(150000);
    }
  });

  it('V-14 low down payment warning', () => {
    const w = (d) => validate(only('down', d));
    expect(w('9,99').warnings.down).toBeTruthy();
    expect(w('10').warnings.down).toBeUndefined();
    expect(w('0').warnings.down).toBeTruthy();
    for (const d of ['9,99', '10', '0']) expect(w(d).ok).toBe(true);
  });

  it('V-15 all invalid fields reported at once', () => {
    const r = validate({ price: 'x', down: 'x', rate: 'x', years: 'x' });
    expect(Object.keys(r.errors).sort()).toEqual(['down', 'price', 'rate', 'years']);
  });

  it('V-16 warning survives an error elsewhere', () => {
    const r = validate({ ...raw('abc'), down: '5' });
    expect(r.ok).toBe(false);
    expect(r.errors.price).toBeTruthy();
    expect(r.warnings.down).toBeTruthy();
  });

  it('V-17 trailing separator is accepted', () => {
    expect(validate(only('rate', '4,')).values.rateH).toBe(400);
    expect(validate(only('rate', '4.')).values.rateH).toBe(400);
  });

  it('V-18 leading separator is rejected', () => {
    expect(validate(only('rate', ',5')).ok).toBe(false);
    expect(validate(only('rate', '.5')).ok).toBe(false);
  });

  it('V-19 thousand-like price is rejected as non-whole', () => {
    expect(validate(only('price', '150.000')).errors.price).toContain('whole number');
    expect(validate(only('price', '150,000')).errors.price).toContain('whole number');
  });

  it('V-20 unicode and unit garbage', () => {
    for (const v of ['４', '150000 €', '4 %', '−5', '0x10', '1_000']) {
      expect(validate(only('price', v)).ok, v).toBe(false);
    }
    expect(validate(only('price', '0000000000150000')).values.price).toBe(150000);
  });

  it('V-21 huge numbers give a range error, not Infinity', () => {
    for (const v of ['9007199254740993', '9'.repeat(400)]) {
      const r = validate(only('price', v));
      expect(r.ok).toBe(false);
      expect(r.errors.price).toContain('between');
      expect(JSON.stringify(r)).not.toContain('Infinity');
    }
  });

  it('V-22 format error wins over range error', () => {
    expect(validate(only('rate', '-1,234')).errors.rate).toContain('must be a number');
  });
});
