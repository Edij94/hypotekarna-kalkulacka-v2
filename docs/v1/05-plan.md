# Mortgage Calculator v1: Plan

## 1. Objectives of V1

- A static web page that calculates an annuity mortgage and shows payment, totals, a full amortization schedule and two charts.
- Correct math first: all money in integer cents, one fixed rounding rule, results verified against an independent exact-arithmetic reference.
- Clean, testable code: pure calculation modules with no DOM, tested without a browser.
- Live results while typing, with clear inline errors.
- A learning and personal project: no backend, no build step, no accounts.

## 2. Scope

### 2.1 In scope

| ID | Requirement |
|---|---|
| FR1 | Monthly payment (annuity). |
| FR2 | Loan amount, total paid and total interest. |
| FR3 | Amortization schedule, one row per month: month, payment, principal, interest, remaining balance. |
| FR4 | Chart of remaining balance over time: line, x = month 1..n, n points, ending at 0. |
| FR5 | Chart of principal vs. interest per month: stacked bars, x = month 1..n. |
| FR6 | Results update live on every `input` event, with no Calculate button and no debounce. |
| FR7 | Invalid input shows an inline error next to the field and clears all results (summary, table, charts). |
| FR8 | Form is pre-filled with defaults, so results show on load. |
| FR9 | Full schedule (up to 480 rows) in a scrollable container with a sticky header. |

**Inputs**

| Input | Min | Max | Format | Default |
|---|---|---|---|---|
| Property price | 10 000 € | 2 000 000 € | whole euros | 150 000 |
| Down payment | 0 % | 90 % | up to 2 decimals | 20 |
| Annual interest rate (nominal) | 0 % | 15 % | up to 2 decimals | 4 |
| Loan term | 1 year | 40 years | whole years | 30 |

A down payment strictly below 10 % is allowed and shows a warning. The warning also shows when other fields are invalid.

**Calculation rules** (money in integer cents, rounding half-up everywhere)

1. `loan = round(price × (1 − down%))`, computed in integers: `floor((2·price·(10000 − downH) + 100) / 200)` cents, where `downH` is the down payment in hundredths of a percent.
2. `r = annualRate / 12`, `n = years × 12`.
3. `M = loan · r / (1 − (1+r)^−n)`; if the rate is 0, `M = loan / n`. The payment is `round(M)`, rounded once. This is the only float step (`Math.pow`).
4. Per row: `interest = round(balance × r)`, computed in integers as `floor((2·balance·rateH + 120000) / 240000)` where `rateH` is the rate in hundredths of a percent. `principal = payment − interest`; `balance −= principal`.
5. For months before `n`: `payment = min(M, balance + interest)`. For month `n`: `payment = balance + interest`, so the final balance is exactly 0. If the balance runs out early, the remaining rows are all zeros. The schedule always has `years × 12` rows, the balance is never negative, never increases, and every payment is ≥ 0. The last installment can differ from the regular one by a lot (up to about 146 € in the bounds), not just cents.
6. `totalPaid = sum of payments`; `totalInterest = totalPaid − loan`.
7. Month numbers are 1..n, with no calendar dates.

**Input parsing**

- Decimal separator is `,` or `.`. Spaces, U+00A0 and U+202F are thousand separators and are stripped; the input is trimmed. Digits are ASCII `0-9` only.
- After that the grammar is `^[0-9]+([.,][0-9]{0,2})?$`. A trailing separator (`4,`) is accepted and means 4, so typing through it shows no error.
- Rejected: `,5`, `.5`, `+4`, `-0`, negatives, `1e3`, `Infinity`, `NaN`, `4,5,6`, units (`€`, `%`), full-width and other Unicode digits, `0x10`, `1_000`.
- Price and years reject any decimal part (`150000.50`, `150.000`, `150,000`, `2,5`).
- A format error wins over a range error. All invalid fields are reported at once. Empty or blank input is "required".
- Parsed values are integers: `price`, `downH`, `rateH`, `years`.

**Display:** English UI, Slovak number format with non-breaking spaces (`1 234,56 €`). Current evergreen browsers only. Inputs are `type="text"` with `inputmode="decimal"`.

**Architecture**

```
index.html, styles.css
src/
  config.js      bounds, defaults, low-down-payment threshold
  validation.js  pure: parse + bounds -> { ok, values, warnings } | { ok:false, errors, warnings }
  calc.js        pure: integer-cents annuity math -> { loan, payment, totalPaid, totalInterest, schedule }
  format.js      pure: formatEur(cents)
  outcome.js     pure: deriveOutcome(raw) -> { status:'ok', values, warnings, result } | { status:'invalid', errors, warnings }
  main.js        composition root; only state is `raw` strings; render(outcome) on every input
  ui/form.js, ui/summary.js, ui/schedule.js, ui/charts.js
```

