import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { calculate, interestCents } from '../../src/calc.js';
import { validate } from '../../src/validation.js';

// Inputs: price in euros, down and rate in hundredths of a percent, years.
const run = (price, downH, rateH, years) => calculate({ price, downH, rateH, years });
const row = (r, k) => r.schedule[k - 1];
const cells = (x) => [x.payment, x.principal, x.interest, x.balance];
const last = (r) => r.schedule[r.schedule.length - 1];

describe('calc.js', () => {
  it('C-01 default', () => {
    const r = run(150000, 2000, 400, 30);
    expect(r.loan).toBe(12000000);
    expect(r.payment).toBe(57290);
    expect(r.totalPaid).toBe(20624291);
    expect(r.totalInterest).toBe(8624291);
    expect(r.schedule).toHaveLength(360);
    expect(cells(row(r, 1))).toEqual([57290, 17290, 40000, 11982710]);
    expect(last(r).payment).toBe(57181);
    expect(last(r).balance).toBe(0);
  });

  it('C-02 zero rate', () => {
    const r = run(100000, 0, 0, 10);
    expect(r.payment).toBe(83333);
    expect(last(r).payment).toBe(83373);
    expect(r.schedule.every((x) => x.interest === 0)).toBe(true);
    expect(r.totalPaid).toBe(10000000);
    expect(r.totalInterest).toBe(0);
  });

  it('C-03 one year at 15 %', () => {
    const r = run(10000, 0, 1500, 1);
    expect(r.payment).toBe(90258);
    expect(last(r).payment).toBe(90262);
    expect(r.totalPaid).toBe(1083100);
    expect(r.totalInterest).toBe(83100);
  });

  it('C-04 max', () => {
    const r = run(2000000, 0, 1500, 40);
    expect(r.payment).toBe(2506448);
    expect(last(r).payment).toBe(2515205);
    expect(r.totalPaid).toBe(1203103797);
    expect(r.totalInterest).toBe(1003103797);
    expect(r.schedule).toHaveLength(480);
    expect(last(r).balance).toBe(0);
  });

  it('C-05 zero rate, 90 % down, one year', () => {
    const r = run(10000, 9000, 0, 1);
    expect(r.loan).toBe(100000);
    expect(r.payment).toBe(8333);
    expect(last(r).payment).toBe(8337);
  });

  it('C-06 tiny rate, long term', () => {
    const r = run(2000000, 9000, 1, 40);
    expect(r.payment).toBe(41750);
    expect(last(r).payment).toBe(41861);
    expect(r.totalInterest).toBe(40111);
  });

  it('C-07 rounded-up loan', () => {
    const r = run(10001, 3300, 400, 7);
    expect(r.loan).toBe(670067);
    expect(r.payment).toBe(9159);
    expect(last(r).payment).toBe(9162);
    expect(r.totalPaid).toBe(769359);
    expect(r.totalInterest).toBe(99292);
  });

  it('C-08 invariants over the grid', () => {
    for (const price of [10000, 10001, 150000, 2000000])
      for (const downH of [0, 999, 1000, 1255, 2000, 9000])
        for (const rateH of [0, 1, 400, 450, 1500])
          for (const years of [1, 2, 30, 40]) {
            const r = run(price, downH, rateH, years);
            const id = [price, downH, rateH, years].join('/');
            const s = r.schedule;
            const sum = (k) => s.reduce((a, x) => a + x[k], 0);
            expect(sum('payment'), id).toBe(r.totalPaid);
            expect(r.totalInterest, id).toBe(r.totalPaid - r.loan);
            expect(sum('principal'), id).toBe(r.loan);
            expect(s.length, id).toBe(years * 12);
            let prev = r.loan;
            s.forEach((x, i) => {
              const at = `${id} row ${i + 1}`;
              if (x.payment !== x.principal + x.interest) throw new Error(`${at} sum`);
              if (x.balance !== prev - x.principal) throw new Error(`${at} balance`);
              if (x.balance < 0 || x.balance > prev) throw new Error(`${at} monotonic`);
              if (x.payment < 0) throw new Error(`${at} negative payment`);
              if (x.month !== i + 1) throw new Error(`${at} month`);
              prev = x.balance;
            });
            expect(last(r).balance, id).toBe(0);
          }
  });

  it('C-09 regular payment until the last month', () => {
    const r = run(150000, 2000, 400, 30);
    expect(r.schedule.slice(0, 359).every((x) => x.payment === 57290)).toBe(true);
    expect(row(r, 360).payment).toBe(57181);
  });

  it('C-10 everything is an integer', () => {
    for (const r of [run(150000, 2000, 400, 30), run(2000000, 0, 1500, 40)]) {
      for (const k of ['loan', 'payment', 'totalPaid', 'totalInterest']) expect(Number.isInteger(r[k])).toBe(true);
      for (const x of r.schedule) for (const v of Object.values(x)) expect(Number.isInteger(v)).toBe(true);
    }
  });

  it('C-11 does not mutate its input and is deterministic', () => {
    const input = Object.freeze({ price: 150000, downH: 2000, rateH: 400, years: 30 });
    expect(calculate(input)).toEqual(calculate(input));
  });

  it('C-12 overpay: balance runs out early', () => {
    const r = run(10000, 9000, 450, 40);
    expect(r.schedule).toHaveLength(480);
    expect(row(r, 479).payment).toBe(318);
    expect(cells(row(r, 480))).toEqual([0, 0, 0, 0]);
    for (const x of r.schedule) for (const v of cells(x)) expect(v).toBeGreaterThanOrEqual(0);
    expect(r.totalPaid).toBe(215418);
    expect(r.totalInterest).toBe(115418);
  });

  it('C-13 big jump in the last payment', () => {
    const r = run(10001, 0, 1500, 40);
    expect(r.payment).toBe(12533);
    expect(last(r).payment).toBe(27108);
    expect(r.totalPaid).toBe(6030415);
  });

  it('C-14 fractional-cent loan', () => {
    const r = run(10001, 1255, 400, 7);
    expect(r.loan).toBe(874587);
    expect(r.payment).toBe(11955);
    expect(last(r).payment).toBe(11914);
    expect(r.totalPaid).toBe(1004179);
  });

  it('C-15 default row 180', () => {
    expect(cells(row(run(150000, 2000, 400, 30), 180))).toEqual([57290, 31368, 25922, 7745095]);
  });

  it('C-16 interest rounds half up', () => {
    expect(interestCents(100, 600)).toBe(1);
    expect(interestCents(99, 600)).toBe(0);
    expect(interestCents(101, 600)).toBe(1);
  });

  it('C-17 golden schedules match the Python reference', () => {
    const golden = JSON.parse(readFileSync('tests/golden/golden.json', 'utf8'));
    const wanted = ['Default', 'Max', 'Big jump', 'Overpay'];
    for (const g of golden.filter((c) => wanted.includes(c.name))) {
      const r = calculate(g);
      expect(r.loan, g.name).toBe(g.loan);
      expect(r.payment, g.name).toBe(g.payment);
      expect(r.totalPaid, g.name).toBe(g.totalPaid);
      expect(r.totalInterest, g.name).toBe(g.totalInterest);
      const rows = r.schedule.map((x) => [x.month, x.payment, x.principal, x.interest, x.balance]);
      expect(rows, g.name).toEqual(g.schedule);
    }
  });

  it('C-18 tiny rate, short term', () => {
    const r = run(10000, 9000, 1, 1);
    expect(r.schedule).toHaveLength(12);
    expect(r.schedule.every((x) => x.interest >= 0)).toBe(true);
    expect(r.schedule.reduce((a, x) => a + x.principal, 0)).toBe(100000);
    expect(last(r).balance).toBe(0);
  });

  it('C-19 rates near the upper bound via validate', () => {
    for (const rate of ['0,01', '14,99', '15', '15,00']) {
      const v = validate({ price: '150000', down: '20', rate, years: '30' });
      expect(v.ok, rate).toBe(true);
      expect(last(calculate(v.values)).balance, rate).toBe(0);
    }
  });

  it('reference cases from section 3.1 (5 % and 4.25 %)', () => {
    expect(run(150000, 2000, 500, 30).payment).toBe(64419);
    expect(run(150000, 2000, 425, 30).payment).toBe(59033);
  });
});
