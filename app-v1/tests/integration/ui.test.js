// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULTS } from '../../src/config.js';
import { deriveOutcome } from '../../src/outcome.js';
import { mountForm } from '../../src/ui/form.js';
import { mountSummary } from '../../src/ui/summary.js';
import { mountSchedule } from '../../src/ui/schedule.js';
import { mountCharts } from '../../src/ui/charts.js';

const N = ' ';
const instances = [];

// Minimal Chart.js stand-in: remembers its config and counts constructions.
class MockChart {
  constructor(canvas, config) {
    this.canvas = canvas;
    this.config = config;
    this.type = config.type;
    this.data = config.data;
    this.options = config.options;
    this.updates = 0;
    instances.push(this);
  }
  update() {
    this.updates += 1;
  }
}

const body = () =>
  readFileSync('index.html', 'utf8')
    .replace(/[\s\S]*<body>/, '')
    .replace(/<\/body>[\s\S]*/, '')
    .replace(/<script[\s\S]*?<\/script>/g, '');

beforeEach(() => {
  instances.length = 0;
  document.body.innerHTML = '';
  globalThis.Chart = MockChart;
});
afterEach(() => {
  delete globalThis.Chart;
});

const el = (tag = 'div') => document.body.appendChild(document.createElement(tag));
const type = (input, value) => {
  input.value = value;
  input.dispatchEvent(new Event('input', { bubbles: true }));
};
const defaultOutcome = () => deriveOutcome(DEFAULTS);

describe('outcome and form', () => {
  it('I-01 deriveOutcome with defaults', () => {
    const o = defaultOutcome();
    expect(o.status).toBe('ok');
    expect(o.result.payment).toBe(57290);
    expect('errors' in o).toBe(false);
  });

  it('I-02 deriveOutcome with an invalid price', () => {
    const o = deriveOutcome({ ...DEFAULTS, price: 'abc' });
    expect(o.status).toBe('invalid');
    expect(o.errors.price).toBeTruthy();
    expect('result' in o).toBe(false);
  });

  it('I-03 mountForm shows defaults', () => {
    const root = el('form');
    mountForm(root, DEFAULTS, () => {});
    const vals = ['price', 'down', 'rate', 'years'].map((k) => root.querySelector(`#${k}`).value);
    expect(vals).toEqual(['150000', '20', '4', '30']);
  });

  it('I-04 one input event gives one onChange with the full raw object', () => {
    const root = el('form');
    const onChange = vi.fn();
    mountForm(root, DEFAULTS, onChange);
    type(root.querySelector('#rate'), '5');
    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ price: '150000', down: '20', rate: '5', years: '30' });
  });

  it('I-05 setErrors shows then removes the message in the right field', () => {
    const root = el('form');
    const form = mountForm(root, DEFAULTS, () => {});
    form.setErrors({ price: 'x' });
    expect(root.querySelector('[data-field="price"]').textContent).toContain('x');
    for (const k of ['down', 'rate', 'years']) {
      expect(root.querySelector(`[data-field="${k}"] .error`).textContent).toBe('');
    }
    form.setErrors({});
    expect(root.querySelector('[data-field="price"] .error').textContent).toBe('');
  });

  it('I-06 rendering keeps the same input, focus and caret', () => {
    const root = el('form');
    const form = mountForm(root, DEFAULTS, () => {});
    const input = root.querySelector('#rate');
    input.focus();
    input.value = '4,25';
    input.setSelectionRange(2, 2);
    form.setErrors({ rate: 'bad' });
    form.setWarnings({ down: 'w' });
    form.setErrors({});
    expect(root.querySelector('#rate')).toBe(input);
    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(2);
  });
});

describe('summary, schedule, warnings', () => {
  it('I-07 low down payment warns but still calculates', () => {
    document.body.innerHTML = body();
    const form = mountForm(document.getElementById('form'), DEFAULTS, () => {});
    const summary = mountSummary(document.getElementById('summary'));
    const apply = (down) => {
      const o = deriveOutcome({ ...DEFAULTS, down });
      form.setWarnings(o.warnings);
      summary.render(o.result);
    };
    const warning = () => document.querySelector('[data-field="down"] .warning');
    apply('5');
    expect(warning().hidden).toBe(false);
    expect(document.querySelector('[data-summary="payment"]').textContent).not.toBe('—');
    apply('10');
    expect(warning().hidden).toBe(true);
  });

  it('I-08 summary renders defaults and the empty state', () => {
    const root = el('dl');
    const summary = mountSummary(root);
    summary.render(defaultOutcome().result);
    for (const t of ['572,90', '206 242,91', '86 242,91', '120 000,00']) {
      expect(root.textContent).toContain(t.replace(/ /g, N) + N + '€');
    }
    summary.render(null);
    expect(root.dataset.state).toBe('empty');
    expect(root.textContent).not.toContain('€');
  });

  it('I-09 schedule rows, header and empty state', () => {
    const root = el();
    const sched = mountSchedule(root);
    sched.render(defaultOutcome().result.schedule);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(360);
    expect(root.querySelectorAll('thead tr')).toHaveLength(1);
    expect(root.querySelectorAll('tbody tr:first-child td')).toHaveLength(5);
    const long = deriveOutcome({ ...DEFAULTS, years: '40' }).result.schedule;
    sched.render(long);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(480);
    sched.render(null);
    expect(root.querySelectorAll('tbody tr')).toHaveLength(0);
    expect(root.dataset.state).toBe('empty');
  });
});