- `calc`, `validation`, `format`, `config`, `outcome` import no UI code and touch no DOM. `ui/*` modules import neither each other nor `calc`; they only receive data from `main`. Only `ui/charts.js` knows Chart.js.
- Form inputs are created once and never rebuilt (focus and caret survive re-render). Chart instances are created once and updated. If Chart.js is not loaded, the chart section shows a message and the rest works.
- The schedule is a plain table (no virtualization).

### 2.2 Out of scope

Extra payments, fees and insurance, effective APR, rate changes, differential payments, saving or export, multiple currencies or languages, backend, persistence, bank rules (LTV, DSTI), scenario comparison, accessibility testing, narrow-viewport layout, IME and autofill behavior.

## 3. Acceptance criteria

Only concrete tests count. Amounts are shown in euros; test code uses cents. "Case (a, b, c, d)" means price, down %, rate %, years.

### 3.1 Reference values

| Case | Loan | Payment | Last payment | Total paid | Total interest | Rows |
|---|---|---|---|---|---|---|
| Default (150000, 20, 4, 30) | 120 000,00 | 572,90 | 571,81 | 206 242,91 | 86 242,91 | 360 |
| (150000, 20, 5, 30) | 120 000,00 | 644,19 | 640,76 | 231 904,97 | 111 904,97 | 360 |
| (150000, 20, 4.25, 30) | 120 000,00 | 590,33 | 588,71 | 212 517,18 | 92 517,18 | 360 |
| Max (2000000, 0, 15, 40) | 2 000 000,00 | 25 064,48 | 25 152,05 | 12 031 037,97 | 10 031 037,97 | 480 |
| Big jump (10001, 0, 15, 40) | 10 001,00 | 125,33 | 271,08 | 60 304,15 | 50 303,15 | 480 |
| Fractional-cent loan (10001, 12.55, 4, 7) | 8 745,87 | 119,55 | 119,14 | 10 041,79 | 1 295,92 | 84 |
| Rounded-up loan (10001, 33, 4, 7) | 6 700,67 | 91,59 | 91,62 | 7 693,59 | 992,92 | 84 |
| Overpay (10000, 90, 4.5, 40) | 1 000,00 | 4,50 | 0,00 | 2 154,18 | 1 154,18 | 480 |

Default row 180 = payment 572,90 / principal 313,68 / interest 259,22 / balance 77 450,95. Default row 1 = 572,90 / 172,90 / 400,00 / 119 827,10. Overpay row 479 = payment 3,18; row 480 = all zeros.

These values come from an independent Python script using exact fractions and the same rules (section 2.1).

### 3.2 Unit tests (Vitest, `node` environment, so a DOM global fails them)

**`format.js`**

| ID | Input | Expected |
|---|---|---|
| F-01 | `formatEur(57290)` | `572,90 €` |
| F-02 | `formatEur(123456)` | `1 234,56 €` |
| F-03 | `formatEur(0)`, `(5)`, `(100)` | `0,00 €`, `0,05 €`, `1,00 €` |
| F-04 | `formatEur(1203103797)` | `12 031 037,97 €` |

(All spaces before `€` and between thousands are U+00A0.)

**`validation.js`** (raw strings: price, down, rate, years)

| ID | Input | Expected |
|---|---|---|
| V-01 | `"150000","20","4","30"` | `ok`, values 150000 / 2000 / 400 / 30, no warnings |
| V-02, V-03 | rate `"4,5"` and `"4.5"` | `rateH` 450 both |
| V-04 | `"10000","0","0","1"` | `ok` |
| V-05 | `"2000000","90","15","40"` | `ok` |
| V-06 | `9999` / `2000001` price; `-1` / `90,01` down; `-0,01` / `15,01` rate; `0` / `41` years | `ok:false`, exactly one error key (the tested field); for in-grammar values the message contains the allowed min and max |
| V-07 | `""` and `"   "` in each field | error containing "required" |
| V-08 | `abc`, `12abc`, `1e3`, `Infinity`, `NaN`, `--5`, `+4`, `-0`, `4,5,6`, `1,234.5` | error on the field |
| V-09 | price `150000.50`, years `2,5` | error containing "whole number" |
| V-10 | rate `4,12` / `4,123` | ok / error containing "max 2 decimals" |
| V-11 | down `12,5` / `12,555` | ok (1250) / "max 2 decimals" |
| V-12 | `" 4 "`, years `"007"` | 400, 7 |
| V-13 | price `150 000` with U+0020, U+00A0, U+202F | 150000 each |
| V-14 | down `9,99` / `10` / `0` | warning / no warning / warning; `ok:true` in all |
| V-15 | all four fields `x` | four keys in `errors` |
| V-16 | price `abc`, down `5` | `ok:false`, error on price, warning on down payment |
| V-17 | rate `4,` and `4.` | 400 |
| V-18 | rate `,5` and `.5` | error |
| V-19 | price `150.000` and `150,000` | error containing "whole number" |
| V-20 | `４` (full-width), `150000 €`, `4 %`, `−5` (U+2212), `0x10`, `1_000` error; `0000000000150000` | 150000 for the last, error for the rest |
| V-21 | price `9007199254740993` and a 400-digit string | range error, no exception, no `Infinity` in output |
| V-22 | rate `-1,234` | the format error, not the range error |

