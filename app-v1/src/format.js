const NBSP = '\u00a0';

// Integer cents -> Slovak format with non-breaking spaces: "1 234,56 €".
export function formatEur(cents) {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  const euros = Math.floor(abs / 100);
  const rest = String(abs % 100).padStart(2, '0');
  const grouped = String(euros).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${sign}${grouped},${rest}${NBSP}€`;
}
