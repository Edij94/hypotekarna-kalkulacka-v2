# Independent review of the v2 plan

Reviewer: an independent pass, not the author of the plan. No file in `docs/v2/01`-`04` was changed.

Reviewed: `01-goal.md`, `02-calculations.md`, `03-frontend.md`, `04-api.md`. To check claims about v1 I also read (read-only) `docs/v1/01-functional.md`, `tests/golden/golden.json` and `tests/reference/reference.py`, because 02 depends on them.

Severity: **H** = would change results or break the plan, **M** = likely bug or rework, **L** = clean-up.

## 0. Summary

The plan is clear and the layering is good (Python = math + validation, API = glue + storage, front-end = parsing + display). The biggest problems are these:

| # | Sev | Problem |
|---|---|---|
| S1 | H | **Saved calculations (04) have no front-end.** 03 explicitly excludes them, 02 says "no new features", v1 says saving is out of scope. The API grows a feature that nobody consumes and nothing tests end to end. |
| S2 | H | **The early-payoff case is not specified in 02.** The v1 golden case "Overpay" has `last_payment = 0` and the schedule ends before month n. 02 step 6 says "the last installment is `balance + interest`", which reads as if the last installment is always the n-th and non-zero. |
| S3 | H | **API input handling contradicts itself** (04 section 3 rules): "not strict Pydantic" + "raw JSON to `mortgage_calc`" + `MortgageInput(**body)` + "missing field = `not_integer`" + "extra fields ignored" cannot all be true with the code shown in the data flow. |
| S4 | H | **Validation order is undefined inside Python** (02), while 04 promises a field order. Two correct implementations return different errors for the same body. |
| S5 | M | **Number parsing in the front-end is ambiguous** (`1.500`, `150.000`, NBSP, signs, `4,`, decimals in whole-number fields). |
| S6 | M | Several stated requirements have **no test** (race handling, aria-live, loading state, static serving, DELETE of a missing id, 500 handler, `client.ts`). |
| S7 | M | **Status and document drift**: 02, 03, 04 still say "Not committed yet"; 03 still says "no saved calculations"; `models.py` lists a `Warning` model that does not exist anywhere else. |

## 1. Coverage: requirement -> module -> test

Legend: OK = covered, **GAP** = requirement exists but no test, **ORPHAN** = test or module with no stated requirement.

### 1.1 Python calculations (02)

| Requirement | Module | Test | Verdict |
|---|---|---|---|
| Loan = round_half_up(price*100*(10000-down_h)/10000) | `annuity.py` | golden (`Fractional-cent loan`, `Rounded-up loan`) | OK |
| Round half up, never `round()` | `rounding.py` | `test_rounding.py` (exact .5) | OK |
| Regular payment, rate 0 branch | `annuity.py` | unit "zero rate" | OK, but golden has **no 0 % case**, so the only check is a unit test whose expected values must be written by hand |
| Last payment = balance + interest, final balance 0 | `_run_schedule` | golden + invariant | OK |
| Payment never exceeds balance + interest (cap) | `_run_schedule` | golden `Overpay` only | **GAP**: not named in 02 section 9, only covered by luck of the golden file |
| Totals (`total_paid`, `total_interest`) | `annuity.py` | golden + invariant | OK |
| Bounds table, inclusive/exclusive | `validation.py` `BOUNDS` | "each bound (min, max, one outside)" | OK, but inclusiveness is never written down (see A8) |
| `bool` rejected, non-int rejected (`not_integer`) | `validation.py` | not listed in 02 section 9 | **GAP**: no test for `True`, `1.0`, `"5"`, `None`, huge ints |
| `ValidationError(field, code)` carries the right field | `errors.py` | not listed | **GAP**: only the code is implied, never which field |
| `low_down_payment` at 9.99 %, not at 10 % | `validation.py` | unit | OK (also when `down_h = 0`: not listed) |
| `calculate()` never returns a partial result | `__init__.py` | not listed | **GAP** (cheap: assert exception, no result) |
| Pure functions, no I/O, no Supabase | all | none | **GAP** (acceptable; maybe a "no third-party imports" test since "no third-party dependencies" is a stated choice) |
| `MortgageResult` / `MortgageInput` frozen | `models.py` | none | **GAP**, low value |
| "Schedule rows used to test the private loop directly" | `golden/test_golden.py` | n/a | **ORPHAN-ish**: tests a private function, so any refactor of `_run_schedule` breaks tests without a behavior change. Also golden keys are camelCase (`downH`, `lastPayment`) while 02/03/04 use snake_case; the mapping is not mentioned. |
| `invariants` "as plain parametrized tests" | none | no file in the folder tree | **GAP in structure**: no file is assigned to them |

