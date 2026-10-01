import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RELOAD_GUARD_MS, isStaleAssetError, mayReloadForNewVersion } from '../../aiwebvideo/src/lib/staleAssets.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const fakeStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return { getItem: (k: string) => data[k] ?? null, setItem: (k: string, v: string) => { data[k] = v; } };
};

test('every browser\'s wording for "this page is an old version" is recognised, and real bugs are not', () => {
  for (const message of [
    'Failed to fetch dynamically imported module: https://x.test/assets/ChatWidget-abc.js',   // Chrome / Edge
    'error loading dynamically imported module: https://x.test/a.js',                            // Firefox
    'Importing a module script failed.',                                                         // Safari
    'Unable to preload CSS for /assets/index-abc.css',                                           // Vite
    'Loading chunk 12 failed.',                                                                  // webpack-style
  ]) assert.equal(isStaleAssetError(new Error(message)), true, message);
  const named = new Error('x'); named.name = 'ChunkLoadError';
  assert.equal(isStaleAssetError(named), true);
  assert.equal(isStaleAssetError(new TypeError("Cannot read properties of undefined (reading 'length')")), false);
  assert.equal(isStaleAssetError(null), false);
});

test('the automatic reload happens once, then not again for two minutes, so it can never loop', () => {
  const storage = fakeStorage();
  const t = 1_000_000;
  assert.equal(mayReloadForNewVersion(storage, t), true);
  assert.equal(mayReloadForNewVersion(storage, t + 1000), false, 'a second failure right after the reload');
  assert.equal(mayReloadForNewVersion(storage, t + RELOAD_GUARD_MS - 1), false);
  assert.equal(mayReloadForNewVersion(storage, t + RELOAD_GUARD_MS + 1), true, 'a later deploy is fine');
  const blocked = { getItem: () => { throw new Error('denied'); }, setItem: () => { throw new Error('denied'); } };
  assert.equal(mayReloadForNewVersion(blocked, t), false, 'blocked storage must never risk a loop');
});

test('the error screen styles itself, recovers a stale page without wiping drafts, and is wired in', async () => {
  const boundary = await fe('components/system/AppErrorBoundary.tsx');
  assert.match(boundary, /isStaleAssetError\(error\)/);
  assert.match(boundary, /reloadForNewVersion\(\)/);
  assert.match(boundary, /style=\{page\}/);                                        // inline styles: readable without the stylesheet
  assert.match(boundary, /A new version is ready/);
  assert.match(boundary, /onClick=\{\(\) => window\.location\.reload\(\)\}/);       // plain reload for a stale page (no draft wiping)
  assert.match(await fe('main.tsx'), /installStaleAssetRecovery\(\);/);
  const app = await readFile(path.resolve(process.cwd(), 'src/app.ts'), 'utf8');
  assert.match(app, /app\.use\('\/assets', \(_req, res\) => res\.status\(404\)\.type\('text\/plain'\)/);
});
