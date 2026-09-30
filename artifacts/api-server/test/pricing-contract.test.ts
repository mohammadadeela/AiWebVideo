import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PRODUCTS } from '../src/routes/paypal.js';
import { BILLING_CREDIT_PRODUCTS } from '../src/lib/billing-products.js';

/** The browser shows prices from lib/pricing.ts; the server charges from PRODUCTS. They must agree. */
async function frontendPricing() {
  return readFile(path.resolve(process.cwd(), '../aiwebvideo/src/lib/pricing.ts'), 'utf8');
}

function entry(source: string, id: string) {
  const line = source.split('\n').find((row) => row.includes(`id: "${id}"`));
  assert.ok(line, `${id} is missing from src/lib/pricing.ts`);
  return {
    credits: Number(/credits: (\d+)/.exec(line)?.[1]),
    amountUsd: Number(/amountUsd: ([\d.]+)/.exec(line)?.[1]),
  };
}

test('every pack and plan on the pricing page matches what the server charges and grants', async () => {
  const source = await frontendPricing();
  for (const id of ['creator', 'pro', 'agency', 'single8', 'single48', 'single144', 'topup50', 'topup100', 'topup250'] as const) {
    const shown = entry(source, id);
    assert.equal(shown.amountUsd, PRODUCTS[id].amountUsd, `${id} price`);
    assert.equal(shown.credits, PRODUCTS[id].credits, `${id} credits`);
    assert.equal(shown.credits, BILLING_CREDIT_PRODUCTS[id].credits, `${id} credit grant`);
  }
});

test('the starter grant shown to customers matches the server (5 internal = 25 shown)', async () => {
  const source = await frontendPricing();
  assert.match(source, /STARTER_CREDITS = 25/);
});

test('pack names announce the real credit amounts customers receive', () => {
  assert.equal(PRODUCTS.topup50.name, `${PRODUCTS.topup50.credits * 5} Credits`);
  assert.equal(PRODUCTS.topup100.name, `${PRODUCTS.topup100.credits * 5} Credits`);
  assert.equal(PRODUCTS.topup250.name, `${PRODUCTS.topup250.credits * 5} Credits`);
});
