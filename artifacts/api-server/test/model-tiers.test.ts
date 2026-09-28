import assert from 'node:assert/strict';
import test from 'node:test';
import {
  INTERNAL_CREDIT_VALUE_USD,
  TARGET_PROVIDER_MULTIPLE,
  imageModelForTier,
  imageProviderCostPerImage,
  markedUpCredits,
  videoModelForTier,
  videoProviderCostPerSecond,
} from '../src/lib/model-tiers.js';
import { videoCreditQuote } from '../src/lib/credits.js';

test('branded media tiers map to server-only provider models', () => {
  assert.equal(videoModelForTier('cinema1'), 'veo-3.1-lite-generate-preview');
  assert.equal(videoModelForTier('cinema2'), 'veo-3.1-fast-generate-preview');
  assert.equal(videoModelForTier('cinema_pro'), 'veo-3.1-generate-preview');
  assert.equal(imageModelForTier('graphic1'), 'gemini-3.1-flash-lite-image');
  assert.equal(imageModelForTier('graphic2'), 'gemini-3.1-flash-image');
  assert.equal(imageModelForTier('graphic_pro'), 'gemini-3-pro-image');
});
test('provider costs match the September 2026 standard media price table', () => {
  assert.equal(videoProviderCostPerSecond('cinema1', '1080p'), 0.08);
  assert.equal(videoProviderCostPerSecond('cinema2', '1080p'), 0.12);
  assert.equal(videoProviderCostPerSecond('cinema2', '4k'), 0.30);
  assert.equal(videoProviderCostPerSecond('cinema_pro', '1080p'), 0.40);
  assert.equal(videoProviderCostPerSecond('cinema_pro', '4k'), 0.60);
  assert.throws(() => videoProviderCostPerSecond('cinema1', '4k'));
  assert.equal(imageProviderCostPerImage('graphic1'), 0.0336);
  assert.equal(imageProviderCostPerImage('graphic2'), 0.101);
  assert.equal(imageProviderCostPerImage('graphic_pro'), 0.24);
});
test('selected-model credit prices clear the configured provider multiple', () => {
  assert.ok(TARGET_PROVIDER_MULTIPLE >= 2);
  for (const [tier, quality, cost] of [
    ['cinema1','1080p',0.08],
    ['cinema2','1080p',0.12],
    ['cinema2','4k',0.30],
    ['cinema_pro','1080p',0.40],
    ['cinema_pro','4k',0.60],
  ] as const) {
    const q=videoCreditQuote('video',true,8,quality,tier);
    assert.ok(q.perSecondCredits * INTERNAL_CREDIT_VALUE_USD + 1e-9 >= cost * TARGET_PROVIDER_MULTIPLE);
  }
  for (const tier of ['graphic1','graphic2','graphic_pro'] as const) {
    const credits=markedUpCredits(imageProviderCostPerImage(tier));
    assert.ok(credits * INTERNAL_CREDIT_VALUE_USD + 1e-9 >= imageProviderCostPerImage(tier) * TARGET_PROVIDER_MULTIPLE);
  }
});
