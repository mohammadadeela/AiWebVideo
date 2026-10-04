// Tells IndexNow-participating search engines (Bing and others) that URLs were created, changed or deleted.
//
//   INDEXNOW_KEY=<your key> node scripts/indexnow-submit.mjs https://aiwebvideo.com/new-page https://aiwebvideo.com/changed-page
//   INDEXNOW_KEY=<your key> node scripts/indexnow-submit.mjs --all        # every page in the sitemap (use sparingly)
//
// Run it after a deploy, with ONLY the pages that changed: do not send unchanged URLs repeatedly. The same key must be set as
// INDEXNOW_KEY on the server, which then serves https://aiwebvideo.com/<key>.txt for the search engine to verify.
import { createRequire } from 'node:module';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const key = process.env.INDEXNOW_KEY?.trim();
const canonical = 'https://aiwebvideo.com';
const args = process.argv.slice(2);
if (!key) { console.error('Set INDEXNOW_KEY first (the same key the server has).'); process.exit(1); }
if (!args.length) { console.error('Give the changed URLs, or --all.'); process.exit(1); }

const { build } = createRequire(path.join(root, 'artifacts/api-server/package.json'))('esbuild');
const dir = mkdtempSync(path.join(tmpdir(), 'aiwebvideo-indexnow-'));
try {
  const output = path.join(dir, 'seo.mjs');
  await build({ entryPoints: [path.join(root, 'artifacts/api-server/src/lib/seo.ts')], outfile: output, bundle: true, platform: 'node', format: 'esm', logLevel: 'silent' });
  const { SITEMAP_PATHS, buildIndexNowPayload, isValidIndexNowKey } = await import(pathToFileURL(output).href);
  if (!isValidIndexNowKey(key)) { console.error('The key must be 8-128 letters, digits or dashes.'); process.exit(1); }
  const urls = args.includes('--all') ? SITEMAP_PATHS.map((p) => `${canonical}${p === '/' ? '' : p}`) : args;
  const payload = buildIndexNowPayload(canonical, key, urls);
  if (!payload.urlList.length) { console.error(`No URL under ${canonical}.`); process.exit(1); }
  const response = await fetch('https://api.indexnow.org/indexnow', { method: 'POST', headers: { 'Content-Type': 'application/json; charset=utf-8' }, body: JSON.stringify(payload) });
  console.log(`IndexNow answered ${response.status} for ${payload.urlList.length} URL(s).`);   // 200 or 202 = accepted
  process.exit(response.ok || response.status === 202 ? 0 : 1);
} finally {
  rmSync(dir, { recursive: true, force: true });
}
