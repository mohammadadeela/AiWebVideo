import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';

const run = promisify(execFile);

test('the upload preview filter processes a PNG and video with valid JPEG output', async () => {
  const source = await readFile(new URL('../src/routes/inspiration.ts', import.meta.url), 'utf8');
  const filter = source.match(/'-vf', '(scale=960:[^']+)'/)?.[1];
  assert.ok(filter, 'the upload route must use the validated thumbnail filter');
  const directory = await mkdtemp(path.join(tmpdir(), 'inspiration-preview-'));
  try {
    for (const [extension, extra] of [
      ['png', []],
      ['mp4', ['-t', '1', '-c:v', 'mpeg4']],
    ] as const) {
      const input = path.join(directory, `creative.${extension}`);
      const poster = path.join(directory, `preview-${extension}.jpg`);
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi',
        '-i', 'color=c=blue:s=576x324', ...extra, '-frames:v', '1', input]);
      await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', input,
        '-frames:v', '1', '-vf', filter, '-q:v', '4', poster]);
      assert.ok((await stat(poster)).size > 100);
      const { stdout } = await run('ffprobe', ['-v', 'error', '-show_entries', 'stream=width,height', '-of', 'csv=p=0', poster]);
      assert.equal(stdout.trim(), '960,540');
    }
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
});

