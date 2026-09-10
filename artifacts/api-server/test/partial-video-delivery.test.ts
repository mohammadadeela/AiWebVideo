import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPartialDeliveryMetadata,
  partialDeliveryResultMessage,
  readPartialDeliveryMetadata,
} from '../src/lib/partial-delivery.js';

test('144s request refunded only for the missing 44 seconds when 100s is delivered', () => {
  const meta = buildPartialDeliveryMetadata(144, 100, 4);
  assert.deepEqual(meta, {
    requestedSeconds: 144,
    deliveredSeconds: 100,
    missingSeconds: 44,
    refundedCredits: 176,
    noAutomaticRetry: true,
  });
});

test('real Veo continuation boundary at 99s refunds only the remaining 45 seconds', () => {
  const meta = buildPartialDeliveryMetadata(144, 99, 4);
  assert.equal(meta?.missingSeconds, 45);
  assert.equal(meta?.refundedCredits, 180);
});

test('4K partial delivery uses the selected per-second customer rate', () => {
  const meta = buildPartialDeliveryMetadata(144, 100, 6);
  assert.equal(meta?.refundedCredits, 264);
});

test('a complete or over-complete provider result has no partial refund', () => {
  assert.equal(buildPartialDeliveryMetadata(144, 144, 4), null);
  assert.equal(buildPartialDeliveryMetadata(144, 148, 4), null);
});

test('saved partial metadata must be internally consistent before it changes result UX', () => {
  const valid = buildPartialDeliveryMetadata(48, 43, 4);
  assert.deepEqual(readPartialDeliveryMetadata(valid), valid);
  assert.equal(readPartialDeliveryMetadata({
    requestedSeconds: 48,
    deliveredSeconds: 43,
    missingSeconds: 6,
    refundedCredits: 24,
  }), null);
});

test('partial delivery result message clearly explains delivery, refund and no paid retry', () => {
  const meta = buildPartialDeliveryMetadata(144, 100, 4);
  assert.ok(meta);
  const message = partialDeliveryResultMessage(meta);
  assert.match(message, /100s of 144s delivered/);
  assert.match(message, /176 credits/);
  assert.match(message, /44s/);
  assert.match(message, /instead of starting another paid generation/);
  assert.match(message, /charged only for the 100s/);
});
