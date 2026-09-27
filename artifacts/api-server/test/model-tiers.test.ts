import test from 'node:test';
import assert from 'node:assert/strict';
import { videoCreditQuote } from '../src/lib/credits.js';
import {
  INTERNAL_CREDIT_VALUE_USD,
  imageProviderCostPerImage,
  markedUpCredits,
  videoModelForTier,
  videoProviderCostPerSecond,
} from '../src/lib/model-tiers.js';

test('branded video tiers map to the intended generation models without changing legacy jobs', () => {
  assert.equal(videoModelForTier('cinema1'), 'veo-3.1-lite-generate-preview');
  assert.equal(videoModelForTier('cinema2'), 'veo-3.1-fast-generate-preview');
  assert.equal(videoModelForTier('cinema_pro'), 'veo-3.1-generate-preview');
  assert.equal(videoCreditQuote('video', true, 8, '1080p').totalCredits, 32);
});

test('tier pricing is derived from provider cost with at least the requested 2x markup', () => {
  for (const [tier, quality] of [
    ['cinema1', '1080p'],
    ['cinema2', '1080p'],
    ['cinema2', '4k'],
    ['cinema_pro', '1080p'],
    ['cinema_pro', '4k'],
  ] as const) {
    const provider = videoProviderCostPerSecond(tier, quality);
    const charged = markedUpCredits(provider);
    assert.ok(charged * INTERNAL_CREDIT_VALUE_USD >= provider * 2);
  }
  for (const tier of ['graphic1', 'graphic_pro'] as const) {
    const provider = imageProviderCostPerImage(tier);
    const charged = markedUpCredits(provider);
    assert.ok(charged * INTERNAL_CREDIT_VALUE_USD >= provider * 2);
  }
});

test('Cinema 1 rejects unsupported 4K pricing and image tiers produce exact four-image quotes', () => {
  assert.throws(() => videoProviderCostPerSecond('cinema1', '4k'), /supports up to 1080p/i);
  const graphic1 = videoCreditQuote('photos', true, 8, '1080p', 'graphic1');
  const graphicPro = videoCreditQuote('photos', true, 8, '4k', 'graphic_pro');
  assert.equal(graphic1.totalCredits, markedUpCredits(imageProviderCostPerImage('graphic1')) * 4);
  assert.equal(graphicPro.totalCredits, markedUpCredits(imageProviderCostPerImage('graphic_pro')) * 4);
});
