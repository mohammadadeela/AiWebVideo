import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { queueSettings } from '../src/lib/provider-queue.js';

async function source(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('Veo queue defaults to one paid generation submission at a time', () => {
  const previous = process.env.GEMINI_VIDEO_CONCURRENCY;
  try {
    delete process.env.GEMINI_VIDEO_CONCURRENCY;
    assert.equal(queueSettings('video').concurrency, 1);
  } finally {
    if (previous === undefined) delete process.env.GEMINI_VIDEO_CONCURRENCY;
    else process.env.GEMINI_VIDEO_CONCURRENCY = previous;
  }
});

test('provider queue retries explicit 429 throttling but not ambiguous 503 submissions', async () => {
  const text = await source('src/lib/provider-queue.ts');
  const start = text.indexOf('function isRateLimitError');
  const end = text.indexOf('function retryAfterFromProvider', start);
  assert.ok(start >= 0 && end > start, 'rate-limit classifier must exist');
  const classifier = text.slice(start, end);
  assert.match(classifier, /status === 429/);
  assert.doesNotMatch(classifier, /status === 503|UNAVAILABLE/);
  assert.match(text, /20_000, 45_000, 90_000, 120_000, 180_000/);
  assert.match(text, /rateLimitStartedAt/);
  assert.match(text, /cancel_requested/);
});

test('user Stop keeps the production reservation while ordinary failures can still refund', async () => {
  const text = await source('src/lib/queries.ts');
  assert.match(text, /current\?\.cancel_requested \|\| isUserRequestedCancellationRefund\(reason\)/);
  assert.match(text, /return refundJobCreditsBase\(jobId, userId, requestedAmount, reason\)/);
  assert.match(text, /patch\.status === 'cancelled' \|\| patch\.status === 'failed'/);
  assert.match(text, /status: 'cancelled'/);
  assert.match(text, /not refundable after Stop/);
});

test('frontend warns with the exact reserved credits before sending Stop', async () => {
  const text = await source('../aiwebvideo/src/lib/api-client.ts');
  const fetchPosition = text.indexOf('const current = await fetchJob(jobId)');
  const confirmPosition = text.indexOf('window.confirm(warning)');
  const cancelRequestPosition = text.indexOf('`/api/jobs/${jobId}/cancel`');
  assert.ok(fetchPosition >= 0, 'cancel flow must read the live job first');
  assert.ok(confirmPosition > fetchPosition, 'credit-loss confirmation must happen after reading the live job');
  assert.ok(cancelRequestPosition > confirmPosition, 'Stop request must not be sent before confirmation');
  assert.match(text, /all \$\{creditsAtRisk\} credits will be lost and will NOT be refunded/);
});
