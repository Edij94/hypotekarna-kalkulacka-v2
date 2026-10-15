# v2 build plan

Status: **draft for approval**. Merges `01-goal` to `05-review` into one plan. Where the documents disagreed, this file picks the **simplest option** (section 2). Where this file and 02-04 differ, **this file wins**.

## 1. Goal and scope

A mortgage calculator made of Front-end, API and Python calculations. The user types four values and sees the totals live.

**In scope (this release)**

- Four inputs: price, down payment, interest rate, term.
- Results: loan, monthly payment, last payment, total paid, total interest, low down payment warning.
- Live update with debounce, inline errors, English UI with Slovak number format.

**Out of scope (this release)**

- Saved calculations, login, Supabase, list/delete endpoints (see decision D1).
- Amortization table and charts (v1 FR3-FR5, FR9).
- Rate limiting, deployment, i18n.

## 2. Inconsistencies and how they are resolved

Each row is a problem found in `05-review.md`, with the simplest fix. No new features are added to fix them.

| ID | Problem (review ref) | Decision |
|---|---|---|
| D1 | Saved calculations exist in 04 but not in 03, 02 or v1 (S1, C1, C2) | **Cut them from this release.** No Supabase, no `/api/calculations`, no `Repository`, no `name`, no `localStorage`. The design stays in 04 as the plan for a later phase. Goal 01 still lists Supabase, but it is a later phase and not built now. |
| D2 | Early payoff rule undefined (A1, E1) | **Always n = years*12 payments.** Month k < n pays `min(payment, balance + interest)`. Month n pays `balance + interest`. `last_payment` is the n-th payment and can be 0. Matches v1 reference and golden case `Overpay`. |
| D3 | Check order inside Python undefined (A4) | **Per field in order** `price, down_h, rate_h, years`: type check, then range check, then the next field. First error wins. |
| D4 | Bounds unit and inclusiveness (A8) | In code units, all **inclusive**: `price 10000..2000000`, `down_h 0..9000`, `rate_h 0..1500`, `years 1..40`. |
| D5 | How raw JSON reaches Python (A2, A3, A14) | The route reads the body as a plain `dict` and builds `MortgageInput(price=body.get("price"), ...)`. No Pydantic input model. `MortgageInput` accepts anything, Python decides. Missing, `null`, string, float (`150000.0`), `bool` all give `not_integer`. Extra fields are ignored. |
| D6 | Absurd integers (E5) | A JSON number with more than 4300 digits makes Python's `json` raise `ValueError`. It is mapped to 400 `bad_request`. Not a special case in `mortgage_calc`. |
| D7 | Error bodies from FastAPI defaults (E9) | One handler set: every error is `{code}` or `{field, code}`. Unknown route or wrong method gives 404/405 `{code: "not_found"}` / `{code: "method_not_allowed"}`. Unknown `/api/*` never falls back to `index.html`. |
| D8 | Codes list | Final set: `not_integer`, `out_of_range` (with `field`); `bad_request`, `not_found`, `method_not_allowed`, `internal_error` (no field). `invalid_name`, `storage_unavailable` are dropped with D1. |
| D9 | Parsing grammar (A9, E15, E16) | See 6.3. Digits only, one `,` or `.` as decimal separator, spaces/NBSP ignored, no sign, no exponent, no `%`/`€`. `150.000` means 150. Integer fields reject any decimal part locally. |
| D10 | Debounce details (A10) | Constant `DEBOUNCE_MS = 300`. First request for the defaults is sent immediately. Local parse errors appear immediately. The **parsed value** is debounced. |
| D11 | Result panel priority (A11, A12) | Local error > API field error > network/server error > loading > ok. Anything but ok/loading hides the numbers. Loading keeps old numbers dimmed. An aborted request is not an error. |
| D12 | Number formatting (A19) | **Hand-written** formatter from integer cents (no `Intl`, no float division): group by NBSP (U+00A0), comma decimal, `NBSP€` suffix. Output does not depend on ICU or Node. |
| D13 | Bounds duplicated in the UI (C5) | Front-end keeps the ranges in one file `lib/limits.ts`. One pytest in the API compares it to Python `BOUNDS` (regex on the file). No `/api/limits` endpoint. |
| D14 | Contract duplicated 3 times (C6) | **One source: section 5 of this file.** `types.ts` and the API response model mirror it. The API contract test uses an expected-keys constant; the e2e smoke test (7.4) checks the real chain. |
| D15 | Validation "only in Python" vs API (C4) | With D1 there is no `name`, so the rule is true again: the API validates nothing except "body is a JSON object". |
| D16 | Zero rate remainder (E2) | Accepted v1 behavior: rounded payment times n-1 plus a larger last payment. `last_payment` can be much larger than `payment` for small loans. Documented and tested. |
| D17 | Performance of `Fraction` at `rate_h = 1` (E3) | Keep `Fraction`. Add one test: worst case (`rate_h=1`, `years=40`) finishes in under 1 s. If it fails, optimise then. |
| D18 | Warnings (A18, C10) | `warnings` is a sorted list of unique code strings. No `Warning` model. |
| D19 | Sync vs async (A20) | Routes are plain `def`. (No Supabase now, so no timeout needed.) |
| D20 | Golden file keys (review 1.1) | `golden.json` uses camelCase (`downH`, `lastPayment`). The test loader maps it to snake_case in one place. |
| D21 | Tooling rule (C11) | "pytest only" means only for Python (plus `httpx` for `TestClient`). The front-end uses Vite, Vitest, Playwright. |
| D22 | Stale docs (C9, C12) | Docs 02-04 are not edited now. Their status lines are known to be stale and 06 is the current truth. (Updating them is a separate small task, section 9.) |
| D23 | v1 features (C8) | See table 2.1. |
| D24 | Rate precision (E6) | Rates have **at most 2 decimals** (hundredths of a percent). `3,875` is rejected by the parser as "too many decimals". |

