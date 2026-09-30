import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import { hasFastStart, isPhoneReady, optimizeShowcaseVideo } from '../src/lib/media-optimize.js';

const run = promisify(execFile);
async function hasFfmpeg() {
  try { await run('ffmpeg', ['-version']); return true; } catch { return false; }
}

async function probe(file: string) {
  const { stdout } = await run('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=codec_name,pix_fmt,width,height', '-of', 'default=nw=1', file]);
  const v = Object.fromEntries(stdout.trim().split('\n').map((line) => line.split('=') as [string, string]));
  return { codec: v.codec_name, pixFmt: v.pix_fmt, width: Number(v.width), height: Number(v.height) };
}

test('a slow-start HEVC upload becomes a phone-ready H.264 file with a poster', async (t) => {
  if (!(await hasFfmpeg())) return t.skip('ffmpeg is not installed here');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'opt-test-'));
  try {
    const bad = path.join(dir, 'bad.mp4');
    // HEVC + no faststart (index at the end) + audio: the kind of file that "plays only after a long time".
    await run('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=540x960:rate=24:duration=2', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=2',
      '-c:v', 'libx265', '-pix_fmt', 'yuv420p', '-tag:v', 'hvc1', '-c:a', 'aac', '-shortest', bad], { timeout: 60_000 });
    const before = await fs.readFile(bad);
    assert.equal(hasFastStart(before), false, 'fixture must start slow');
    assert.equal(await isPhoneReady(bad), false);

    const result = await optimizeShowcaseVideo(before, '.mp4');
    assert.equal(result.optimized, true);
    assert.equal(result.extension, '.mp4');
    assert.ok(result.poster && result.poster.length > 500, 'poster frame is produced');

    const good = path.join(dir, 'good.mp4');
    await fs.writeFile(good, result.video);
    assert.equal(hasFastStart(result.video), true, 'index moved to the front');
    assert.equal(await isPhoneReady(good), true);
    const info = await probe(good);
    assert.equal(info.codec, 'h264');
    assert.equal(info.pixFmt, 'yuv420p');
    assert.equal(info.height, 960, 'portrait size is preserved, not shrunk');
  } finally { await fs.rm(dir, { recursive: true, force: true }); }
});

test('corrupt input never loses the upload: the original bytes come back', async (t) => {
  if (!(await hasFfmpeg())) return t.skip('ffmpeg is not installed here');
  const junk = Buffer.from('this is not a video');
  const result = await optimizeShowcaseVideo(junk, '.mp4');
  assert.equal(result.optimized, false);
  assert.deepEqual(result.video, junk);
});