describe('charts', () => {
  const mount = () => {
    const [a, b, msg] = [el('canvas'), el('canvas'), el('p')];
    return { charts: mountCharts({ balanceCanvas: a, flowCanvas: b, messageEl: msg }), msg };
  };

  it('I-10 chart data for the default schedule', () => {
    const { charts } = mount();
    charts.update(defaultOutcome().result.schedule);
    const [balance, flow] = instances;
    expect(balance.type).toBe('line');
    const bd = balance.data.datasets[0].data;
    expect(bd).toHaveLength(360);
    expect(bd[0]).toBe(119827.1);
    expect(bd[359]).toBe(0);
    expect(flow.type).toBe('bar');
    expect(flow.data.datasets).toHaveLength(2);
    for (const d of flow.data.datasets) expect(d.data).toHaveLength(360);
    expect(flow.options.scales.x.stacked).toBe(true);
    expect(flow.options.scales.y.stacked).toBe(true);
    expect(balance.data.labels[0]).toBe(1);
    expect(balance.data.labels[359]).toBe(360);
    expect(flow.data.labels).toHaveLength(360);
    charts.update(null);
    expect(balance.data.datasets[0].data).toEqual([]);
    for (const d of flow.data.datasets) expect(d.data).toEqual([]);
  });

  it('I-11 charts are created once and reused', () => {
    const spy = vi.fn();
    globalThis.Chart = class extends MockChart {
      constructor(...a) {
        super(...a);
        spy();
      }
    };
    const { charts } = mount();
    const s = defaultOutcome().result.schedule;
    charts.update(s);
    charts.update(null);
    charts.update(s);
    expect(spy).toHaveBeenCalledTimes(2);
  });

  it('I-12 missing Chart.js shows a message and the rest still renders', () => {
    delete globalThis.Chart;
    const { charts, msg } = mount();
    expect(() => charts.update(defaultOutcome().result.schedule)).not.toThrow();
    expect(msg.hidden).toBe(false);
    expect(msg.textContent).toContain('Chart.js');
    const root = el('dl');
    mountSummary(root).render(defaultOutcome().result);
    expect(root.textContent).toContain('572,90');
  });
});

describe('main wiring', () => {
  it('I-13 invalid input empties summary, schedule and charts; valid restores', async () => {
    document.body.innerHTML = body();
    vi.resetModules();
    await import('../../src/main.js');
    const payment = () => document.querySelector('[data-summary="payment"]').textContent;
    const rows = () => document.querySelectorAll('#schedule tbody tr').length;
    expect(payment()).toBe(`572,90${N}€`);
    expect(rows()).toBe(360);

    type(document.getElementById('price'), '5000');
    expect(payment()).toBe('—');
    expect(rows()).toBe(0);
    expect(document.getElementById('summary').dataset.state).toBe('empty');
    expect(document.getElementById('schedule').dataset.state).toBe('empty');
    expect(instances[0].data.datasets[0].data).toEqual([]);
    expect(instances[1].data.datasets[0].data).toEqual([]);

    type(document.getElementById('price'), '150000');
    expect(payment()).toBe(`572,90${N}€`);
    expect(rows()).toBe(360);

    const bad = deriveOutcome({ ...DEFAULTS, price: '5000' });
    expect('result' in bad).toBe(false);
  });
});

describe('static checks', () => {
  const files = (dir) =>
    readdirSync(dir).flatMap((f) => {
      const p = join(dir, f);
      return statSync(p).isDirectory() ? files(p) : p.endsWith('.js') ? [p] : [];
    });
  const importsOf = (file) =>
    [...readFileSync(file, 'utf8').matchAll(/^\s*import[^'"]*['"]([^'"]+)['"]/gm)].map((m) => m[1]);

  it('I-14 layering of imports', () => {
    const pure = ['calc', 'validation', 'format', 'config', 'outcome'];
    for (const name of pure) {
      for (const imp of importsOf(`src/${name}.js`)) expect(imp, name).not.toMatch(/ui\//);
    }
    for (const file of files('src/ui')) {
      for (const imp of importsOf(file)) {
        expect(imp, file).not.toMatch(/(^|\/)calc\.js$|^\.\/(form|summary|schedule|charts)/);
      }
    }
  });

  it('I-15 no Calculate button, one CDN script, no build script', () => {
    const html = readFileSync('index.html', 'utf8');
    expect(html).not.toMatch(/calculate/i);
    const external = [...html.matchAll(/<script[^>]*\ssrc="(https?:[^"]+)"/g)];
    expect(external).toHaveLength(1);
    expect(external[0][1]).toMatch(/chart\.js/i);
    const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
    expect(pkg.scripts.build).toBeUndefined();
  });
});