### 2.1 v1 feature status

| v1 feature | v2 |
|---|---|
| FR1 inputs, FR2 results | Kept |
| FR3-FR5 amortization table, charts | Dropped |
| FR6 live update | Kept (debounce, API call) |
| FR7 invalid input hides results | Kept, now "result hidden, error at field" |
| FR8 low down payment warning | Kept (`low_down_payment` code) |
| FR9 scrollable schedule | Dropped |
| Save/share | Not in v2.0 (D1) |

## 3. Final architecture

```
Browser (React) --/api/*--> FastAPI --import--> mortgage_calc (pure Python)
        ^                     |
        +---- static files ---+      (Supabase: later phase)
```

- One process, one origin. FastAPI serves `/api/*` and the built front-end. In development Vite proxies `/api` to FastAPI.
- `mortgage_calc` is a library, not a service.
- Units everywhere: price in whole euros, rates in hundredths of a percent, money out in integer cents.

## 4. Repository layout

```
app-v2/
  calculations/   pyproject.toml, src/mortgage_calc/, tests/
  api/            pyproject.toml, src/mortgage_api/, tests/
  frontend/       package.json, src/, tests/
docs/v2/          documentation (this file)
```

The v1 app is not touched.

## 5. Contract (single source)

```
POST /api/calculate
  request  {price:int, down_h:int, rate_h:int, years:int}
  200      {loan, payment, last_payment, total_paid, total_interest: int (cents), warnings: string[]}
  422      {field: "price"|"down_h"|"rate_h"|"years", code: "not_integer"|"out_of_range"}
  400      {code: "bad_request"}          body is not valid JSON or not an object
  500      {code: "internal_error"}       no traceback in body, logged

GET /api/health  -> 200 {"status": "ok"}
Unknown /api/*   -> 404 {code: "not_found"};  wrong method -> 405 {code: "method_not_allowed"}
```

## 6. Parts

Build order is section 8. Each part lists responsibility, modules, rules and done criteria.

### 6.1 Python calculations (`app-v2/calculations`)

**Responsibility:** math and validation. No I/O, no Supabase, no formatting.

**Modules** (`src/mortgage_calc/`)

| File | Content |
|---|---|
| `models.py` | `MortgageInput` (frozen, fields untyped at runtime), `MortgageResult` (frozen) |
| `errors.py` | `ValidationError(field, code)` |
| `rounding.py` | `round_half_up(Fraction) -> int` (never built-in `round`) |
| `validation.py` | `BOUNDS`, `validate(data) -> list[str]` (returns warnings, raises `ValidationError`) |
| `annuity.py` | loan, regular payment, private `_run_schedule` |
| `__init__.py` | exports `calculate`, `MortgageInput`, `MortgageResult`, `ValidationError` |

**Rules**

