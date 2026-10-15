import { validate } from './validation.js';
import { calculate } from './calc.js';

// raw strings -> everything the UI needs to render.
export function deriveOutcome(raw) {
  const v = validate(raw);
  if (!v.ok) return { status: 'invalid', errors: v.errors, warnings: v.warnings };
  return { status: 'ok', values: v.values, warnings: v.warnings, result: calculate(v.values) };
}