Orphans in modules: `models.py` lists a `Warning` model, but `warnings` is `list[str]` everywhere. Either the model is missing from section 5 or it should be removed from the folder tree.

### 1.2 Front-end (03)

| Requirement | Module | Test | Verdict |
|---|---|---|---|
| Parse `,`/`.`, ignore spaces, exact hundredths | `lib/parse.ts` | `parse.test.ts` | OK in principle, but cases are vague (see A9) |
| Local error for unparsable text | `parse.ts`, `NumberField.tsx` | parse unit only | **GAP**: no e2e that shows the inline local error, and no rule for what happens to the result panel while a local error exists |
| Cents -> `1 234,56 €` | `lib/format.ts` | `format.test.ts` | OK, see E9 (NBSP) |
| code -> text, unknown code fallback | `lib/messages.ts` | `messages.test.ts` | OK, but "every known code" is undefined: 04 adds 5 more codes (`invalid_name`, `bad_request`, `not_found`, `storage_unavailable`, `internal_error`) |
| Defaults on load show a result | `App.tsx` | e2e | OK |
| Debounce about 300 ms | `useDebouncedValue.ts` | e2e "updates after the debounce" | **GAP**: no unit test of the hook; "about 300 ms" is not testable as written |
| New request aborts the previous one | `useCalculation.ts` | none | **GAP** (explicitly a stated requirement, the most error-prone one) |
| Loading state keeps old numbers dimmed | `ResultPanel.tsx` | none | **GAP** |
| Field error hides the result | `ResultPanel.tsx` | e2e `out_of_range` | OK |
| Warning banner | `WarningBanner.tsx` | e2e 9.99 % | OK |
| Network/server error message, "retry on the next change" | `useCalculation.ts` | e2e "server error" | Partial: the retry part is not tested |
| `api/client.ts` typed fetch, error mapping | `api/client.ts` | none (e2e mocks at route level) | **GAP**: non-JSON reply, 503 body, timeout, abort are untested |
| Accessibility (labels, `aria-live`) | components | none | **GAP** |
| Hard-coded ranges in `messages.ts` | `messages.ts` | none | **GAP**: nothing detects drift from Python `BOUNDS` (the plan accepts the drift risk but offers no check) |
| `types.ts` mirrors the API contract | `api/types.ts` | none | **GAP**: only the API side has a contract test (see below) |

### 1.3 API (04)

| Requirement | Module | Test | Verdict |
|---|---|---|---|
| `POST /calculate` end to end | `routes/calculate.py` | one golden case + warning at 999/1000 | OK |
| Error table, 422 shapes, field order, 400, no `detail` | `errors.py` | `test_errors.py` | OK |
| 404 for non-UUID id | `routes/calculations.py` | listed | OK, but see A15 (FastAPI default for a typed path is 422) |
| 500 `internal_error`, no traceback, logged | `errors.py` | none | **GAP** |
| 404/405/415 and unknown routes return `{code}` not `detail` | `errors.py` | none | **GAP**: only 422 is checked for "no `detail`" |
| `GET /api/health` | `routes/health.py` | none | **GAP** (trivial, but it is in the endpoint table) |
| `DELETE` returns 204 | routes | create/get/delete test | OK; **DELETE of a missing id is undefined** (204, 404?) and untested |
| Name 1-80 chars after trimming | routes | "invalid name gives 422" | Partial: no tests for 0, 1, 80, 81 chars, whitespace-only, non-string, trimming |
| Extra unknown fields ignored | routes | none | **GAP** |
| Storage failure -> 503 | `storage.py` | `StorageError` test | OK |
| Supabase round trip | `SupabaseRepository` | opt-in integration test | OK (skipped by default, so CI never runs it) |
| RLS on, anon key cannot read/write | SQL migration | none | **GAP**: the main security claim (A8) is not tested |
| Static serving with fallback to `index.html` (step 5) | `main.py` | none | **GAP**: a whole numbered step with no test |
| Contract check against `03-frontend.md` | `schemas.py` | `test_calculate.py` | **ORPHAN-ish**: it compares to a constant "kept" in the test, not to the front-end file, so it only checks the API against itself. The front-end `types.ts` is never compared to it. |
| `created_at` is ISO 8601 UTC | `schemas.py` | none | **GAP** (format variants: `Z` vs `+00:00`, microseconds) |
| `GET` recomputes the result | routes | "result equals `/calculate`" | OK |
| Old row invalid after a bounds change -> 422 on GET | routes | none | **GAP** (and see C7) |
| Same origin, no CORS | `main.py` | none | **GAP**, low value |