1. Validation order: D3. A value is valid if `type(x) is int` (so `bool` and `float` fail), then inside inclusive range (D4).
2. `loan = round_half_up(price*100*(10000-down_h)/10000)`.
3. `n = years*12`, `r = Fraction(rate_h, 120000)`.
4. `payment = loan/n` if `rate_h == 0`, else `loan*r / (1-(1+r)**-n)`, rounded half up once.
5. Month loop (D2): interest = `round_half_up(balance*r)`; month k<n pays `min(payment, balance+interest)`; month n pays `balance+interest`; final balance is 0.
6. `total_paid = sum(payments)`, `total_interest = total_paid - loan`, `last_payment` = payment of month n.
7. Warning `low_down_payment` if `down_h < 1000`. No warning is returned if validation fails.

**Done when:** all tests in 7.1 pass and `calculate()` equals every golden case.

### 6.2 API (`app-v2/api`)

**Responsibility:** HTTP glue only. Parse the body, call `calculate`, return JSON, serve static files.

**Modules** (`src/mortgage_api/`)

| File | Content |
|---|---|
| `main.py` | `create_app(static_dir=None)`: routes, handlers, static mount |
| `config.py` | `STATIC_DIR` env var (optional; if unset, API-only mode) |
| `errors.py` | handlers: `ValidationError` -> 422, bad body -> 400, 404/405, any exception -> 500 (logged) |
| `routes/calculate.py` | `def calculate(body)`: dict check, `MortgageInput(price=body.get(...), ...)`, return `asdict(result)` |
| `routes/health.py` | health |

**Rules**

- D5-D8, D15, D19.
- Static: mount built files at `/`; unknown non-`/api` paths return `index.html` (so reloads work); path traversal is blocked by using Starlette's `StaticFiles`.
- Request body bigger than 10 KB is rejected as 400 `bad_request` (cheap guard, since the real body is under 100 bytes).
- No CORS (same origin).

**Done when:** all tests in 7.2 pass and `uvicorn` serves the built front-end and `/api/calculate` on one port.

### 6.3 Front-end (`app-v2/frontend`)

**Responsibility:** four inputs -> API -> display. Parsing and formatting only; no math, no range checks.

**Modules** (`src/`)

| File | Content |
|---|---|
| `lib/parse.ts` | text -> number or local error, per grammar below |
| `lib/format.ts` | cents -> `1 234,56 €` (D12) |
| `lib/limits.ts` | display ranges (D13) |
| `lib/messages.ts` | code -> English text, fallback for unknown codes |
| `api/types.ts`, `api/client.ts` | section 5 types; `calculate(input, signal)`; maps non-JSON, network failure and unknown bodies to `internal_error` |
| `hooks/useCalculation.ts` | debounce (D10), abort previous request, state machine (D11) |
| `components/` | `CalculatorForm`, `NumberField`, `ResultPanel`, `WarningBanner` |
| `App.tsx`, `main.tsx`, `styles/styles.css` | page, v1 look |

**Parsing grammar (D9)**

- Allowed: digits; spaces and NBSP (U+00A0, U+202F) anywhere (ignored); at most one `,` or `.`.
- Rejected locally: empty, any other character (letters, `%`, `€`, sign, `e`), more than one separator, more than 2 decimals, a separator with nothing after it (`4,`), non-ASCII digits.
- Integer fields (price, years): any decimal part is rejected. `150.000` is 150 (and then the API says out of range).
- Percent fields: result is hundredths computed from the string (`"4,35"` -> 435, `"4"` -> 400, `".5"` -> 50). No float multiplication.
- Leading zeros are fine (`04` -> 4). Max 12 characters are parsed; longer text is a local error.

**States (D11):** local error, API field error, network/server error, loading, ok. Defaults: price 150 000, down 20 %, rate 4 %, term 30.

**Accessibility:** labels tied to inputs, errors in an `aria-live="polite"` region, result in a live region.

**Done when:** all tests in 7.3 pass and the page works against the real API.

### 6.4 Supabase (later phase, not built now)

Kept as designed in `04-api.md` sections 5-8 (table, RLS, `Repository`). Before it starts, a new plan must also cover the front-end part (UI, ids in `localStorage`), delete semantics, `name` validation and `rules_version`. Nothing in this release depends on it.

## 7. Tests and requirements

### 7.1 Requirements

IDs are used in the traceability table (7.5).

