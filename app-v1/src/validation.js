import { BOUNDS, LOW_DOWN_PAYMENT_H } from './config.js';

const FIELDS = {
  price: { label: 'Property price', unit: '€', integer: true },
  down: { label: 'Down payment', unit: '%', integer: false },
  rate: { label: 'Interest rate', unit: '%', integer: false },
  years: { label: 'Loan term', unit: 'years', integer: true },
};

const GROUP_SEPARATORS = /[ \u00a0\u202f]/g;
// Digits with an optional separator and any number of decimals; the 2-decimal
// limit is checked afterwards so it gets its own message.
const NUMBER = /^([0-9]+)(?:[.,]([0-9]*))?$/;
const MAX_DIGITS = 12; // anything longer is out of range anyway; avoids Infinity

const hundredthsToText = (h) => (h % 100 === 0 ? String(h / 100) : (h / 100).toFixed(2));

function rangeMessage(key) {
  const { label, unit, integer } = FIELDS[key];
  const { min, max } = BOUNDS[key];
  const fmt = integer ? String : hundredthsToText;
  return `${label} must be between ${fmt(min)} and ${fmt(max)} ${unit}`;
}

// Returns { value } (integer in the field's stored unit) or { error }.
function parseField(key, text) {
  const { label, integer } = FIELDS[key];
  const s = String(text ?? '').replace(GROUP_SEPARATORS, '').trim();
  if (s === '') return { error: `${label} is required` };
  const m = NUMBER.exec(s);
  if (!m) return { error: `${label} must be a number, for example 4 or 4,5` };
  const [, intDigits, frac] = m;
  if (integer) {
    if (frac !== undefined) return { error: `${label} must be a whole number` };
  } else if (frac !== undefined && frac.length > 2) {
    return { error: `${label}: max 2 decimals` };
  }
  const trimmed = intDigits.replace(/^0+(?=\d)/, '');
  if (trimmed.length > MAX_DIGITS) return { error: rangeMessage(key) };
  const value = integer
    ? Number(trimmed)
    : Number(trimmed) * 100 + Number((frac ?? '').padEnd(2, '0') || 0);
  const { min, max } = BOUNDS[key];
  if (value < min || value > max) return { error: rangeMessage(key) };
  return { value };
}

// raw: { price, down, rate, years } strings.
export function validate(raw) {
  const values = {};
  const errors = {};
  const warnings = {};
  for (const key of Object.keys(FIELDS)) {
    const res = parseField(key, raw[key]);
    if (res.error) errors[key] = res.error;
    else values[key] = res.value;
  }
  if (values.down !== undefined && values.down < LOW_DOWN_PAYMENT_H) {
    warnings.down = 'Down payment is below 10 %. Some lenders may not approve such a loan.';
  }
  if (Object.keys(errors).length > 0) return { ok: false, errors, warnings };
  return {
    ok: true,
    values: { price: values.price, downH: values.down, rateH: values.rate, years: values.years },
    warnings,
  };
}
