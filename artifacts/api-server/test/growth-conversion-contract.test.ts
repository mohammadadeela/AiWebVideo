import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CREDIT_COSTS } from '../src/lib/credits.js';
import {
  CREDIT_DISPLAY_MULTIPLIER,
  STARTER_CREDITS_INTERNAL,
  STARTER_CREDITS_DISPLAY,
  WELCOME_DISCOUNT_PERCENT,
  marginSafeWelcomePrice,
  proposedWelcomeDiscountAmount,
  providerCoverageMultiple,
} from '../src/lib/growth-offers.js';

async function source(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('starter credits use x5 display units and cannot authorize the cheapest paid generation alone', () => {
  assert.equal(CREDIT_DISPLAY_MULTIPLIER, 5);
  assert.equal(STARTER_CREDITS_INTERNAL, 5);
  assert.equal(STARTER_CREDITS_DISPLAY, 25);
  assert.ok(STARTER_CREDITS_INTERNAL < CREDIT_COSTS.PHOTO_SET_4);
});

test('20 percent welcome offer lowers price, never credits, and keeps at least 2x modeled provider coverage', () => {
  const packs = [
    { id: 'topup50', amountUsd: 14.99, credits: 50 },
    { id: 'topup100', amountUsd: 28.99, credits: 100 },
    { id: 'topup250', amountUsd: 69.99, credits: 250 },
  ];

  assert.equal(WELCOME_DISCOUNT_PERCENT, 20);
  for (const pack of packs) {
    const expectedDiscounted = proposedWelcomeDiscountAmount(pack.amountUsd);
    const charged = marginSafeWelcomePrice({
      productId: pack.id,
      amountUsd: pack.amountUsd,
      purchasedInternalCredits: pack.credits,
    });
    assert.equal(charged, expectedDiscounted);
    assert.ok(charged < pack.amountUsd, `${pack.id} must receive a real lower checkout price`);
    assert.ok(
      providerCoverageMultiple({
        amountUsd: charged,
        purchasedInternalCredits: pack.credits,
      }) >= 2,
      `${pack.id} must remain at or above the 2x modeled provider-cost floor`,
    );
  }
});

test('discount guard refuses unsupported products and unsafe economics', () => {
  assert.equal(
    marginSafeWelcomePrice({ productId: 'agency', amountUsd: 249, purchasedInternalCredits: 1000 }),
    249,
  );
  assert.equal(
    marginSafeWelcomePrice({ productId: 'topup250', amountUsd: 1, purchasedInternalCredits: 250 }),
    1,
  );
});

test('growth settlement is authenticated, first-sign-in timed and does not grant welcome bonus credits', async () => {
  const text = await source('src/routes/growth.ts');
  assert.match(text, /router\.get\('\/welcome', requireAuth/);
  assert.match(text, /welcome_offer_started_at=NOW\(\)/);
  assert.match(text, /welcome_offer_started_at IS NULL/);
  assert.match(text, /created_at >= NOW\(\) - INTERVAL '24 hours'/);
  assert.match(text, /growth:starter:\$\{userId\}/);
  assert.match(text, /discountPercent: WELCOME_DISCOUNT_PERCENT/);
  assert.match(text, /bonusPercent: 0/);
  assert.match(text, /bonusCreditsGranted: 0/);
  assert.doesNotMatch(text, /growth:welcome20/);
});

test('ordinary account refresh starts the welcome window and returns the fresh starter balance', async () => {
  const text = await source('src/routes/index.ts');
  assert.match(text, /router\.get\('\/user\/me', requireAuth/);
  assert.match(text, /settleGrowthCredits\(req\.user!\.id\)/);
  assert.match(text, /req\.user!\.creditsBalance = growth\.balanceInternal/);
});

test('customer API credit quantities are converted to x5 while server accounting stays internal', async () => {
  const serverCredits = await source('src/lib/credits.ts');
  const growth = await source('src/lib/growth-offers.ts');
  const routes = await source('src/routes/index.ts');
  assert.doesNotMatch(serverCredits, /CREDIT_DISPLAY_MULTIPLIER/);
  assert.match(growth, /CREDIT_DISPLAY_MULTIPLIER = 5/);
  assert.match(routes, /CUSTOMER_CREDIT_FIELDS/);
  assert.match(routes, /value \* CREDIT_DISPLAY_MULTIPLIER/);
  assert.match(routes, /scaleCreditTextNumber/);
  assert.match(routes, /req\.path\.startsWith\('\/admin'\)/);
  assert.match(routes, /req\.path\.startsWith\('\/growth'\)/);
});

test('PayPal charges the discounted amount but grants the original purchased credits', async () => {
  const paypal = await source('src/routes/paypal.ts');
  assert.match(paypal, /marginSafeWelcomePrice/);
  assert.match(paypal, /checkoutAmountUsd\.toFixed\(2\)/);
  assert.match(paypal, /orderId, checkoutAmountUsd, product\.credits/);
  assert.doesNotMatch(paypal, /bonusInternal/);
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
