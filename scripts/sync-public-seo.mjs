import { createRequire } from 'node:module';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apiPackage = path.join(root, 'artifacts/api-server/package.json');
const { build } = createRequire(apiPackage)('esbuild');
const temporaryDirectory = mkdtempSync(path.join(tmpdir(), 'aiwebvideo-seo-'));

try {
  const output = path.join(temporaryDirectory, 'seo.mjs');
  await build({
    entryPoints: [path.join(root, 'artifacts/api-server/src/lib/seo.ts')],
    outfile: output,
    bundle: true,
    platform: 'node',
    format: 'esm',
    logLevel: 'silent',
  });
  const { buildAiSummary, buildRobotsTxt, buildSitemapXml } = await import(pathToFileURL(output).href);
  const publicDirectory = path.join(root, 'artifacts/aiwebvideo/public');
  const canonical = 'https://aiwebvideo.com';
  const summary = buildAiSummary(canonical);
  writeFileSync(path.join(publicDirectory, 'sitemap.xml'), buildSitemapXml(canonical));
  writeFileSync(path.join(publicDirectory, 'robots.txt'), buildRobotsTxt(canonical));
  writeFileSync(path.join(publicDirectory, 'llms.txt'), summary);
  writeFileSync(path.join(publicDirectory, 'ai.txt'), summary);
} finally {
  rmSync(temporaryDirectory, { recursive: true, force: true });
}
