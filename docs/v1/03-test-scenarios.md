# Mortgage Calculator v1: Test Scenarios

Covers the requirements in [01-functional.md](01-functional.md) and the modules in [02-architecture.md](02-architecture.md).

- **Levels:** Unit (pure modules, Vitest, no DOM), Integration (`deriveOutcome` and DOM modules, Vitest + jsdom, Chart.js mocked), E2E (real browser, Playwright as a dev dependency).
- **Types:** Positive (happy path), Negative (invalid input or failure), Boundary (edge values).
- **Reqs:** FR = functional requirement, R = domain rule (section 5 of the functional spec), D = decision in section 5 below, "Decision n" = architecture decision.
- Amounts are shown Slovak-style. Reference values were computed independently (Python, round-half-even). Re-check them against the JS implementation, which rounds half-up (D1).
- Input order for calc tests: price, down payment %, annual rate %, years.

## 1. Unit tests: `calc.js`

| ID | Name | Level | Type | Purpose | Input | Expected output | Reqs |
|---|---|---|---|---|---|---|---|
| C-01 | Default scenario | Unit | Positive | Verify the known mortgage example end to end. | 150000, 20, 4, 30 | loan 120 000,00; payment 572,90; total paid 206 242,86; interest 86 242,86; 360 rows. Row 1: 572,90 / 172,90 / 400,00 / 119 827,10. Last row: payment 571,76, balance 0. | FR1-3, R1-8 |
| C-02 | Zero rate | Unit | Boundary | The `M = L/n` branch; the rounding remainder lands in the last row. | 100000, 0, 0, 10 | payment 833,33; last payment 833,73; interest 0,00 in every row; total paid 100 000,00; total interest 0,00 | R3, R6 |
| C-03 | Max rate, min term | Unit | Boundary | Highest interest share, 12 rows. | 10000, 0, 15, 1 | payment 902,58; last 902,62; total paid 10 831,00; interest 831,00 | FR1-2 |
| C-04 | Max loan, max rate, max term | Unit | Boundary | Largest numbers, 480 rows, no overflow or precision loss. | 2000000, 0, 15, 40 | payment 25 064,48; last 25 151,23; 480 rows; final balance 0; total interest 10 031 037,15 | FR3, FR9 |
| C-05 | Min price, max down payment | Unit | Boundary | Smallest loan. | 10000, 90, 0, 1 | loan 1 000,00; payment 83,33; last 83,37; balance 0 | R1 |
| C-06 | Very small rate, long term | Unit | Boundary | Precision of `1 − (1+r)^−n` when `r` is tiny. | 2000000, 90, 0.01, 40 | payment 417,50; last 418,61; total interest 401,11 | R3 |
| C-07 | Fractional-cent loan | Unit | Boundary | `price × (1 − d)` gives fractional cents and must convert without float drift. | 10001, 33, 4, 7 | loan 6 700,67; payment 91,59; last 91,62; total paid 7 693,59 | R1, R4 |
| C-08 | Invariants over a grid | Unit | Positive | Properties that hold for any valid input (grid of price × down × rate × years, including all bounds). | grid | `sum(payment) = totalPaid`; `totalInterest = totalPaid − loan`; `sum(principal) = loan`; per row `payment = principal + interest`; `balance[k] = balance[k−1] − principal[k]`; final balance exactly 0; balance never negative and strictly decreasing; `rows.length = years×12`; months are 1..n | R5-8 |
| C-09 | Payment unchanged except last row | Unit | Positive | Rounding is applied once. | 150000, 20, 4, 30 | rows 1..n−1 have equal payment; \|last − payment\| is small (a few cents) | R4, R6 |
| C-10 | Integer cents everywhere | Unit | Positive | No floats leak into money values. | any valid | every money field passes `Number.isInteger` | Decision 4 |
| C-11 | Purity | Unit | Positive | `calculate` does not mutate its input and is deterministic. | same input twice | deep-equal results; input object unchanged | Section 4 of architecture |

## 2. Unit tests: `validation.js`

Input is `RawInput` strings.