### 1.4 Goal (01)

- 01 step 4 says the API stores/loads data "when needed". 02/03 never need it; only 04 does. See S1.
- 01 lists "user data" in Supabase. Nothing in 02-04 handles users. This is fine as "later" but is never stated as out of scope in 04's scope list.

## 2. Ambiguous requirements

Each entry: the text, two valid readings that produce different results, and a suggested single rule.

| ID | Sev | Where | Ambiguity | Reading A vs reading B | Suggested rule |
|---|---|---|---|---|---|
| A1 | H | 02 s6 step 5-6 | Early payoff. "A payment never exceeds `balance + interest`" and "the last installment is `balance + interest`". | A: stop the loop when the balance reaches 0, so fewer than n payments. B: always n payments, trailing ones are 0. A: `last_payment` is the last non-zero payment. B: `last_payment` is month n, i.e. 0. v1 reference (`min(pay, balance + interest)` for k < n, always n rows) gives B, golden `Overpay` has `lastPayment = 0`. | State B explicitly: "always n months, payment for month k < n is `min(pay, balance + interest)`, month n is `balance + interest`; `last_payment` is the n-th payment and can be 0". Add to the front-end plan how to show `0,00 €`. |
| A2 | H | 04 s3 rules | Type handling. "Request models do not use strict Pydantic ints" **and** "raw JSON values go to `mortgage_calc`". | A: the Pydantic model declares `int`: in lax mode `"150000"`, `150000.0`, `true` are **coerced** before Python sees them, so `not_integer` never fires. B: the model declares `Any`/dict and Python checks types. | Use a plain `dict` / `Any` fields and build `MortgageInput` with `body.get(...)`. Add a test for each of `"5"`, `5.0`, `true`, `null`, missing. |
| A3 | H | 04 s3 vs s4 | `MortgageInput(**body)` vs "missing field = `not_integer`" and "extra fields ignored". | A literal `**body` raises `TypeError` on a missing or extra key (a 500 or a default 422). | Spell out: `MortgageInput(price=body.get("price"), ...)`; `MortgageInput` must accept `None`. |
| A4 | H | 02 s7-8, 04 s3 | Order of checks in Python. | A: per field in order (price type, price range, down_h type, ...). B: all types first, then all ranges. Body `{price: 5, down_h: "x"}`: A gives `price/out_of_range`, B gives `down_h/not_integer`. | Pick A, write the order in 02 (04 only states it for the API) and test it in `test_validation.py`. |
| A5 | M | 04 s3 | Where `name` fits in the order and which layer validates it. "Validate, store" vs order `price, down_h, rate_h, years, name`. | A: name validated by the route after `calculate()`. B: by a Pydantic model before `calculate()`, so a bad name beats a bad price. | A, via the same handler, and say so. Also this is validation outside Python (see C4). |
| A6 | M | 04 s3 | `name` length. "1-80 characters after trimming". | Trimming: ASCII spaces only or Unicode whitespace? Characters: code points, UTF-16 units, or graphemes (emoji)? Is the trimmed or the original value stored? SQL check uses `char_length` of the stored value. | Define: strip Unicode whitespace, count code points, store the trimmed value. Test 80 vs 81 and an emoji. |
| A7 | M | 04 s3 | Non-string `name` (number, null, missing, list). | `invalid_name` vs `not_integer` vs 400. | `invalid_name` for all of them. |
| A8 | M | 02 s7 | Bounds inclusive? The table has "Min" and "Max", units are in % but the code uses hundredths. | Is `down_h = 9000` valid? Is `rate_h = 1500`? Is 15.00 % the same as `rate_h = 1500`? | Write the table in code units: `10000..2000000`, `0..9000`, `0..1500`, `1..40`, all inclusive. |
| A9 | M | 03 s7 | Parsing rules. Examples that give different values in two valid parsers: `1.500` (1.5 or 1500?), `150.000` (150 or 150 000, Slovak users type this), `1,234.56`, `4.` / `4,` / `.5`, `+4`, `-4`, `1e3`, `04`, `150 000,5` in the whole-euros field, `30.5` years, a typed `%` or `€`, **NBSP (U+00A0) and narrow NBSP (U+202F)** (which `Intl` itself outputs and users copy). | See left | Write a grammar: optional spaces/NBSP as group separators, at most one `,` or `.` as decimal separator, digits only, no sign, no exponent. Integer fields (price, years) reject any decimal part locally. Then list 15 table-driven cases in `parse.test.ts`. State clearly that `150.000` means 150. |
| A10 | M | 03 s7 | Debounce "about 300 ms" and what is debounced. | Debounce the raw text or the parsed value? Does a local parse error appear immediately or after the delay? Is the first request for the defaults sent at once or after 300 ms? | Debounce the parsed value; local errors immediate; first request immediate; use the exact constant `300` so the test can use fake timers. |
| A11 | M | 03 s4 | What the result panel shows when several things are true at once: old result + loading + local error on a different field + API error on another field; a warning is returned with a stale result. | Which one wins is not defined. | Table of states with priority: local error > API field error > network error > loading > ok. |
| A12 | M | 03 s4 | "network/server error (one message above the result ...)". Is the old result kept or hidden? Does an aborted request count as an error? | Result visible or hidden. | Hide results, ignore `AbortError`. |
| A13 | M | 04 s3 | `DELETE` of a nonexistent id. | 204 (idempotent) vs 404 `not_found`. The `Repository.delete -> bool` suggests the route reports it, the table does not list DELETE. | 404, add to the table and a test. |
| A14 | L | 04 s3 | JSON number forms: `150000.0` and `1e5` in the body (Python `json` makes them `float`). | `not_integer` vs accepted as an integer. | Reject (consistent with 02 "must be integers") and add a test. Note `JSON.stringify(150000.0)` gives `150000`, so the front-end never sends this. |
| A15 | L | 04 s3 | "Id that is not a UUID gives 404". If the path parameter is typed `UUID`, FastAPI answers 422 (default) before the route runs. | 422 vs 404. | Declare the path param as `str` and parse manually, or add a handler. Test it. |
| A16 | L | 04 s4 | "calculate() again (or reuse the first result)". | Same output either way, but two code paths. | Reuse. |
| A17 | L | 04 s3 | `created_at` format. | `...Z` vs `+00:00`, with or without microseconds. | `2026-10-15T12:00:00Z`, no fraction; test it. |
| A18 | L | 02 s5 | `warnings` order and uniqueness. | Only one warning exists today, but a list type invites a second. | "Sorted, unique". |
| A19 | L | 03 s7 | `format.ts` uses `Intl.NumberFormat('sk-SK')` on a value derived from cents. | The exact output string differs by ICU build and Node version (grouping with NBSP, `1234,56` without grouping in some locales). The example in the doc uses a normal space. | Test against ` ` and pin the Node version, or hand-roll the format from integer cents (no float division). |
| A20 | L | 04 s5 | `SupabaseRepository` sync vs async. | A blocking client inside `async def` routes blocks the event loop; with `def` routes it runs in the thread pool. | Say: routes are plain `def`. Also set a timeout on every Supabase call; otherwise 503 is never reached on a hang. |

