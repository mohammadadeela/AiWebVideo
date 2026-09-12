import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function frontendSource(relativePath: string) {
  return readFile(path.resolve(process.cwd(), '../aiwebvideo', relativePath), 'utf8');
}

test('production Stop uses the branded in-app warning instead of a browser dialog', async () => {
  const canvas = await frontendSource('src/components/chat/GenerationCanvas.tsx');

  assert.match(canvas, /AlertDialog/);
  assert.match(canvas, /Stop production\?/);
  assert.match(canvas, /Credits at risk/);
  assert.match(canvas, /Stop and lose \$\{creditsAtRisk\} credits/);
  assert.match(canvas, /Keep generating/);
  assert.doesNotMatch(canvas, /window\.confirm/);
  assert.doesNotMatch(canvas, /onClick=\{onCancel\}/);
});

test('confirmed Stop submits cancellation only after the in-app confirmation', async () => {
  const canvas = await frontendSource('src/components/chat/GenerationCanvas.tsx');

  assert.match(canvas, /confirmStopProduction/);
  assert.match(canvas, /`\/api\/jobs\/\$\{id\}\/cancel`/);
  assert.match(canvas, /setStopRequested\(true\)/);
  assert.match(canvas, /disabled=\{stopPreviewLoading \|\| stopSubmitting \|\| stopRequested\}/);
});
