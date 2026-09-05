import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { ASSETS_DIR } from './capture.js';
import type { Storyboard, StoryboardScene } from './gemini.js';
import { buildAiVideoScenePrompt, buildContinuousExtensionPrompt, buildContinuousVideoPrompt } from './video-prompts.js';
import { GEMINI_COST_CATALOG, recordGenerationCost } from './costs.js';
import { query } from './pool.js';
import { runQueuedProviderCall } from './provider-queue.js';

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
  frameRate: 24 | 30 | 60;
  narrationError?: string;
}

export type AudioMode = 'voice_music' | 'native_audio' | 'music_only' | 'silent';

/** Number of Veo continuation operations needed after the initial 8s base. */
export function continuousExtensionCount(targetSeconds: number) {
  const target = Math.max(8, Math.round(targetSeconds));
  return Math.max(0, Math.ceil((target - 8) / 7));
}

export function continuousOperationCount(targetSeconds: number) {
  return 1 + continuousExtensionCount(targetSeconds);
}

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

/** Veo accepts both text-to-video and image-to-video through `source`. */
export function buildGeminiVideoSource(prompt: string, image?: ReturnType<typeof imageFromBuffer>, video?: Record<string, unknown>) {
  if (video) return { prompt, video };
  return image ? { prompt, image } : { prompt };
}

function sceneReferenceIndices(scene: StoryboardScene, sceneIndex: number, count: number, mode: string) {
  const requested = (scene.sourceIndices ?? [])
    .filter((index) => Number.isInteger(index) && index >= 0 && index < count);
  const unique = [...new Set(requested)];
  const maxRefs = mode === 'custom' ? 3 : scene.sceneType === 'interaction' ? 2 : 1;
  if (unique.length) return unique.slice(0, maxRefs);
  if (!count) return [];
  if (mode === 'custom') {
    // Reference images in Custom/Scenario mode are content/style anchors, not
    // literal first frames. Rotate through up to three assets so different
    // scenes can keep identity/style continuity without repeating the exact
    // same composition every eight seconds.
    return Array.from({ length: Math.min(3, count) }, (_, offset) => (sceneIndex + offset) % count);
  }
  return [sceneIndex % count];
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

async function videoDimensions(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file,
  ]);
  const [width, height] = stdout.trim().split('x').map(Number);
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new Error(`Could not verify generated video resolution: ${path.basename(file)}.`);
  }
  return { width, height };
}

/** Minimum native short-edge we accept before mastering; never disguise 720p as 1080p/4K by upscaling. */
export function minimumProviderShortEdge(quality: '1080p' | '4k') {
  return quality === '4k' ? 2160 : 1080;
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

// Fields this Gemini Developer API Veo path rejects for our production use
// case. Never add these back to a generation config. Production has rejected
// personGeneration='allow_adult', generateAudio, seed, and negativePrompt with
// INVALID_ARGUMENT before video generation starts. Quality exclusions belong in
// the positive master prompt instead of an unsupported negativePrompt field.
const GEMINI_DEVELOPER_API_UNSUPPORTED_FIELDS = ['personGeneration', 'generateAudio', 'seed', 'negativePrompt'] as const;

export function buildGeminiVideoConfig(
  apiAspect: '16:9' | '9:16',
  quality: '1080p' | '4k',
  isStateTransition: boolean,
  lastFrame?: { imageBytes: string; mimeType: string },
  assetReferences: Array<{ imageBytes: string; mimeType: string }> = [],
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    numberOfVideos: 1,
    aspectRatio: apiAspect,
    durationSeconds: 8,
    resolution: quality === '4k' ? '4k' : '1080p',
  };
  // IMPORTANT: do not send personGeneration, generateAudio, seed, or negativePrompt to Gemini
  // Developer API Veo. These fields are unsupported or Enterprise-only and the request is
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
  if (assetReferences.length) {
    config.referenceImages = assetReferences.slice(0, 3).map((image) => ({ image, referenceType: 'asset' }));
  }
  for (const field of GEMINI_DEVELOPER_API_UNSUPPORTED_FIELDS) {
    if (field in config) throw new Error(`buildGeminiVideoConfig must never include '${field}' — it is rejected by the Gemini Developer API.`);
  }
  return config;
}