## 3. Missing edge cases and invalid inputs

### 3.1 Calculations

- **E1 Early payoff** (`Overpay`: 10 000 €, 90 % down, 4.5 %, 40 y): payment 450, `last_payment` 0. Needs an explicit requirement (A1) and a front-end rule for showing a 0 last payment.
- **E2 Zero rate remainder.** Example: loan 1 000 €, 40 years, 0 %. The regular payment is 208 cents (2,08 €), the last is 368 cents (3,68 €), because the rounded payment times 479 leaves up to n/2 cents over. "Differs slightly" in 02 is wrong for small loans (77 % higher here). No golden case has rate 0. Add one, and say that this is accepted v1 behavior.
- **E3 Rate 0.01 %** (`rate_h = 1`): `(1 + r)^-n` is very close to 1, so the denominator is tiny. With `Fraction` this is exact, but the size of the numbers (about 2400 digits for n = 480) makes the call slower than "fast". Measure it and add a performance guard test, because the front-end calls it on every debounce.
- **E4 Boundaries not in golden:** 1 year, 1 month term via `years = 1`, `years = 40` with 0 %, `down_h = 0` and `9000`, `price` min and max, rate min and max (`Max` and `Big jump` cover only the 15 %/40 y/0 % combination).
- **E5 Inputs outside the declared types:** `True`/`False`, `1.0`, `"1"`, `None`, `[]`, `{}`, `float('nan')`/`inf` (not valid JSON but possible via Python callers), integers with more than 4300 digits (Python refuses to convert them and raises `ValueError`, which would become a 500, not `out_of_range`), negative numbers, `-0`.
- **E6 Rates that cannot be expressed:** `rate_h` is an integer in hundredths, so 3,875 % is not possible. This is a deliberate limit (v1: "up to 2 decimals") but should be written down as a requirement, because a user will type it.
- **E7 Warning plus error:** a request with `down_h = 500` and an invalid `years` must return only the error (no warning).

