import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { ASSETS_DIR } from './capture.js';
import type { Storyboard, StoryboardScene } from './gemini.js';
import { getProviderSettings, providerAvailability, resolveProvider } from './provider-config.js';
import { generateGpuVideo } from './self-hosted.js';
import { buildAiVideoScenePrompt } from './video-prompts.js';
import { GEMINI_COST_CATALOG, recordGenerationCost } from './costs.js';
import { query } from './pool.js';

const execFileAsync = promisify(execFile);
const VIDEO_CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.AI_VIDEO_CONCURRENCY ?? 2)));
const POLL_MS = Math.max(2_000, Number(process.env.GEMINI_VIDEO_POLL_MS ?? 10_000));
const POLL_LOG_MS = Math.max(POLL_MS, Number(process.env.GEMINI_VIDEO_POLL_LOG_MS ?? 30_000));
const GENERATION_TIMEOUT_MS = Math.max(60_000, Number(process.env.GEMINI_VIDEO_TIMEOUT_MS ?? 12 * 60_000));
const DEFAULT_TOTAL_GENERATION_TIMEOUT_MS = 24 * 60_000;
const TOTAL_GENERATION_TIMEOUT_ENV = process.env.AI_VIDEO_TOTAL_TIMEOUT_MS;
const FINISHING_BUFFER_MS = 6 * 60_000; // stitching, audio mix, narration, final mux

/**
 * A fixed total-job timeout doesn't scale with how many scenes a production
 * actually has. A 3-scene short and an 8-scene cinematic film at the same
 * per-scene poll budget legitimately need very different total budgets — a
 * fixed 24-minute cap can kill a longer job that is generating correctly but
 * simply has more batches to get through. If the operator explicitly sets
 * AI_VIDEO_TOTAL_TIMEOUT_MS, that value always wins; otherwise the deadline
 * scales with the real batch count so it always has headroom over the
 * per-scene timeout that's already being enforced.
 */
export function totalGenerationTimeoutMs(sceneCount: number): number {
  if (TOTAL_GENERATION_TIMEOUT_ENV) {
    return Math.max(5 * 60_000, Number(TOTAL_GENERATION_TIMEOUT_ENV));
  }
  const batches = Math.max(1, Math.ceil(Math.max(1, sceneCount) / VIDEO_CONCURRENCY));
  const scaled = batches * GENERATION_TIMEOUT_MS + FINISHING_BUFFER_MS;
  return Math.max(DEFAULT_TOTAL_GENERATION_TIMEOUT_MS, scaled);
}

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

export type VideoAspectRatio = '16:9' | '9:16' | '1:1';

export interface GeneratedVideo {
  url: string;
  aspectRatio: VideoAspectRatio;
  clipCount: number;
  outputQuality: '1080p' | '4k';
  frameRate: 30 | 60;
  narrationError?: string;
}

export type AudioMode = 'voice_music' | 'music_only' | 'silent';

function outputFrame(aspectRatio: VideoAspectRatio, quality: '1080p' | '4k') {
  const scale = quality === '4k' ? 2 : 1;
  if (aspectRatio === '9:16') return { width: 1080 * scale, height: 1920 * scale };
  if (aspectRatio === '1:1') return { width: 1080 * scale, height: 1080 * scale };
  return { width: 1920 * scale, height: 1080 * scale };
}

function providerAspectRatio(aspectRatio: VideoAspectRatio): '16:9' | '9:16' {
  // Veo currently supports 16:9 and 9:16. Square delivery is generated as a
  // center-safe 16:9 AI clip, then technically cropped to 1:1 in mastering.
  return aspectRatio === '9:16' ? '9:16' : '16:9';
}

function imageFromBuffer(buffer: Buffer) {
  return { imageBytes: buffer.toString('base64'), mimeType: 'image/jpeg' };
}

function sceneReferenceIndices(scene: StoryboardScene, sceneIndex: number, count: number) {
  const requested = (scene.sourceIndices ?? [])
    .filter((index) => Number.isInteger(index) && index >= 0 && index < count);
  const unique = [...new Set(requested)];
  if (unique.length) return unique.slice(0, scene.sceneType === 'interaction' ? 2 : 1);
  return count ? [sceneIndex % count] : [];
}

async function hasAudio(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file,
  ]).catch(() => ({ stdout: '' }));
  return Boolean(stdout.trim());
}

