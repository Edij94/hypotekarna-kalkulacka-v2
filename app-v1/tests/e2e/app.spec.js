import { test, expect } from '@playwright/test';
import { calculate } from '../../src/calc.js';
import { formatEur } from '../../src/format.js';

const N = ' ';
const MONEY = /^\d{1,3}( \d{3})*,\d{2} €$/;
const FIELDS = { price: '150000', down: '20', rate: '4', years: '30' };

const payment = (page) => page.locator('[data-summary="payment"]');
const totalPaid = (page) => page.locator('[data-summary="totalPaid"]');
const rows = (page) => page.locator('#schedule tbody tr');
const chartPoints = (page, id) =>
  page.evaluate((i) => Chart.getChart(document.getElementById(i)).data.datasets.map((d) => d.data.length), id);

let errors;
test.beforeEach(async ({ page }) => {
  errors = [];
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  page.on('pageerror', (e) => errors.push(String(e)));
});

test('E-01 defaults on load', async ({ page }) => {
  await page.goto('/');
  for (const [k, v] of Object.entries(FIELDS)) await expect(page.locator(`#${k}`)).toHaveValue(v);
  await expect(payment(page)).toHaveText(`572,90${N}€`);
  await expect(rows(page)).toHaveCount(360);
  expect(await chartPoints(page, 'balance-chart')).toEqual([360]);
  expect(await chartPoints(page, 'flow-chart')).toEqual([360, 360]);
  await expect(page.getByRole('button', { name: /calculate/i })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test('E-02 rate 4 to 5', async ({ page }) => {
  await page.goto('/');
  await page.fill('#rate', '5');
  await expect(payment(page)).toHaveText(`644,19${N}€`);
  await expect(totalPaid(page)).toHaveText(`231${N}904,97${N}€`);
});

test('E-03 invalid price shows error and clears results', async ({ page }) => {
  await page.goto('/');
  await page.fill('#price', '5000');
  await expect(page.locator('[data-field="price"] .error')).not.toBeEmpty();
  await expect(payment(page)).toHaveText('—');
  await expect(rows(page)).toHaveCount(0);
  expect(await chartPoints(page, 'balance-chart')).toEqual([0]);
  expect(await chartPoints(page, 'flow-chart')).toEqual([0, 0]);
});

test('E-04 recovering from an invalid price', async ({ page }) => {
  await page.goto('/');
  await page.fill('#price', '5000');
  await page.fill('#price', '150000');
  await expect(page.locator('[data-field="price"] .error')).toBeEmpty();
  await expect(payment(page)).toHaveText(`572,90${N}€`);
  await expect(rows(page)).toHaveCount(360);
});

test('E-05 low down payment warns', async ({ page }) => {
  await page.goto('/');
  await page.fill('#down', '5');
  await expect(page.locator('[data-field="down"] .warning')).toBeVisible();
  await expect(payment(page)).not.toHaveText('—');
});

test('E-06 comma and dot decimals agree', async ({ page }) => {
  await page.goto('/');
  await page.fill('#rate', '4,5');
  const comma = await page.locator('#summary').innerText();
  await page.fill('#rate', '4.5');
  expect(await page.locator('#summary').innerText()).toBe(comma);
});

test('E-07 40 years scrolls inside the container', async ({ page }) => {
  await page.goto('/');
  const height30 = await page.evaluate(() => document.documentElement.scrollHeight);
  await page.fill('#years', '40');
  await expect(rows(page)).toHaveCount(480);
  const box = page.locator('#schedule');
  expect(await box.evaluate((e) => e.scrollHeight > e.clientHeight)).toBe(true);
  expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBe(height30);
  const top = () => page.locator('#schedule th').first().evaluate((e) => e.getBoundingClientRect().top);
  const before = await top();
  await box.evaluate((e) => (e.scrollTop = 1000));
  expect(await top()).toBe(before);
});

test('E-08 money cells use Slovak format', async ({ page }) => {
  await page.goto('/');
  const texts = await page.locator('#summary dd').allInnerTexts();
  const cells = await page.locator('#schedule tbody tr:nth-child(-n+5) td:not(:first-child)').allInnerTexts();
  expect(texts.length + cells.length).toBe(24);
  for (const t of [...texts, ...cells]) expect(t).toMatch(MONEY);
});

test('E-09 Chart.js request aborted', async ({ page }) => {
  await page.route(/chart(\.umd)?(\.min)?\.js/, (route) => route.abort());
  await page.goto('/');
  await expect(page.locator('#chart-message')).toBeVisible();
  await expect(payment(page)).toHaveText(`572,90${N}€`);
  await expect(rows(page)).toHaveCount(360);
});

test('E-10 clearing each field shows "required", retyping recovers', async ({ page }) => {
  await page.goto('/');
  for (const [k, v] of Object.entries(FIELDS)) {
    await page.locator(`#${k}`).click();
    await page.keyboard.press('Control+A');
    await page.keyboard.press('Delete');
    await expect(page.locator(`[data-field="${k}"] .error`)).toContainText('required');
    await page.keyboard.type(v);
    await expect(page.locator(`[data-field="${k}"] .error`)).toBeEmpty();
    await expect(payment(page)).toHaveText(`572,90${N}€`);
  }
  expect(errors).toEqual([]);
});

test('E-11 fast typing of 4,25', async ({ page }) => {
  await page.goto('/');
  await page.locator('#rate').click();
  await page.keyboard.press('Control+A');
  await page.keyboard.type('4,25', { delay: 0 });
  await expect(payment(page)).toHaveText(`590,33${N}€`);
  await expect(totalPaid(page)).toHaveText(`212${N}517,18${N}€`);
});

test('E-12 reload keeps visible values and results together', async ({ page }) => {
  await page.goto('/');
  await page.fill('#rate', '7');
  await page.reload();
  const raw = {};
  for (const k of Object.keys(FIELDS)) raw[k] = await page.locator(`#${k}`).inputValue();
  const r = calculate({
    price: Number(raw.price),
    downH: Number(raw.down) * 100,
    rateH: Number(raw.rate) * 100,
    years: Number(raw.years),
  });
  await expect(payment(page)).toHaveText(formatEur(r.payment));
});
