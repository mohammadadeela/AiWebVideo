import test from 'node:test';
import assert from 'node:assert/strict';
import { videoCreditQuote, videoCreditCost, CREDIT_COSTS } from '../src/lib/credits.js';

test('customer video credits are exact for every whole-second duration', () => {
  for (const seconds of [8, 9, 15, 32, 64, 101, 144]) {
    const quote1080 = videoCreditQuote('video', true, seconds, '1080p');
    const quote4k = videoCreditQuote('video', true, seconds, '4k');
    assert.equal(quote1080.generatedSeconds, seconds);
    assert.equal(quote1080.totalCredits, seconds * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P);
    assert.equal(quote4k.totalCredits, seconds * CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K);
  }
});

test('narration and photo extras are charged exactly once', () => {
  assert.equal(videoCreditCost('video', false, 8, '1080p'), 38);
  assert.equal(videoCreditCost('video', false, 32, '1080p'), 134);
  assert.equal(videoCreditCost('video', false, 64, '1080p'), 262);
  assert.equal(videoCreditCost('both', false, 8, '1080p'), 46);
  assert.equal(videoCreditCost('photos', false, 8, '1080p'), CREDIT_COSTS.PHOTO_SET_4);
});

test('customer pricing does not change when the internal provider model changes', () => {
  const before = process.env.GEMINI_VIDEO_MODEL;
  try {
    process.env.GEMINI_VIDEO_MODEL = 'veo-fast-experimental';
    const fastNamed = videoCreditQuote('video', true, 21, '1080p');
    process.env.GEMINI_VIDEO_MODEL = 'veo-3.1-generate-preview';
    const standardNamed = videoCreditQuote('video', true, 21, '1080p');
    assert.deepEqual(fastNamed, standardNamed);
  } finally {
    if (before === undefined) delete process.env.GEMINI_VIDEO_MODEL;
    else process.env.GEMINI_VIDEO_MODEL = before;
  }
});
