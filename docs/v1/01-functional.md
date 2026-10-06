# Mortgage Calculator v1: Functional Specification

## 1. Project goal

A personal and learning project. It is a static web page that calculates an annuity mortgage. The priority is correct math and clean, testable code.

## 2. Technical scope

- Static page in vanilla HTML, CSS and JavaScript, with no build step and no backend.
- Charts are drawn with Chart.js loaded from a CDN.
- The calculation logic is a separate pure JS module, tested with Vitest. Node and npm are needed only for development and tests.
- Current evergreen browsers only.
- The UI language is English. Numbers are formatted in Slovak style (`1 234,56 €`).

## 3. Functional requirements

- **FR1.** Calculate the monthly payment (annuity).
- **FR2.** Show the total amount paid and total interest.
- **FR3.** Show an amortization schedule, one row per month: month number, payment, principal, interest, remaining balance.
- **FR4.** Show a chart of the remaining balance over time.
- **FR5.** Show a chart of principal vs. interest per month.
- **FR6.** Results update live as the user types, with no "Calculate" button.
- **FR7.** Invalid or out-of-range input shows an inline error next to the field, and no results are calculated.
- **FR8.** The form is pre-filled with defaults (see section 4), so results show immediately.
- **FR9.** The schedule is shown in full (up to 480 rows) in a scrollable container.

## 4. Inputs and bounds

| Input | Min | Max | Format | Default |
|---|---|---|---|---|
| Property price | 10 000 € | 2 000 000 € | whole euros | 150 000 € |
| Down payment | 0 % | 90 % | percent | 20 % |
| Annual interest rate | 0 % | 15 % | up to 2 decimals | 4 % |
| Loan term | 1 year | 40 years | whole years | 30 years |

EUR is the only currency. A down payment below 10 % is allowed but shows a warning.

## 5. Domain rules

1. Loan amount `L = price × (1 − down payment %)`.
2. Monthly rate `r = annual rate / 12`. This is a nominal rate with monthly compounding (not an effective APR). The number of payments is `n = years × 12`.
3. Annuity payment `M = L · r / (1 − (1+r)^−n)`. If the rate is 0 %, then `M = L / n`.
4. The payment is rounded to cents.
5. Each schedule row: interest = balance × r, principal = payment − interest, new balance = balance − principal.
6. Because of rounding, the last installment is adjusted so the final balance is exactly 0.00.
7. Total paid = sum of all installments. Total interest = total paid − L.
8. The schedule uses month numbers 1..n, with no calendar dates.

## 6. Out of scope for v1

- Extra payments or early repayment
- Fees, insurance, other costs, and effective APR (RPMN)
- Fixed-rate periods or rate changes over time
- Differential (declining) payment type
- Saving, exporting (CSV or PDF) or sharing results
- Multiple currencies and localization (one fixed UI language)
- Backend, user accounts, and persistence
- Bank-specific rules (such as an LTV or DSTI income check)
- Side-by-side scenario comparison

## 7. Open questions

- Slovak number format in the UI with an English-language interface: should the decimal input accept both `,` and `.`? (Proposed: yes.)
- Whether a minimum down payment should become a hard limit in a later version (for example, 10 % or 20 % under Slovak LTV rules).
- Whether to add a calendar start date to the schedule in v2.