### 3.2 API

- **E8 Bodies:** empty body, `[]`, `"string"`, `null`, JSON with a BOM, wrong `Content-Type` (`text/plain` with valid JSON), extremely large body, deeply nested JSON, duplicate keys.
- **E9 Methods and routes:** `GET /api/calculate`, `POST /api/health`, unknown `/api/xyz`, trailing slash `/api/calculations/`. FastAPI answers 404/405/307 with `detail` bodies, which breaks the "no `detail`" rule. With the static fallback (step 5), an unknown `/api/...` path could return `index.html` with status 200, so the front-end would try to parse HTML as JSON.
- **E10 Names:** only whitespace, 80/81 characters, emoji, control characters, newlines, HTML/script text (React escapes it, but the doc should say names are rendered as text only), the same name twice, a name that is a number.
- **E11 Saved calculation state:** a row whose inputs became invalid after a bounds change (GET gives 422 with a `field`, but the front-end has no form to put it on; also there is no way to fix the row, only to delete it); deleting twice; concurrent create/delete; id of the right shape but nonexistent.
- **E12 Storage:** Supabase timeout/hang (no timeout is specified), partial failure after insert but before the response (client retries and creates a duplicate; POST is not idempotent), wrong or missing env vars at startup (fail fast or fail at first request?), service key rotated, `gen_random_uuid()` collision (negligible).
- **E13 Abuse:** anonymous unauthenticated `POST /calculations` lets anyone fill the table (O3 says "none now"). At least a body size limit and a name limit are cheap, and a row cap or per-IP rate limit should be a conscious decision, not a default.
- **E14 Static serving:** missing `STATIC_DIR` (API-only mode), path traversal in the static handler, caching headers for `index.html` vs hashed assets, `HEAD` requests, a deep link such as `/c/<id>` for a shared calculation (needs the front-end to have a router; 03 has none).

### 3.3 Front-end

- **E15 Empty and partial text** while typing: `""`, `"4,"`, `"-"`. Does each keystroke produce a local error flash? Combine with A10.
- **E16 Locale and paste:** NBSP in pasted values, pasted `150 000 €`, `4,5 %`, IME/Unicode digits (Arabic-Indic, full-width), leading zeros.
- **E17 Very long input** (10 000 characters) in a field.
- **E18 API failures:** HTML instead of JSON (proxy or static fallback), `200` with an unexpected body shape, `422` with an unknown `code`, `422` with `field: "name"` or no `field` (04 s9 adds these but 03 does not handle them), request taking longer than the next debounce (race), API down at first load (page must still render the form), response order inversion (covered by abort, but untested).
- **E19 Browser state:** `localStorage` disabled (private mode, quota), because O1's default depends on it; corrupted stored id list; invalid id in a shared link.
- **E20 Display values:** `last_payment = 0`, the largest values (`total_paid` about 4 million €, still safe in a float, but state the limit), negative zero from float division, and `Intl` output when the user's browser locale differs from `sk-SK` (the code fixes the locale, so it is consistent; state that on purpose).
- **E21 StrictMode** double effects in development must not send duplicate requests or leave a pending abort.

## 4. Consistency: do all parts go toward the same goal?

The core goal (01) is a mortgage calculator with front-end, API, Python calculations and Supabase. 02 and 03 are aligned with it. The drift is in 04 and in stale statements.

