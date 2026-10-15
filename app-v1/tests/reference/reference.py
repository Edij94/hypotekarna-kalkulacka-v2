"""Independent exact-arithmetic reference for the mortgage calculator.

Uses fractions.Fraction only (no floats) and the same rules as docs/v1/05-plan.md
section 2.1. Writes tests/golden/golden.json.
Run: python tests/reference/reference.py
"""
import json
from fractions import Fraction
from pathlib import Path


def round_half_up(x: Fraction) -> int:
    return (2 * x.numerator + x.denominator) // (2 * x.denominator)


# name, price (EUR), down (hundredths of %), rate (hundredths of %), years
CASES = [
    ("Default", 150000, 2000, 400, 30),
    ("Rate 5", 150000, 2000, 500, 30),
    ("Rate 4.25", 150000, 2000, 425, 30),
    ("Max", 2000000, 0, 1500, 40),
    ("Big jump", 10001, 0, 1500, 40),
    ("Fractional-cent loan", 10001, 1255, 400, 7),
    ("Rounded-up loan", 10001, 3300, 400, 7),
    ("Overpay", 10000, 9000, 450, 40),
]


def schedule_for(price, down_h, rate_h, years):
    loan = round_half_up(Fraction(price * (10000 - down_h), 100))
    n = years * 12
    r = Fraction(rate_h, 120000)
    if rate_h == 0:
        m = Fraction(loan, n)
    else:
        m = loan * r / (1 - (1 + r) ** (-n))
    pay = round_half_up(m)
    balance = loan
    rows = []
    for k in range(1, n + 1):
        interest = round_half_up(balance * r)
        payment = balance + interest if k == n else min(pay, balance + interest)
        principal = payment - interest
        balance -= principal
        rows.append([k, payment, principal, interest, balance])
    total_paid = sum(row[1] for row in rows)
    return {
        "loan": loan,
        "payment": pay,
        "lastPayment": rows[-1][1],
        "totalPaid": total_paid,
        "totalInterest": total_paid - loan,
        "schedule": rows,
    }


def main():
    out = []
    for name, price, down_h, rate_h, years in CASES:
        out.append({"name": name, "price": price, "downH": down_h,
                    "rateH": rate_h, "years": years,
                    **schedule_for(price, down_h, rate_h, years)})
    path = Path(__file__).resolve().parent.parent / "golden" / "golden.json"
    path.write_text(json.dumps(out, indent=1) + "\n", encoding="utf-8", newline="\n")


if __name__ == "__main__":
    main()
