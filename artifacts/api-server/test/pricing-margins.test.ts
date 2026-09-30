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

const PAID_PRODUCT_IDS = ['creator', 'pro', 'agency', 'single8', 'single48', 'single144', 'topup50', 'topup100', 'topup250'] as const;
const WELCOME_PRODUCT_IDS = new Set(['topup50', 'topup100', 'topup250']);

/** Net revenue per internal credit for a product as actually charged (welcome price for top-ups). */
function revenuePerCredit(id: (typeof PAID_PRODUCT_IDS)[number], welcome = false) {
  const product = PRODUCTS[id];
  const price = welcome && WELCOME_PRODUCT_IDS.has(id) ? product.amountUsd * (1 - WELCOME_DISCOUNT) : product.amountUsd;
  return price / product.credits;
}

function lowestRevenuePerInternalCredit() {
  // Every credit the site sells is spendable on any model, so the floor covers ALL products
  // (one-video packs included) at their lowest real price.
  return Math.min(...PAID_PRODUCT_IDS.map((id) => revenuePerCredit(id, true)));
}

test('the customer prices are the ones the pricing page advertises', () => {
  assert.deepEqual(
    (['topup50', 'topup100', 'topup250'] as const).map((id) => PRODUCTS[id].amountUsd),
    [4.99, 14.99, 24.99],
  );
  const [small, medium, large] = (['topup50', 'topup100', 'topup250'] as const).map((id) => revenuePerCredit(id));
  assert.ok(small > medium && medium > large, 'bigger credit packs must be cheaper per credit');
  assert.ok(PRODUCTS.single8.amountUsd < 9.99 && PRODUCTS.single48.amountUsd < 52.99 && PRODUCTS.single144.amountUsd < 149.99);
});

test('a one-video pack fully covers a Cinema 2 1080p video of that length, with narration', () => {
  const cinema2 = GENERATION_MODELS['cinema-2'];
  const perSecond = videoModelCreditsPerSecond(cinema2, '1080p');
  const NARRATION = 6;
  for (const [id, seconds] of [['single8', 8], ['single48', 48], ['single144', 144]] as const) {
    assert.ok(PRODUCTS[id].credits >= perSecond * seconds + NARRATION, `${id} must cover ${seconds}s + narration`);
    assert.ok(PRODUCTS[id].credits <= perSecond * seconds + NARRATION + 2, `${id} must not include unused headroom`);
  }
});

test('every credit-selling product keeps 2x modeled provider cost even at the welcome price', () => {
  const worstProviderCostPerCredit = 0.101; // Graphic 2 / Space 2 at 1080p is the most expensive credit
  for (const id of PAID_PRODUCT_IDS) {
    assert.ok(
      revenuePerCredit(id, true) >= worstProviderCostPerCredit * 2,
      `${id}: $${revenuePerCredit(id, true).toFixed(4)} per credit must cover 2x $${worstProviderCostPerCredit}`,
    );
  }
});

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