**`calc.js`** (all values in cents)

| ID | Case | Expected |
|---|---|---|
| C-01 | Default | loan 12000000; payment 57290; totalPaid 20624291; totalInterest 8624291; 360 rows; row 1 `57290/17290/40000/11982710`; last payment 57181; last balance 0 |
| C-02 | (100000, 0, 0, 10) | payment 83333; last 83373; every interest 0; totalPaid 10000000; totalInterest 0 |
| C-03 | (10000, 0, 15, 1) | payment 90258; last 90262; totalPaid 1083100; totalInterest 83100 |
| C-04 | Max | payment 2506448; last 2515205; totalPaid 1203103797; totalInterest 1003103797; 480 rows; final balance 0 |
| C-05 | (10000, 90, 0, 1) | loan 100000; payment 8333; last 8337 |
| C-06 | (2000000, 90, 0.01, 40) | payment 41750; last 41861; totalInterest 40111 |
| C-07 | Rounded-up loan | loan 670067; payment 9159; last 9162; totalPaid 769359; totalInterest 99292 |
| C-08 | Grid: price {10000, 10001, 150000, 2000000} × down {0, 9.99, 10, 12.55, 20, 90} × rate {0, 0.01, 4, 4.5, 15} × years {1, 2, 30, 40} | `sum(payment) = totalPaid`; `totalInterest = totalPaid − loan`; `sum(principal) = loan`; per row `payment = principal + interest`; `balance[k] = balance[k−1] − principal[k]`; final balance 0; balance never negative and never increasing; every payment ≥ 0; `rows.length = years×12`; months are 1..n |
| C-09 | Default | rows 1..359 all have payment 57290; row 360 has 57181 |
| C-10 | Default and Max | every money field passes `Number.isInteger` |
| C-11 | Default, input frozen with `Object.freeze` | no throw; two calls give deep-equal results |
| C-12 | Overpay | 480 rows; row 479 payment 318; row 480 payment, principal, interest, balance all 0; no negative value anywhere; totalPaid 215418; totalInterest 115418 |
| C-13 | Big jump | payment 12533; last 27108; totalPaid 6030415 |
| C-14 | Fractional-cent loan | loan 874587 (exact 874587.45); payment 11955; last 11914; totalPaid 1004179 |
| C-15 | Default row 180 | `57290/31368/25922/7745095` |
| C-16 | `interestCents(100, 600)`, `(99, 600)`, `(101, 600)` | 1 (exact tie 0.5 rounds up), 0, 1 |
| C-17 | Golden: full schedules of Default, Max, Big jump, Overpay | equal the independent reference row by row |
| C-18 | (10000, 90, 0.01, 1) | 12 rows; every interest ≥ 0; `sum(principal) = 100000`; final balance 0 |
| C-19 | price 150000, down 20, years 30, rates `0,01`, `14,99`, `15`, `15,00` through `validate` then `calculate` | no exception; final balance 0 each |

### 3.3 Integration tests (Vitest + jsdom, Chart.js mocked)

| ID | Test | Expected |
|---|---|---|
| I-01 | `deriveOutcome` with defaults | `status:'ok'`, `result.payment` 57290, no `errors` key |
| I-02 | `deriveOutcome` with price `abc` | `status:'invalid'`, `errors.price` present, no `result` key |
| I-03 | `mountForm` | inputs hold `150000 / 20 / 4 / 30` |
| I-04 | one `input` event on the rate field | `onChange` called once with the full raw object |
| I-05 | `setErrors({price:'x'})`, then `setErrors({})` | message inside the price field container only; then removed |
| I-06 | type into a field, then render | same input element; focus and `selectionStart` unchanged |
| I-07 | down `5`, then `10` | warning visible and summary rendered; warning gone at 10 |
| I-08 | summary of Default | text contains `572,90 €`, `206 242,91 €`, `86 242,91 €`, `120 000,00 €`; `null` gives the empty state |
| I-09 | schedule with 360 and 480 rows | 360 / 480 body rows, 5 cells per row, one header row; `null` gives the empty state; a second render replaces rows |
| I-10 | charts with Default | balance: type `line`, 360 points, first `119827.10`, last 0; principal and interest: type `bar`, 360 points each, stacked on both axes; labels 1..360; `update(null)` empties the datasets |
| I-11 | three `update()` calls | `Chart` constructor called exactly twice |
| I-12 | `Chart` undefined | message in the chart section; form, summary and schedule still render |
| I-13 | valid then invalid input through `main`; also two outcomes from `deriveOutcome` | summary, schedule, charts show the empty state; the second outcome has no `result` |
| I-14 | scan of `import` lines in `src/**` | `calc`, `validation`, `format`, `config`, `outcome` import nothing from `ui/`; `ui/*` import neither each other nor `calc` |
| I-15 | read `index.html` and `package.json` | no Calculate button; exactly one external script, Chart.js from a CDN; no `build` script |