export function buildContinuousBaseVideoConfig(
  apiAspect: '16:9' | '9:16',
  resolution: '720p' | '1080p' | '4k',
  assetReferences: Array<{ image: { imageBytes: string; mimeType: string }; referenceType: 'asset' }> = [],
): Record<string, unknown> {
  const config: Record<string, unknown> = {
    numberOfVideos: 1,
    aspectRatio: apiAspect,
    durationSeconds: 8,
    resolution,
  };
  if (assetReferences.length) config.referenceImages = assetReferences.slice(0, 3);
  for (const field of GEMINI_DEVELOPER_API_UNSUPPORTED_FIELDS) {
    if (field in config) throw new Error(`Continuous Veo config must never include '${field}' — it is rejected by the Gemini Developer API.`);
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
  return /"code"\s*:\s*(?:14|429|503)|RESOURCE_EXHAUSTED|UNAVAILABLE|high demand|spikes in demand|model (?:is )?(?:overloaded|busy)|ECONNRESET|ETIMEDOUT/i.test(message);
}

const GEMINI_RETRY_DELAYS_MS = [20_000, 60_000, 120_000];

// If the operator pins a specific model via GEMINI_VIDEO_MODEL, honor that
// exact choice. Otherwise prioritize final visual quality: the default is the
// full Veo 3.1 model, not Fast. Operators can still explicitly choose Fast for
// draft/preview economics, but customer-facing final renders should use the
// quality model unless they intentionally override it.
export function geminiModelChain(): string[] {
  const pinned = process.env.GEMINI_VIDEO_MODEL?.trim();
  if (pinned) return [pinned];
  return ['veo-3.1-generate-preview'];
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
  useAssetReferences: boolean,
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
        aspectRatio, quality, nativeAudio, useAssetReferences, model, onStatus, shouldCancel, deadlineAt,
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
  useAssetReferences: boolean,
  model: string,
  onStatus?: (message: string) => void,
  shouldCancel?: () => Promise<boolean>,
  deadlineAt?: number,
) {
  const client = getGeminiClient();
  const selected = referenceIndices.map((index) => references[index]).filter(Boolean);

  const apiAspect = providerAspectRatio(aspectRatio);
  // Website-first productions use an exact captured first frame so real UI is
  // preserved. Custom Idea / Scenario productions instead pass up to three
  // images as Veo 3.1 asset references. That preserves people/products/place
  // identity while allowing the model to compose a genuinely new shot instead
  // of cloning the same uploaded photo at the start of every scene.
  const primary = !useAssetReferences && selected[0] ? imageFromBuffer(selected[0]) : undefined;
  const assetReferences = useAssetReferences ? selected.map(imageFromBuffer).slice(0, 3) : [];
  const isStateTransition = !useAssetReferences && ['interaction'].includes(scene.sceneType) && selected.length >= 2;
  const config = buildGeminiVideoConfig(
    apiAspect,
    quality,
    isStateTransition,
    isStateTransition ? imageFromBuffer(selected[selected.length - 1]) : undefined,
    assetReferences,
  );

  console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini model=${model} source=${primary ? 'first-frame' : assetReferences.length ? 'asset-references' : 'text-only'} refs=${selected.length} transition_frames=${isStateTransition} audio_requested=${nativeAudio} (generateAudio param omitted — native audio is verified after download)`);

  // A Veo request can fail transiently in two different places:
  //   1) generateVideos() rejects immediately (429/503/network error), or
  //   2) Google accepts the long-running operation, then the completed
  //      operation contains gRPC code 14 / "high demand".
  // The old implementation retried only case (1), which meant a single busy
  // scene could invalidate an otherwise-complete multi-scene render. Keep the
  // retry around the whole submit -> poll lifecycle so only that failed scene
  // is resubmitted; already-completed sibling scenes remain untouched.
  for (let attempt = 0; ; attempt++) {
    if (Date.now() >= (deadlineAt ?? Number.POSITIVE_INFINITY)) {
      throw new Error(`AI video generation exceeded the overall production timeout before retrying scene ${sceneIndex + 1}.`);
    }
    if (shouldCancel && await shouldCancel()) {
      throw new Error('AI video generation was cancelled by the user.');
    }

    onStatus?.(attempt === 0
      ? `Submitting AI scene ${sceneIndex + 1} to Veo`
      : `Retrying AI scene ${sceneIndex + 1} with Veo`);

    let operation: Awaited<ReturnType<typeof client.models.generateVideos>>;
    try {
      operation = await runQueuedProviderCall({
        kind: 'video',
        model,
        operation: 'video_generate_scene',
        jobId,
        task: () => client.models.generateVideos({
          model,
          source: buildGeminiVideoSource(prompt, primary),
          config,
        } as never),
      });
    } catch (error) {
      const message = (error as Error).message || String(error);
      const retryDelayMs = GEMINI_RETRY_DELAYS_MS[attempt];
      const canRetry = isRetryableGeminiError(message) && retryDelayMs !== undefined
        && (!deadlineAt || Date.now() + retryDelayMs < deadlineAt)
        && !(shouldCancel && await shouldCancel());
      if (!canRetry) throw error;
      console.warn(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini transient_submit_failure, retrying in ${Math.round(retryDelayMs / 1000)}s (attempt ${attempt + 2}/${GEMINI_RETRY_DELAYS_MS.length + 1}): ${message}`);
      onStatus?.(`Veo is temporarily busy — retrying scene ${sceneIndex + 1} shortly`);
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      continue;
    }

    const operationName = typeof (operation as { name?: unknown }).name === 'string'
      ? String((operation as { name?: string }).name)
      : 'unknown';
    const started = Date.now();
    let lastPollLogAt = 0;
    console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini submitted operation=${operationName} attempt=${attempt + 1}`);

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
        console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini waiting elapsed=${elapsedSeconds}s operation=${operationName} attempt=${attempt + 1}`);
        onStatus?.(`Generating AI scene ${sceneIndex + 1} · ${elapsedSeconds}s elapsed`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      try {
        operation = await client.operations.getVideosOperation({ operation } as never);
      } catch (error) {
        const message = (error as Error).message || String(error);
        if (!isRetryableGeminiError(message)) throw error;
        // A polling transport failure does not mean the Veo operation itself
        // failed. Keep polling the same operation instead of creating a costly
        // duplicate generation request.
        console.warn(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini transient_poll_failure operation=${operationName}: ${message}`);
        onStatus?.(`Veo connection was interrupted — continuing scene ${sceneIndex + 1}`);
      }
    }

    if (operation.error) {
      const operationError = JSON.stringify(operation.error);
      const retryDelayMs = GEMINI_RETRY_DELAYS_MS[attempt];
      const canRetry = isRetryableGeminiError(operationError) && retryDelayMs !== undefined
        && (!deadlineAt || Date.now() + retryDelayMs < deadlineAt)
        && !(shouldCancel && await shouldCancel());
      if (canRetry) {
        console.warn(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini transient_operation_failure operation=${operationName}, retrying scene in ${Math.round(retryDelayMs / 1000)}s (attempt ${attempt + 2}/${GEMINI_RETRY_DELAYS_MS.length + 1}): ${operationError}`);
        onStatus?.(`Veo is under high demand — retrying only scene ${sceneIndex + 1}`);
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
        continue;
      }
      throw new Error(`Gemini video generation failed for scene ${sceneIndex + 1}: ${operationError}`);
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
    console.info(`[ai-video] job=${jobId} scene=${sceneIndex + 1} provider=gemini completed elapsed=${Math.round((Date.now() - started) / 1000)}s duration=${seconds.toFixed(2)}s bytes=${stat.size} attempt=${attempt + 1}`);
    return output;
  }
}

