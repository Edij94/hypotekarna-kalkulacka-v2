# Mortgage Calculator v1: Independent Review

Reviewed documents (only these): `01-functional.md`, `02-architecture.md`, `03-test-scenarios.md`.
Severity: **blocker** = the plan cannot be implemented and verified as written; **major** = likely wrong result or a requirement without real verification; **minor** = clarity, gold-plating or low-risk gaps.

All numbers in section 5 were recomputed with exact rational arithmetic (Python `Fraction`, no floats) in a separate script (appendix). A second script mimics a naive JS float implementation to show what the "real" code would produce.

## Summary

- **4 blockers** (#1-#4): reference values in C-01 and C-04 contradict the plan's own rounding rules; "the last installment is a few cents off" is false; balance and last payment can go negative for valid inputs.
- 7 majors (#5-#11), 9 minors (#12-#20).
- Reference values that are wrong under the plan's own rules: C-01 (last payment, total paid, total interest), C-04 (last payment, total interest), plus F-04 and I-08, which reuse them. C-02, C-03, C-05, C-06, C-07 are correct.

## 1. Findings table

| # | Severity | Finding | Affects |
|---|---|---|---|
| 1 | **blocker** | **Reference values for C-01 contradict Decision 4 / D1.** The doc says last payment 571,76 and total paid 206 242,86. Those numbers are produced only by an algorithm that keeps interest *unrounded* and rounds just the payment. Architecture Decision 4 (`interest = round(balance × r)` per row, half-up) gives **571,81** and **206 242,91** (interest 86 242,91). Per-row half-even gives 571,74. No rounding variant of Decision 4 gives 571,76. A correct implementation would fail its own test. | C-01, I-08 (uses C-01 values), E-01, E-08, R5-R7, Decision 4, D1 |
| 2 | **blocker** | **Reference values for C-04 and F-04 were computed with half-even, not half-up (D1).** Doc: last 25 151,23; total interest 10 031 037,15; F-04 input 1203103715 cents. Exact half-up per Decision 4: last **25 152,05**, total paid **12 031 037,97**, interest **10 031 037,97**, F-04 input would be 1203103797. The header of the test doc even says "round-half-even" and tells the implementer to re-check, which means the tests are known to disagree with D1 and no one decided which wins. | C-04, F-04, D1, FR2 |
| 3 | **blocker** | **"Last installment is within a few cents" (C-09) is false.** The payment is rounded once, and the rounding error is amplified by the compounding factor `((1+r)^n − 1)/r`. Examples (exact, half-up): 2 000 000 €, 0 %, 15 %, 40 y: regular 25 064,48, last 25 152,05 (+87,57 €). 10 001 €, 0 %, 15 %, 40 y: regular **125,33**, last **271,08** (+145,75 €, last is 2.2x a normal installment). R6 and the edge case list both assume a small adjustment. | R4, R6, C-09, FR3 (user sees a jump in the last row), edge case 4 |
| 4 | **blocker** | **Balance can go negative and the last payment can be negative for valid inputs.** The payment rounded up overshoots, so an earlier row already repays more than the balance. In a 480-case grid, 4 cases break: (10 000 €, 90 %, 4,5 %, 40 y) last row payment **−1,32 €**, principal −1,32 €; (10 001, 12,55 %, 15 %, 40 y) last payment **−32,30 €**; (10 001, 90 %, 4,5 %, 40 y) −0,80 €; (10 001, 90 %, 15 %, 30 y) −17,51 €. These violate C-08 ("balance never negative and strictly decreasing") and R6 ("final balance exactly 0.00" is met only by showing a negative payment). Neither the spec nor the architecture defines what happens when the balance is exhausted before month n. | R5, R6, C-08, FR3, FR4 (balance chart dips below 0), Decision 4 |
| 5 | **major** | **Rounding mode is not in the spec.** R4 says "rounded to cents" only. D1 (half-up) exists only in the test doc, not in `01-functional.md` or `02-architecture.md`. Two implementers pick half-up vs half-even vs ceil and get different schedules (104 of 480 grid cases differ between half-up and half-even). | R4, R5, C-01..C-04, D1 |
| 6 | **major** | **Float implementation does not match exact half-up either.** Naive JS (`Math.round(balance * r)` in doubles) matches exact half-up in most cases but differs in 47 of 480 grid cases. In C-04 there are 9 exact .5-cent ties, and the float result differs from exact at 103 rows: last payment 25 151,99 (float) vs 25 152,05 (exact), total interest 10 031 037,91 vs 10 031 037,97. "Half-up" is therefore not a complete definition; the plan must say *how* interest is computed (e.g. integer arithmetic on cents × basis points, or `Math.round` on doubles), and the payment `M` via `pow` is also float-dependent. No test targets a tie. | Decision 4, D1, C-04, C-08 (will not catch it: invariants still hold) |
| 7 | **major** | **Loan amount rounding is unspecified, and C-07 does not test it.** R1 gives `L = price × (1 − d)`. With a 2-decimal down payment the result can have fractional cents, e.g. 10 001 € with 12,55 % → 8 745,8745 € (874 587,45 cents; 40 of 480 grid cases). Floor, half-up and "keep fractional" give different loans and totals (R7: total interest = total paid − L, so an unrounded L gives fractional interest). C-07 is labelled "fractional-cent loan" but 10 001 × 67 % = **6 700,67 € exactly**; the test only exercises float drift (`10001*(1-0.33)*100 = 670066.9999999999`, floor gives 6 700,66), not fractional cents. In a sample of 514 400 price/down combinations, float floor disagrees with exact in 1.1 %. | R1, R7, C-07, edge case 2, Input.downPct as `number` |
| 8 | **major** | **Per-row interest rounding is not stated in the spec (R5).** R5 says `interest = balance × r`. Rounded per row (architecture) and unrounded (the values actually used in C-01) differ by 5 cents in the last row for the default scenario and by about 2,78 € in the last row of C-04 (25 149,27 vs 25 152,05). The functional spec alone permits both. | R5, R6, R7, Decision 4, C-01 |
| 9 | **major** | **Invalid-input behaviour: "no results are calculated" allows stale results.** FR7 can be met by leaving the previous results on screen (no new calculation) or by clearing them. Architecture picks "empty state" (I-13, E-03) but the spec does not require it. Also: whether the warning shows when other fields are invalid (V-16 says yes; the spec is silent). | FR7, I-13, E-03, E-10 |
| 10 | **major** | **Charts are not really verified.** FR4/FR5 are tested only on mocked datasets (I-10) and E-01's "two charts drawn" has no stated oracle (canvas non-blank? instance exists?). Nothing checks chart type, axis units, labels, or that the dataset reaches the real `Chart`. The spec itself is ambiguous (see #13). | FR4, FR5, I-10, E-01, ui/charts.js |
| 11 | **major** | **Thousand/decimal separator conflict.** D4 accepts spaces as thousand separators and V-02/V-03 accept `,` and `.` as decimals, but `"150.000"` (a Slovak thousand dot) and `"1.234"` are not covered: reject as "not whole" (D2) or read as 150 000? V-08 rejects `"1,234.5"` but nothing says what `"1 234,5"` does in the rate field, `"4 ,5"`, or `"4,"`. The spec open question #1 is still marked open while Decision 6 closes it. | §7 Q1, Decision 6, D2, D4, V-02..V-13 |
| 12 | **minor** | **Spec/architecture inconsistency.** `01-functional.md` §7 lists the decimal separator question as open; `02-architecture.md` Decision 6 resolves it; the spec was not updated. | §7, Decision 6 |
| 13 | **minor** | **FR4/FR5 are under-specified.** Does the balance chart start at month 0 (point L, n+1 points) or month 1 (n points, as I-10 asserts)? X axis in months or years? Principal vs. interest: stacked bars, stacked area or two lines? Two implementations both satisfy the text. | FR4, FR5, I-10 |
| 14 | **minor** | **Live update semantics (FR6).** `input` event on every key vs debounce vs `change`; autofill, paste and browser form-restore (Firefox restores field values on reload, arch pre-fills defaults at mount) are not covered. No test for reload with restored values. | FR6, FR8, ui/form.js, E-01 |
| 15 | **minor** | **Orphan function `formatPercent`.** No requirement or UI module displays a percentage, yet F-05, D5 and the module table cover it. Either add the requirement (where is it shown?) or remove it. | format.js, F-05, D5 |
| 16 | **minor** | **Summary shows "loan amount" (architecture, I-08) but FR2 lists only monthly payment, total paid, total interest.** Harmless gold-plating but untraceable. | ui/summary.js, I-08, FR1-2 |
| 17 | **minor** | **Constraints in §2 have no test or owner:** "no build step", "Chart.js from CDN", "English UI", "evergreen browsers". Acceptable only if declared as review items. | §2 |
| 18 | **minor** | **Cross-module detail missing:** `Input.price` is `int €` and `downPct` is a float `number`, but `calc` works in cents. Neither document says who converts euros to cents or how `downPct` becomes an exact value (hundredths as integer would avoid float drift). | calc.js, validation.js, Data model |
| 19 | **minor** | **I-14 "no DOM globals" via static scan is brittle** (string match on `document`, `window` in comments/strings) and `Intl`-based formatting would be unchecked against nbsp/grouping. Prefer running `calc`/`validation`/`format` under Vitest's `node` environment. | I-14, format.js |
| 20 | **minor** | **E-02 gives no expected value.** "payment changes to the 5 % value": the recomputed value is **644,19 €** (total paid 231 904,97, last 640,76) under half-up. Tests with undefined oracles are not repeatable. | E-02, E-11 (4,25 %: no value given either) |

## 2. Coverage check

### 2.1 Requirement → module → test

| Req | Module | Test(s) | Verdict |
|---|---|---|---|
| FR1 payment | calc | C-01..C-07, I-08, E-01 | Covered, but C-01 reference wrong (#1) |
| FR2 totals | calc, summary | C-01..C-08, I-08 | Covered, reference wrong for C-01/C-04 |
| FR3 schedule | calc, schedule | C-08, I-09, E-07 | Covered; middle rows never checked against a reference (see 5.3) |
| FR4 balance chart | calc, charts | I-10, I-11, E-01 | **Weak**: mocked only, no oracle for real chart (#10) |
| FR5 principal/interest chart | calc, charts | I-10, E-01 | **Weak** (#10) |
| FR6 live update | main, form | I-04, I-06, E-02, E-10, E-11 | Covered; event type/paste/restore not (#14) |
| FR7 inline errors, no results | validation, form, main | V-06..V-16, I-02, I-05, I-13, E-03, E-04 | Covered; stale-results ambiguity (#9) |
| FR8 defaults | config, form | V-01, I-03, E-01 | Covered |
| FR9 480 rows scrollable | schedule | I-09, E-07 | Covered |
| §4 bounds, formats | config, validation | V-04..V-14 | Covered; "up to 2 decimals" for rate edge forms missing (`4,`, `,5`) |
| §4 low down-payment warning | validation, form | V-14, V-16, I-07, E-05 | Covered |
| R1 loan | calc | C-05, C-07 | Rounding not defined (#7) |
| R2 nominal monthly rate | calc | C-01 (implicitly) | No explicit test that rate is nominal / not effective |
| R3 payment, 0 % | calc | C-01, C-02, C-06 | Covered |
| R4 rounded to cents | calc | C-09 | Weak: depends on #5 |
| R5 rows | calc | C-01, C-08 | Interest rounding undefined (#8) |
| R6 last installment | calc | C-02..C-04, C-08, C-09 | **Fails for valid inputs (#3, #4)** |
| R7 totals | calc | C-01, C-08 | Covered |
| R8 month numbers | calc | C-08, I-09 | Covered |
| §2 Slovak format | format | F-01..F-04, E-08 | Covered |
| §2 no build / CDN / English / browsers | n/a | none | Untested (#17) |
| §6 out of scope | n/a | none | Nothing to test; fine |

### 2.2 Tests without a real requirement

| Test | Observation |
|---|---|
| C-10, C-11 | Check architecture decisions (integer cents, purity), not user requirements. Legitimate, but they trace to "Decision 4" and "Architecture §4", not to FR/R. |
| F-05 | `formatPercent` has no consumer (#15). |
| I-14 | Tests the architecture rule, not a requirement (#19). |
| I-11, I-12, E-09 | Test Decisions 8 and 9, which are not in the functional spec. Valid as architecture tests. |
| C-07 | Does not test what its purpose says (#7). |

### 2.3 Modules without a stated requirement trace
`format.js` percent function (#15); loan amount in `summary.js` (#16).

## 3. Ambiguous requirements (two implementations, different results)

| # | Requirement | Interpretation A | Interpretation B | Visible difference |
|---|---|---|---|---|
| A1 | R4 "rounded to cents" | half-up | half-even / ceil | 104/480 grid cases change at least one row |
| A2 | R5 `interest = balance × r` | round each row | keep exact, round only at display | last payment 571,81 vs 571,76 (default) |
| A3 | R1 loan with fractional cents | round half-up to cent | floor / keep fractional | loan ±1 cent, totals shift |
| A4 | R6 "last installment adjusted" | last payment = balance + interest (can be negative / huge) | spread the remainder or cap; or put remainder in principal only | last row, FR4 chart end point |
| A5 | R6 when balance reaches 0 early | keep rows to n with zero/negative values | stop schedule early | row count (breaks `rows.length = years × 12`) |
| A6 | FR7 "no results are calculated" | clear views | keep last results | what the user sees |
| A7 | FR4 "balance over time" | n points from month 1 | n + 1 points starting at L | chart and I-10 |
| A8 | FR6 "as the user types" | every `input` event | debounced | E-11 timing |
| A9 | §4 price "whole euros" | reject `150000.50` (D2) | round to 150 000 or 150 001 | validation |
| A10 | Decimal/thousand separators | `.` and `,` both decimal (D) | `.` as Slovak thousand separator | `"150.000"`, `"1.234"` |
| A11 | §4 down payment "percent" | 2 decimals (D6) | integer percent | V-11 |
| A12 | FR2 "total amount paid" | sum of installments (R7) | includes down payment | summary |
| A13 | Warning "below 10 %" | strict `< 10` | `<= 10` | 10 % boundary (V-14 pins it to `<`) |

## 4. Missing edge cases and invalid inputs

Not listed in `03-test-scenarios.md` section 6 and not covered by a test:

**Calculation**

1. Overpaying schedule: `10000, 90, 4.5, 40` gives a negative last payment (−1,32 €) and negative principal (see #4). Needs a defined behaviour and a test.
2. Large last-installment jump: `10001, 0, 15, 40` gives 125,33 regular and 271,08 last.
3. Real fractional-cent loan: `10001, 12.55, 4, 7` (loan 8 745,8745 €).
4. Exact .5-cent interest ties (C-04 has 9; a minimal one: balance 100,00 € at 6 % gives 0,5 cent). Needed to pin half-up behaviour against float.
5. Minimum interest: smallest loan (1 000 €) at 0,01 %, 1 y: interest per row below 1 cent, many rows with `interest = 0` and the payment still includes it.
6. Mid-schedule reference row: no test checks a middle row (default, month 180 = payment 572,90, principal 313,68, interest 259,22, balance 77 450,95).
7. 2-decimal rate boundaries across all bounds (`0,01`, `14,99`, `15`, `15,00`).
8. Down payment between 0 and 10 with minimum price (warning plus tiny/large numbers).

**Input parsing (all must be rejected or explicitly accepted)**

9. Trailing/leading separators: `"4,"`, `"4."`, `",5"`, `".5"`, `"0,"`; matter for E-10/E-11 because users type through them.
10. Unit suffixes and symbols: `"150000 €"`, `"4 %"`, `"4,5%"`.
11. Mixed separators: `"1 234,5"` in rate, `"150.000"`, `"150,000"` (price), `"1,5,"`.
12. Unicode: full-width digits `"４"`, Arabic-Indic digits, Unicode minus `"−5"`, narrow nbsp U+202F as thousand separator (Slovak/French systems paste this).
13. Control and extra characters: tab, newline (listed only as a one-line item), zero-width space, hex `"0x10"`, `"1_000"`, `"1E3"`/`"1e3"` variants, `"٫"` (Arabic decimal).
14. Very long strings (>400 digits → `Infinity`), integers over 2^53 (`"9007199254740993"`), many leading zeros `"0000000000150000"`.
15. Field with both a range and format error (`"-1,234"`): which message wins?

**UI and browser**

16. Browser form restore / bfcache returns old field values; defaults pre-filled by JS may overwrite them (or results may not match the visible fields).
17. Autofill and paste that do not fire `input` the same way; IME composition.
18. Chart.js loaded but animations running while `update()` is called rapidly (E-11 covers typing but not the animation state).
19. Window resize / narrow viewport (D7 puts it out of scope; acknowledge as a known gap).
20. Very long numbers in the summary overflowing layout (`12 031 037,97 €`).
21. Screen-reader announcement of inline errors (D7 out of scope; OK but record it).

## 5. Out-of-scope features: which modules must change

### 5.1 Extra payments / early repayment (§6, item 1)

| Module | Required change |
|---|---|
| `config.js` | Bounds and defaults for the new inputs (amount, month or frequency, mode: shorten term vs lower payment). |
| `validation.js` | Parse and validate the new fields; cross-field rule (extra payment month ≤ n; amount ≤ remaining balance). New errors/warnings keys. |
| `calc.js` | Schedule loop must accept a per-month extra and **stop early**. This breaks the invariant `rows.length = years × 12` (C-08, I-09 headings), Decision 4's "last row" rule, and R6 (final row logic). `Result` needs fields such as `monthsSaved`, `interestSaved`. |
| `format.js` | Possibly a "years and months" formatter. |
| `ui/form.js` | New inputs plus error placement for them (`RawInput` grows). |
| `ui/summary.js` | Show new term, interest saved. |
| `ui/schedule.js` | Mark rows with extra payments; row count no longer fixed at 480 maximum semantics (FR9). |
| `ui/charts.js` | Datasets have variable length; labels must stay aligned with a shorter schedule. |
| `main.js` | `deriveOutcome` unchanged in shape, but `RawInput`/`Input` types change. |
| Tests | C-08/C-09/C-10 and I-09/I-10 assumptions change; new reference values. |
| Spec/arch | R3 (annuity formula no longer produces the whole schedule), FR3, FR9. |

### 5.2 Differential (declining) payment type (§6, item 4)

| Module | Required change |
|---|---|
| `config.js` | New `PAYMENT_TYPES` enum and default. |
| `validation.js` | New field `type` (enum check; no numeric parsing). |
| `calc.js` | New branch: constant principal `L/n` (rounded), interest on balance, payment varies. `Result.payment` (a single number) is no longer meaningful: need `firstPayment`/`lastPayment` or a list. Rounding rule for constant principal (remainder) needs a new decision. |
| `ui/form.js` | A type selector; changes the `RawInput` shape. |
| `ui/summary.js` | "Monthly payment" label becomes a range (first–last). |
| `ui/schedule.js` | No structural change (columns identical). |
| `ui/charts.js` | Principal vs interest chart: principal flat, interest declining (still works); balance chart is a straight line. No code change expected, but the axis scaling must be re-checked. |
| `main.js` | Pass new field only. |
| Tests | C-09 ("equal payment in rows 1..n−1") fails for this mode; C-01 reference values are annuity-only; new reference table. |

### 5.3 Export of results to CSV (§6, item 5)

| Module | Required change |
|---|---|
| **new** `export.js` (pure) | Build CSV text from `result.schedule` (and optionally the inputs). Must decide separator (`;` for Slovak Excel, `,` otherwise), decimal separator, BOM, quoting. |
| `format.js` | Needs a *plain* numeric formatter (cents → `1234,56` without nbsp and `€`); the current `formatEur` is for display and would break CSV parsing. |
| `ui/` | A new button component (e.g. `ui/export.js`) or a change in `ui/summary.js`; trigger a `Blob` download. |
| `main.js` | Wire the button to the current `outcome`; disable it when `status = 'invalid'`. |
| `calc.js`, `validation.js`, `config.js` | **No change.** |
| Architecture §4 / I-14 | Dependency rules must be extended (`export` pure, no DOM, imports `format` only). |
| Tests | New unit tests for `export.js`; E2E download test (Playwright). §6 line "saving, exporting" must be removed from out-of-scope. |

## 5b. Reference values recomputed (answer to task 5)

Method: exact rational arithmetic; loan in cents; `M = L·r/(1 − (1+r)^−n)` evaluated exactly, rounded **half-up**; per-row interest `round_half_up(balance·r)`; last row `payment = balance + interest`. "Float sim" is a Python mirror of the obvious JS implementation (`Math.round`, doubles). Values in euros.

### 5b.1 Calc tests

| Test | Item | Doc says | Recomputed (exact, half-up, Decision 4) | Float sim | Half-even | Match |
|---|---|---|---|---|---|---|
| C-01 | loan | 120 000,00 | 120 000,00 | same | same | OK |
| C-01 | payment | 572,90 | 572,90 | 572,90 | 572,90 | OK |
| C-01 | total paid | 206 242,86 | **206 242,91** | 206 242,91 | 206 242,84 | **WRONG** |
| C-01 | total interest | 86 242,86 | **86 242,91** | 86 242,91 | 86 242,84 | **WRONG** |
| C-01 | row 1 | 572,90 / 172,90 / 400,00 / 119 827,10 | same | same | same | OK |
| C-01 | last payment | 571,76 | **571,81** | 571,81 | 571,74 | **WRONG** (571,76 = unrounded-interest variant) |
| C-01 | rows | 360 | 360 | | | OK |
| C-02 | payment / last | 833,33 / 833,73 | 833,33 / 833,73 | same | same | OK |
| C-02 | total paid / interest | 100 000,00 / 0,00 | same | same | same | OK |
| C-03 | payment / last | 902,58 / 902,62 | 902,58 / 902,62 | same | same | OK |
| C-03 | total paid / interest | 10 831,00 / 831,00 | same | same | same | OK |
| C-04 | payment | 25 064,48 | 25 064,48 | same | same | OK |
| C-04 | last | 25 151,23 | **25 152,05** | 25 151,99 | 25 151,23 | **WRONG** under D1 (only half-even matches) |
| C-04 | total paid | (not given) | 12 031 037,97 | 12 031 037,91 | 12 031 037,15 | |
| C-04 | total interest | 10 031 037,15 | **10 031 037,97** | 10 031 037,91 | 10 031 037,15 | **WRONG** under D1 |
| C-04 | rows | 480 | 480 | | | OK |
| C-05 | loan / payment / last | 1 000,00 / 83,33 / 83,37 | same | same | same | OK |
| C-06 | payment / last | 417,50 / 418,61 | 417,50 / 418,61 | same | same | OK |
| C-06 | total interest | 401,11 | 401,11 | same | same | OK |
| C-07 | loan | 6 700,67 | 6 700,67 (exact, not fractional) | | | OK; but test purpose wrong (#7) |
| C-07 | payment / last / total paid | 91,59 / 91,62 / 7 693,59 | same | same | same | OK |
| C-07 | total interest (not given) | | 992,92 | | | |

### 5b.2 Other tests that use these numbers

| Test | Doc says | Recomputed | Match |
|---|---|---|---|
| F-01 | `572,90 €` | `572,90 €` | OK (formatting is deterministic) |
| F-02 | `1 234,56 €` for 123456 | same | OK |
| F-03 | `0,00 €`, `0,05 €`, `1,00 €` | same | OK |
| F-04 | 1203103715 → `12 031 037,15 €` | The formatting of that number is correct, **but the number is wrong** (should be 1203103797 → `12 031 037,97 €`) | **WRONG input** |
| F-05 | `4 %`, `4,5 %` | same | OK |
| I-08 | `206 242,86 €`, `86 242,86 €` | `206 242,91 €`, `86 242,91 €` (572,90 and 120 000,00 OK) | **WRONG** |
| E-02 | "5 % value" (not given) | 644,19 € (total 231 904,97, last 640,76) | missing value |
| E-11 | "4,25 %" (not given) | not given | missing value |

### 5b.3 Extra values the plan should add

| Case | Value |
|---|---|
| C-01 month 180 | `payment 572,90 / principal 313,68 / interest 259,22 / balance 77 450,95` |
| Overpay case `10000, 90, 4.5, 40` | last payment −1,32 € (invalid result) |
| Large jump `10001, 0, 15, 40` | regular 125,33 €, last 271,08 € |
| Fractional-cent loan `10001, 12.55` | L = 874 587,45 cents → rounds to 874 587 (8 745,87 €) |
| Naive textbook interest `n·M − L` | default: 86 244,00 vs 86 242,91 (matches edge case 5; differs by 1,09 €, not "a few cents") |
| Grid summary (480 cases) | 4 with negative balance/last payment; 47 where float differs from exact; 104 where half-even differs from half-up; max last-vs-regular gap 145,75 € |

## Appendix: reproduction script (core)

```python
from fractions import Fraction as F
import math

def rnd(x, mode):
    fl = math.floor(x); d = x - fl
    if d > F(1, 2): return fl + 1
    if d < F(1, 2): return fl
    return fl + 1 if mode == 'up' else (fl if fl % 2 == 0 else fl + 1)

def exact(price, down, rate, years, mode='up'):
    L = rnd(F(price) * 100 * (1 - F(down) / 100), mode)   # loan in cents
    n, r = years * 12, F(rate) / 1200
    M = F(L, n) if r == 0 else L * r / (1 - (1 + r) ** (-n))
    pay, bal, rows = rnd(M, mode), L, []
    for k in range(1, n + 1):
        i = rnd(bal * r, mode)
        if k < n: p = pay - i; rows.append((k, pay, p, i, bal - p)); bal -= p
        else:     rows.append((k, bal + i, bal, i, 0))
    tot = sum(x[1] for x in rows)
    return dict(L=L, pay=pay, rows=rows, tot=tot, ti=tot - L, last=rows[-1][1])
```

The float simulation uses the same loop with `L = floor(x + 0.5)` on doubles, `r = rate/100/12` and `M = L*r/(1 - (1+r)**-n)`. Grid: price ∈ {10000, 10001, 150000, 2000000}, down ∈ {0, 9.99, 10, 12.55, 20, 90}, rate ∈ {0, 0.01, 4, 4.5, 15}, years ∈ {1, 2, 30, 40}.
