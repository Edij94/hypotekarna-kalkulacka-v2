// The only module that knows Chart.js (loaded as a global from the CDN).
const MISSING = 'Charts are unavailable because Chart.js could not be loaded.';

export function mountCharts({ balanceCanvas, flowCanvas, messageEl }) {
  const Chart = globalThis.Chart;
  if (typeof Chart === 'undefined') {
    messageEl.textContent = MISSING;
    messageEl.hidden = false;
    return { update() {} };
  }
  messageEl.hidden = true;

  const common = { responsive: true, maintainAspectRatio: false, animation: false };
  const balance = new Chart(balanceCanvas, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{ label: 'Remaining balance (€)', data: [], borderColor: '#1f6feb', pointRadius: 0, borderWidth: 2 }],
    },
    options: { ...common, scales: { x: { title: { display: true, text: 'Month' } } } },
  });
  const flow = new Chart(flowCanvas, {
    type: 'bar',
    data: {
      labels: [],
      datasets: [
        { label: 'Principal (€)', data: [], backgroundColor: '#1f6feb' },
        { label: 'Interest (€)', data: [], backgroundColor: '#e8912d' },
      ],
    },
    options: {
      ...common,
      scales: { x: { stacked: true, title: { display: true, text: 'Month' } }, y: { stacked: true } },
    },
  });

  return {
    // schedule: rows in cents, or null to empty both charts. Charts show euros.
    update(schedule) {
      const rows = schedule ?? [];
      const euros = (k) => rows.map((r) => r[k] / 100);
      const labels = rows.map((r) => r.month);
      balance.data.labels = labels;
      balance.data.datasets[0].data = euros('balance');
      flow.data.labels = labels;
      flow.data.datasets[0].data = euros('principal');
      flow.data.datasets[1].data = euros('interest');
      balance.update('none');
      flow.update('none');
    },
  };
}
