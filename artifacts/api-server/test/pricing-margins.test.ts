import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PRODUCTS } from '../src/routes/paypal.js';
import {
  GENERATION_MODELS,
  imageModelCreditsPerImage,
  imageModelProviderCostPerImage,
  videoModelCreditsPerSecond,
  videoModelProviderCostPerSecond,
} from '../src/lib/generation-models.js';

const WELCOME_DISCOUNT = 0.20;

function lowestRevenuePerInternalCredit() {
  return Math.min(
    PRODUCTS.creator.amountUsd / PRODUCTS.creator.credits,
    PRODUCTS.pro.amountUsd / PRODUCTS.pro.credits,
    PRODUCTS.agency.amountUsd / PRODUCTS.agency.credits,
    PRODUCTS.topup50.amountUsd * (1 - WELCOME_DISCOUNT) / PRODUCTS.topup50.credits,
    PRODUCTS.topup100.amountUsd * (1 - WELCOME_DISCOUNT) / PRODUCTS.topup100.credits,
    PRODUCTS.topup250.amountUsd * (1 - WELCOME_DISCOUNT) / PRODUCTS.topup250.credits,
  );
}

test('every public video model preserves at least 2x provider-cost coverage', () => {
  const revenuePerCredit = lowestRevenuePerInternalCredit();
  for (const id of ['cinema-1', 'cinema-2', 'cinema-pro'] as const) {
    const model = GENERATION_MODELS[id];
    for (const quality of ['1080p', '4k'] as const) {
      if (quality === '4k' && !model.supports4k) continue;
      const revenuePerSecond = videoModelCreditsPerSecond(model, quality) * revenuePerCredit;
      const providerPerSecond = videoModelProviderCostPerSecond(model, quality);
      assert.ok(
        revenuePerSecond >= providerPerSecond * 2,
        `${id} ${quality}: $${revenuePerSecond.toFixed(4)} revenue/sec must cover 2x $${providerPerSecond.toFixed(4)}`,
      );
    }
  }
});

test('every public image/interior model preserves at least 2x provider-cost coverage', () => {
  const revenuePerCredit = lowestRevenuePerInternalCredit();
  for (const id of ['graphic-1', 'graphic-2', 'graphic-pro', 'space-1', 'space-2', 'space-pro'] as const) {
    const model = GENERATION_MODELS[id];
    for (const quality of ['1080p', '4k'] as const) {
      if (quality === '4k' && !model.supports4k) continue;
      const revenuePerImage = imageModelCreditsPerImage(model, quality) * revenuePerCredit;
      const providerPerImage = imageModelProviderCostPerImage(model, quality);
      assert.ok(
        revenuePerImage >= providerPerImage * 2,
        `${id} ${quality}: $${revenuePerImage.toFixed(4)} revenue/image must cover 2x $${providerPerImage.toFixed(4)}`,
      );
    }
  }
});

test('public model ids do not expose provider model names', () => {
  for (const model of Object.values(GENERATION_MODELS)) {
    assert.ok(model.publicName.startsWith('AiWebVideo '));
    assert.ok(!/gemini|veo/i.test(model.publicName));
  }
});
