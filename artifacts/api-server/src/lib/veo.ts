import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { ASSETS_DIR } from './capture.js';
import type { Storyboard, StoryboardScene } from './gemini.js';

const execFileAsync = promisify(execFile);
const CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.VIDEO_CONCURRENCY ?? 2)));
const CROSSFADE_SECONDS = 0.28;
const INTERNAL_CROSSFADE_SECONDS = 0.20;

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export interface GeneratedVideo {
  url: string;
  aspectRatio: VideoAspectRatio;
  clipCount: number;
  outputQuality: '1080p' | '4k';
  frameRate: 30 | 60;
}

interface VideoOptions {
  aspectRatio: VideoAspectRatio;
  outputQuality: '1080p' | '4k';
  frameRate: 30 | 60;
  silent: boolean;
  creativeBrief?: string;
  mode?: string;
  variantSeed: number;
}

/**
 * Scene clips are rendered at the final 1080p-class resolution so the master
 * never upscales soft 720p intermediates. 4K masters upscale from this base.
 */
function sceneFrame(aspectRatio: VideoAspectRatio) {
  if (aspectRatio === '9:16') return { width: 1080, height: 1920 };
  if (aspectRatio === '1:1') return { width: 1080, height: 1080 };
  return { width: 1920, height: 1080 };
}

function masterFrame(aspectRatio: VideoAspectRatio, quality: '1080p' | '4k') {
  const scale = quality === '4k' ? 2 : 1;
  const base = sceneFrame(aspectRatio);
  return { width: base.width * scale, height: base.height * scale };
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? value : min));
}

function sceneSourceIndices(scene: StoryboardScene, sceneIndex: number, validIndices: number[]) {
  const requested = (scene.sourceIndices ?? [])
    .filter((value) => Number.isInteger(value) && validIndices.includes(value));
  const unique = [...new Set(requested)];
  if (unique.length) return unique.slice(0, 3);
  return [validIndices[sceneIndex % validIndices.length]];
}

export function supportedTransition(direction: string | undefined, fallbackIndex = 0) {
  const value = (direction ?? '').toLowerCase();
  if (value.includes('wipe')) return value.includes('up') ? 'wipeup' : value.includes('right') ? 'wiperight' : 'wipeleft';
  if (value.includes('slide')) return value.includes('up') ? 'slideup' : value.includes('right') ? 'slideright' : 'slideleft';
  if (value.includes('smooth')) return value.includes('up') ? 'smoothup' : value.includes('right') ? 'smoothright' : 'smoothleft';
  if (value.includes('match') || value.includes('cut')) return 'fadefast';
  if (value.includes('dissolve') || value.includes('fade')) return 'fade';
  return ['fadefast', 'smoothleft', 'wipeleft', 'slideleft', 'smoothup'][fallbackIndex % 5];
}

async function duration(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]);
  const value = Number(stdout.trim());
  if (!Number.isFinite(value)) throw new Error(`Could not inspect ${file}.`);
  return value;
}

async function hasAudio(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file,
  ]).catch(() => ({ stdout: '' }));
  return stdout.trim().length > 0;
}

async function dimensions(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=p=0:s=x', file,
  ]);
  const [width, height] = stdout.trim().split('x').map(Number);
  return { width, height };
}

/** Reject obviously blank/placeholder captures before they can create gray scenes. */
async function imageHasUsefulVisualRange(file: string) {
  try {
    const { stdout } = await execFileAsync('ffmpeg', [
      '-hide_banner', '-loglevel', 'error', '-i', file,
      '-vf', 'scale=64:64,signalstats,metadata=print:file=-', '-frames:v', '1', '-f', 'null', '-',
    ], { timeout: 30_000, maxBuffer: 2 * 1024 * 1024 });
    const read = (name: string) => Number(new RegExp(`lavfi\\.signalstats\\.${name}=([0-9.]+)`).exec(stdout)?.[1] ?? NaN);
    const min = read('YMIN');
    const max = read('YMAX');
    const low = read('YLOW');
    const high = read('YHIGH');
    if (![min, max, low, high].every(Number.isFinite)) return true;
    return (max - min) >= 20 && (high - low) >= 5;
  } catch {
    return true;
  }
}

