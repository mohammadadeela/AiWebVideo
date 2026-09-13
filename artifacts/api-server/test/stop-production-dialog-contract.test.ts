import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function frontendSource(relativePath: string) {
  return readFile(path.resolve(process.cwd(), '../aiwebvideo', relativePath), 'utf8');
}

function executableSource(text: string) {
  // Security/UX assertions should inspect executable source, not prose comments.
  return text.replace(/\/\/.*$/gm, '');
}

test('production Stop uses the branded in-app warning instead of a browser dialog', async () => {
  const canvas = await frontendSource('src/components/chat/GenerationCanvas.tsx');
  const executable = executableSource(canvas);

  assert.match(canvas, /AlertDialog/);
  assert.match(canvas, /Stop production\?/);
  assert.match(canvas, /Credits at risk/);
  assert.match(canvas, /Stop and lose \$\{creditsAtRisk\} credits/);
  assert.match(canvas, /Keep generating/);
  assert.doesNotMatch(executable, /window\.confirm/);
  assert.doesNotMatch(executable, /onClick=\{onCancel\}/);
});

test('confirmed Stop submits cancellation only after the in-app confirmation', async () => {
  const canvas = await frontendSource('src/components/chat/GenerationCanvas.tsx');

  assert.match(canvas, /confirmStopProduction/);
  assert.match(canvas, /`\/api\/jobs\/\$\{id\}\/cancel`/);
  assert.match(canvas, /setStopRequested\(true\)/);
  assert.match(canvas, /disabled=\{stopPreviewLoading \|\| stopSubmitting \|\| stopRequested\}/);
});
