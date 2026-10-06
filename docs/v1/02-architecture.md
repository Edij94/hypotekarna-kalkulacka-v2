# Mortgage Calculator v1: Architecture

Implements the requirements in [01-functional.md](01-functional.md).

## 1. Stack

- Vanilla HTML, CSS and native ES modules (`<script type="module">`), with no build step and no backend.
- Chart.js loaded from a CDN, used only by the chart view.
- Vitest runs the pure modules from Node. Node and npm are for development and tests only.
- Browsers: current evergreen versions only.

## 2. Module layout

```
index.html, styles.css
src/
  main.js          composition root, owns state and render()
  config.js        bounds, defaults, thresholds
  validation.js    pure: parse + bounds check
  calc.js          pure: annuity math in integer cents
  format.js        pure: Slovak-style formatting
  ui/form.js
  ui/summary.js
  ui/schedule.js
  ui/charts.js
tests/             calc, validation, format (no DOM)
```

## 3. Modules

| Module | Responsibility | Interface | Requirements |
|---|---|---|---|
| **config.js** | Single source of truth for bounds, defaults and the low-down-payment threshold. | `BOUNDS`, `DEFAULTS`, `LOW_DOWN_PAYMENT_PCT = 10` | FR8, section 4 |
| **validation.js** | Parses raw strings (accepts both `,` and `.` as decimal separator), checks type and bounds, and returns a warning for a down payment under 10 %. | `validate(raw) → { ok: true, values, warnings } \| { ok: false, errors, warnings }` | FR7, FR8, section 4 |
| **calc.js** | All math in integer cents: loan amount, monthly rate, payment rounded once, schedule rows, last installment adjusted so the final balance is exactly 0. Handles the 0 % rate case. | `calculate(values) → Result` | FR1, FR2, FR3, data for FR4 and FR5, rules 1-8 |
| **format.js** | Turns cents into `1 234,56 €` (non-breaking spaces) and formats percentages. No DOM access. | `formatEur(cents)`, `formatPercent(x)` | Section 2 formatting |
| **ui/form.js** | Renders inputs, pre-fills defaults, reads raw strings, shows inline errors and the warning. | `mountForm(root, { onChange }) → { setErrors(errors, warnings) }` | FR6, FR7, FR8 |
| **ui/summary.js** | Shows monthly payment, total paid, total interest and loan amount. | `renderSummary(root, result \| null)` | FR1, FR2 |
| **ui/schedule.js** | Draws the full table (up to 480 rows) in a scrollable container with a sticky header. No virtualization. | `renderSchedule(root, rows \| null)` | FR3, FR9 |
| **ui/charts.js** | Draws two Chart.js charts (balance over time; principal vs. interest per month). Updates existing chart instances instead of recreating them. | `mountCharts(canvasA, canvasB) → { update(schedule \| null) }` | FR4, FR5 |
| **main.js** | Wires everything together. Holds `raw` as the only state and runs `render()` on every input event. | entry point | FR6, FR7 |

## 4. Dependency direction

```
main ──► ui/* ──► format ──► (nothing)
 │
 ├──► validation ──► config
 └──► calc ──► (nothing)
```

- `calc`, `validation`, `format` and `config` are pure: they never import UI code and never touch the DOM.
- `ui/*` modules never import each other or `calc`. They only receive data from `main`.
- Only `main` knows every module. Only `ui/charts.js` knows Chart.js.
- Everything in `tests/` runs without a DOM.

## 5. Data model

All money values in `Row` and `Result` are **integer cents**. Only `format.js` converts them to euros.

```js
RawInput  { price: string, downPct: string, annualRatePct: string, years: string }
Input     { price: int €, downPct: number, annualRatePct: number, years: int }
Row       { month, payment, principal, interest, balance }
Result    { loan, payment, totalPaid, totalInterest, schedule: Row[] }

Warnings  { downPct?: string }
Errors    { [field]: string }

// Derived view of the current input: a discriminated union
Outcome   = { status: 'ok',      values: Input, warnings: Warnings, result: Result }
          | { status: 'invalid', errors: Errors, warnings: Warnings }
```

### State

The only stored state is `raw: RawInput`. Everything else is derived:

```js
const outcome = deriveOutcome(raw);   // in main.js

function deriveOutcome(raw) {
  const v = validate(raw);
  return v.ok
    ? { status: 'ok', values: v.values, warnings: v.warnings, result: calculate(v.values) }
    : { status: 'invalid', errors: v.errors, warnings: v.warnings };
}
```

- A result and errors can never coexist, so FR7 ("no results are calculated" on invalid input) holds by construction.
- Nothing can go out of sync, because nothing is stored besides the raw strings.
- Calculation is fast (at most 480 rows), so deriving on every input is cheap.

## 6. Data flow (FR6)

```
input event → raw = form.read()
            → outcome = deriveOutcome(raw)
            → render(outcome):
                form.setErrors(errors, warnings)
                summary   ← result | null
                schedule  ← result.schedule | null
                charts    ← result.schedule | null
```

Every update re-renders all views from `outcome`. There is no pub/sub store. When `status` is `'invalid'`, the views receive `null` and show an empty state.

## 7. Decisions

1. **Native ES modules.** The browser and Vitest import the same files, so no bundler is needed.
2. **Store only `raw`, derive the rest.** This removes any risk of stale or inconsistent state. The cost is that intermediate values are recomputed on each input, which is negligible at this size.
3. **Discriminated union (`Outcome`).** It documents the invariant that errors and results are mutually exclusive. Plain JS does not enforce it, so a test asserts it for both branches.
4. **Integer cents.** The payment is rounded once. Each row has `interest = round(balance × r)` and `principal = payment − interest`. The last row uses `payment = balance + interest`, so the final balance is exactly 0 and any rounding difference lands there (rule 6). Tests use exact equality.
5. **Validation separate from calc.** `calc` trusts valid input. Bounds live only in `config.js`.
6. **Both `,` and `.` accepted** as decimal separator, which resolves the first open question in the functional spec as "yes".
7. **Schedule as a plain table.** All rows are rendered, with no virtualization.
8. **Charts are updated, not recreated.** Chart instances are kept and updated on each change.
9. **Chart.js unavailable (CDN failure).** The charts section shows a short message and the rest of the app keeps working.
10. **Out of scope.** The architecture adds no persistence, export or backend, per section 6 of the functional spec.

## 8. Testing notes

- `calc`: payment against known values, 0 % rate, final balance exactly 0, `sum(rows.payment) = totalPaid`, `totalInterest = totalPaid − loan`, bounds (1 year, 40 years).
- `validation`: both decimal separators, empty and non-numeric input, each bound inclusive and exclusive, the down payment warning below 10 %.
- `format`: `1 234,56 €` with non-breaking spaces, rounding, zero.
- `deriveOutcome`: `ok` carries a result and no errors; `invalid` carries errors and no result.