| ID | Sev | Finding |
|---|---|---|
| C1 | H | **Scope creep in 04 (S1).** 02 Q2: "No new features, the math is a port of v1". v1 s6: saving/sharing is out of scope. 03 F2: "calculator only. No saved calculations". 04 A4 adds create/get/delete saved calculations, a table, a repository abstraction, an in-memory implementation and an integration test, but 03 gets no component, hook, route, localStorage handling or e2e test for it. Result: roughly half of 04's work (steps 3-4) has no consumer. Decide: (a) add saving to 03 with a UI plan and tests, or (b) cut steps 3-4 from 04 and keep Supabase as a later phase, or (c) keep the API part but mark it explicitly as "API only, no UI in this release". |
| C2 | H | **Supabase is in the goal (01) but in practice optional.** Without C1 being resolved, the system in 01 step 4 ("API stores or loads data when needed") is not actually used by the product. The architecture diagram in 01 should reflect what is built first. |
| C3 | M | **Documents contradict each other.** 03 F2 (no saving) vs 04 A4 (saving); 03 s6 `ApiError` lacks `name` and field-less errors; 03 `messages.ts` lacks 5 new codes; 03 s9 order of work does not know about the API plan. 04 s9 lists these changes but nobody owns them. Either update 03 in the same change or mark 03 as outdated at the top. |
| C4 | M | **"Validation only in Python" (02 Q5, 04 A3) is broken by `name`.** The `name` check lives in the API. That is reasonable, but the rule "the API does no validation" is then false. State: "the API validates only what is not part of the mortgage model (`name`)". |
| C5 | M | **Single source of truth for bounds.** Python `BOUNDS` is the truth, but 03 hard-codes the ranges in `messages.ts` and shows them in the UI. A change in Python silently makes the UI lie. Cheapest fix: an optional `GET /api/limits` (or include `min`/`max` in the 422 body) and a contract test; otherwise add a test that parses the front-end constants and compares them with `BOUNDS`. |
| C6 | M | **Contract is duplicated three times** (02 interface, 03 s6 types, 04 types) with a "contract test" that compares only the API to a constant. Pick one source (for example the FastAPI OpenAPI file, with `types.ts` generated or checked against it). |
| C7 | M | **Stored inputs + recompute (A7) vs v1 rules.** Recomputing on read keeps Python as the only calculator, but it makes a saved item fail with 422 if the bounds ever change, and it makes the stored result change silently if the rounding rules ever change. Both are consistent with the stated principle but are not mentioned as a conscious trade-off. A `rules_version` column would make this explicit. |
| C8 | M | **v1 features dropped without a list.** 03 s3 drops FR3-FR5 but not FR9 (full schedule in a scrollable container); FR7 changed meaning ("no results are calculated" becomes "the API rejects it, the UI hides the result"). A short "v1 FR -> v2 status" table would remove the doubt. |
| C9 | L | **Stale status lines.** 02, 03, 04 all say "Not committed yet", but they are committed. 02 says "draft, all questions answered" and 03/04 say "draft". |
| C10 | L | **Folder tree vs text (02).** `models.py` lists `Warning`; section 5 has no such type. No file for invariants in the test tree. |
| C11 | L | **Tooling rule.** 02 Q7 "pytest only" vs 04 adds `httpx` (explained) and the front-end adds Vitest, Playwright and Vite (fine, different language). The rule should say "pytest only for Python". |
| C12 | L | **01 diagram** shows the Python calculations as a separate box the API "asks". 02 Q1 makes it a library imported by the API. Update the diagram wording to avoid readers assuming a network hop. |
| C13 | L | **Integration risk.** Nothing tests the whole chain (front-end build served by the API talking to the real Python package). The only whole-system test would be a Playwright run against the real API, which 03 deliberately avoids (mocked). One smoke test is enough. |

What is consistent and good: units (cents and hundredths) are the same in 02, 03, 04; error codes are code-only everywhere; the API does not hold bounds; the front-end does not calculate; the Repository abstraction keeps tests offline; the order of work (04 s8) lets the front-end start after step 2.

## 5. Recommended actions, in order

1. **Decide the scope of saving** (C1). Everything else in 04 depends on it.
2. **Fix 02**: A1 (early payoff rule), A4 (validation order), A8 (bounds in code units, inclusive), E2 (zero-rate remainder), add tests for `not_integer` variants and `field` in `ValidationError`, assign a file for invariants, remove `Warning` or define it.
3. **Fix 04 section 3**: A2/A3 (how raw JSON reaches Python), A13 (DELETE missing), A15, A6/A7 (name), handlers for 404/405/415 without `detail` (E9), a size limit on the body, Supabase timeout (A20).
4. **Fix 03**: the parsing grammar (A9), debounce details (A10), state priority table (A11, A12), tests for abort, loading, client errors, a11y; add the new error codes.
5. **Add a "v1 -> v2" feature table** and update statuses and the 01 diagram (C8-C12).
6. **Add one end-to-end smoke test** against the real API (C13), and a drift test for bounds (C5) and for the contract (C6).