async function validateReferenceImages(jobId: string, referenceImages: Buffer[]) {
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const checks = await Promise.all(referenceImages.map(async (source, index) => {
    const file = path.join(dir, `capture-validation-${index}.jpg`);
    await fs.writeFile(file, source);
    return (await imageHasUsefulVisualRange(file)) ? index : -1;
  }));
  const valid = checks.filter((index) => index >= 0);
  const rejected = checks.filter((index) => index < 0).length;
  if (rejected > 0) {
    console.warn(`[video] job=${jobId} rejected ${rejected} blank/low-information capture(s) before scene planning`);
  }
  // Never fail only because the heuristic was too strict; source pixels are
  // still safer than fabricating replacement content.
  return valid.length ? valid : referenceImages.map((_, index) => index);
}

function cropExpressions(scene: StoryboardScene, durationSeconds: number, movementVariant: number) {
  const focusX = clamp(Number(scene.focusX ?? 0.5));
  const focusY = clamp(Number(scene.focusY ?? 0.5));
  const motion = scene.motion ?? 'push_in';
  const amp = movementVariant === 0 ? 0.035 : movementVariant === 1 ? 0.055 : 0.075;
  const p = `(t/${Math.max(0.1, durationSeconds).toFixed(3)})`;
  let xFraction = `${focusX.toFixed(4)}`;
  let yFraction = `${focusY.toFixed(4)}`;

  if (motion === 'pan_left') xFraction = `${clamp(focusX + amp).toFixed(4)}-${(amp * 2).toFixed(4)}*${p}`;
  else if (motion === 'pan_right') xFraction = `${clamp(focusX - amp).toFixed(4)}+${(amp * 2).toFixed(4)}*${p}`;
  else if (motion === 'pan_up') yFraction = `${clamp(focusY + amp).toFixed(4)}-${(amp * 2).toFixed(4)}*${p}`;
  else if (motion === 'pan_down') yFraction = `${clamp(focusY - amp).toFixed(4)}+${(amp * 2).toFixed(4)}*${p}`;
  else if (motion === 'push_in') {
    xFraction = `${clamp(focusX - amp / 3).toFixed(4)}+${(amp * 0.65).toFixed(4)}*${p}`;
    yFraction = `${clamp(focusY - amp / 3).toFixed(4)}+${(amp * 0.65).toFixed(4)}*${p}`;
  } else if (motion === 'pull_out') {
    xFraction = `${clamp(focusX + amp / 3).toFixed(4)}-${(amp * 0.65).toFixed(4)}*${p}`;
    yFraction = `${clamp(focusY + amp / 3).toFixed(4)}-${(amp * 0.65).toFixed(4)}*${p}`;
  }

  const x = `'clip((iw-ow)*(${xFraction}),0,max(0,iw-ow))'`;
  const y = `'clip((ih-oh)*(${yFraction}),0,max(0,ih-oh))'`;
  return { x, y };
}

/**
 * Build a short editorial shot from one immutable screenshot. The screenshot is
 * never sent to a generative video model: only scale/crop/position are animated.
 */
