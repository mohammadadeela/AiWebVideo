import { test } from 'node:test';
import assert from 'node:assert/strict';
import { continuousOperationCount, totalGenerationTimeoutMs } from '../src/lib/veo.js';

/**
 * Regression coverage for long productions. Continuous Veo films are not a
 * pool of independent scenes: every extension depends on the provider video
 * returned by the previous extension. Their total timeout therefore has to be
 * sized as a sequential workload even when ordinary scene rendering supports
 * concurrency.
 */

test('a small job keeps at least the default 24-minute floor', () => {
  const ms = totalGenerationTimeoutMs(1);
  assert.ok(ms >= 24 * 60_000, `expected at least 24 minutes, got ${ms / 60_000} min`);
});

test('a larger job gets a proportionally larger timeout than a smaller one', () => {
  const small = totalGenerationTimeoutMs(2);
  const large = totalGenerationTimeoutMs(8);
  assert.ok(large > small, `expected an 8-operation job (${large / 60_000}min) to get more time than a 2-operation job (${small / 60_000}min)`);
});

test('timeout never shrinks below the default floor regardless of operation count', () => {
  for (const count of [0, 1, 2, 3, 4, 5, 6, 7, 8, 20]) {
    const ms = totalGenerationTimeoutMs(count);
    assert.ok(ms >= 24 * 60_000, `operationCount=${count} produced ${ms / 60_000}min, below the 24-minute floor`);
  }
});

test('continuous 144-second films are correctly recognized as 21 sequential Veo operations', () => {
  assert.equal(continuousOperationCount(144), 21);
});

test('sequential continuous work receives more time than the same count treated as concurrent', () => {
  const operationCount = continuousOperationCount(144);
  const concurrentBudget = totalGenerationTimeoutMs(operationCount, 3);
  const sequentialBudget = totalGenerationTimeoutMs(operationCount, 1);
  assert.ok(
    sequentialBudget > concurrentBudget,
    `expected sequential budget ${sequentialBudget / 60_000}min to exceed concurrent budget ${concurrentBudget / 60_000}min`,
  );
});