| ID | Requirement |
|---|---|
| R1 | Loan = round half up of `price*100*(10000-down_h)/10000` cents |
| R2 | Rounding is half up (exact .5 rounds up), never banker's |
| R3 | Regular payment by annuity formula; rate 0 uses `loan/n` |
| R4 | Month loop per D2; final balance is 0; `last_payment` is month n |
| R5 | `total_paid = sum(payments)`; `total_interest = total_paid - loan` |
| R6 | Bounds D4 inclusive; one past the bound gives `out_of_range` |
| R7 | Non-int (str, float, bool, None, missing) gives `not_integer` for the right field |
| R8 | First error follows field order D3; no warning when invalid |
| R9 | `low_down_payment` iff `down_h < 1000`; warnings sorted and unique |
| R10 | `calculate` is pure and `MortgageInput`/`MortgageResult` are frozen |
| R11 | `POST /api/calculate` returns the section 5 body and units |
| R12 | Every API error has the section 5 shape, never `detail`, never a traceback |
| R13 | Bad JSON, non-object, body over 10 KB give 400; extra fields ignored |
| R14 | Unknown route 404, wrong method 405, both `{code}`, unknown `/api/*` never returns HTML |
| R15 | `/api/health` returns ok |
| R16 | API serves static files with `index.html` fallback outside `/api` |
| R17 | Parser follows the grammar (D9); percent conversion is exact |
| R18 | Formatter follows D12 for all cents values |
| R19 | Every known code has a message; unknown code gets a fallback |
| R20 | Live update: 300 ms debounce, first request immediate, previous request aborted, old response never overwrites a newer one |
| R21 | State priority D11; numbers hidden except ok/loading; loading dims old numbers |
| R22 | Warning banner on `low_down_payment` |
| R23 | Accessibility: labels, `aria-live` |
| R24 | UI limits equal Python `BOUNDS` |
| R25 | Whole chain works: built front-end -> API -> `mortgage_calc` |
| R26 | Worst-case calculation (`rate_h=1`, 40 years) takes under 1 s |

### 7.2 Calculations tests (`pytest`)

Files: `tests/unit/test_rounding.py`, `test_annuity.py`, `test_validation.py`, `test_invariants.py`, `golden/test_golden.py`.

- **Golden** (R1, R3-R5): every case in the copied `golden.json`, compares `loan, payment, last_payment, total_paid, total_interest`, camelCase mapping in the loader (D20). The cases include `Overpay` (last payment 0). Schedule rows are checked through the private loop's totals only, not its internals, so refactors do not break tests.
- **Added cases (hand-computed, D16)**: rate 0 with a small loan (1 000 €, 40 years: payment 208, last 368), rate 0 normal, `years=1`, `years=40`, each bound `down_h` 0 and 9000, price min and max, rate min (0) and max (1500).
- **Rounding** (R2): `.5` up, `.49` down, exact integers, large values.
- **Validation** (R6-R9): each field at min, max, min-1, max+1; `True`, `False`, `1.0`, `"1"`, `None`, `[]` per field give `not_integer` with the right `field`; negative; two wrong fields respect the order (the D3 example `{price: 5, down_h: "x"}` gives `price/out_of_range`); `down_h = 0` and `999` warn, `1000` does not; error input returns no warning.
- **Invariants** (R4, R5), parametrized over ~20 inputs: balance ends at 0, principal sums to loan, `total_paid == sum(payments)`, `total_interest == total_paid - loan`.
- **Purity** (R10): assigning to a field of the result or input raises; calling twice gives equal results.
- **Performance** (R26): one test with a 1 s limit.

### 7.3 API tests (`pytest`, `TestClient`, `httpx`)

Files: `tests/test_calculate.py`, `test_errors.py`, `test_static.py`, `test_limits_drift.py`.

- **R11**: one golden case end to end, response has exactly the 6 keys, all ints but `warnings` (a list). Warning present at `down_h=999`, absent at `1000`.
- **R12, R13**: `not_integer` for string, float `150000.0`, `null`, missing, `true`; `out_of_range` for each field; field order with two bad fields; malformed JSON, `[]`, `"x"`, `null`, empty body, body over 10 KB, wrong `Content-Type` with valid JSON, a 5000-digit number: all 400; extra field ignored; no response contains `detail`; a forced exception returns 500 `internal_error` without text from the exception.
- **R14**: `GET /api/calculate` 405, `POST /api/health` 405, `GET /api/xyz` 404, both `{code}`.
- **R15**: health.
- **R16**: with a temporary static dir: `/` serves `index.html`, `/assets/x.js` serves the file, `/some/path` falls back to `index.html`, `/api/xyz` is still JSON 404, `../` traversal does not read outside the dir. Without `STATIC_DIR`, `/` gives 404 JSON.
- **R24**: parse `frontend/src/lib/limits.ts` and compare with `mortgage_calc.BOUNDS`.

### 7.4 Front-end tests