async function prepareScreenshotClip(
  jobId: string,
  source: Buffer,
  sceneIndex: number,
  shotIndex: number,
  options: VideoOptions,
  seconds: number,
  scene: StoryboardScene,
  detailBoost = 0,
) {
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const image = path.join(dir, `real-site-source-${sceneIndex}-${shotIndex}.jpg`);
  const output = path.join(dir, `real-site-shot-${sceneIndex}-${shotIndex}.mp4`);
  await fs.writeFile(image, source);
  const size = await dimensions(image);
  const { width, height } = sceneFrame(options.aspectRatio);
  const durationSeconds = Math.max(1.4, Math.min(12, seconds || 3));
  const sourceAspect = size.width / Math.max(1, size.height);
  const targetAspect = width / height;
  const tallCapture = sourceAspect < targetAspect * 0.86;
  const detail = scene.composition === 'single' ? detailBoost : detailBoost + 0.01;
  const baseZoom = scene.motion === 'push_in' ? 1.095 : scene.motion === 'pull_out' ? 1.045 : 1.065;
  const seedZoom = (((options.variantSeed % 9) - 4) * 0.003);
  const zoom = Math.max(1.025, baseZoom + detail * 0.065 + seedZoom);
  const scaleWidth = Math.max(width, Math.round(width * zoom));
  const scaleHeight = Math.max(height, Math.round(height * zoom));
  const movementVariant = (shotIndex + detailBoost + options.variantSeed) % 3;
  const seedX = (((options.variantSeed % 17) - 8) * 0.004);
  const seedY = ((((Math.floor(options.variantSeed / 17)) % 17) - 8) * 0.004);
  const variedScene: StoryboardScene = {
    ...scene,
    focusX: clamp(Number(scene.focusX ?? 0.5) + seedX),
    focusY: clamp(Number(scene.focusY ?? 0.5) + seedY),
  };
  const { x, y } = cropExpressions(variedScene, durationSeconds, movementVariant);

  // For tall full-page captures, this is intentionally a small focal drift,
  // not a top-to-bottom scroll. That removes the "normal screen recording" look.
  const filter = tallCapture
    ? `scale=${scaleWidth}:-2:flags=lanczos,crop=${width}:${height}:${x}:${y},setsar=1`
    : `scale=${scaleWidth}:${scaleHeight}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height}:${x}:${y},setsar=1`;

  await execFileAsync('ffmpeg', [
    '-y', '-loop', '1', '-t', String(durationSeconds), '-i', image,
    '-f', 'lavfi', '-t', String(durationSeconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-map', '0:v:0', '-map', '1:a:0', '-vf', filter,
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', output,
  ], { timeout: 8 * 60_000, maxBuffer: 16 * 1024 * 1024 });
  return output;
}

async function prepareSplitScreenClip(
  jobId: string,
  primary: Buffer,
  secondary: Buffer,
  sceneIndex: number,
  options: VideoOptions,
  seconds: number,
) {
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const first = path.join(dir, `real-site-split-${sceneIndex}-a.jpg`);
  const second = path.join(dir, `real-site-split-${sceneIndex}-b.jpg`);
  const output = path.join(dir, `real-site-split-${sceneIndex}.mp4`);
  await Promise.all([fs.writeFile(first, primary), fs.writeFile(second, secondary)]);
  const landscape = options.aspectRatio !== '9:16';
  const { width, height } = sceneFrame(options.aspectRatio);
  const gap = 6;
  const panelWidth = Math.floor((width - gap) / 2);
  const panelHeight = Math.floor((height - gap) / 2);
  const durationSeconds = Math.max(2.0, Math.min(12, seconds || 3));
  const filter = landscape
    ? `[0:v]scale=${panelWidth}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${panelWidth}:${height}:(iw-ow)/2:(ih-oh)/2,setsar=1[left];` +
      `[1:v]scale=${panelWidth}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${panelWidth}:${height}:(iw-ow)/2:(ih-oh)/2,setsar=1[right];` +
      `color=c=0x080808:s=${width}x${height}:d=${durationSeconds}[bg];` +
      `[bg][left]overlay=0:0[tmp];[tmp][right]overlay=${Math.ceil((width + gap) / 2)}:0[v]`
    : `[0:v]scale=${width}:${panelHeight}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${panelHeight}:(iw-ow)/2:(ih-oh)/2,setsar=1[top];` +
      `[1:v]scale=${width}:${panelHeight}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${panelHeight}:(iw-ow)/2:(ih-oh)/2,setsar=1[bottom];` +
      `color=c=0x080808:s=${width}x${height}:d=${durationSeconds}[bg];` +
      `[bg][top]overlay=0:0[tmp];[tmp][bottom]overlay=0:${Math.ceil((height + gap) / 2)}[v]`;
  await execFileAsync('ffmpeg', [
    '-y', '-loop', '1', '-t', String(durationSeconds), '-i', first,
    '-loop', '1', '-t', String(durationSeconds), '-i', second,
    '-f', 'lavfi', '-t', String(durationSeconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex', filter, '-map', '[v]', '-map', '2:a:0',
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', output,
  ], { timeout: 8 * 60_000, maxBuffer: 16 * 1024 * 1024 });
  return output;
}

async function prepareTriplePanelClip(
  jobId: string,
  sources: Buffer[],
  sceneIndex: number,
  options: VideoOptions,
  seconds: number,
) {
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const files = sources.slice(0, 3).map((_, offset) => path.join(dir, `real-site-triple-${sceneIndex}-${offset}.jpg`));
  await Promise.all(files.map((file, offset) => fs.writeFile(file, sources[offset])));
  const output = path.join(dir, `real-site-triple-${sceneIndex}.mp4`);
  const landscape = options.aspectRatio !== '9:16';
  const { width, height } = sceneFrame(options.aspectRatio);
  const gap = 6;
  const durationSeconds = Math.max(2.0, Math.min(12, seconds || 3));
  let filter: string;
  if (landscape) {
    const w1 = Math.floor(width * 0.5);
    const w2 = width - w1 - gap;
    const h2 = Math.floor((height - gap) / 2);
    filter = `[0:v]scale=${w1}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w1}:${height}:(iw-ow)/2:(ih-oh)/2,setsar=1[a];` +
      `[1:v]scale=${w2}:${h2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w2}:${h2}:(iw-ow)/2:(ih-oh)/2,setsar=1[b];` +
      `[2:v]scale=${w2}:${h2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w2}:${h2}:(iw-ow)/2:(ih-oh)/2,setsar=1[c];` +
      `color=c=0x080808:s=${width}x${height}:d=${durationSeconds}[bg];` +
      `[bg][a]overlay=0:0[t1];[t1][b]overlay=${w1 + gap}:0[t2];[t2][c]overlay=${w1 + gap}:${h2 + gap}[v]`;
  } else {
    const h1 = Math.floor(height * 0.5);
    const h2 = height - h1 - gap;
    const w2 = Math.floor((width - gap) / 2);
    filter = `[0:v]scale=${width}:${h1}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${h1}:(iw-ow)/2:(ih-oh)/2,setsar=1[a];` +
      `[1:v]scale=${w2}:${h2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w2}:${h2}:(iw-ow)/2:(ih-oh)/2,setsar=1[b];` +
      `[2:v]scale=${w2}:${h2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${w2}:${h2}:(iw-ow)/2:(ih-oh)/2,setsar=1[c];` +
      `color=c=0x080808:s=${width}x${height}:d=${durationSeconds}[bg];` +
      `[bg][a]overlay=0:0[t1];[t1][b]overlay=0:${h1 + gap}[t2];[t2][c]overlay=${w2 + gap}:${h1 + gap}[v]`;
  }
  await execFileAsync('ffmpeg', [
    '-y', '-loop', '1', '-t', String(durationSeconds), '-i', files[0],
    '-loop', '1', '-t', String(durationSeconds), '-i', files[1],
    '-loop', '1', '-t', String(durationSeconds), '-i', files[2],
    '-f', 'lavfi', '-t', String(durationSeconds), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000',
    '-filter_complex', filter, '-map', '[v]', '-map', '3:a:0',
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '17', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '128k', '-shortest', '-movflags', '+faststart', output,
  ], { timeout: 8 * 60_000, maxBuffer: 16 * 1024 * 1024 });
  return output;
}

async function stitchNamed(
  jobId: string,
  clips: string[],
  silent: boolean,
  outputName: string,
  transitions?: string[],
) {
  const out = path.join(ASSETS_DIR, jobId, outputName);
  if (clips.length === 1) {
    await fs.copyFile(clips[0], out);
    return out;
  }

  const durations = await Promise.all(clips.map(duration));
  const firstSize = await dimensions(clips[0]);
  const targetWidth = firstSize.width;
  const targetHeight = firstSize.height;
  const useAudio = !silent && (await Promise.all(clips.map(hasAudio))).every(Boolean);
  const inputs = clips.flatMap((clip) => ['-i', clip]);
  const filters: string[] = clips.map((_, index) =>
    `[${index}:v]scale=${targetWidth}:${targetHeight}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${targetWidth}:${targetHeight}:(ow-iw)/2:(oh-ih)/2:color=black,fps=30,format=yuv420p,settb=AVTB,setsar=1[vn${index}]`
  );
  let videoIn = '[vn0]';
  let audioIn = '[0:a]';
  let offset = 0;
  for (let index = 1; index < clips.length; index++) {
    const transitionDuration = outputName.startsWith('editorial-scene-') ? INTERNAL_CROSSFADE_SECONDS : CROSSFADE_SECONDS;
    offset += durations[index - 1] - transitionDuration;
    const videoOut = index === clips.length - 1 ? '[vout]' : `[v${index}]`;
    const transition = transitions?.[index - 1] ?? ['fadefast', 'smoothleft', 'wipeleft'][index % 3];
    filters.push(`${videoIn}[vn${index}]xfade=transition=${transition}:duration=${transitionDuration}:offset=${Math.max(0, offset).toFixed(3)}${videoOut}`);
    videoIn = videoOut;
    if (useAudio) {
      const audioOut = index === clips.length - 1 ? '[aout]' : `[a${index}]`;
      filters.push(`${audioIn}[${index}:a]acrossfade=d=${transitionDuration}${audioOut}`);
      audioIn = audioOut;
    }
  }
  await execFileAsync('ffmpeg', [
    '-y', ...inputs, '-filter_complex', filters.join(';'), '-map', '[vout]',
    ...(useAudio ? ['-map', '[aout]', '-c:a', 'aac', '-b:a', '192k'] : ['-an']),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out,
  ], { timeout: 20 * 60_000, maxBuffer: 32 * 1024 * 1024 });
  return out;
}

/**
 * Execute the AI storyboard as deterministic editing instructions. Every scene
 * has multiple beats so the output feels edited, while all website text remains
 * baked into the source screenshots and therefore cannot be hallucinated.
 */
async function prepareEditorialScene(
  jobId: string,
  scene: StoryboardScene,
  sceneIndex: number,
  referenceImages: Buffer[],
  validIndices: number[],
  options: VideoOptions,
) {
  const requested = sceneSourceIndices(scene, sceneIndex, validIndices);
  if (requested.length > 1) {
    const shift = options.variantSeed % requested.length;
    requested.push(...requested.splice(0, shift));
  }
  const composition = scene.composition ?? 'single';
  if (composition === 'sequence') {
    for (const index of validIndices) {
      if (requested.length >= 3) break;
      if (!requested.includes(index)) requested.push(index);
    }
  }
  const seconds = Math.max(4, Math.min(12, Number(scene.durationSeconds || 8)));
  const sourceAt = (position: number) => {
    const index = requested[position % requested.length] ?? validIndices[(sceneIndex + position) % validIndices.length];
    return referenceImages[index];
  };

  if (composition === 'split' && validIndices.length >= 2) {
    const secondIndex = requested[1] ?? validIndices[(validIndices.indexOf(requested[0]) + 1) % validIndices.length];
    const split = await prepareSplitScreenClip(jobId, sourceAt(0), referenceImages[secondIndex], sceneIndex, options, Math.min(3.2, seconds * 0.42));
    const detail = await prepareScreenshotClip(jobId, sourceAt(0), sceneIndex, 7, options, seconds - Math.min(3.2, seconds * 0.42) + INTERNAL_CROSSFADE_SECONDS, scene, 2);
    return stitchNamed(jobId, [split, detail], options.silent, `editorial-scene-${sceneIndex}.mp4`, [options.variantSeed % 2 ? 'fadefast' : 'smoothleft']);
  }

  if (composition === 'triple' && validIndices.length >= 3) {
    const tripleIndices = [...requested];
    for (const index of validIndices) if (tripleIndices.length < 3 && !tripleIndices.includes(index)) tripleIndices.push(index);
    const triple = await prepareTriplePanelClip(jobId, tripleIndices.slice(0, 3).map((index) => referenceImages[index]), sceneIndex, options, Math.min(3.0, seconds * 0.38));
    const detail = await prepareScreenshotClip(jobId, referenceImages[tripleIndices[0]], sceneIndex, 8, options, seconds - Math.min(3.0, seconds * 0.38) + INTERNAL_CROSSFADE_SECONDS, scene, 2);
    return stitchNamed(jobId, [triple, detail], options.silent, `editorial-scene-${sceneIndex}.mp4`, [options.variantSeed % 3 === 0 ? 'smoothleft' : 'fadefast']);
  }

  const shotCount = composition === 'sequence' ? 3 : 2;
  const shotSeconds = (seconds + (shotCount - 1) * INTERNAL_CROSSFADE_SECONDS) / shotCount;
  const shots: string[] = [];
  for (let shot = 0; shot < shotCount; shot++) {
    const source = composition === 'sequence'
      ? sourceAt(shot)
      : sourceAt(0);
    shots.push(await prepareScreenshotClip(jobId, source, sceneIndex, shot, options, shotSeconds, scene, shot));
  }
  const internalTransitions = Array.from({ length: shots.length - 1 }, (_, index) =>
    (index + options.variantSeed) % 2 === 0 ? 'fadefast' : supportedTransition(scene.transition, index + options.variantSeed)
  );
  return stitchNamed(jobId, shots, options.silent, `editorial-scene-${sceneIndex}.mp4`, internalTransitions);
}

/**
 * A scene clip may only enter the final concat when the file really exists,
 * has bytes, and ffprobe confirms a playable video stream with duration and
 * sane dimensions. Corrupt or empty segments are skipped instead of stitched.
 */
async function validateSegment(file: string, label: string): Promise<boolean> {
  try {
    const stat = await fs.stat(file);
    if (stat.size === 0) throw new Error('zero-byte file');
    const seconds = await duration(file);
    if (!(seconds > 0.2)) throw new Error(`invalid duration ${seconds}`);
    const size = await dimensions(file);
    if (!(size.width > 0) || !(size.height > 0)) throw new Error(`invalid dimensions ${size.width}x${size.height}`);
    return true;
  } catch (err) {
    console.warn(`[video] segment rejected ${label}: ${(err as Error).message}`);
    return false;
  }
}

/** Final delivery gate: the job may only complete when the master file is provably playable. */
async function validateMaster(file: string, expected: { width: number; height: number }) {
  const stat = await fs.stat(file);
  if (stat.size === 0) throw new Error('Final video file is empty.');
  const seconds = await duration(file);
  if (!(seconds > 0.5)) throw new Error(`Final video has invalid duration (${seconds}s).`);
  const size = await dimensions(file);
  if (size.width !== expected.width || size.height !== expected.height) {
    throw new Error(`Final video is ${size.width}x${size.height}, expected ${expected.width}x${expected.height}.`);
  }
  return seconds;
}

async function master(jobId: string, input: string, options: VideoOptions) {
  const { width, height } = masterFrame(options.aspectRatio, options.outputQuality);
  const fps = options.frameRate;
  const fpsFilter = fps === 60 ? 'fps=60,' : 'fps=30,';
  // Variation seed + timestamp keep every generated master at a unique URL, so
  // no browser/CDN cache can ever show a previous render as the new result.
  const output = path.join(
    ASSETS_DIR, jobId,
    `video-${options.aspectRatio.replace(':', 'x')}-${options.outputQuality}-${fps}fps-v${options.variantSeed}-${Date.now().toString(36)}.mp4`,
  );
  await execFileAsync('ffmpeg', [
    '-y', '-i', input,
    '-vf', `${fpsFilter}scale=${width}:${height}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2:color=black`,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', options.outputQuality === '4k' ? '17' : '18',
    '-pix_fmt', 'yuv420p', ...(options.silent ? ['-an'] : ['-c:a', 'aac', '-b:a', '192k']),
    '-movflags', '+faststart', output,
  ], { timeout: 30 * 60_000, maxBuffer: 32 * 1024 * 1024 });
  return output;
}

async function concurrentMap<T, R>(items: T[], fn: (item: T, index: number) => Promise<R>) {
  const results: PromiseSettledResult<R>[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (cursor < items.length) {
      const index = cursor++;
      try { results[index] = { status: 'fulfilled', value: await fn(items[index], index) }; }
      catch (reason) { results[index] = { status: 'rejected', reason }; }
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, items.length) }, () => worker()));
  return results;
}

