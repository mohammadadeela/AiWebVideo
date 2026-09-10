import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { classifyAdminProduction } from '../src/lib/admin-production.js';

test('admin production feature labels cover every creator type', () => {
  const cases = [
    [{ mode: 'video', captureMetadata: { sourceType: 'website' } }, 'website-video', 'Website Video'],
    [{ mode: 'custom', captureMetadata: { sourceType: 'studio', studioKind: 'idea' } }, 'ai-video', 'AI Video'],
    [{ mode: 'photos', captureMetadata: { sourceType: 'upload' } }, 'ai-images', 'AI Images'],
    [{ mode: 'photos', captureMetadata: { sourceType: 'studio', studioKind: 'product' } }, 'product-photos', 'Product Photos'],
    [{ mode: 'video', captureMetadata: { sourceType: 'studio', studioKind: 'product' } }, 'product-video', 'Product Video'],
    [{ mode: 'custom', captureMetadata: { sourceType: 'studio', studioKind: 'scenario' } }, 'talking-scene', 'Talking Scene'],
  ] as const;

  for (const [input, expectedType, expectedLabel] of cases) {
    assert.deepEqual(classifyAdminProduction(input), { type: expectedType, label: expectedLabel });
  }
});

test('admin report timeline avoids the reserved month alias that broke PostgreSQL', async () => {
  const source = await readFile(new URL('../src/routes/admin.ts', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /\bAS\s+month\b/i);
  assert.match(source, /AS period_start/);
  assert.match(source, /LEFT JOIN revenue ON revenue\.period_start=month_series\.period_start/);
});
