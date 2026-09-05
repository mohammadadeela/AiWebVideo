import { test } from 'node:test';
import assert from 'node:assert/strict';
import { videoCreditCost, CREDIT_COSTS } from '../src/lib/credits.js';
import { geminiModelChain } from '../src/lib/veo.js';
import { PRODUCTS } from '../src/routes/paypal.js';

// Official Gemini Developer API rates checked 2026-09-01.
const STANDARD_1080P_USD_PER_SEC = 0.40;
const STANDARD_4K_USD_PER_SEC = 0.60;
const IMAGE_4K_USD = 0.151;
const TTS_USD_PER_SEC = (25 / 1_000_000) * 20;
const TEXT_AND_INPUT_ALLOWANCE_USD = 0.20;
// Conservative reserve for payment processing before checking the 2x floor.
const PAYMENT_FEE_RESERVE = 0.06;

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

test('the automatic Gemini model chain defaults to premium Veo 3.1 Standard', () => {
  withVideoModel(undefined, () => assert.deepEqual(geminiModelChain(), ['veo-3.1-generate-preview']));
});

test('premium Standard 1080p and 4K credit rates cover provider cost by at least 2x', () => {
  const cheapestCreditUsd = Math.min(
    PRODUCTS.creator.amountUsd / PRODUCTS.creator.credits,
    PRODUCTS.pro.amountUsd / PRODUCTS.pro.credits,
    PRODUCTS.agency.amountUsd / PRODUCTS.agency.credits,
  );
  withVideoModel(undefined, () => {
    for (const [quality, providerRate] of [['1080p', STANDARD_1080P_USD_PER_SEC], ['4k', STANDARD_4K_USD_PER_SEC]] as const) {
      const credits = videoCreditCost('video', true, 64, quality);
      const revenue = credits * cheapestCreditUsd * (1 - PAYMENT_FEE_RESERVE);
      const providerCost = 64 * providerRate;
      assert.ok(revenue >= providerCost * 2, `${quality}: $${revenue.toFixed(2)} revenue must cover 2x $${providerCost.toFixed(2)} provider cost`);
    }
  });
});

test('changing the provider model cannot lower the customer credit charge', () => {
  withVideoModel('veo-3.1-fast-generate-preview', () => {
    assert.equal(videoCreditCost('video', true, 8, '1080p'), 8 * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P);
    assert.equal(videoCreditCost('video', true, 8, '4k'), 8 * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K);
  });
});

test('every subscription remains above 2x premium Standard provider cost when all credits are used', () => {
  const plans = [PRODUCTS.creator, PRODUCTS.pro, PRODUCTS.agency];
  for (const plan of plans) {
    const available1080Seconds = plan.credits / CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P;
    const available4kSeconds = plan.credits / CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K;
    const netRevenue = plan.amountUsd * (1 - PAYMENT_FEE_RESERVE);
    assert.ok(netRevenue >= available1080Seconds * STANDARD_1080P_USD_PER_SEC * 2);
    assert.ok(netRevenue >= available4kSeconds * STANDARD_4K_USD_PER_SEC * 2);
  }
});

test('one-time premium 1080p packs include narration credits and clear the 2x cost floor', () => {
  const packs = [
    { product: PRODUCTS.single8, seconds: 8 },
    { product: PRODUCTS.single48, seconds: 48 },
    { product: PRODUCTS.single144, seconds: 144 },
  ];
  withVideoModel(undefined, () => {
    for (const { product, seconds } of packs) {
      assert.equal(product.credits, videoCreditCost('video', false, seconds, '1080p'));
      const conservativeCost = seconds * STANDARD_1080P_USD_PER_SEC + seconds * TTS_USD_PER_SEC + TEXT_AND_INPUT_ALLOWANCE_USD;
      const netRevenue = product.amountUsd * (1 - PAYMENT_FEE_RESERVE);
      assert.ok(netRevenue >= conservativeCost * 2, `$${product.amountUsd} pack must cover 2x $${conservativeCost.toFixed(2)} after fee reserve`);
    }
  });
});

test('photo sets and every credit top-up clear the 2x provider-cost floor', () => {
  const cheapestCreditUsd = Math.min(
    PRODUCTS.creator.amountUsd / PRODUCTS.creator.credits,
    PRODUCTS.pro.amountUsd / PRODUCTS.pro.credits,
    PRODUCTS.agency.amountUsd / PRODUCTS.agency.credits,
  );
  const photoRevenue = CREDIT_COSTS.PHOTO_SET_4 * cheapestCreditUsd * (1 - PAYMENT_FEE_RESERVE);
  const photoCost = IMAGE_4K_USD * 4 + TEXT_AND_INPUT_ALLOWANCE_USD;
  assert.ok(photoRevenue >= photoCost * 2);
  for (const topup of [PRODUCTS.topup50, PRODUCTS.topup100, PRODUCTS.topup250]) {
    const topup4kSeconds = topup.credits / CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K;
    assert.ok(topup.amountUsd * (1 - PAYMENT_FEE_RESERVE) >= topup4kSeconds * STANDARD_4K_USD_PER_SEC * 2);
  }
});
