import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { addBrandClosingOverlay, createMusicOnlyBed, finishAudio } from '../src/lib/veo.js';
import { ASSETS_DIR } from '../src/lib/capture.js';

const execFileAsync = promisify(execFile);

/**
 * Real, no-mock coverage for the final audio mix step. This exists because a
 * previous version of finishAudio used `-shortest` in a way that silently cut
 * narration short whenever TTS ran longer than the assembled AI-video clips
 * (a real production bug — Step 20 in the engineering brief explicitly bans
 * this). These tests run actual ffmpeg against tiny synthetic clips and
 * assert on the real output duration, so a regression here fails loudly
 * instead of only showing up against a real multi-minute render.
 */

async function ffprobeDuration(file: string): Promise<number> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]);
  return Number(stdout.trim());
}

async function ffprobeHasAudio(file: string): Promise<boolean> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file,
  ]);
  return Boolean(stdout.trim());
}

async function makeSyntheticVideo(dir: string, name: string, seconds: number, withAudio: boolean): Promise<string> {
  const output = path.join(dir, name);
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `color=c=blue:s=320x240:d=${seconds}`];
  if (withAudio) args.push('-f', 'lavfi', '-i', `sine=frequency=220:duration=${seconds}`);
  args.push('-c:v', 'libx264', '-pix_fmt', 'yuv420p');
  if (withAudio) args.push('-c:a', 'aac', '-shortest');
  else args.push('-an');
  args.push(output);
  await execFileAsync('ffmpeg', args);
  return output;
}

async function makeSyntheticAudio(dir: string, name: string, seconds: number): Promise<string> {
  const output = path.join(dir, name);
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', `sine=frequency=440:duration=${seconds}`,
    '-c:a', 'aac', output,
  ]);
  return output;
}

test('silent mode strips audio entirely', { concurrency: false }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-mix-'));
  try {
    const source = await makeSyntheticVideo(dir, 'source.mp4', 3, true);
    const output = path.join(dir, 'out.mp4');
    await finishAudio(source, output, true, null, true);
    assert.equal(await ffprobeHasAudio(output), false);
    const dur = await ffprobeDuration(output);
    assert.ok(Math.abs(dur - 3) < 0.3, `expected ~3s, got ${dur}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('no narration and no native audio copies source through unchanged', { concurrency: false }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-mix-'));
  try {
    const source = await makeSyntheticVideo(dir, 'source.mp4', 3, false);
    const output = path.join(dir, 'out.mp4');
    await finishAudio(source, output, false, null, false);
    const dur = await ffprobeDuration(output);
    assert.ok(Math.abs(dur - 3) < 0.3, `expected ~3s, got ${dur}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('narration shorter than the video does not extend the video', { concurrency: false }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-mix-'));
  try {
    const source = await makeSyntheticVideo(dir, 'source.mp4', 5, true);
    const narration = await makeSyntheticAudio(dir, 'narration.mp4', 2);
    const output = path.join(dir, 'out.mp4');
    await finishAudio(source, output, false, narration, true);
    const dur = await ffprobeDuration(output);
    assert.ok(Math.abs(dur - 5) < 0.4, `video should stay ~5s when narration is shorter, got ${dur}`);
    assert.equal(await ffprobeHasAudio(output), true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

// Regression test for the real bug: TTS narration running longer than the
// assembled AI clips must never be cut short. The final video must be
// extended (frozen last frame) to fit the full narration instead.
test('narration longer than the video extends the video instead of truncating narration', { concurrency: false }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-mix-'));
  try {
    const source = await makeSyntheticVideo(dir, 'source.mp4', 3, true);
    const narration = await makeSyntheticAudio(dir, 'narration.mp4', 7);
    const output = path.join(dir, 'out.mp4');
    await finishAudio(source, output, false, narration, true);
    const dur = await ffprobeDuration(output);
    assert.ok(dur >= 6.6, `expected the output to extend to ~7s to fit narration, got ${dur}`);
    assert.equal(await ffprobeHasAudio(output), true);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('narration longer than a silent (no native audio) clip still extends instead of truncating', { concurrency: false }, async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'audio-mix-'));
  try {
    const source = await makeSyntheticVideo(dir, 'source.mp4', 2, false);
    const narration = await makeSyntheticAudio(dir, 'narration.mp4', 6);
    const output = path.join(dir, 'out.mp4');
    await finishAudio(source, output, false, narration, false);
    const dur = await ffprobeDuration(output);
    assert.ok(dur >= 5.6, `expected the output to extend to ~6s to fit narration, got ${dur}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('music-only fallback creates an audio bed without any voice source', { concurrency: false }, async () => {
  const jobId = `music-test-${Date.now()}`;
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  try {
    const music = await createMusicOnlyBed(jobId, 2.5);
    assert.equal(await ffprobeHasAudio(music), true);
    const dur = await ffprobeDuration(music);
    assert.ok(Math.abs(dur - 2.5) < 0.35, `expected ~2.5s, got ${dur}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('branded ending overlays the captured website icon and exact site name', { concurrency: false }, async () => {
  const jobId = `brand-test-${Date.now()}`;
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  try {
    const source = await makeSyntheticVideo(dir, 'source.mp4', 3, true);
    const icon = path.join(dir, 'website-icon.jpg');
    await execFileAsync('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi', '-i', 'color=c=purple:s=512x512:d=0.1', '-frames:v', '1', icon]);
    const output = path.join(dir, 'branded.mp4');
    await addBrandClosingOverlay(source, output, jobId, 'Example Website');
    assert.equal(await ffprobeHasAudio(output), true);
    const dur = await ffprobeDuration(output);
    assert.ok(Math.abs(dur - 3) < 0.4, `expected ~3s, got ${dur}`);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
