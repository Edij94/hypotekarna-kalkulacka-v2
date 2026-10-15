import { formatEur } from '../format.js';

const HEADERS = ['Month', 'Payment', 'Principal', 'Interest', 'Balance'];

export function mountSchedule(root) {
  const table = document.createElement('table');
  const head = table.createTHead().insertRow();
  for (const h of HEADERS) {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = h;
    head.append(th);
  }
  const body = table.createTBody();
  const note = document.createElement('p');
  note.className = 'empty-note';
  note.textContent = 'Enter valid loan details to see the schedule.';
  root.append(table, note);
  root.dataset.state = 'empty';

  return {
    // schedule: [{ month, payment, principal, interest, balance }] in cents, or null.
    render(schedule) {
      const rows = (schedule ?? []).map((r) => {
        const tr = document.createElement('tr');
        const month = document.createElement('td');
        month.textContent = String(r.month);
        tr.append(month);
        for (const k of ['payment', 'principal', 'interest', 'balance']) {
          const td = document.createElement('td');
          td.textContent = formatEur(r[k]);
          tr.append(td);
        }
        return tr;
      });
      body.replaceChildren(...rows);
      root.dataset.state = schedule ? 'filled' : 'empty';
      note.hidden = Boolean(schedule);
    },
  };
}
