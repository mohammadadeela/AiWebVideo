import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { queueSettings } from '../src/lib/provider-queue.js';

async function source(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('storyboard defaults to one in-flight multimodal planning request', () => {
  const previous = process.env.GEMINI_STORYBOARD_CONCURRENCY;
  try {
    delete process.env.GEMINI_STORYBOARD_CONCURRENCY;
    assert.equal(queueSettings('storyboard').concurrency, 1);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_STORYBOARD_CONCURRENCY;
    else process.env.GEMINI_STORYBOARD_CONCURRENCY = previous;
  }
});

test('storyboard does not repeat the same provider-throttled request five times', async () => {
  const text = await source('src/lib/provider-queue.ts');
  assert.match(text, /GEMINI_STORYBOARD_QUEUE_RATE_LIMIT_RETRIES', 1/);
  assert.match(text, /GEMINI_STORYBOARD_MAX_RETRY_DELAY_MS', 8_000/);
  assert.match(text, /storyboardDelayTooLong/);
  assert.match(text, /provider quota unavailable; not parking job in retry queue/);
});

test('provider retry hints and real quota reason are visible in PM2 logs', async () => {
  const text = await source('src/lib/provider-queue.ts');
  assert.match(text, /\\s\+in/);
  assert.match(text, /providerError: safeProviderErrorText\(error\)/);
  assert.match(text, /providerRetryAfterMs/);
});

test('provider throttling is not presented as another user ahead in the local queue', async () => {
  const text = await source('src/lib/provider-queue.ts');
  assert.match(text, /Gemini temporarily limited AI planning/);
  assert.match(text, /Queued for \$\{label\} · position \$\{position\}/);
  assert.match(text, /publishProviderThrottleStatus\(item, delayMs\)/);
});
