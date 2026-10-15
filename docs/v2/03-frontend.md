# Front-end: plan and structure

Status: **draft**. Not committed yet.

Based on `docs/v2/01-goal.md` (the front-end collects inputs and shows results; it talks only to the API), `docs/v2/02-calculations.md` (what the API will return) and the v1 UI in `docs/v1/01-functional.md`.

## 1. Decisions

| # | Decision |
|---|---|
| F1 | Stack: **React + Vite + TypeScript**. |
| F2 | Scope now: **calculator only** (form + totals + warnings). No saved calculations, no login. These come later with Supabase. |
| F3 | Results update **live with debounce** (about 300 ms after the user stops typing). No Calculate button. |
| F4 | UI language **English**, numbers in **Slovak format** (`1 234,56 €`). One map from codes to texts. |
| F5 | Tests: **Vitest** (unit) + **Playwright** (end-to-end). |
| F6 | Styling: **plain CSS**, reusing the look of v1 `styles.css`. No UI library. |
| F7 | The API does not exist yet, so the **front-end is built after the API**. This document only fixes the plan and the contract it expects. |
| F8 | The front-end only **parses and converts units**. All math and all validation stay in Python. |

## 2. Responsibility

- Show four inputs, send them to the API, show the answer.
- Convert typed text to API units and cents back to display text. This is formatting, not calculation.
- Map error and warning **codes** from the API to English texts (02-calculations section 8).
- It does **not** calculate anything and does **not** validate ranges. Out-of-range input is sent to the API, and the `out_of_range` error is shown next to the field.
- It does not talk to Supabase directly. Only to the API.

## 3. What disappears from v1

Because results are totals only (02-calculations Q4), v1 features **FR3 to FR5 (amortization table, two charts) are not in v2**. Chart.js is not needed. v1 FR1, FR2, FR6, FR7, FR8 stay.

## 4. Screen

One page, one component tree:

```
┌ Mortgage calculator ─────────────────────────────┐
│ Inputs                    │ Result               │
│  Property price   [ € ]   │  Loan amount         │
│  Down payment     [ % ]   │  Monthly payment     │
│  Interest rate    [ % ]   │  Last payment        │
│  Term             [ y ]   │  Total paid          │
│                           │  Total interest      │
│  (field errors inline)    │  (warning banner)    │
└──────────────────────────────────────────────────┘
```

States of the result panel: **loading** (keeps the old numbers dimmed), **ok**, **field error** (result hidden, error shown at the field), **network/server error** (one message above the result with a retry on the next change).

Defaults, as in v1: price 150 000 €, down payment 20 %, rate 4 %, term 30 years. The form is pre-filled, so the result shows right after load.

## 5. Folder structure

```
app-v2/
  frontend/
    package.json
    vite.config.ts
    tsconfig.json
    index.html
    src/
      main.tsx
      App.tsx
      api/
        client.ts          # calculate(input) -> fetch to the API, typed
        types.ts           # request/response types (mirror of 02 interface)
      components/
        CalculatorForm.tsx
        NumberField.tsx    # label, input, inline error
        ResultPanel.tsx
        WarningBanner.tsx
      hooks/
        useDebouncedValue.ts
        useCalculation.ts  # debounce, call API, abort the previous request
      lib/
        parse.ts           # "4,25" / "4.25" -> 425 (hundredths), "150 000" -> 150000
        format.ts          # cents -> "1 234,56 €", Slovak style
        messages.ts        # code -> text map (errors and warnings)
      styles/
        styles.css         # ported from v1
    tests/
      unit/
        parse.test.ts
        format.test.ts
        messages.test.ts
      e2e/
        calculator.spec.ts
```

## 6. Contract expected from the API

The front-end depends only on this. It is a mirror of 02-calculations and must be confirmed when the API is designed.

```ts
type CalculateRequest = {
  price: number;   // whole euros
  down_h: number;  // hundredths of a percent, 2000 = 20 %
  rate_h: number;  // hundredths of a percent, 400 = 4 %
  years: number;
};

type CalculateResponse = {
  loan: number;           // cents
  payment: number;        // cents
  last_payment: number;   // cents
  total_paid: number;     // cents
  total_interest: number; // cents
  warnings: string[];     // e.g. "low_down_payment"
};

type ApiError = { field: "price" | "down_h" | "rate_h" | "years"; code: "not_integer" | "out_of_range" };
```

The API sends field names in API units. The front-end maps `down_h` to the "Down payment" field, and so on.

## 7. Key behaviors

- **Parsing** (`parse.ts`): accepts `,` and `.` as the decimal separator (the open question in v1, answered "yes") and ignores spaces. Percent values are converted to hundredths with string/integer handling, not float multiplication, so `4.35` becomes `435` exactly. Text that cannot be parsed (empty, letters, more than 2 decimals) shows an inline error locally; this is a format error, not a range check.
- **Debounce and races**: each change restarts a ~300 ms timer. A new request aborts the previous one (`AbortController`), so an old answer cannot overwrite a newer one.
- **Display** (`format.ts`): cents to `1 234,56 €` using `Intl.NumberFormat('sk-SK', { style: 'currency', currency: 'EUR' })` on a value derived from integer cents.
- **Messages** (`messages.ts`): `low_down_payment` shows a warning banner; `out_of_range` shows the allowed range next to the field. The allowed ranges are hard-coded display text in the front-end (a copy of `BOUNDS`), and a note in this file says the Python `BOUNDS` stay the source of truth. If they drift, the API still rejects the value.
- **Accessibility**: labels tied to inputs, errors announced with `aria-live`, results in a live region.

## 8. Testing

- **Vitest**: `parse` (comma/dot, spaces, too many decimals, empty), `format` (rounding is not needed, only cents formatting; zero, large values), `messages` (every known code has a text; unknown code gets a generic fallback).
- **Playwright**: runs against a **mocked API route** so the e2e tests do not depend on the real API. Cases: defaults show a result on load; typing a new price updates the result after the debounce; `out_of_range` shows the inline error; 9.99 % down payment shows the warning; server error shows the error message.
- The real calculation correctness is already covered by the Python golden tests, so the front-end does not repeat it.

## 9. Order of work (after the API exists)

1. Scaffold `app-v2/frontend` (Vite, TypeScript, Vitest, Playwright).
2. `lib/parse.ts`, `lib/format.ts`, `lib/messages.ts` with unit tests (no API needed).
3. `api/client.ts` against the real API.
4. Components and hooks, port `styles.css`.
5. Playwright tests.

Steps 1 and 2 do not need the API, so they can start earlier if wanted.
