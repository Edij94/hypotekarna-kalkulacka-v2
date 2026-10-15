import { formatEur } from '../format.js';

const ITEMS = [
  ['loan', 'Loan amount'],
  ['payment', 'Monthly payment'],
  ['totalPaid', 'Total paid'],
  ['totalInterest', 'Total interest'],
];
const EMPTY = '—';

export function mountSummary(root) {
  const values = {};
  for (const [key, label] of ITEMS) {
    const box = document.createElement('div');
    const dt = document.createElement('dt');
    dt.textContent = label;
    const dd = document.createElement('dd');
    dd.dataset.summary = key;
    dd.textContent = EMPTY;
    box.append(dt, dd);
    root.append(box);
    values[key] = dd;
  }
  root.dataset.state = 'empty';
  return {
    // result: { loan, payment, totalPaid, totalInterest } in cents, or null.
    render(result) {
      root.dataset.state = result ? 'filled' : 'empty';
      for (const [key] of ITEMS) values[key].textContent = result ? formatEur(result[key]) : EMPTY;
    },
  };
}
