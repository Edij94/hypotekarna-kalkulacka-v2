import { DEFAULTS } from './config.js';
import { deriveOutcome } from './outcome.js';
import { mountForm } from './ui/form.js';
import { mountSummary } from './ui/summary.js';
import { mountSchedule } from './ui/schedule.js';
import { mountCharts } from './ui/charts.js';

const $ = (id) => document.getElementById(id);

const summary = mountSummary($('summary'));
const schedule = mountSchedule($('schedule'));
const charts = mountCharts({
  balanceCanvas: $('balance-chart'),
  flowCanvas: $('flow-chart'),
  messageEl: $('chart-message'),
});
const form = mountForm($('form'), DEFAULTS, (raw) => render(deriveOutcome(raw)));

function render(outcome) {
  form.setWarnings(outcome.warnings);
  if (outcome.status === 'ok') {
    form.setErrors({});
    summary.render(outcome.result);
    schedule.render(outcome.result.schedule);
    charts.update(outcome.result.schedule);
  } else {
    form.setErrors(outcome.errors);
    summary.render(null);
    schedule.render(null);
    charts.update(null);
  }
}

// Start from what the inputs actually contain (the browser may restore values on reload).
render(deriveOutcome(form.getRaw()));
