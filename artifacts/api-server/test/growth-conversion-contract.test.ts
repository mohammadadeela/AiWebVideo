import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CREDIT_COSTS } from '../src/lib/credits.js';
import {
  CREDIT_DISPLAY_MULTIPLIER,
  STARTER_CREDITS_INTERNAL,
  STARTER_CREDITS_DISPLAY,
  WELCOME_BONUS_PERCENT,
  marginSafeWelcomeBonusCredits,
  providerCoverageMultiple,
} from '../src/lib/growth-offers.js';

async function source(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('starter credits are real but cannot authorize the cheapest paid generation', () => {
  assert.equal(CREDIT_DISPLAY_MULTIPLIER, 10);
  assert.equal(STARTER_CREDITS_INTERNAL, 5);
  assert.equal(STARTER_CREDITS_DISPLAY, 50);
  assert.ok(STARTER_CREDITS_INTERNAL < CREDIT_COSTS.PHOTO_SET_4);
});

test('20 percent top-up bonus keeps at least 2x worst-case provider-cost coverage after reserve', () => {
  const packs = [
    { id: 'topup50', amountUsd: 14.99, credits: 50 },
    { id: 'topup100', amountUsd: 28.99, credits: 100 },
    { id: 'topup250', amountUsd: 69.99, credits: 250 },
  ];

  assert.equal(WELCOME_BONUS_PERCENT, 20);
  for (const pack of packs) {
    const bonus = marginSafeWelcomeBonusCredits({
      productId: pack.id,
      amountUsd: pack.amountUsd,
      purchasedInternalCredits: pack.credits,
    });
    assert.equal(bonus, Math.floor(pack.credits * 0.2));
    assert.ok(
      providerCoverageMultiple({
        amountUsd: pack.amountUsd,
        purchasedInternalCredits: pack.credits,
        bonusInternalCredits: bonus,
      }) >= 2,
      `${pack.id} must remain at or above the 2x provider-cost floor`,
    );
  }
});

test('bonus guard refuses unsupported products and unsafe economics', () => {
  assert.equal(
    marginSafeWelcomeBonusCredits({ productId: 'agency', amountUsd: 249, purchasedInternalCredits: 1000 }),
    0,
  );
  assert.equal(
    marginSafeWelcomeBonusCredits({ productId: 'topup250', amountUsd: 1, purchasedInternalCredits: 250 }),
    0,
  );
});

test('growth settlement is authenticated, idempotent and based on verified paid rows', async () => {
  const text = await source('src/routes/growth.ts');
  assert.match(text, /router\.get\('\/welcome', requireAuth/);
  assert.match(text, /grantCreditsOnce/);
  assert.match(text, /growth:starter:\$\{userId\}/);
  assert.match(text, /status='paid'/);
  assert.match(text, /kind='one_time'/);
  assert.match(text, /product_id = ANY/);
  assert.match(text, /marginSafeWelcomeBonusCredits/);
});

test('ordinary account refresh settles growth grants and returns the fresh balance immediately', async () => {
  const text = await source('src/routes/index.ts');
  assert.match(text, /router\.get\('\/user\/me', requireAuth/);
  assert.match(text, /settleGrowthCredits\(req\.user!\.id\)/);
  assert.match(text, /req\.user!\.creditsBalance = growth\.balanceInternal/);
});

test('customer-facing denomination does not alter server generation accounting', async () => {
  const serverCredits = await source('src/lib/credits.ts');
  const growth = await source('src/lib/growth-offers.ts');
  assert.doesNotMatch(serverCredits, /CREDIT_DISPLAY_MULTIPLIER/);
  assert.match(growth, /CREDIT_DISPLAY_MULTIPLIER = 10/);
});

test('refund credit clawback is installed before the HTTP server starts', async () => {
  const billing = await source('src/lib/billing.ts');
  const entry = await source('src/index.ts');
  assert.match(billing, /aiwebvideo_payment_credit_clawback/);
  assert.match(billing, /OLD\.status = 'paid'/);
  assert.match(billing, /NEW\.status IN \('refunded', 'reversed'\)/);
  assert.match(entry, /await ensurePaymentClawbackProtection\(\)/);
  assert.ok(entry.indexOf('await ensurePaymentClawbackProtection()') < entry.indexOf('app.listen'));
});