async function normalizeClip(
  input: string,
  output: string,
  aspectRatio: VideoAspectRatio,
  quality: '1080p' | '4k',
  frameRate: 24 | 30 | 60,
) {
  const { width, height } = outputFrame(aspectRatio, quality);
  const sourceSize = await videoDimensions(input);
  const requiredShortEdge = minimumProviderShortEdge(quality);
  const actualShortEdge = Math.min(sourceSize.width, sourceSize.height);
  if (actualShortEdge < requiredShortEdge) {
    throw new Error(
      `Quality gate rejected ${path.basename(input)}: provider returned ${sourceSize.width}x${sourceSize.height} for requested ${quality}. ` +
      `AiWebVideo will not upscale a lower-resolution source and call it ${quality}.`,
    );
  }
  const sourceHasAudio = await hasAudio(input);
  const scaleCrop = `scale=${width}:${height}:force_original_aspect_ratio=increase,crop=${width}:${height},setsar=1,fps=${frameRate}`;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
  if (!sourceHasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  args.push(
    '-vf', scaleCrop,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', quality === '4k' ? '14' : '15', '-pix_fmt', 'yuv420p',
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
      '-c:v', extendSeconds > 0 ? 'libx264' : 'copy', ...(extendSeconds > 0 ? ['-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p'] : []),
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
  const temporary = /^(?:ai-scene-\d+-(?:gemini|normalized)\.mp4|ai-scenes\.concat\.txt|ai-video-master-source\.mp4|ai-video-continuous-provider\.mp4|ai-video-continuous-master\.mp4|ai-video-audio-mix\.mp4|music-only-bed\.m4a|brand-name\.txt)$/;
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
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p', '-c:a', 'copy', '-movflags', '+faststart', output,
  ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  await duration(output);
}

type GeminiProviderVideo = Record<string, unknown>;

function videoProviderRate(model: string, resolution: '720p' | '1080p' | '4k') {
  if (model.includes('lite')) {
    return resolution === '1080p' ? GEMINI_COST_CATALOG.video.lite1080 : GEMINI_COST_CATALOG.video.lite720;
  }
  if (model.includes('fast')) {
    if (resolution === '4k') return GEMINI_COST_CATALOG.video.fast4k;
    if (resolution === '1080p') return GEMINI_COST_CATALOG.video.fast1080;
    return GEMINI_COST_CATALOG.video.fast720;
  }
  // Standard Veo's 720p extension price is tracked conservatively at the
  // existing standard 1080p rate when no separate 720p catalog entry exists.
  return resolution === '4k' ? GEMINI_COST_CATALOG.video.standard4k : GEMINI_COST_CATALOG.video.standard1080;
}

async function waitForContinuousOperation({
  jobId,
  model,
  label,
  createOperation,
  generatedSeconds,
  billingResolution,
  onStatus,
  shouldCancel,
  deadlineAt,
}: {
  jobId: string;
  model: string;
  label: string;
  createOperation: () => Promise<Awaited<ReturnType<ReturnType<typeof getGeminiClient>['models']['generateVideos']>>>;
  generatedSeconds: number;
  billingResolution: '720p' | '1080p' | '4k';
  onStatus?: (message: string) => void;
  shouldCancel?: () => Promise<boolean>;
  deadlineAt?: number;
}): Promise<GeminiProviderVideo> {
  const client = getGeminiClient();
  let lastError: unknown;

  for (let attempt = 0; attempt <= GEMINI_RETRY_DELAYS_MS.length; attempt++) {
    if (Date.now() >= (deadlineAt ?? Number.POSITIVE_INFINITY)) {
      throw new Error(`Continuous AI video generation exceeded the overall timeout during ${label}.`);
    }
    if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');

    let operation: Awaited<ReturnType<typeof client.models.generateVideos>>;
    try {
      onStatus?.(attempt ? `Retrying ${label}` : `Submitting ${label} to Veo`);
      operation = await createOperation();
    } catch (error) {
      lastError = error;
      const message = (error as Error).message || String(error);
      const retryDelay = GEMINI_RETRY_DELAYS_MS[attempt];
      if (retryDelay === undefined || !isRetryableGeminiError(message) || (deadlineAt && Date.now() + retryDelay >= deadlineAt)) throw error;
      console.warn(`[ai-video] job=${jobId} continuous ${label} transient submit failure; retrying in ${Math.round(retryDelay / 1000)}s: ${message}`);
      onStatus?.('Veo is temporarily busy — retrying without losing this production');
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
      continue;
    }

    const operationName = typeof (operation as { name?: unknown }).name === 'string'
      ? String((operation as { name?: string }).name)
      : 'unknown';
    const started = Date.now();
    let lastPollLogAt = 0;
    console.info(`[ai-video] job=${jobId} continuous ${label} submitted operation=${operationName} attempt=${attempt + 1}`);

    while (!operation.done) {
      const now = Date.now();
      if (deadlineAt && now >= deadlineAt) throw new Error(`Continuous AI video generation exceeded the overall timeout while waiting for ${label}.`);
      if (now - started > GENERATION_TIMEOUT_MS) throw new Error(`Veo timed out while generating ${label}.`);
      if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
      if (now - lastPollLogAt >= POLL_LOG_MS) {
        lastPollLogAt = now;
        const elapsed = Math.round((now - started) / 1000);
        console.info(`[ai-video] job=${jobId} continuous ${label} waiting elapsed=${elapsed}s operation=${operationName}`);
        onStatus?.(`${label} · ${elapsed}s elapsed`);
      }
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
      try {
        operation = await client.operations.getVideosOperation({ operation } as never);
      } catch (error) {
        const message = (error as Error).message || String(error);
        if (!isRetryableGeminiError(message)) throw error;
        console.warn(`[ai-video] job=${jobId} continuous ${label} transient poll failure operation=${operationName}: ${message}`);
      }
    }

    if (operation.error) {
      const operationError = JSON.stringify(operation.error);
      lastError = new Error(operationError);
      const retryDelay = GEMINI_RETRY_DELAYS_MS[attempt];
      if (retryDelay !== undefined && isRetryableGeminiError(operationError) && (!deadlineAt || Date.now() + retryDelay < deadlineAt)) {
        console.warn(`[ai-video] job=${jobId} continuous ${label} operation failed transiently; retrying in ${Math.round(retryDelay / 1000)}s: ${operationError}`);
        onStatus?.('Veo is under high demand — retrying this continuation');
        await new Promise((resolve) => setTimeout(resolve, retryDelay));
        continue;
      }
      throw new Error(`Veo failed during ${label}: ${operationError}`);
    }

    const providerVideo = operation.response?.generatedVideos?.[0]?.video as GeminiProviderVideo | undefined;
    if (!providerVideo) throw new Error(`Veo returned no video during ${label}.`);
    await recordGenerationCost({
      jobId,
      provider: 'gemini',
      model,
      operation: label.startsWith('extension') ? 'video_extension' : 'video_continuous_base',
      quantity: generatedSeconds,
      unit: 'generated_second',
      unitCostUsd: videoProviderRate(model, billingResolution),
      metadata: { continuous: true, stage: label, resolution: billingResolution },
    });
    console.info(`[ai-video] job=${jobId} continuous ${label} complete elapsed=${Math.round((Date.now() - started) / 1000)}s`);
    return providerVideo;
  }

  throw lastError instanceof Error ? lastError : new Error(`Continuous AI video generation failed during ${label}.`);
}

async function masterContinuousVideo(
  input: string,
  output: string,
  aspectRatio: VideoAspectRatio,
  quality: '1080p' | '4k',
  frameRate: 24 | 30 | 60,
  targetSeconds: number,
) {
  const { width, height } = outputFrame(aspectRatio, quality);
  const sourceHasAudio = await hasAudio(input);
  const filter = `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},setsar=1,fps=${frameRate}`;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
  if (!sourceHasAudio) args.push('-f', 'lavfi', '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
  args.push(
    '-t', targetSeconds.toFixed(3),
    '-vf', filter,
    '-c:v', 'libx264', '-preset', 'slow', '-crf', quality === '4k' ? '13' : '14', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    ...(sourceHasAudio ? [] : ['-shortest']),
    '-movflags', '+faststart', output,
  );
  await execFileAsync('ffmpeg', args, { timeout: 20 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  const masteredSeconds = await duration(output);
  if (masteredSeconds + 0.35 < targetSeconds) {
    throw new Error(`Continuous master is too short: requested ${targetSeconds}s but received ${masteredSeconds.toFixed(2)}s.`);
  }
  return sourceHasAudio;
}

export async function generateMarketingVideo(
  jobId: string,
  siteTitle: string,
  storyboard: Pick<Storyboard, 'concept' | 'vibe' | 'scenes' | 'creativeBrief' | 'aspectRatio' | 'outputQuality' | 'frameRate' | 'variantSeed' | 'targetDurationSeconds'>,
  referenceImages: Buffer[],
  _screenStyle: boolean,
  audioMode: AudioMode,
  mode = 'video',
  onProgress?: (percent: number, message?: string, etaSeconds?: number) => void,
  narrationAudioPath?: Promise<string | null> | string | null,
  referenceLabels: string[] = [],
  shouldCancel?: () => Promise<boolean>,
  brandOverlayLabel?: string,
): Promise<GeneratedVideo> {
  try {
    const silent = audioMode === 'silent';
    const musicOnly = audioMode === 'music_only';
    const scenes = (storyboard.scenes ?? []).slice(0, 30);
    if (!scenes.length) throw new Error('Production plan has no timeline beats.');
    const canRenderTextOnly = ['custom', 'ai-video', 'talking-scene'].includes(mode);
    if (!referenceImages.length && !canRenderTextOnly) throw new Error('This production needs at least one real website or product reference image.');

    const aspectRatio = storyboard.aspectRatio ?? '16:9';
    const outputQuality = storyboard.outputQuality ?? '1080p';
    const frameRate = storyboard.frameRate ?? 24;
    const variantSeed = Number(storyboard.variantSeed ?? 0);
    const targetDurationSeconds = Math.max(8, Math.round(storyboard.targetDurationSeconds ?? scenes.reduce((sum, scene) => sum + Math.max(1, Number(scene.durationSeconds || 8)), 0)));
    const extensionCount = continuousExtensionCount(targetDurationSeconds);
    if (extensionCount > 20) {
      throw new Error(`A single continuous Veo video can currently be extended to at most 148 seconds. Requested ${targetDurationSeconds}s requires ${extensionCount} extensions.`);
    }

    const generationStartedAt = Date.now();
    const operationCount = 1 + extensionCount;
    const jobTotalTimeoutMs = totalGenerationTimeoutMs(operationCount);
    const deadlineAt = generationStartedAt + jobTotalTimeoutMs;
    const model = geminiModelChain()[0];
    if (!model) throw new Error('No Gemini video model is configured.');
    const client = getGeminiClient();
    const providerResolution: '720p' | '1080p' | '4k' = targetDurationSeconds > 8 ? '720p' : outputQuality;
    // Veo's video-extension endpoint currently accepts a 16:9 input video.
    // For any film longer than the native 8s base we therefore generate one
    // center-safe 16:9 continuity source and master/crop it to the requested
    // 9:16 or 1:1 delivery afterward. This avoids the provider 400 seen when
    // attempting to extend a 9:16 input.
    const apiAspect: '16:9' | '9:16' = targetDurationSeconds > 8 ? '16:9' : providerAspectRatio(aspectRatio);
    const masterPrompt = buildContinuousVideoPrompt({
      mode,
      siteTitle,
      concept: storyboard.concept ?? 'Professional directed film',
      vibe: storyboard.vibe ?? 'premium',
      scenes,
      targetDurationSeconds,
      creativeBrief: storyboard.creativeBrief,
      referenceLabels,
      aspectRatio,
      outputQuality,
      nativeAudio: !silent,
      musicOnly,
      separateNarration: audioMode === 'voice_music',
      variantSeed,
    });

    const referenceAssets = referenceImages.slice(0, 3).map((buffer) => ({ image: imageFromBuffer(buffer), referenceType: 'asset' as const }));
    const baseConfig = buildContinuousBaseVideoConfig(apiAspect, providerResolution, referenceAssets);

    console.info(`[ai-video] job=${jobId} provider=gemini mode=${mode} continuous_video=true target=${targetDurationSeconds}s extensions=${extensionCount} refs=${referenceAssets.length} provider_resolution=${providerResolution} provider_aspect=${apiAspect} delivery=${outputQuality} aspect=${aspectRatio}`);
    onProgress?.(80, 'Starting one continuous AI video', Math.max(60, operationCount * 75));

    let providerVideo = await waitForContinuousOperation({
      jobId,
      model,
      label: 'continuous base video',
      createOperation: () => runQueuedProviderCall({
        kind: 'video',
        model,
        operation: 'video_generate_base',
        jobId,
        task: () => client.models.generateVideos({ model, source: buildGeminiVideoSource(masterPrompt), config: baseConfig } as never),
      }),
      generatedSeconds: 8,
      billingResolution: providerResolution,
      onStatus: (message) => onProgress?.(82, message, Math.max(45, operationCount * 60)),
      shouldCancel,
      deadlineAt,
    });

    let providerSeconds = 8;
    for (let index = 0; index < extensionCount; index++) {
      if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
      const nextProviderSeconds = providerSeconds + 7;
      const extensionPrompt = buildContinuousExtensionPrompt(masterPrompt, providerSeconds, targetDurationSeconds);
      const progressBase = 82 + Math.round(((index + 1) / Math.max(1, extensionCount)) * 11);
      onProgress?.(Math.min(93, progressBase), `Continuing the same film · ${Math.min(nextProviderSeconds, targetDurationSeconds)}s of ${targetDurationSeconds}s`, Math.max(35, (extensionCount - index) * 60));
      const previousVideo = providerVideo;
      providerVideo = await waitForContinuousOperation({
        jobId,
        model,
        label: `extension ${index + 1} of ${extensionCount}`,
        createOperation: () => runQueuedProviderCall({
          kind: 'video',
          model,
          operation: 'video_generate_extension',
          jobId,
          task: () => client.models.generateVideos({
            model,
            source: buildGeminiVideoSource(extensionPrompt, undefined, previousVideo),
            config: { numberOfVideos: 1, durationSeconds: 8, resolution: '720p' },
          } as never),
        }),
        generatedSeconds: 7,
        billingResolution: '720p',
        onStatus: (message) => onProgress?.(Math.min(93, progressBase), message, Math.max(30, (extensionCount - index) * 55)),
        shouldCancel,
        deadlineAt,
      });
      providerSeconds = nextProviderSeconds;
    }

    if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
    const dir = path.join(ASSETS_DIR, jobId);
    await fs.mkdir(dir, { recursive: true });
    const providerOutput = path.join(dir, 'ai-video-continuous-provider.mp4');
    onProgress?.(94, 'Downloading the continuous film', 40);
    await client.files.download({ file: providerVideo, downloadPath: providerOutput } as never);
    const providerDuration = await duration(providerOutput);
    if (providerDuration + 0.35 < targetDurationSeconds) {
      throw new Error(`Veo returned ${providerDuration.toFixed(2)}s after continuous extension, shorter than requested ${targetDurationSeconds}s.`);
    }

    const masteredSource = path.join(dir, 'ai-video-continuous-master.mp4');
    onProgress?.(95, 'Mastering the complete film to your format', 30);
    const nativeAudioPresent = await masterContinuousVideo(providerOutput, masteredSource, aspectRatio, outputQuality, frameRate, targetDurationSeconds);

    let narrationError: string | undefined;
    let narration: string | null = null;
    if (!silent && narrationAudioPath) {
      try { narration = await narrationAudioPath; }
      catch (err) {
        narrationError = (err as Error).message;
        console.warn(`[ai-video] job=${jobId} narration unavailable: ${narrationError}`);
      }
    }

    const mixOutput = path.join(dir, 'ai-video-audio-mix.mp4');
    const musicBed = musicOnly ? await createMusicOnlyBed(jobId, targetDurationSeconds) : null;
    await finishAudio(masteredSource, mixOutput, silent, musicBed ?? narration, musicOnly ? false : nativeAudioPresent);

    const brandedOutput = path.join(dir, `ai-video-${mode}-${variantSeed || Date.now()}.mp4`);
    let output = mixOutput;
    if (mode === 'custom') {
      await fs.copyFile(mixOutput, brandedOutput);
      output = brandedOutput;
    } else {
      try {
        await addBrandClosingOverlay(mixOutput, brandedOutput, jobId, brandOverlayLabel || siteTitle);
        output = brandedOutput;
      } catch (error) {
        console.warn(`[ai-video] job=${jobId} branded ending unavailable: ${(error as Error).message}`);
        await fs.copyFile(mixOutput, brandedOutput);
        output = brandedOutput;
      }
    }

    const expectedFrame = outputFrame(aspectRatio, outputQuality);
    const finalFrame = await videoDimensions(output);
    if (finalFrame.width !== expectedFrame.width || finalFrame.height !== expectedFrame.height) {
      throw new Error(`Final format verification failed: requested ${aspectRatio} ${expectedFrame.width}x${expectedFrame.height}, but mastered file is ${finalFrame.width}x${finalFrame.height}.`);
    }
    const seconds = await duration(output);
    if (Math.abs(seconds - targetDurationSeconds) > 1.0) {
      throw new Error(`Final duration verification failed: requested ${targetDurationSeconds}s, delivered ${seconds.toFixed(2)}s.`);
    }
    console.info(`[ai-video] job=${jobId} output=${path.basename(output)} continuous=true duration=${seconds.toFixed(2)} frame=${finalFrame.width}x${finalFrame.height} extensions=${extensionCount} provider_source=${providerResolution} delivery=${outputQuality} native_audio=${nativeAudioPresent} narration=${Boolean(narration)}`);

    return {
      url: `/api/assets/${jobId}/${path.basename(output)}`,
      aspectRatio,
      clipCount: 1,
      outputQuality,
      frameRate,
      narrationError,
    };
  } finally {
    await cleanup(jobId);
  }
}
