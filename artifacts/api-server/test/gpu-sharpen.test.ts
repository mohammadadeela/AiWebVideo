import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { sharpenGpuClip } from '../src/lib/self-hosted.js';

const execFileAsync = promisify(execFile);

/**
 * Real, no-mock coverage for the GPU-clip post-processing sharpening added
 * to address a real quality complaint: the self-hosted worker runs
 * wan2.2-ti2v-5b, a small (5B parameter) open video model that documented
 * community testing confirms renders noticeably softer detail than larger
 * commercial models. This applies a mild unsharp mask specifically to
 * GPU-sourced clips (never to Gemini/Veo output, which doesn't need it).
 */

async function ffprobeCodec(file: string): Promise<string> {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name', '-of', 'csv=p=0', file,
  ]);
  return stdout.trim();
}

test('sharpenGpuClip produces a valid, decodable output clip', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gpu-sharpen-'));
  try {
    const input = path.join(dir, 'in.mp4');
    const output = path.join(dir, 'out.mp4');
    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', input,
    ]);
    await sharpenGpuClip(input, output);
    const codec = await ffprobeCodec(output);
    assert.equal(codec, 'h264');
    const stat = await fs.stat(output);
    assert.ok(stat.size > 0);
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('sharpenGpuClip preserves the audio track', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gpu-sharpen-'));
  try {
    const input = path.join(dir, 'in.mp4');
    const output = path.join(dir, 'out.mp4');
    await execFileAsync('ffmpeg', [
      '-y', '-loglevel', 'error', '-f', 'lavfi', '-i', 'testsrc=size=320x240:duration=2',
      '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-shortest', input,
    ]);
    await sharpenGpuClip(input, output);
    const { stdout } = await execFileAsync('ffprobe', [
      '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', output,
    ]);
    assert.equal(stdout.trim(), 'audio');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});

test('sharpenGpuClip falls back to copying the original clip if ffmpeg fails on unreadable input', async () => {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'gpu-sharpen-'));
  try {
    const input = path.join(dir, 'in.mp4');
    const output = path.join(dir, 'out.mp4');
    await fs.writeFile(input, 'not a real video file');
    // Must not throw — a failed sharpen pass should never lose the scene.
    await sharpenGpuClip(input, output);
    const outputContent = await fs.readFile(output, 'utf-8');
    assert.equal(outputContent, 'not a real video file');
  } finally {
    await fs.rm(dir, { recursive: true, force: true });
  }
});