async function cleanupVideoIntermediates(jobId: string) {
  const dir = path.join(ASSETS_DIR, jobId);
  let names: string[] = [];
  try { names = await fs.readdir(dir); } catch { return; }
  const temporary = /^(?:capture-validation-|real-site-|editorial-scene-|exact-capture-master-source\.mp4)/;
  await Promise.all(names.filter((name) => temporary.test(name)).map((name) => fs.rm(path.join(dir, name), { force: true }).catch(() => {})));
}

export async function generateMarketingVideo(
  jobId: string,
  _siteTitle: string,
  storyboard: Pick<Storyboard, 'concept' | 'vibe' | 'scenes' | 'creativeBrief' | 'aspectRatio' | 'outputQuality' | 'frameRate' | 'variantSeed'>,
  referenceImages: Buffer[],
  _screenStyle: boolean,
  silent: boolean,
  mode = 'video',
  onProgress?: (percent: number) => void,
): Promise<GeneratedVideo> {
  try {
    const scenes = storyboard.scenes.slice(0, 8);
    if (!scenes.length) throw new Error('Storyboard has no scenes.');
  if (!referenceImages.length) {
    throw new Error('No exact website screenshots are available. Generation was stopped rather than inventing replacement visuals.');
  }

  const options: VideoOptions = {
    aspectRatio: storyboard.aspectRatio ?? '16:9',
    outputQuality: storyboard.outputQuality ?? '1080p',
    frameRate: storyboard.frameRate ?? 30,
    silent,
    creativeBrief: storyboard.creativeBrief,
    mode,
    variantSeed: Number(storyboard.variantSeed ?? 0),
  };

  const validIndices = await validateReferenceImages(jobId, referenceImages);
  console.info(
    `[video] job=${jobId} variation=${options.variantSeed} mode=${mode} screenshots=${referenceImages.length} usable_screenshots=${validIndices.length} ` +
    `renderer=ffmpeg scrolling_recording_used=false scenes=${scenes.length} aspect=${options.aspectRatio} quality=${options.outputQuality}`,
  );
  let completed = 0;
  const results = await concurrentMap(scenes, async (scene, index) => {
    const clip = await prepareEditorialScene(jobId, scene, index, referenceImages, validIndices, options);
    completed++;
    onProgress?.(80 + Math.round((completed / scenes.length) * 13));
    return clip;
  });

  const candidates = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  const clipChecks = await Promise.all(candidates.map((clip) => validateSegment(clip, path.basename(clip))));
  const clips = candidates.filter((_, index) => clipChecks[index]);
  if (!clips.length) {
    const firstError = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
    throw firstError?.reason ?? new Error('No exact-capture scene could be assembled.');
  }
  if (clips.length < scenes.length) {
    console.warn(`[video] job=${jobId} delivering ${clips.length}/${scenes.length} validated scene clips`);
  }

  const transitions = clips.slice(1).map((_, index) => supportedTransition(scenes[index]?.transition, index + options.variantSeed));
  const stitched = await stitchNamed(jobId, clips, options.silent, 'exact-capture-master-source.mp4', transitions);
  onProgress?.(96);
  const output = await master(jobId, stitched, options);
  const masterSeconds = await validateMaster(output, masterFrame(options.aspectRatio, options.outputQuality));
  console.info(`[video] job=${jobId} variation=${options.variantSeed} output=${path.basename(output)} duration=${masterSeconds.toFixed(2)}s clips=${clips.length}`);
    return {
      url: `/api/assets/${jobId}/${path.basename(output)}`,
      aspectRatio: options.aspectRatio,
      clipCount: clips.length,
      outputQuality: options.outputQuality,
      frameRate: options.frameRate,
    };
  } finally {
    await cleanupVideoIntermediates(jobId);
  }
}
