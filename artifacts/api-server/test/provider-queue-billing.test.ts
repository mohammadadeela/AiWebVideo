import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

async function source() {
  return readFile(path.resolve(fileURLToPath(new URL('../src/lib/provider-queue.ts', import.meta.url))), 'utf8');
}

test('Gemini prepayment depletion is treated as provider billing failure', async () => {
  const text = await source();
  assert.match(text, /function isProviderBillingUnavailable/);
  assert.match(text, /status === 402/);
  assert.match(text, /prepayment credits\?/i);
  assert.match(text, /const canRetry = item\.attempt < maxRetries && !clearlyLongLived/);
});

test('provider queue drains again when an active task finishes', async () => {
  const text = await source();
  assert.match(text, /\.finally\(\(\) => \{/);
  assert.match(text, /void drain\(kind, model\);/);
});

test('known billing exhaustion clears already-waiting provider calls', async () => {
  const text = await source();
  assert.match(text, /const pending = state\.waiting\.splice\(0, state\.waiting\.length\)/);
  assert.match(text, /queued\.reject\(error\)/);
});