async function duration(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', file,
  ]);
  const value = Number(stdout.trim());
  if (!Number.isFinite(value) || value <= 0) throw new Error(`Invalid generated video: ${path.basename(file)}.`);
  return value;
}

async function concurrentMap<T, R>(values: T[], task: (value: T, index: number) => Promise<R>) {
  const results: Array<PromiseSettledResult<R>> = new Array(values.length);
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(VIDEO_CONCURRENCY, values.length) }, async () => {
    while (true) {
      const index = next++;
      if (index >= values.length) return;
      try {
        results[index] = { status: 'fulfilled', value: await task(values[index], index) };
      } catch (reason) {
        results[index] = { status: 'rejected', reason };
      }
    }
  }));
  return results;
}

// Fields Veo rejects on the Gemini Developer API (Enterprise Agent
// Platform-only). Never add these back to buildGeminiVideoConfig — see the
// generateAudio comment below and the `seed` comment near the API call.
const GEMINI_DEVELOPER_API_UNSUPPORTED_FIELDS = ['generateAudio', 'seed'] as const;

export function buildGeminiVideoConfig(
  apiAspect: '16:9' | '9:16',
  quality: '1080p' | '4k',
  isStateTransition: boolean,
  lastFrame?: { imageBytes: string; mimeType: string },
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    numberOfVideos: 1,
    aspectRatio: apiAspect,
    durationSeconds: 8,
    resolution: quality === '4k' ? '4k' : '1080p',
    personGeneration: 'allow_adult',
    negativePrompt: 'garbled text, misspelled text, changed Arabic letters, changed English words, fake prices, fake buttons, fake UI, duplicated controls, warped logo, distorted product, unreadable interface, random subtitles, random captions',
  };
  // IMPORTANT: do NOT send `generateAudio` to Gemini Developer API Veo — like
  // `seed`, this field is Enterprise Agent Platform-only and the request is
  // rejected outright with "generateAudio parameter is only supported in
  // Gemini Enterprise Agent Platform mode, not in Gemini Developer API mode"
  // (confirmed against live production logs and Google's own developer
  // forum). veo-3.1 on the Developer API generates native audio on its own;
  // whether the final clip actually has an audio track is verified after
  // download with ffprobe in normalizeClip()/hasAudio(), not by this flag —
  // so omitting it here does not change silent-mode behavior downstream.
  if (isStateTransition && lastFrame) {
    config.lastFrame = lastFrame;
  }
  for (const field of GEMINI_DEVELOPER_API_UNSUPPORTED_FIELDS) {
    if (field in config) throw new Error(`buildGeminiVideoConfig must never include '${field}' — it is rejected by the Gemini Developer API.`);
  }
  return config;
}

// Errors worth retrying on the SAME provider before giving up to the (much
// slower, lower-quality) fallback provider. RESOURCE_EXHAUSTED here is
// usually Gemini's spend-based rate limit — a rolling 10-minute spend cap
// tied to account usage tier ($10/10min on Tier 1), completely separate
// from prepaid balance. It reliably clears within a few minutes as the
// rolling window advances, so a short backoff-and-retry recovers the job
// on Gemini instead of unnecessarily falling back. 429/503/UNAVAILABLE are
// the standard transient-failure signals; anything else (bad request,
// permission denied, invalid argument) is permanent and must not be retried.
export function isRetryableGeminiError(message: string): boolean {
  return /"code"\s*:\s*429|RESOURCE_EXHAUSTED|"code"\s*:\s*503|UNAVAILABLE|ECONNRESET|ETIMEDOUT/i.test(message);
}

const GEMINI_RETRY_DELAYS_MS = [20_000, 60_000, 120_000];

// If the operator pins a specific model via GEMINI_VIDEO_MODEL, honor that
// single explicit choice exactly (no surprise substitution). Otherwise, by
// default, use Fast (the margin-safe choice for the public catalog). Standard
// costs $0.40/sec at 1080p and $0.60/sec at 4K, so silently falling back to it
// after reserving Fast-priced credits would break the 2x provider-cost floor.
// An explicitly pinned Standard model is still supported; videoCreditCost()
// applies its conservative 4/5-credit per-second rates before generation.
export function geminiModelChain(): string[] {
  const pinned = process.env.GEMINI_VIDEO_MODEL;
  if (pinned) return [pinned];
  return ['veo-3.1-fast-generate-preview'];
}

