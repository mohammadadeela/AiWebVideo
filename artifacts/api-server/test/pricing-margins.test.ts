import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoCreditCost, CREDIT_COSTS } from '../src/lib/credits.js';
import { geminiModelChain } from '../src/lib/veo.js';
import { PRODUCTS } from '../src/routes/paypal.js';

// Official Gemini Developer API rates checked 2026-08-10.
const FAST_1080P_USD_PER_SEC = 0.12;
const FAST_4K_USD_PER_SEC = 0.30;
const STANDARD_1080P_USD_PER_SEC = 0.40;
const STANDARD_4K_USD_PER_SEC = 0.60;
const IMAGE_4K_USD = 0.151;
const CHEAPEST_SUBSCRIPTION_CREDIT_USD = 99 / 400; // Pro: $0.2475
const TTS_56_SECONDS_USD = (56 * 25 / 1_000_000) * 20;
const TEXT_AND_INPUT_ALLOWANCE_USD = 0.20;

function withVideoModel(model: string | undefined, run: () => void) {
  const previous = process.env.GEMINI_VIDEO_MODEL;
  if (model === undefined) delete process.env.GEMINI_VIDEO_MODEL;
  else process.env.GEMINI_VIDEO_MODEL = model;
  try { run(); }
  finally {
    if (previous === undefined) delete process.env.GEMINI_VIDEO_MODEL;
    else process.env.GEMINI_VIDEO_MODEL = previous;
  }
}

test('the automatic Gemini model chain cannot silently fall back to margin-breaking Standard', () => {
  withVideoModel(undefined, () => assert.deepEqual(geminiModelChain(), ['veo-3.1-fast-generate-preview']));
});

test('Fast 1080p and 4K charges cover provider cost by at least 2x at the cheapest subscription credit value', () => {
  withVideoModel(undefined, () => {
    for (const [quality, providerRate] of [['1080p', FAST_1080P_USD_PER_SEC], ['4k', FAST_4K_USD_PER_SEC]] as const) {
      const credits = videoCreditCost('video', true, 56, quality);
      const revenue = credits * CHEAPEST_SUBSCRIPTION_CREDIT_USD;
      const providerCost = 56 * providerRate;
      assert.ok(revenue >= providerCost * 2, `${quality}: $${revenue.toFixed(2)} revenue must cover 2x $${providerCost.toFixed(2)} provider cost`);
    }
  });
});

test('an explicitly pinned Standard model automatically charges conservative credits', () => {
  withVideoModel('veo-3.1-generate-preview', () => {
    const credits1080 = videoCreditCost('video', true, 8, '1080p');
    const credits4k = videoCreditCost('video', true, 8, '4k');
    assert.equal(credits1080, 8 * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P);
    assert.equal(credits4k, 8 * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K);
    assert.ok(credits1080 * CHEAPEST_SUBSCRIPTION_CREDIT_USD >= 8 * STANDARD_1080P_USD_PER_SEC * 2);
    assert.ok(credits4k * CHEAPEST_SUBSCRIPTION_CREDIT_USD >= 8 * STANDARD_4K_USD_PER_SEC * 2);
  });
});

test('every subscription remains above 2x Fast 1080p cost when all credits are used', () => {
  const plans = [PRODUCTS.creator, PRODUCTS.pro, PRODUCTS.agency];
  for (const plan of plans) {
    const providerCost = plan.credits * FAST_1080P_USD_PER_SEC;
    assert.ok(plan.amountUsd >= providerCost * 2, `$${plan.amountUsd} plan with ${plan.credits} credits must cover 2x $${providerCost.toFixed(2)}`);
  }
});

test('one-time 1080p video packs include narration credits and clear the 2x cost floor', () => {
  const packs = [
    { product: PRODUCTS.single8, seconds: 8 },
    { product: PRODUCTS.single30, seconds: 24 },
    { product: PRODUCTS.single60, seconds: 56 },
  ];
  withVideoModel(undefined, () => {
    for (const { product, seconds } of packs) {
      assert.equal(product.credits, videoCreditCost('video', false, seconds, '1080p'));
      const conservativeCost = seconds * FAST_1080P_USD_PER_SEC + TTS_56_SECONDS_USD + TEXT_AND_INPUT_ALLOWANCE_USD;
      assert.ok(product.amountUsd >= conservativeCost * 2, `$${product.amountUsd} pack must cover 2x $${conservativeCost.toFixed(2)}`);
    }
  });
});

test('photo sets and 100-credit top-ups clear the 2x provider-cost floor', () => {
  const photoRevenue = CREDIT_COSTS.PHOTO_SET_4 * CHEAPEST_SUBSCRIPTION_CREDIT_USD;
  const photoCost = IMAGE_4K_USD * 4 + TEXT_AND_INPUT_ALLOWANCE_USD;
  assert.ok(photoRevenue >= photoCost * 2);
  assert.ok(PRODUCTS.topup100.amountUsd >= PRODUCTS.topup100.credits * FAST_1080P_USD_PER_SEC * 2);
});
