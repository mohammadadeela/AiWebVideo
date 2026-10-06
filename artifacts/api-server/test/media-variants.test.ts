import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, statSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';

const hasFfmpeg = (() => { try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; } })();
const assetsDir = mkdtempSync(path.join(tmpdir(), 'variants-'));
process.env.ASSETS_DIR = assetsDir;
const JOB = '123e4567-e89b-12d3-a456-426614174000';

test('only the listed picture widths are accepted, so nobody can ask the server for arbitrary sizes', async () => {
  const { parseVariantWidth } = await import('../src/lib/media-variants.js');
  assert.equal(parseVariantWidth('32'), 32);
  assert.equal(parseVariantWidth('480'), 480);
  assert.equal(parseVariantWidth('960'), 960);
  for (const bad of ['0', '31', '5000', '-480', '480.5', 'abc', '', undefined, ['480'], '480 ']) assert.equal(parseVariantWidth(bad as never), null);
});

test('a tiny preview, a grid size and a video poster are made once from the original and the original is untouched', { skip: !hasFfmpeg }, async () => {
  const { ensureImageVariant, ensureVideoPoster } = await import('../src/lib/media-variants.js');
  mkdirSync(path.join(assetsDir, JOB), { recursive: true });
  const image = path.join(assetsDir, JOB, 'photo-0.png');
  const video = path.join(assetsDir, JOB, 'clip.mp4');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1920x1080:rate=1:duration=1', '-frames:v', '1', image], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1280x720:rate=24:duration=1', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video], { stdio: 'ignore' });
  const before = statSync(image).size;

  const tiny = await ensureImageVariant(JOB, 'photo-0.png', 32);
  const small = await ensureImageVariant(JOB, 'photo-0.png', 480);
  assert.ok(tiny && small);
  assert.ok(statSync(tiny!).size < 4_000, 'the blur preview is a few hundred bytes to a few KB');
  assert.ok(statSync(small!).size < before);
  assert.equal(readFileSync(tiny!).subarray(0, 2).toString('hex'), 'ffd8');   // a JPEG
  assert.equal(statSync(image).size, before);
  assert.equal(await ensureImageVariant(JOB, 'photo-0.png', 480), small);   // the second ask reuses the first

  const poster = await ensureVideoPoster(JOB, 'clip.mp4');
  assert.ok(poster && statSync(poster).size > 0);
  // wrong kinds and missing files give nothing, never an error and never the original
  assert.equal(await ensureVideoPoster(JOB, 'photo-0.png'), null);
  assert.equal(await ensureImageVariant(JOB, 'clip.mp4', 480), null);
  assert.equal(await ensureImageVariant(JOB, 'missing.png', 32), null);
  assert.equal(await ensureImageVariant(JOB, '../../etc/passwd', 32), null);
});

test('the asset route serves previews with the original\'s signature and never falls back to the whole file for a tiny one', async () => {
  const route = readFileSync(path.resolve(process.cwd(), 'src/routes/index.ts'), 'utf8');
  assert.match(route, /req\.query\.poster === '1'/);
  assert.match(route, /parseVariantWidth\(req\.query\.w\)/);
  assert.match(route, /wantsPoster \|\| \(variantWidth !== null && variantWidth <= 64\)/);
  // the signature is checked before any preview work
  assert.ok(route.indexOf('verifyPrivateAssetSignature(jobId, filename') < route.indexOf('ensureImageVariant(jobId'));
});

test('a preview is really delivered over HTTP (Express refuses files inside dot-folders, which broke the first version)', { skip: !hasFfmpeg }, async () => {
  const { default: express } = await import('express');
  const { ensureImageVariant, sendVariantFile } = await import('../src/lib/media-variants.js');
  mkdirSync(path.join(assetsDir, JOB), { recursive: true });
  const image = path.join(assetsDir, JOB, 'http-photo.png');
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=1600x900:rate=1:duration=1', '-frames:v', '1', image], { stdio: 'ignore' });
  const variant = await ensureImageVariant(JOB, 'http-photo.png', 960);
  assert.ok(variant);
  assert.ok(!variant!.split(path.sep).some((part) => part.startsWith('.') && part.length > 1 && part !== '..'), 'the preview folder is not a dot-folder: ' + variant);

  const app = express();
  app.get('/ok', async (_req, res) => { if (!(await sendVariantFile(res, variant!, 'private, max-age=60'))) res.status(500).end('fell back'); });
  app.get('/missing', async (_req, res) => { const sent = await sendVariantFile(res, path.join(assetsDir, 'nothing-here.jpg'), 'private, max-age=60'); if (!sent) res.status(404).json({ fellBack: true, type: res.getHeader('content-type') ?? null }); });
  const server = app.listen(0);
  try {
    const { port } = server.address() as { port: number };
    const ok = await fetch(`http://127.0.0.1:${port}/ok`);
    assert.equal(ok.status, 200);
    assert.equal(ok.headers.get('content-type'), 'image/jpeg');
    assert.equal(ok.headers.get('cache-control'), 'private, max-age=60');
    const bytes = Buffer.from(await ok.arrayBuffer());
    assert.equal(bytes.subarray(0, 2).toString('hex'), 'ffd8');
    assert.ok(bytes.length < statSync(image).size);
    // a file that cannot be sent never leaves a wrong content type behind for the fallback
    const missing = await fetch(`http://127.0.0.1:${port}/missing`);
    assert.equal(missing.status, 404);
    assert.deepEqual(await missing.json(), { fellBack: true, type: null });
  } finally {
    server.close();
  }
});
