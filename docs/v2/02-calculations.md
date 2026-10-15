# Python calculations: specification and structure

Status: **draft, all questions answered**. Not committed yet.

Based on `docs/v2/01-goal.md` (the Python calculations part receives inputs from the API and returns computed results) and on the v1 rules in `docs/v1/01-functional.md` section 5.

## 1. Decisions

| # | Decision |
|---|---|
| Q1 | The API is written in Python and **imports the calculations package directly** (no separate calculation service). |
| Q2 | No new features. The math is a port of the v1 rules. |
| Q3 | Python is the **only** source of calculations. The front-end does not calculate anything. |
| Q4 | The result contains **totals only**. No amortization schedule is returned. |
| Q5 | Validation lives **only in Python** (including the low down payment warning). |
| Q6 | Python knows nothing about Supabase. It communicates only through the API. |
| Q7 | Tooling is `pytest` only. No linters or type checkers. |
| Q8 | New top-level folder `app-v2/`, with the calculations in `app-v2/calculations/`. The v1 app stays untouched. |
| R2 | `app-v2/calculations/` has its own `pyproject.toml` (standalone installable package). |
| R3 | Errors and warnings are code-only, no message text. |

## 2. Responsibility

The Python part does the mortgage math and the input validation, and nothing else.

- It does **not** talk to Supabase, the front-end or the network.
- It does **not** format numbers for display (no `1 234,56 €`).
- It is a set of pure functions: same input, same output, no side effects.

## 3. Technical choices

| Topic | Choice | Why |
|---|---|---|
| Python version | 3.12+ | Current, good typing support |
| Money | Integer cents (`int`) | Same approach as v1 `src/calc.js`, no float drift |
| Rates and the annuity formula | `fractions.Fraction` | Exact math, as in `tests/reference/reference.py` |
| Rounding | Round half up, in one helper | Python's built-in `round()` is banker's rounding and must not be used |
| Models | `dataclass(frozen=True)` | No third-party dependencies in the core |
| Tests | `pytest` | Only dev dependency |

The v1 rules stay the same: nominal annual rate / 12, half-up rounding to cents, the last installment adjusted so the final balance is exactly 0.

## 4. Folder structure

```
app-v2/
  calculations/
    pyproject.toml
    src/
      mortgage_calc/
        __init__.py        # public API: calculate()
        models.py          # MortgageInput, MortgageResult, Warning
        rounding.py        # round_half_up(Fraction) -> int
        annuity.py         # loan amount, regular payment, internal schedule loop
        validation.py      # BOUNDS, input checks, warnings
        errors.py          # ValidationError with field + code
    tests/
      unit/
        test_rounding.py
        test_annuity.py
        test_validation.py
      golden/
        golden.json        # copy of tests/golden/golden.json from v1
        test_golden.py
```

The API (written later, in `app-v2/api/`) will import `mortgage_calc`. The front-end will live in its own folder as well. Those are outside the scope of this document.

## 5. Public interface

One entry point. Inputs use the same units as v1 (price in whole euros, percentages in hundredths of a percent).

```python
@dataclass(frozen=True)
class MortgageInput:
    price: int        # whole euros
    down_h: int       # hundredths of a percent, e.g. 2000 = 20 %
    rate_h: int       # hundredths of a percent, e.g. 400 = 4 %
    years: int        # whole years

@dataclass(frozen=True)
class MortgageResult:
    loan: int            # cents
    payment: int         # cents, regular monthly installment
    last_payment: int    # cents (differs slightly because of rounding)
    total_paid: int      # cents
    total_interest: int  # cents
    warnings: list[str]  # stable codes, e.g. "low_down_payment"

def calculate(data: MortgageInput) -> MortgageResult: ...
```

Rules:

- `calculate` raises `ValidationError` for out-of-range input. It never returns a partial result.
- Money leaves the module as integer cents. Converting to euros or text is the job of the front-end.
- `warnings` holds codes, not display text. The front-end decides the wording.

## 6. Calculation steps

1. Validate input against the bounds (section 7).
2. `loan = round_half_up(price * 100 * (10000 - down_h) / 10000)` in cents.
3. `n = years * 12`, `r = Fraction(rate_h, 120000)`.
4. Regular payment: `loan / n` if the rate is 0, otherwise `loan * r / (1 - (1 + r) ** -n)`, rounded half up once.
5. Run the month-by-month loop **internally**: interest = `round_half_up(balance * r)`, principal = payment - interest, new balance = balance - principal. A payment never exceeds `balance + interest`.
6. The last installment is `balance + interest`, so the final balance is exactly 0.
7. Totals: `total_paid = sum(payments)`, `total_interest = total_paid - loan`.

**Why the loop is still needed:** the totals depend on rounding in every month, so they cannot be taken from a closed formula without drifting by a few cents from v1. The loop lives in a private function `_run_schedule` in `annuity.py`. Only the totals leave the module. If a schedule is ever wanted again, that function can be exposed without changing the math.

## 7. Validation

Bounds are the v1 values, kept in one `BOUNDS` constant:

| Field | Min | Max |
|---|---|---|
| price | 10 000 € | 2 000 000 € |
| down payment | 0 % | 90 % |
| annual rate | 0 % | 15 % |
| years | 1 | 40 |

- All four fields must be integers (`bool` is rejected).
- Down payment below 10 % (`down_h < 1000`) is allowed and adds the warning `low_down_payment`.

## 8. Error handling

- `ValidationError(field, code)` with stable codes: `not_integer`, `out_of_range`. Errors and warnings are **code-only**: no message text; the front-end decides the wording.
- The API maps it to an HTTP 4xx response with the field and code; the front-end shows it next to the field.
- Any other exception is a bug and surfaces normally.

## 9. Testing (pytest only)

- **Golden tests**: for every case in `golden.json`, compare `loan`, `payment`, `last_payment`, `total_paid`, `total_interest`. The schedule rows in the file are used to test the private loop directly, so the internals are still verified month by month.
- **Unit tests**: rounding at exact .5, zero rate, one-year term, 40-year maximum, each bound (min, max, one outside), warning at 9.99 % and not at 10 %.
- **Invariants** as plain parametrized tests: final balance is 0; the sum of principal equals the loan; `total_paid == sum(payments)`.

## 10. Consequences to be aware of

- **v2 has no amortization table and no charts** (v1 FR3-FR5), because Q4 says totals only. If these should return later, the schedule has to be exposed and the API/front-end extended.
- **Live updates while typing** (v1 FR6) now need an API call per change. This is the front-end/API's concern, and a debounce will probably be needed. The Python function itself is fast (at most 480 loop steps).
