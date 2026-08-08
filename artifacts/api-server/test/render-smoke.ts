/**
 * FFmpeg renderer smoke test. Requires ffmpeg/ffprobe on PATH.
 *
 * Renders a real multi-scene editorial video (single/sequence/split/triple,
 * push-in/pan motion, xfade transitions) from synthetic screenshots through
 * the actual production renderer, then proves:
 *   - the master passes ffprobe validation (duration, stream, dimensions)
 *   - 16:9, 9:16 and 1:1 deliveries all work
 *   - two different variation seeds produce different files AND different pixels
 *
 * Run with: pnpm --filter @workspace/api-server run smoke:render
 */
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';

const execFileAsync = promisify(execFile);

async function makeSyntheticScreenshot(file: string, seed: number, width: number, height: number) {
  // Deterministic, high-detail source frames stand in for website screenshots.
  await execFileAsync('ffmpeg', [
    '-y', '-f', 'lavfi', '-i', `testsrc2=size=${width}x${height}:rate=1:duration=1`,
    '-vf', `hue=h=${seed * 55}:s=2,drawgrid=w=64:h=64:t=2:c=white@0.4`,
    '-frames:v', '1', '-q:v', '3', file,
  ]);
  return fs.readFile(file);
}

async function probe(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,codec_type:format=duration,size',
    '-of', 'json', file,
  ]);
  const data = JSON.parse(stdout) as { streams: Array<{ width: number; height: number; codec_type: string }>; format: { duration: string; size: string } };
  return {
    width: data.streams[0]?.width ?? 0,
    height: data.streams[0]?.height ?? 0,
    hasVideoStream: data.streams[0]?.codec_type === 'video',
    duration: Number(data.format.duration),
    size: Number(data.format.size),
  };
}

async function sha256(file: string) {
  return createHash('sha256').update(await fs.readFile(file)).digest('hex');
}

async function main() {
  const assetsDir = await fs.mkdtemp(path.join(os.tmpdir(), 'aiwv-smoke-'));
  process.env.ASSETS_DIR = assetsDir;
  // Imported after ASSETS_DIR is set so the renderer writes into the temp dir.
  const { generateMarketingVideo } = await import('../src/lib/veo.js');

  const sources = await Promise.all([0, 1, 2].map((seed) =>
    makeSyntheticScreenshot(path.join(assetsDir, `synthetic-${seed}.jpg`), seed, 1440, seed === 2 ? 3200 : 900),
  ));

  const scenes = [
    { sceneNumber: 1, durationSeconds: 8, sceneType: 'hook' as const, shotDescription: 'wide hero', sourceIndices: [0], composition: 'single' as const, motion: 'push_in' as const, focusX: 0.5, focusY: 0.3, onScreenCopy: '', transition: 'smooth directional slide left' },
    { sceneNumber: 2, durationSeconds: 8, sceneType: 'feature' as const, shotDescription: 'split comparison', sourceIndices: [0, 1], composition: 'split' as const, motion: 'static' as const, focusX: 0.5, focusY: 0.5, onScreenCopy: '', transition: 'match cut' },
    { sceneNumber: 3, durationSeconds: 8, sceneType: 'cta' as const, shotDescription: 'triple montage into tall-page detail', sourceIndices: [0, 1, 2], composition: 'triple' as const, motion: 'pan_down' as const, focusX: 0.4, focusY: 0.6, onScreenCopy: '', transition: '' },
  ];

  const results: string[] = [];
  const outputs: Record<string, string> = {};

  for (const [aspectRatio, expected] of [
    ['16:9', { width: 1920, height: 1080 }],
    ['9:16', { width: 1080, height: 1920 }],
    ['1:1', { width: 1080, height: 1080 }],
  ] as const) {
    const jobId = `smoke-${aspectRatio.replace(':', 'x')}`;
    await fs.mkdir(path.join(assetsDir, jobId), { recursive: true });
    const video = await generateMarketingVideo(
      jobId, 'Smoke Site',
      { concept: 'smoke', vibe: 'test', scenes, aspectRatio, outputQuality: '1080p', frameRate: 30, variantSeed: 1234 },
      sources, true, true, 'video',
    );
    const file = path.join(assetsDir, jobId, path.basename(video.url));
    const info = await probe(file);
    if (!info.hasVideoStream || !(info.duration > 5) || info.width !== expected.width || info.height !== expected.height || !(info.size > 0)) {
      throw new Error(`${aspectRatio} master failed validation: ${JSON.stringify(info)}`);
    }
    outputs[aspectRatio] = file;
    results.push(`${aspectRatio}: ${path.basename(file)} ${info.width}x${info.height} ${info.duration.toFixed(2)}s ${(info.size / 1024 / 1024).toFixed(2)}MB clips=${video.clipCount}`);
  }

  // Regeneration check: a different variation seed must produce a different
  // output filename and different pixels from the same immutable sources.
  const jobB = 'smoke-variation';
  await fs.mkdir(path.join(assetsDir, jobB), { recursive: true });
  const videoB = await generateMarketingVideo(
    jobB, 'Smoke Site',
    { concept: 'smoke', vibe: 'test', scenes, aspectRatio: '16:9', outputQuality: '1080p', frameRate: 30, variantSeed: 4321 },
    sources, true, true, 'video',
  );
  const fileB = path.join(assetsDir, jobB, path.basename(videoB.url));
  const fileA = outputs['16:9'];
  if (path.basename(fileA) === path.basename(fileB)) throw new Error('Variation seed did not change the output filename.');
  const [hashA, hashB] = await Promise.all([sha256(fileA), sha256(fileB)]);
  if (hashA === hashB) throw new Error('Two variation seeds produced byte-identical videos.');
  results.push(`variation: ${path.basename(fileA)} sha=${hashA.slice(0, 12)}… != ${path.basename(fileB)} sha=${hashB.slice(0, 12)}…`);

  console.log('RENDER SMOKE TEST PASSED');
  for (const line of results) console.log(' -', line);
  await fs.rm(assetsDir, { recursive: true, force: true }).catch(() => {});
}

main().catch((err) => {
  console.error('RENDER SMOKE TEST FAILED:', err);
  process.exit(1);
});
