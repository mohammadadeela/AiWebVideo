import test from 'node:test';
import assert from 'node:assert/strict';
import { videoCreditQuote, videoCreditCost } from '../src/lib/credits.js';

test('video model tiers have exact whole-second pricing', () => {
  for (const seconds of [8, 9, 15, 32, 64, 101, 144]) {
    assert.equal(videoCreditQuote('video', true, seconds, '1080p', 'cinema-1').totalCredits, seconds);
    assert.equal(videoCreditQuote('video', true, seconds, '1080p', 'cinema-2').totalCredits, seconds * 2);
    assert.equal(videoCreditQuote('video', true, seconds, '4k', 'cinema-2').totalCredits, seconds * 3);
    assert.equal(videoCreditQuote('video', true, seconds, '1080p', 'cinema-pro').totalCredits, seconds * 4);
    assert.equal(videoCreditQuote('video', true, seconds, '4k', 'cinema-pro').totalCredits, seconds * 6);
  }
});

test('narration is charged exactly once', () => {
  assert.equal(videoCreditCost('video', false, 8, '1080p', 'cinema-2'), 22);
  assert.equal(videoCreditCost('video', false, 8, '1080p', 'cinema-pro'), 38);
});

test('image model tiers price four-image sets by quality', () => {
  assert.equal(videoCreditCost('photos', true, 8, '1080p', 'graphic-1', 'product'), 4);
  assert.equal(videoCreditCost('photos', true, 8, '1080p', 'graphic-2', 'product'), 4);
  assert.equal(videoCreditCost('photos', true, 8, '4k', 'graphic-2', 'product'), 8);
  assert.equal(videoCreditCost('photos', true, 8, '4k', 'graphic-pro', 'product'), 12);
  assert.equal(videoCreditCost('photos', true, 8, '1080p', 'space-2', 'interior'), 4);
  assert.equal(videoCreditCost('photos', true, 8, '4k', 'space-pro', 'interior'), 12);
});

test('provider env variables cannot change public customer pricing', () => {
  const before = process.env.GEMINI_VIDEO_MODEL;
  try {
    process.env.GEMINI_VIDEO_MODEL = 'anything';
    const quoteA = videoCreditQuote('video', true, 21, '1080p', 'cinema-2');
    process.env.GEMINI_VIDEO_MODEL = 'something-else';
    const quoteB = videoCreditQuote('video', true, 21, '1080p', 'cinema-2');
    assert.deepEqual(quoteA, quoteB);
  } finally {
    if (before === undefined) delete process.env.GEMINI_VIDEO_MODEL;
    else process.env.GEMINI_VIDEO_MODEL = before;
  }
});
