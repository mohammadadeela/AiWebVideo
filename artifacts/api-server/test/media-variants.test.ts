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