### 3.4 End-to-end tests (Playwright, Chromium)

| ID | Test | Expected |
|---|---|---|
| E-01 | open page | inputs show defaults; summary `572,90 €`; 360 rows; both canvases have a Chart.js instance with 360 points; no Calculate button; zero console errors |
| E-02 | rate 4 → 5 | payment `644,19 €`; total paid `231 904,97 €` |
| E-03 | price `5000` | error next to the price field; summary, table and charts empty |
| E-04 | price `5000` → `150000` | error gone; payment `572,90 €`; 360 rows |
| E-05 | down `5` | warning visible; payment shown |
| E-06 | rate typed `4,5` and `4.5` | identical summary text |
| E-07 | years `40` | 480 rows; table container `scrollHeight > clientHeight`; header position unchanged after scrolling the container 1000 px; page height equal for 30 and 40 years |
| E-08 | defaults | every money cell in the summary and the first 5 table rows matches `/^\d{1,3}( \d{3})*,\d{2} €$/` |
| E-09 | Chart.js request aborted | chart message visible; payment `572,90 €`; 360 rows |
| E-10 | in each field: select all, delete, retype default | error containing "required", then results return; zero console errors |
| E-11 | type `4,25` with no delay between keys | payment `590,33 €`; total paid `212 517,18 €` |
| E-12 | set rate 7, reload | visible field values and displayed payment belong together (payment equals `calculate` of the visible values) |

## 4. Building order

Each step ends only when its tests are green. Pure modules come first, UI after.

| # | Step | Work | Tests that close it |
|---|---|---|---|
| 0 | Tooling | `package.json`, Vitest config (`node` default, `jsdom` for integration), Playwright config, static dev server, Python reference script that writes the golden schedules | `npm test` runs and exits 0 with one smoke test that loads the golden file and finds 8 cases |
| 1 | `config.js`, `format.js` | bounds in hundredths, defaults as strings, `formatEur` with nbsp | F-01..F-04 |
| 2 | `validation.js` | parsing grammar, bounds, warning | V-01..V-22 |
| 3 | `calc.js` | rules 1-7, export `interestCents` | C-01..C-19 |
| 4 | `outcome.js` | `deriveOutcome` | I-01, I-02, I-14 |
| 5 | Form, summary, schedule, `main.js`, `index.html`, `styles.css` | inputs built once, `render(outcome)` on each input, empty states | I-03..I-09, I-13, I-15 |
| 6 | `ui/charts.js` | two charts, instances reused, missing-Chart.js message | I-10..I-12 |
| 7 | End-to-end | one spec per scenario | E-01..E-12 |

## 5. Definition of done

- `npm test` (unit + integration) and `npm run test:e2e` both exit 0, with zero skipped tests.
- Every test ID in section 3 exists in the code, in the test title.
- Rerunning the reference script gives output identical to the committed golden file.
- All FR1-FR9 map to at least one passing test: FR1-FR2 (C-01..C-07, I-08), FR3 (C-08, I-09), FR4-FR5 (I-10, E-01), FR6 (I-04, I-06, E-02, E-10, E-11), FR7 (V-06..V-22, I-02, I-05, I-13, E-03, E-04), FR8 (V-01, I-03, E-01), FR9 (I-09, E-07).
- The app runs by opening the static files through any static server, with no build.

## 6. Building tools

| Tool | Use |
|---|---|
| Vanilla HTML, CSS, native ES modules | The app. No bundler, no framework. |
| Chart.js (CDN `<script>`) | The two charts. Only `ui/charts.js` uses it. |
| Node and npm | Development and tests only. |
| Vitest | Unit tests (`node` environment) and integration tests (`jsdom` environment). |
| jsdom | DOM for the integration tests. |
| Playwright (Chromium) | End-to-end tests. |
| Python 3 (`fractions`) | Independent exact-arithmetic reference that produces the golden schedules. |
| Git | Version control; commits happen only when requested. |