| ID | Name | Level | Type | Purpose | Input | Expected output | Reqs |
|---|---|---|---|---|---|---|---|
| V-01 | Defaults are valid | Unit | Positive | Default values pass. | "150000", "20", "4", "30" | `ok:true`, numeric values, no warnings | FR8 |
| V-02 | Comma decimal | Unit | Positive | Slovak input. | rate "4,5" | `ok:true`, rate 4.5 | Decision 6 |
| V-03 | Dot decimal | Unit | Positive | Same result as comma. | rate "4.5" | rate 4.5 | Decision 6 |
| V-04 | Lower bounds inclusive | Unit | Boundary | Min values accepted. | "10000", "0", "0", "1" | `ok:true` | §4 |
| V-05 | Upper bounds inclusive | Unit | Boundary | Max values accepted. | "2000000", "90", "15", "40" | `ok:true` | §4 |
| V-06 | Just outside each bound | Unit | Boundary | Rejection one step beyond (table-driven). | price "9999" / "2000001"; down "-1" / "90,01"; rate "-0,01" / "15,01"; years "0" / "41" | `ok:false`, error only on that field, message states the allowed range | FR7 |
| V-07 | Empty and whitespace | Unit | Negative | Required fields. | "" and "   " in each field | error "required" per field | FR7 |
| V-08 | Non-numeric | Unit | Negative | Strict parsing, no coercion by `Number()`. | "abc", "12abc", "1e3", "Infinity", "NaN", "--5", "+4", "-0", "4,5,6", "1,234.5" | error on the field | FR7, D4 |
| V-09 | Whole-number fields | Unit | Negative | Price and years are whole numbers. | price "150000.50", years "2,5" | error "whole number" | §4, D2 |
| V-10 | Rate decimals | Unit | Boundary | Max 2 decimals. | rate "4,12" / "4,123" | ok / error "max 2 decimals" | §4, D3 |
| V-11 | Down payment decimals | Unit | Boundary | Up to 2 decimals allowed, like the rate. | down "12,5" / "12,555" | ok / error "max 2 decimals" | D6 |
| V-12 | Surrounding whitespace, leading zeros | Unit | Positive | Tolerant parsing. | " 4 ", years "007" | 4, 7 | D4 |
| V-13 | Thousand separators | Unit | Positive | The app displays `1 234,56`, and users may paste it. | price "150 000" (space and nbsp) | `ok:true`, 150000 | D4 |
| V-14 | Low down-payment warning | Unit | Boundary | Warning threshold. | down "9,99", "10", "0" | warning, no warning, warning; `ok` stays true | §4 |
| V-15 | Multiple errors at once | Unit | Negative | All fields reported, not just the first. | all four invalid | four keys in `errors` | FR7 |
| V-16 | Invalid input keeps warning | Unit | Negative | Warning and errors can coexist. | price "abc", down "5" | `ok:false`, error on price, warning on downPct | FR7 |

## 3. Unit tests: `format.js`

| ID | Name | Level | Type | Purpose | Input | Expected output | Reqs |
|---|---|---|---|---|---|---|---|
| F-01 | Basic format | Unit | Positive | Slovak style with nbsp. | 57290 cents | `572,90 €` (U+00A0 before €) | §2 |
| F-02 | Thousands | Unit | Positive | Thousands separator is nbsp. | 123456 cents | `1 234,56 €` | §2 |
| F-03 | Zero and tiny | Unit | Boundary | Padding. | 0, 5, 100 cents | `0,00 €`, `0,05 €`, `1,00 €` | §2 |
| F-04 | Largest value | Unit | Boundary | Multi-group number. | 1203103715 cents | `12 031 037,15 €` | §2 |
| F-05 | Percent | Unit | Positive | Comma decimal, nbsp before `%`. | 4, 4.5 | `4 %`, `4,5 %` | §2, D5 |

## 4. Integration tests (Vitest + jsdom)

| ID | Name | Level | Type | Purpose | Input | Expected output | Reqs |
|---|---|---|---|---|---|---|---|
| I-01 | `deriveOutcome` valid | Integration | Positive | `ok` branch invariant. | defaults | `status:'ok'`, has `result`, no `errors` | FR7 |
| I-02 | `deriveOutcome` invalid | Integration | Negative | `invalid` branch invariant. | price "abc" | `status:'invalid'`, has `errors`, no `result` | FR7 |
| I-03 | Form pre-fill | Integration | Positive | Defaults rendered on mount. | `mountForm` | four inputs hold 150000 / 20 / 4 / 30 | FR8 |
| I-04 | Form `onChange` | Integration | Positive | Fires on every input event with raw strings. | type in rate | `onChange` called once per event with the full `RawInput` | FR6 |
| I-05 | Inline error placement and clearing | Integration | Negative | Error next to the field; disappears when fixed. | `setErrors({price:'…'})`, then `{}` | message in the price field's container only; then removed | FR7 |
| I-06 | Focus survives re-render | Integration | Positive | Typing must not rebuild inputs. | type, trigger render | same input element; focus and caret kept | FR6 |
| I-07 | Warning display | Integration | Boundary | Warning shown, results not blocked. | down "5" → "10" | warning visible and results rendered; warning hidden at 10 | §4 |
| I-08 | Summary | Integration | Positive | Four values formatted. | result of C-01 | `572,90 €`, `206 242,86 €`, `86 242,86 €`, `120 000,00 €`; `null` → empty state | FR1-2 |
| I-09 | Schedule table | Integration | Positive | Rows and columns. | 360 and 480 rows | 360 / 480 `<tr>`, 5 columns, header row; `null` → empty; a second render replaces rows | FR3, FR9 |
| I-10 | Charts data | Integration | Positive | Datasets (Chart.js mocked). | schedule from C-01 | balance dataset has n points ending at 0; principal and interest datasets have n points; `null` → cleared | FR4-5 |
| I-11 | Chart instances reused | Integration | Positive | Update, don't recreate. | three `update()` calls | `Chart` constructor called twice in total (once per chart) | Decision 8 |
| I-12 | Chart.js missing | Integration | Negative | CDN failure. | `Chart` undefined | message in the chart section; form, summary and schedule still work | Decision 9 |
| I-13 | Views get `null` on invalid | Integration | Negative | No stale results. | valid → invalid input | summary, schedule and charts show the empty state | FR7 |
| I-14 | Dependency rules | Integration | Positive | Enforce the architecture. | static scan of `src/**` imports | `calc`, `validation`, `format`, `config` import no `ui/*` and use no DOM globals; `ui/*` import neither each other nor `calc` | Architecture §4 |