**Vitest** (`tests/unit`)

- `parse.test.ts` (R17), table-driven, at least 20 rows: `"4,25"`, `"4.25"`, `"4"`, `".5"`, `"4,"` (error), `"4,255"` (error), `"1 500"`, NBSP and narrow NBSP, `"150.000"` in price (150), `"30.5"` in years (error), `"-4"`, `"+4"`, `"1e3"`, `"4%"`, `"€5"`, `""`, `"abc"`, `"1,2,3"`, `"04"`, 13 characters, `"٣"` (non-ASCII digit).
- `format.test.ts` (R18): 0, 1, 99, 100, 123456, 400000000 cents; NBSP in the output; no `-0`.
- `messages.test.ts` (R19): iterate over the codes in section 5; unknown code gives the fallback.
- `useCalculation.test.ts` (R20, R21) with fake timers and a fake client: first call immediate; typing three times within 300 ms makes one call; a new call aborts the previous signal; a late old answer is ignored; `AbortError` does not set an error state; state priority table.
- `client.test.ts`: 200 body; 422 body; HTML reply, network failure and unknown JSON shape all become `internal_error`.

**Playwright** (`tests/e2e`), two projects:

1. *Mocked API* (R20-R23): defaults show a result on load; changing the price updates after the debounce; `out_of_range` mock shows the inline error and hides the numbers; `down_h=999` shows the banner; 500 mock shows one message and recovers on the next change; a local parse error shows immediately and hides the numbers; axe-core style checks: inputs have labels and the live region exists (R23).
2. *Smoke against the real stack* (R25): the built front-end served by FastAPI; defaults give the golden values for 150 000 / 20 % / 4 % / 30 (loan 120 000,00 €, monthly payment from `golden.json`); a bad value shows the range error from the real API.

### 7.5 Traceability

| Requirement | Module(s) | Test(s) |
|---|---|---|
| R1, R3, R4, R5 | `annuity.py` | golden, added cases, invariants |
| R2 | `rounding.py` | `test_rounding.py` |
| R6-R9 | `validation.py`, `errors.py` | `test_validation.py` |
| R10 | `models.py` | purity tests |
| R26 | `annuity.py` | performance test |
| R11-R13 | `routes/calculate.py`, `errors.py` | `test_calculate.py`, `test_errors.py` |
| R14, R15 | `errors.py`, `routes/health.py` | `test_errors.py` |
| R16 | `main.py` | `test_static.py` |
| R17 | `parse.ts` | `parse.test.ts` |
| R18 | `format.ts` | `format.test.ts` |
| R19 | `messages.ts` | `messages.test.ts` |
| R20, R21 | `useCalculation.ts`, `ResultPanel.tsx` | hook tests, e2e mocked |
| R22 | `WarningBanner.tsx` | e2e mocked |
| R23 | components | e2e mocked |
| R24 | `limits.ts`, `BOUNDS` | `test_limits_drift.py` |
| R25 | everything | e2e smoke |

Every requirement has at least one test, and every test above is listed under a requirement.

## 8. Build order

Each step ends with its tests green and one commit (the commit only after you approve).

1. **Calculations scaffold**: `pyproject.toml`, copy `golden.json`, folders.
2. **Calculations code + tests** (6.1, 7.2). Nothing else can start before the golden tests pass.
3. **API scaffold + `/api/calculate` + error handlers + tests** (6.2, 7.3 except static and drift). The contract in section 5 is now real.
4. **Front-end scaffold** (Vite, TS, Vitest, Playwright).
5. **Front-end lib** (`parse`, `format`, `limits`, `messages`) + unit tests. Steps 4-5 can start in parallel with step 3, since they need no API.
6. **Front-end API client, hook, components, CSS** + Vitest + Playwright (mocked).
7. **Static serving** in the API + `test_static.py` + `test_limits_drift.py`.
8. **Smoke test** against the real stack (R25) and a short `README` with the commands: build the front-end, run `uvicorn`, run all tests.
9. **Doc cleanup**: mark 02-04 as superseded by 06 where they differ (D22).

## 9. Risks and later work

- **Performance** (R26) of exact `Fraction` math at tiny rates; fall back to a faster exact method only if the test fails.
- **Bounds drift** is caught by one test (R24), but only for the front-end constants, not for the texts in the messages.
- **Supabase phase** (6.4) needs its own plan and answers to review items on deletion, abuse limits, ownership and storage timeouts.
- **Doc cleanup** (step 9) is small but is the only place where 02-04 and this plan still disagree.
