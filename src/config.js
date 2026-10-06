// Bounds are stored as integers: price in whole euros, percentages in hundredths
// of a percent ("H" suffix), term in whole years.
export const BOUNDS = {
  price: { min: 10000, max: 2000000 },
  down: { min: 0, max: 9000 },
  rate: { min: 0, max: 1500 },
  years: { min: 1, max: 40 },
};

// Raw strings, exactly as they appear in the inputs on load.
export const DEFAULTS = {
  price: '150000',
  down: '20',
  rate: '4',
  years: '30',
};

// A down payment strictly below this (in hundredths of a percent) shows a warning.
export const LOW_DOWN_PAYMENT_H = 1000;
