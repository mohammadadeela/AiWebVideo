import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { normalizeUploadToJpeg, sanitizeUploadTitle, uploadPhotoLabel } from '../src/lib/uploads.js';

const execFileAsync = promisify(execFile);

/**
 * Real, no-mock coverage for normalizeUploadToJpeg — it shells out to
 * ffmpeg, so a synthetic PNG/JPEG is generated and actually run through the
 * real function, then the output is verified with ffprobe. This exists
 * because the exact ffmpeg build this app runs on turned out to have no
 * HEIC/HEIF decoding support (checked directly: `ffmpeg -formats` /
 * `-codecs` show nothing for heic/heif) — a real, concrete gap that would
 * otherwise only surface as a silent per-file failure in production.
 */

async function ffprobe(file: string): Promise<{ width: number; height: number; codec: string }> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_name',
    '-of', 'csv=p=0', file,
  ]);
  const [codec, width, height] = stdout.trim().split(',');
  return { width: Number(width), height: Number(height), codec };
}

test('normalizes a PNG upload to real JPEG bytes', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-norm-'));
  try {
    const pngPath = path.join(dir, 'in.png');
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=blue:s=800x600', '-frames:v', '1', pngPath]);
    const png = await fs.readFile(pngPath);

    const jpeg = await normalizeUploadToJpeg(png);
    const outPath = path.join(dir, 'out.jpg');
    await fs.writeFile(outPath, jpeg);

    const info = await ffprobe(outPath);
    assert.equal(info.codec, 'mjpeg');
    assert.equal(info.width, 800);
    assert.equal(info.height, 600);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('caps oversized images to the max dimension while preserving aspect ratio', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-norm-'));
  try {
    const bigPath = path.join(dir, 'in.jpg');
    // 4000x2000, 2:1 aspect ratio, both dimensions over the 2400 cap.
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=red:s=4000x2000', '-frames:v', '1', '-q:v', '3', bigPath]);
    const big = await fs.readFile(bigPath);

    const jpeg = await normalizeUploadToJpeg(big);
    const outPath = path.join(dir, 'out.jpg');
    await fs.writeFile(outPath, jpeg);

    const info = await ffprobe(outPath);
    assert.ok(info.width <= 2400 && info.height <= 2400, `expected capped dimensions, got ${info.width}x${info.height}`);
    // Aspect ratio (2:1) must be preserved within rounding.
    assert.ok(Math.abs(info.width / info.height - 2) < 0.02, `expected ~2:1 aspect ratio, got ${info.width}x${info.height}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('leaves already-small images at their original size', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'upload-norm-'));
  try {
    const smallPath = path.join(dir, 'in.jpg');
    await execFileAsync('ffmpeg', ['-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=green:s=400x300', '-frames:v', '1', '-q:v', '3', smallPath]);
    const small = await fs.readFile(smallPath);

    const jpeg = await normalizeUploadToJpeg(small);
    const outPath = path.join(dir, 'out.jpg');
    await fs.writeFile(outPath, jpeg);

    const info = await ffprobe(outPath);
    assert.equal(info.width, 400);
    assert.equal(info.height, 300);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('rejects unreadable/corrupt input with a friendly error instead of a raw ffmpeg failure', async () => {
  await assert.rejects(
    () => normalizeUploadToJpeg(Buffer.from('this is not an image')),
    /could not be read as an image/i,
  );
});

test('sanitizeUploadTitle trims, collapses whitespace, and falls back sensibly', () => {
  assert.equal(sanitizeUploadTitle('  My   Product Shots  '), 'My Product Shots');
  assert.equal(sanitizeUploadTitle(''), 'Your uploaded photos');
  assert.equal(sanitizeUploadTitle(null), 'Your uploaded photos');
  assert.equal(sanitizeUploadTitle('a'.repeat(200)).length, 120);
});

test('uploadPhotoLabel produces a readable label with or without a filename', () => {
  assert.equal(uploadPhotoLabel(0, 'product_front.jpg'), 'Uploaded photo: product front');
  assert.equal(uploadPhotoLabel(2, undefined), 'Uploaded photo 3');
});
