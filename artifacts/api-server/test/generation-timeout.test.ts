import { test } from 'node:test';
import assert from 'node:assert/strict';
import { totalGenerationTimeoutMs } from '../src/lib/veo.js';

/**
 * Regression coverage for a real production issue: a fixed 24-minute total
 * job timeout doesn't scale with how many scenes a production actually has.
 * A short 2-scene job and a long 8-scene cinematic film at the same
 * concurrency legitimately need very different total budgets — real Veo
 * generation commonly takes several minutes per clip, so a longer job that
 * is generating correctly (just has more sequential batches to get through
 * at a fixed concurrency) must not be killed by a timeout sized for a
 * shorter one.
 */

test('a small job keeps at least the default 24-minute floor', () => {
  const ms = totalGenerationTimeoutMs(1);
  assert.ok(ms >= 24 * 60_000, `expected at least 24 minutes, got ${ms / 60_000} min`);
});

test('a larger job gets a proportionally larger timeout than a smaller one', () => {
  const small = totalGenerationTimeoutMs(2);
  const large = totalGenerationTimeoutMs(8);
  assert.ok(large > small, `expected an 8-scene job (${large / 60_000}min) to get more time than a 2-scene job (${small / 60_000}min)`);
});

test('timeout never shrinks below the default floor regardless of scene count', () => {
  for (const count of [0, 1, 2, 3, 4, 5, 6, 7, 8, 20]) {
    const ms = totalGenerationTimeoutMs(count);
    assert.ok(ms >= 24 * 60_000, `sceneCount=${count} produced ${ms / 60_000}min, below the 24-minute floor`);
  }
});
