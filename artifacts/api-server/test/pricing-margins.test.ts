import { test } from 'node:test';
import assert from 'node:assert/strict';
import { BILLING_PRODUCTS, minimumSafeCheckoutUsd, safeCatalogPrice } from '../src/lib/billing-products.js';
import { GENERATION_MODELS, imageModelCreditsPerImage, imageModelProviderCostPerImage,
  videoModelCreditsPerSecond, videoModelProviderCostPerSecond } from '../src/lib/generation-models.js';

const flexible = Object.entries(BILLING_PRODUCTS).filter(([,p]) => p.type !== 'create_once');
const net = (amount: number) => amount * (1 - .0401) - .35;

test('generic packs grant the displayed amount exactly once at x5', () => {
  for (const display of [50,100,250,500,1000]) {
    const product = BILLING_PRODUCTS[`credits${display}` as keyof typeof BILLING_PRODUCTS];
    assert.equal(product.credits,display/5);
    assert.equal(product.displayCredits,display);
    assert.equal(product.plan,null);
  }
});

test('each flexible product covers the worst supported model path after fees and overhead', () => {
  for (const [id,product] of flexible) {
    for (const model of Object.values(GENERATION_MODELS)) {
      for (const quality of ['1080p','4k'] as const) {
        if (quality === '4k' && !model.supports4k) continue;
        const perCredit = model.creditUnit === 'second'
          ? videoModelProviderCostPerSecond(model,quality) / videoModelCreditsPerSecond(model,quality)
          : imageModelProviderCostPerImage(model,quality) / imageModelCreditsPerImage(model,quality);
        const allIn = product.credits * (perCredit * 1.05 + .02/4);
        assert.ok(net(product.amountUsd) + 1e-6 >= allIn * 2,
          `${id} on ${model.id} ${quality}: net ${net(product.amountUsd)} < 2x ${allIn}`);
      }
    }
  }
});

test('every scoped pass has exact restrictions and a safe final checkout price', () => {
  for (const [id,product] of Object.entries(BILLING_PRODUCTS)) {
    if (product.type !== 'create_once') continue;
    const scope = product.scope!;
    const model = GENERATION_MODELS[scope.modelId as keyof typeof GENERATION_MODELS];
    assert.equal(scope.quality,'1080p');
    const count = scope.durationSeconds ?? product.credits / imageModelCreditsPerImage(model,'1080p');
    const baseCost = model.creditUnit === 'second'
      ? count * videoModelProviderCostPerSecond(model,'1080p')
      : count * imageModelProviderCostPerImage(model,'1080p');
    assert.ok(net(product.amountUsd) + 1e-6 >= 2 * (baseCost * 1.05 + .02),id);
  }
});

test('unsafe target prices round upward to a safe .99 price', () => {
  assert.ok(Math.abs(safeCatalogPrice(1.49,10)%1-.99)<1e-8);
  assert.ok(safeCatalogPrice(1.49,10)>=minimumSafeCheckoutUsd(10));
});