async function generateGeminiScene(
  jobId: string,
  sceneIndex: number,
  prompt: string,
  scene: StoryboardScene,
  references: Buffer[],
  referenceIndices: number[],
  aspectRatio: VideoAspectRatio,
  quality: '1080p' | '4k',
  nativeAudio: boolean,
  onStatus?: (message: string) => void,
  shouldCancel?: () => Promise<boolean>,
  deadlineAt?: number,
): Promise<string> {
  const chain = geminiModelChain();
  let lastError: unknown;
  for (const [chainIndex, model] of chain.entries()) {
    try {
      return await generateGeminiSceneWithModel(
        jobId, sceneIndex, prompt, scene, references, referenceIndices,
        aspectRatio, quality, nativeAudio, model, onStatus, shouldCancel, deadlineAt,
      );
    } catch (error) {
      lastError = error;
      const nextModel = chain[chainIndex + 1];
      if (!nextModel) throw error;
      const message = (error as Error).message || String(error);
      console.warn(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini model=${model} exhausted, trying model=${nextModel}: ${message}`);
      onStatus?.(`Switching AI models for scene ${sceneIndex + 1}`);
    }
  }
  throw lastError;
}

async function generateGeminiSceneWithModel(
  jobId: string,
  sceneIndex: number,
  prompt: string,
  scene: StoryboardScene,
  references: Buffer[],
  referenceIndices: number[],
  aspectRatio: VideoAspectRatio,
  quality: '1080p' | '4k',
  nativeAudio: boolean,
  model: string,
  onStatus?: (message: string) => void,
  shouldCancel?: () => Promise<boolean>,
  deadlineAt?: number,
) {
  const client = getGeminiClient();
  const selected = referenceIndices.map((index) => references[index]).filter(Boolean);
  if (!selected.length) throw new Error('No website screenshot is available for AI video grounding.');

  const apiAspect = providerAspectRatio(aspectRatio);
  const primary = imageFromBuffer(selected[0]);
  const isStateTransition = ['interaction'].includes(scene.sceneType) && selected.length >= 2;
  const config = buildGeminiVideoConfig(
    apiAspect,
    quality,
    isStateTransition,
    isStateTransition ? imageFromBuffer(selected[selected.length - 1]) : undefined,
  );

  // Veo's image-to-video path uses the real screenshot as the exact first
  // frame. Interaction scenes additionally use a captured real after-state as
  // lastFrame. We intentionally do not combine image + referenceImages here:
  // first/last-frame interpolation gives website UI the strongest grounding
  // and follows Google's documented Veo 3.1 request shapes.

  console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini model=${model} refs=${selected.length} transition_frames=${isStateTransition} audio_requested=${nativeAudio} (generateAudio param omitted — Developer API rejects it; actual audio is verified after download)`);
  onStatus?.(`Submitting AI scene ${sceneIndex + 1} to Veo`);

  // @google/genai now prefers the consolidated `source` argument. Using it
  // avoids the SDK deprecation warning emitted by prompt/image top-level
  // arguments. IMPORTANT: do not send `seed` to Gemini Developer API Veo;
  // that field is currently rejected outside the Enterprise Agent Platform.
  let operation: Awaited<ReturnType<typeof client.models.generateVideos>> | undefined;
  for (let attempt = 0; ; attempt++) {
    try {
      operation = await client.models.generateVideos({
        model,
        source: { prompt, image: primary },
        config,
      } as never);
      break;
    } catch (error) {
      const message = (error as Error).message || String(error);
      const retryDelayMs = GEMINI_RETRY_DELAYS_MS[attempt];
      const canRetry = isRetryableGeminiError(message) && retryDelayMs !== undefined
        && (!deadlineAt || Date.now() + retryDelayMs < deadlineAt)
        && !(shouldCancel && await shouldCancel());
      if (!canRetry) throw error;
      console.warn(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini rate_limited, retrying in ${Math.round(retryDelayMs / 1000)}s (attempt ${attempt + 2}/${GEMINI_RETRY_DELAYS_MS.length + 1}): ${message}`);
      onStatus?.(`Veo is temporarily busy — retrying scene ${sceneIndex + 1} shortly`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    }
  }

  const operationName = typeof (operation as { name?: unknown }).name === 'string'
    ? String((operation as { name?: string }).name)
    : 'unknown';
  const started = Date.now();
  let lastPollLogAt = 0;
  console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini submitted operation=${operationName}`);

  while (!operation.done) {
    const now = Date.now();
    const elapsedMs = now - started;
    if (deadlineAt && now >= deadlineAt) {
      throw new Error(`AI video generation exceeded the overall production timeout while waiting for scene ${sceneIndex + 1}.`);
    }
    if (elapsedMs > GENERATION_TIMEOUT_MS) {
      throw new Error(`Gemini video generation timed out for scene ${sceneIndex + 1} after ${Math.round(elapsedMs / 1000)}s.`);
    }
    if (shouldCancel && await shouldCancel()) {
      throw new Error('AI video generation was cancelled by the user.');
    }
    if (now - lastPollLogAt >= POLL_LOG_MS) {
      lastPollLogAt = now;
      const elapsedSeconds = Math.round(elapsedMs / 1000);
      console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini waiting elapsed=${elapsedSeconds}s operation=${operationName}`);
      onStatus?.(`Generating AI scene ${sceneIndex + 1} · ${elapsedSeconds}s elapsed`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    operation = await client.operations.getVideosOperation({ operation } as never);
  }
  if (operation.error) {
    throw new Error(`Gemini video generation failed for scene ${sceneIndex + 1}: ${JSON.stringify(operation.error)}`);
  }

  const video = operation.response?.generatedVideos?.[0]?.video;
  if (!video) throw new Error(`Gemini returned no video for scene ${sceneIndex + 1}.`);
  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const output = path.join(dir, `ai-scene-${sceneIndex + 1}-gemini.mp4`);
  onStatus?.(`Downloading completed AI scene ${sceneIndex + 1}`);
  await client.files.download({ file: video, downloadPath: output } as never);
  const seconds = await duration(output);
  const stat = await fs.stat(output);
  const providerRate = model.includes('lite')
    ? (quality === '4k' ? 0 : GEMINI_COST_CATALOG.video.lite1080)
    : model.includes('fast')
      ? (quality === '4k' ? GEMINI_COST_CATALOG.video.fast4k : GEMINI_COST_CATALOG.video.fast1080)
      : (quality === '4k' ? GEMINI_COST_CATALOG.video.standard4k : GEMINI_COST_CATALOG.video.standard1080);
  await recordGenerationCost({
    jobId, provider: 'gemini', model, operation: 'video_scene',
    quantity: seconds, unit: 'generated_second', unitCostUsd: providerRate,
    metadata: { scene: sceneIndex + 1, quality },
  });
  console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini completed elapsed=${Math.round((Date.now() - started) / 1000)}s duration=${seconds.toFixed(2)}s bytes=${stat.size}`);
  return output;
}

async function normalizeClip(
  input: string,
  output: string,
  aspectRatio: VideoAspectRatio,
  quality: '1080p' | '4k',
  frameRate: 30 | 60,
) {
  const { width, height } = outputFrame(aspectRatio, quality);
  const sourceHasAudio = await hasAudio(input);
  const scaleCrop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${frameRate}`;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
  if (!sourceHasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  args.push(
    '-vf', scaleCrop,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', quality === '4k' ? '17' : '18', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    ...(sourceHasAudio ? [] : ['-shortest']),
    '-movflags', '+faststart', output,
  );
  await execFileAsync('ffmpeg', args, { timeout: 15 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  await duration(output);
  return sourceHasAudio;
}

async function concatClips(jobId: string, clips: string[]) {
  const dir = path.join(ASSETS_DIR, jobId);
  const list = path.join(dir, 'ai-scenes.concat.txt');
  const esc = (value: string) => value.replace(/'/g, "'\\''");
  await fs.writeFile(list, clips.map((clip) => `file '${esc(clip)}'`).join('\n'));
  const output = path.join(dir, 'ai-video-master-source.mp4');
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-c', 'copy', '-movflags', '+faststart', output,
  ], { timeout: 15 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  await duration(output);
  return output;
}

export async function finishAudio(
  source: string,
  output: string,
  silent: boolean,
  narrationPath: string | null,
  nativeAudioPresent: boolean,
) {
  if (silent) {
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source,
      '-map', '0:v:0', '-c:v', 'copy', '-an', '-movflags', '+faststart', output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return;
  }

  if (narrationPath) {
    // TTS timing can legitimately run longer than the scripted target, and the
    // assembled AI clips have a fixed total length. Never solve that mismatch
    // by cutting the narration short with -shortest — freeze the final frame
    // instead so the voiceover always finishes speaking.
    const [videoSeconds, narrationSeconds] = await Promise.all([
      duration(source),
      duration(narrationPath).catch(() => 0),
    ]);
    const extendSeconds = narrationSeconds > videoSeconds + 0.25 ? narrationSeconds - videoSeconds : 0;
    const videoLabel = extendSeconds > 0 ? '[v]' : '0:v:0';
    // Both audio legs are padded to the SAME bounded target duration before
    // mixing, so neither amix input can end early and cut the other off.
    // IMPORTANT: apad must be bounded with whole_dur here — apad with no
    // bound pads forever, and two unbounded apads feeding amix builds an
    // infinite filter graph that ffmpeg cannot materialize (it fails with a
    // misleading "No space left on device" rather than a clear filter error).
    const targetSeconds = Math.max(videoSeconds, narrationSeconds).toFixed(2);
    // Keep the AI model's own music/ambience/UI effects as a quiet bed and put
    // narration clearly above it. If the provider generated no meaningful
    // audio, the normalized silent bed simply contributes nothing audible.
    const filters = [
      ...(extendSeconds > 0 ? [`[0:v]tpad=stop_mode=clone:stop_duration=${extendSeconds.toFixed(2)}[v]`] : []),
      nativeAudioPresent
        ? `[0:a]volume=0.32,apad=whole_dur=${targetSeconds}[bed];[1:a]volume=1.0,apad=whole_dur=${targetSeconds}[voice];[bed][voice]amix=inputs=2:duration=first:dropout_transition=2[a]`
        : `[1:a]volume=1.0,apad=whole_dur=${targetSeconds}[a]`,
    ];
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-i', narrationPath,
      '-filter_complex', filters.join(';'),
      '-map', videoLabel, '-map', '[a]',
      '-c:v', extendSeconds > 0 ? 'libx264' : 'copy', ...(extendSeconds > 0 ? ['-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p'] : []),
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
      '-shortest', '-movflags', '+faststart', output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    if (extendSeconds > 0) {
      console.info(`[ai-video] narration ${narrationSeconds.toFixed(1)}s exceeded assembled video ${videoSeconds.toFixed(1)}s — held final frame for ${extendSeconds.toFixed(1)}s instead of cutting narration`);
    }
    return;
  }

  await fs.copyFile(source, output);
}

export async function createMusicOnlyBed(jobId: string, seconds: number) {
  const output = path.join(ASSETS_DIR, jobId, 'music-only-bed.m4a');
  const configured = process.env.BACKGROUND_MUSIC_PATH?.trim();
  if (configured) {
    try {
      await fs.access(configured);
      await execFileAsync('ffmpeg', [
        '-y', '-hide_banner', '-loglevel', 'error', '-stream_loop', '-1', '-i', configured,
        '-t', seconds.toFixed(3), '-vn', '-af', `volume=0.48,afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(0, seconds - 1.2).toFixed(3)}:d=1.2`,
        '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', output,
      ], { timeout: 5 * 60_000, maxBuffer: 8 * 1024 * 1024 });
      return output;
    } catch (error) {
      console.warn(`[audio] configured background music unavailable, using generated instrumental bed: ${(error as Error).message}`);
    }
  }

  // A deterministic, royalty-free ambient instrumental fallback. It contains
  // no recorded voice or vocal model, guaranteeing the music-only choice is
  // actually free of talking even when an AI-video provider returns dialogue.
  const expression = '0.045*sin(2*PI*220*t)*(0.72+0.28*sin(2*PI*0.08*t))+0.030*sin(2*PI*277.18*t)+0.024*sin(2*PI*329.63*t)+0.014*sin(2*PI*440*t)*(0.5+0.5*sin(2*PI*0.13*t))';
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-f', 'lavfi',
    '-i', `aevalsrc=${expression}|${expression}:s=48000:d=${seconds.toFixed(3)}`,
    '-af', `lowpass=f=4200,highpass=f=90,afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(0, seconds - 1.2).toFixed(3)}:d=1.2`,
    '-c:a', 'aac', '-b:a', '192k', output,
  ], { timeout: 5 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  return output;
}

async function cleanup(jobId: string) {
  const dir = path.join(ASSETS_DIR, jobId);
  let files: string[] = [];
  try { files = await fs.readdir(dir); } catch { return; }
  const temporary = /^(?:ai-scene-\d+-(?:gemini|normalized)\.mp4|gpu-\d+\.mp4|ai-scenes\.concat\.txt|ai-video-master-source\.mp4|ai-video-audio-mix\.mp4|music-only-bed\.m4a|brand-name\.txt)$/;
  await Promise.all(files.filter((name) => temporary.test(name)).map((name) => fs.rm(path.join(dir, name), { force: true }).catch(() => {})));
}

function safeBrandName(siteTitle: string) {
  return siteTitle.split(/[|\-–—:]/)[0]?.replace(/[\r\n]+/g, ' ').trim().slice(0, 80) || siteTitle.slice(0, 80);
}

/**
 * Add an exact, deterministic identity card over the final seconds. The AI
 * creates the motion; this finishing pass protects the real captured icon and
 * website name from generative text/logo distortion.
 */
export async function addBrandClosingOverlay(source: string, output: string, jobId: string, siteTitle: string) {
  const iconPath = path.join(ASSETS_DIR, jobId, 'website-icon.jpg');
  await fs.access(iconPath);
  const seconds = await duration(source);
  const start = Math.max(0, seconds - Math.min(3.2, Math.max(2, seconds * 0.28)));
  const { stdout: dimensionsText } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', source,
  ]);
  const [width, height] = dimensionsText.trim().split('x').map(Number);
  if (!width || !height) throw new Error('Could not read the video dimensions for the branded ending.');
  const iconSize = Math.round(Math.min(width, height) * 0.13);
  const cardHeight = Math.round(Math.min(width, height) * 0.24);
  const padding = Math.round(cardHeight * 0.22);
  const fontSize = Math.round(cardHeight * 0.22);
  const textFile = path.join(ASSETS_DIR, jobId, 'brand-name.txt');
  await fs.writeFile(textFile, safeBrandName(siteTitle), 'utf8');
  const fontFile = process.env.BRAND_FONT_FILE ?? '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf';
  const filter = [
    `[0:v]drawbox=x=0:y=ih-${cardHeight}:w=iw:h=${cardHeight}:color=0x100c20@0.82:t=fill:enable='gte(t,${start.toFixed(3)})'[base]`,
    `[1:v]scale=${iconSize}:${iconSize}:force_original_aspect_ratio=decrease[mark]`,
    `[base][mark]overlay=x=${padding}:y=H-${cardHeight}+(${cardHeight}-h)/2:enable='between(t,${start.toFixed(3)},${seconds.toFixed(3)})'[withmark]`,
    `[withmark]drawtext=fontfile=${fontFile}:textfile=${textFile}:fontcolor=white:fontsize=${fontSize}:x=${padding + iconSize + Math.round(padding * 0.7)}:y=h-${cardHeight}+((${cardHeight}-text_h)/2):enable='between(t,${start.toFixed(3)},${seconds.toFixed(3)})'[v]`,
  ].join(';');
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-loop', '1', '-i', iconPath,
    '-filter_complex', filter, '-map', '[v]', '-map', '0:a?', '-t', seconds.toFixed(3),
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', output,
  ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  await duration(output);
}

export async function generateMarketingVideo(
  jobId: string,
  siteTitle: string,
  storyboard: Pick<Storyboard, 'concept' | 'vibe' | 'scenes' | 'creativeBrief' | 'aspectRatio' | 'outputQuality' | 'frameRate' | 'variantSeed'>,
  referenceImages: Buffer[],
  _screenStyle: boolean,
  audioMode: AudioMode,
  mode = 'video',
  onProgress?: (percent: number, message?: string, etaSeconds?: number) => void,
  narrationAudioPath?: Promise<string | null> | string | null,
  referenceLabels: string[] = [],
  shouldCancel?: () => Promise<boolean>,
): Promise<GeneratedVideo> {
  try {
    const silent = audioMode === 'silent';
    const musicOnly = audioMode === 'music_only';
    const scenes = (storyboard.scenes ?? []).slice(0, 30);
    if (!scenes.length) throw new Error('Storyboard has no scenes.');
    if (!referenceImages.length) throw new Error('No website screenshots are available to ground AI video generation.');

    const provider = await resolveProvider('video');
    const providerSettings = await getProviderSettings();
    const availability = providerAvailability('video');
    const providerOrder: Array<'gemini' | 'open_source'> = [provider];
    if (providerSettings.fallbackEnabled) {
      const fallback = provider === 'gemini' ? 'open_source' : 'gemini';
      const fallbackReady = fallback === 'gemini' ? availability.gemini : availability.openSource;
      if (fallbackReady) providerOrder.push(fallback);
    }
    const aspectRatio = storyboard.aspectRatio ?? '16:9';
    const outputQuality = storyboard.outputQuality ?? '1080p';
    const frameRate = storyboard.frameRate ?? 30;
    const variantSeed = Number(storyboard.variantSeed ?? 0);
    const targetDurationSeconds = scenes.reduce((sum, scene) => sum + Math.max(1, Number(scene.durationSeconds || 8)), 0);
    const generationStartedAt = Date.now();
    const jobTotalTimeoutMs = totalGenerationTimeoutMs(scenes.length);
    const deadlineAt = generationStartedAt + jobTotalTimeoutMs;

    console.info(`[ai-video] job=${jobId} provider=${provider} mode=${mode} scenes=${scenes.length} refs=${referenceImages.length} native_ai_generation=true code_generated_motion=false fallback_order=${providerOrder.join('->')} total_timeout_s=${Math.round(jobTotalTimeoutMs / 1000)}`);

    let completed = 0;
    const results = await concurrentMap(scenes, async (scene, sceneIndex) => {
      const indices = sceneReferenceIndices(scene, sceneIndex, referenceImages.length);
      const selectedLabels = indices.map((index) => referenceLabels[index] || `CAPTURE ${index}`);
      const prompt = buildAiVideoScenePrompt({
        mode,
        siteTitle,
        concept: storyboard.concept ?? 'Professional website film',
        vibe: storyboard.vibe ?? 'premium',
        scene,
        sceneIndex,
        totalScenes: scenes.length,
        targetDurationSeconds,
        creativeBrief: storyboard.creativeBrief,
        nativeAudio: !silent,
        musicOnly,
        referenceLabels: selectedLabels,
        variantSeed,
        aspectRatio,
        previousSceneSummary: scenes[sceneIndex - 1]?.shotDescription,
        nextSceneSummary: scenes[sceneIndex + 1]?.shotDescription,
      });

      if (Date.now() >= deadlineAt) {
        throw new Error('AI video generation exceeded the overall production timeout before all scenes could start.');
      }
      if (shouldCancel && await shouldCancel()) {
        throw new Error('AI video generation was cancelled by the user.');
      }

      let raw: string | null = null;
      let lastError: unknown = null;
      onProgress?.(Math.max(81, 80 + Math.round((completed / scenes.length) * 14)), `Generating AI scene ${sceneIndex + 1} of ${scenes.length}`);
      for (let providerIndex = 0; providerIndex < providerOrder.length; providerIndex++) {
        const sceneProvider = providerOrder[providerIndex];
        try {
          const status = (message: string) => {
            const pct = Math.max(81, 80 + Math.round((completed / scenes.length) * 14));
            onProgress?.(pct, `${message} · ${completed}/${scenes.length} scenes complete`);
          };
          raw = sceneProvider === 'gemini'
            ? await generateGeminiScene(
                jobId, sceneIndex, prompt, scene, referenceImages, indices, aspectRatio, outputQuality, !silent,
                status, shouldCancel, deadlineAt,
              )
            : await generateGpuVideo(
                jobId, sceneIndex, prompt, indices.map((index) => referenceImages[index]), providerAspectRatio(aspectRatio),
                shouldCancel,
              );
          if (sceneProvider !== provider) console.warn(`[ai-video] job=${jobId} scene=${sceneIndex + 1} fallback_provider=${sceneProvider} succeeded`);
          break;
        } catch (error) {
          lastError = error;
          const message = (error as Error).message || String(error);
          console.warn(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=${sceneProvider} failed: ${message}`);
          if (/cancelled by the user/i.test(message)) throw error;
          const nextProvider = providerOrder[providerIndex + 1];
          if (nextProvider) {
            onProgress?.(Math.max(81, 80 + Math.round((completed / scenes.length) * 14)), `Scene ${sceneIndex + 1}: ${sceneProvider === 'gemini' ? 'Veo' : 'open-source video'} failed — trying ${nextProvider === 'gemini' ? 'Veo' : 'open-source video'} fallback`);
          }
        }
      }
      if (!raw) throw lastError instanceof Error ? lastError : new Error(`AI video scene ${sceneIndex + 1} failed on all configured providers.`);

      if (shouldCancel && await shouldCancel()) {
        throw new Error('AI video generation was cancelled by the user.');
      }
      const normalized = path.join(ASSETS_DIR, jobId, `ai-scene-${sceneIndex + 1}-normalized.mp4`);
      const nativeAudio = await normalizeClip(raw, normalized, aspectRatio, outputQuality, frameRate);
      completed++;
      const pct = 80 + Math.round((completed / scenes.length) * 14);
      const elapsedSeconds = Math.max(1, (Date.now() - generationStartedAt) / 1000);
      const averageSceneSeconds = elapsedSeconds * VIDEO_CONCURRENCY / Math.max(1, completed);
      const batchesLeft = Math.ceil(Math.max(0, scenes.length - completed) / VIDEO_CONCURRENCY);
      const etaSeconds = Math.max(10, Math.round(averageSceneSeconds * batchesLeft + 35));
      onProgress?.(pct, `AI scene ${sceneIndex + 1} complete · ${completed}/${scenes.length} scenes ready`, etaSeconds);
      return { file: normalized, nativeAudio };
    });

    const failures = results
      .map((result, index) => ({ result, index }))
      .filter((item): item is { result: PromiseRejectedResult; index: number } => item.result.status === 'rejected');
    if (failures.length) {
      const summary = failures.slice(0, 3).map(({ result, index }) => {
        const reason = result.reason instanceof Error ? result.reason.message : String(result.reason);
        return `scene ${index + 1}: ${reason}`;
      }).join(' | ');
      throw new Error(`AI video generation did not complete all ${scenes.length} planned scenes (${failures.length} failed). ${summary}`);
    }

    const successful = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
    if (successful.length !== scenes.length) {
      throw new Error(`AI video generation returned ${successful.length}/${scenes.length} scenes; refusing to deliver an incomplete video.`);
    }

    onProgress?.(95, 'All AI scenes are ready · assembling the final master', 45);
    const stitched = await concatClips(jobId, successful.map((item) => item.file));
    onProgress?.(96, 'Finishing your AI video', 30);

    let narrationError: string | undefined;
    let narration: string | null = null;
    if (!silent && narrationAudioPath) {
      try { narration = await narrationAudioPath; }
      catch (err) {
        narrationError = (err as Error).message;
        console.warn(`[ai-video] job=${jobId} narration unavailable: ${narrationError}`);
      }
    }

    const mixOutput = path.join(ASSETS_DIR, jobId, 'ai-video-audio-mix.mp4');
    const nativeAudioPresent = successful.some((item) => item.nativeAudio);
    const musicBed = musicOnly ? await createMusicOnlyBed(jobId, await duration(stitched)) : null;
    await finishAudio(stitched, mixOutput, silent, musicBed ?? narration, musicOnly ? false : nativeAudioPresent);
    const brandedOutput = path.join(ASSETS_DIR, jobId, `ai-video-${mode}-${variantSeed || Date.now()}.mp4`);
    let output = mixOutput;
    try {
      await addBrandClosingOverlay(mixOutput, brandedOutput, jobId, siteTitle);
      output = brandedOutput;
    } catch (error) {
      console.warn(`[ai-video] job=${jobId} branded ending unavailable: ${(error as Error).message}`);
    }
    const seconds = await duration(output);
    console.info(`[ai-video] job=${jobId} output=${path.basename(output)} duration=${seconds.toFixed(2)} clips=${successful.length} native_audio=${nativeAudioPresent} narration=${Boolean(narration)}`);

    return {
      url: `/api/assets/${jobId}/${path.basename(output)}`,
      aspectRatio,
      clipCount: successful.length,
      outputQuality,
      frameRate,
      narrationError,
    };
  } finally {
    await cleanup(jobId);
  }
}
