// Annuity mortgage maths in integer cents, rounding half-up everywhere.
// The only float step is the regular payment (Math.pow), rounded once.

// round(balance * rateH / 120000) in integers; exact ties round up.
export function interestCents(balance, rateH) {
  return Math.floor((2 * balance * rateH + 120000) / 240000);
}

// price: whole euros, downH / rateH: hundredths of a percent, years: whole years.
export function calculate({ price, downH, rateH, years }) {
  const loan = Math.floor((2 * price * (10000 - downH) + 100) / 200);
  const n = years * 12;
  const r = rateH / 120000;
  const exact = rateH === 0 ? loan / n : (loan * r) / (1 - Math.pow(1 + r, -n));
  const regular = Math.floor(exact + 0.5);

  const schedule = [];
  let balance = loan;
  let totalPaid = 0;
  for (let month = 1; month <= n; month++) {
    const interest = interestCents(balance, rateH);
    const payment = month === n ? balance + interest : Math.min(regular, balance + interest);
    const principal = payment - interest;
    balance -= principal;
    totalPaid += payment;
    schedule.push({ month, payment, principal, interest, balance });
  }
  return { loan, payment: regular, totalPaid, totalInterest: totalPaid - loan, schedule };
}