## 5. End-to-end tests (Playwright)

| ID | Name | Level | Type | Purpose | Input | Expected output | Reqs |
|---|---|---|---|---|---|---|---|
| E-01 | First load | E2E | Positive | Results show immediately, no console errors. | open page | form shows defaults; summary shows 572,90 €; 360 rows; two charts drawn; no Calculate button; no console errors | FR6, FR8 |
| E-02 | Live update | E2E | Positive | Change recalculates without a click. | rate 4 → 5 | payment changes to the 5 % value as you type | FR6 |
| E-03 | Invalid input | E2E | Negative | Error shown, nothing calculated. | price "5000" | inline error; summary, schedule and charts empty | FR7 |
| E-04 | Recovery | E2E | Positive | Fixing input restores results. | price 5000 → 150000 | error gone; results back | FR7 |
| E-05 | Low down-payment warning | E2E | Boundary | Warning but results visible. | down 5 | warning visible; results shown | §4 |
| E-06 | Comma decimal typed | E2E | Positive | Slovak keyboard entry. | rate "4,5" | accepted; same result as "4.5" | Decision 6 |
| E-07 | Full-length schedule | E2E | Boundary | 480 rows, scrollable, sticky header. | years 40 | 480 rows; container scrolls, header stays visible; page height does not grow with rows | FR9 |
| E-08 | Number formatting in UI | E2E | Positive | Slovak style on screen. | defaults | `1 234,56 €`-style values in summary and table | §2 |
| E-09 | CDN blocked | E2E | Negative | Graceful degradation. | block the Chart.js request | chart message shown; everything else works | Decision 9 |
| E-10 | Clear field mid-edit | E2E | Negative | No crash on a transient invalid state. | select all + delete in each field, retype | error then recovery; no console errors | FR6-7 |
| E-11 | Rapid typing | E2E | Positive | Final state is correct. | type "4,25" fast | results match 4.25 %; no stale render | FR6 |

## 6. Edge cases not covered by the functional spec

1. **Rounding mode.** The spec says "rounded to cents" but not half-up vs half-even (D1).
2. **Float drift when computing the loan.** `10001 × 0.67` can be `6700.669999…`; the conversion to cents needs care (C-07).
3. **Down payment decimals.** The spec says "percent" with no decimal limit (D6).
4. **Last installment** can be higher or lower than the regular payment; C-09 only asserts it stays close.
5. **Total interest differs by a few cents from the textbook formula** (`n·M − L`) because of per-row rounding. Tests use the spec's definition (R7).
6. **Strict parsing.** `Number("1e3")`, `Number("")` and `Number(" ")` succeed silently, so a naive parser would accept them (V-07, V-08).
7. **`type="number"` inputs** reject a comma in some browser locales; the inputs probably need `type="text"` with `inputmode="decimal"`.
8. **Re-rendering the form on each keystroke** would lose focus and caret position (I-06).
9. **Transient empty field while typing.** FR7 combined with live updates means the page flashes to an empty state (E-10).
10. **CDN race.** Chart.js may not be loaded yet when the module runs (I-12, E-09).
11. **Per-keystroke cost.** 480 DOM rows and two chart updates on every key (E-11).
12. **`-0`, `+4`, very long strings, pasted text with newlines.**

## 7. Decisions

| # | Question | Decision |
|---|---|---|
| D1 | Rounding mode | Half-up (`Math.round`), documented in `calc.js` |
| D2 | Price `150000.50` and years `2,5` | Rejected: whole numbers only |
| D3 | Rate `4,123` | Rejected with "max 2 decimals" |
| D4 | Spaces and nbsp as thousand separators, surrounding spaces, `+4`, `-0` | Spaces and nbsp accepted, input trimmed; `+` and `-0` rejected |
| D5 | `formatPercent` output | `4,5 %` (comma, nbsp before `%`) |
| D6 | Down payment decimals | Up to 2 decimals, like the rate |
| D7 | Accessibility and 375 px viewport tests | Out of scope for v1; listed as edge cases only |
| D8 | E2E tool | Playwright (dev dependency only) |
