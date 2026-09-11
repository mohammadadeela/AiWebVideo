import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { ASSETS_DIR } from './capture.js';
import type { Storyboard, StoryboardScene } from './gemini.js';
import { buildAiVideoScenePrompt } from './video-prompts.js';
import { GEMINI_COST_CATALOG, recordGenerationCost } from './costs.js';
import { runQueuedProviderCall } from './provider-queue.js';
import {
  buildGeminiVideoConfig,
  buildGeminiVideoSource,
  createMusicOnlyBed,
  geminiModelChain,
  isRetryableGeminiError,
  totalGenerationTimeoutMs,
  type AudioMode,
  type VideoAspectRatio,
} from './veo-base.js';
import { getJob, refundJobCredits, updateJob } from './queries.js';
import { videoCreditQuote } from './credits.js';
import { buildPartialDeliveryMetadata, type PartialDeliveryMetadata } from './partial-delivery.js';

const execFileAsync = promisify(execFile);
const POLL_MS = Math.max(2_000, Number(process.env.GEMINI_VIDEO_POLL_MS ?? 10_000));
const POLL_LOG_MS = Math.max(POLL_MS, Number(process.env.GEMINI_VIDEO_POLL_LOG_MS ?? 30_000));
const GENERATION_TIMEOUT_MS = Math.max(60_000, Number(process.env.GEMINI_VIDEO_TIMEOUT_MS ?? 12 * 60_000));
const PROVIDER_SCENE_SECONDS = 8;

/**
 * Premium renderer
 * ----------------
 * Veo video-extension is 720p-only. Paid customer output must never be built by
 * upscaling that 720p extension chain and calling it 1080p/4K. Instead, every
 * timeline segment is generated natively as its own 8-second Veo operation at
 * the customer's requested 1080p or 4K quality, then the verified clips are
 * joined into one delivery. This intentionally restores the high-quality
 * scene-based visual strategy while keeping the newer no-retry, partial-refund,
 * cancellation and billing safety behavior.
 */

export interface GeneratedVideo {
  url: string;
  aspectRatio: VideoAspectRatio;
  clipCount: number;
  outputQuality: '1080p' | '4k';
  frameRate: 24 | 30 | 60;
  narrationError?: string;
  requestedDurationSeconds: number;
  deliveredDurationSeconds: number;
  partial: boolean;
  partialRefundCredits: number;
}

type GeminiProviderVideo = Record<string, unknown>;

type SegmentScene = StoryboardScene & {
  deliverySeconds: number;
};

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

function outputFrame(aspectRatio: VideoAspectRatio, quality: '1080p' | '4k') {
  const scale = quality === '4k' ? 2 : 1;
  if (aspectRatio === '9:16') return { width: 1080 * scale, height: 1920 * scale };
  if (aspectRatio === '1:1') return { width: 1080 * scale, height: 1080 * scale };
  return { width: 1920 * scale, height: 1080 * scale };
}

function providerAspectRatio(aspectRatio: VideoAspectRatio): '16:9' | '9:16' {
  // Veo has no native square mode. Square is generated at the selected native
  // quality in 16:9 with square-safe composition, then center-cropped. Unlike
  // the old long-video path, resolution itself is never downgraded.
  return aspectRatio === '9:16' ? '9:16' : '16:9';
}

function imageFromBuffer(buffer: Buffer) {
  return { imageBytes: buffer.toString('base64'), mimeType: 'image/jpeg' };
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

async function hasAudio(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a:0', '-show_entries', 'stream=codec_type', '-of', 'csv=p=0', file,
  ]).catch(() => ({ stdout: '' }));
  return Boolean(stdout.trim());
}

async function audioStreamCount(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'a', '-show_entries', 'stream=index', '-of', 'csv=p=0', file,
  ]).catch(() => ({ stdout: '' }));
  return stdout.split(/\r?\n/).filter(Boolean).length;
}

function minimumProviderShortEdge(quality: '1080p' | '4k') {
  return quality === '4k' ? 2160 : 1080;
}

function isStudioMode(mode: string) {
  return ['custom', 'ai-video', 'product-video', 'talking-scene'].includes(mode);
}

function sceneReferenceIndices(scene: StoryboardScene, sceneIndex: number, count: number, mode: string): number[] {
  const requested = ((scene.sourceIndices ?? []) as number[])
    .filter((index: number) => Number.isInteger(index) && index >= 0 && index < count);
  const unique = [...new Set(requested)];
  const studio = isStudioMode(mode);
  const maxRefs = studio ? 3 : scene.sceneType === 'interaction' ? 2 : 1;
  if (unique.length) return unique.slice(0, maxRefs);
  if (!count) return [];
  if (studio) {
    return Array.from({ length: Math.min(3, count) }, (_, offset) => (sceneIndex + offset) % count);
  }
  return [sceneIndex % count];
}

function buildSegmentScenes(
  scenes: StoryboardScene[],
  targetDurationSeconds: number,
  referenceCount: number,
  mode: string,
): SegmentScene[] {
  const segmentCount = Math.max(1, Math.ceil(targetDurationSeconds / PROVIDER_SCENE_SECONDS));
  const source = scenes.length ? scenes : [{
    sceneNumber: 1,
    durationSeconds: PROVIDER_SCENE_SECONDS,
    sceneType: 'hook' as const,
    shotDescription: 'Create the strongest professional interpretation of the customer direction.',
    sourceIndices: referenceCount ? [0] : [],
    composition: 'single' as const,
    motion: 'static' as const,
    focusX: 0.5,
    focusY: 0.5,
    onScreenCopy: '',
    transition: '',
  }];

  return Array.from({ length: segmentCount }, (_, index) => {
    const start = index * PROVIDER_SCENE_SECONDS;
    const deliverySeconds = Math.max(1, Math.min(PROVIDER_SCENE_SECONDS, targetDurationSeconds - start));
    const existing = source[index];
    const base = existing ?? source[source.length - 1];
    const synthetic = !existing;
    const last = index === segmentCount - 1;
    const studio = isStudioMode(mode);
    const fallbackRefs = !referenceCount
      ? []
      : studio
        ? Array.from({ length: Math.min(3, referenceCount) }, (_, offset) => (index + offset) % referenceCount)
        : [index % referenceCount];

    return {
      ...base,
      sceneNumber: index + 1,
      durationSeconds: deliverySeconds,
      deliverySeconds,
      sceneType: last ? 'cta' : index === 0 ? 'hook' : (base.sceneType ?? 'feature'),
      shotDescription: synthetic
        ? `${base.shotDescription} Continue the same campaign/world with a genuinely new visual beat for segment ${index + 1}/${segmentCount}. Do not replay the previous shot. ${last ? 'Resolve on a deliberate, complete final moment.' : 'Leave a natural editorial handoff into the next segment.'}`
        : base.shotDescription,
      sourceIndices: synthetic ? fallbackRefs : (base.sourceIndices ?? fallbackRefs),
      onScreenCopy: '',
      transition: last ? '' : (base.transition || 'Cut or hand off naturally into the next premium shot without repeating the previous action.'),
    };
  });
}

function videoProviderRate(model: string, quality: '1080p' | '4k') {
  if (model.includes('lite')) {
    return quality === '4k' ? 0 : GEMINI_COST_CATALOG.video.lite1080;
  }
  if (model.includes('fast')) {
    return quality === '4k' ? GEMINI_COST_CATALOG.video.fast4k : GEMINI_COST_CATALOG.video.fast1080;
  }
  return quality === '4k' ? GEMINI_COST_CATALOG.video.standard4k : GEMINI_COST_CATALOG.video.standard1080;
}

async function waitForSceneOperation({
  jobId,
  sceneIndex,
  model,
  prompt,
  scene,
  references,
  referenceIndices,
  aspectRatio,
  quality,
  useAssetReferences,
  onStatus,
  shouldCancel,
  deadlineAt,
}: {
  jobId: string;
  sceneIndex: number;
  model: string;
  prompt: string;
  scene: StoryboardScene;
  references: Buffer[];
  referenceIndices: number[];
  aspectRatio: VideoAspectRatio;
  quality: '1080p' | '4k';
  useAssetReferences: boolean;
  onStatus?: (message: string) => void;
  shouldCancel?: () => Promise<boolean>;
  deadlineAt?: number;
}): Promise<string> {
  const client = getGeminiClient();
  if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
  if (Date.now() >= (deadlineAt ?? Number.POSITIVE_INFINITY)) {
    throw new Error(`Premium AI video generation exceeded the overall timeout before scene ${sceneIndex + 1}.`);
  }

  const selected = referenceIndices.map((index) => references[index]).filter(Boolean);
  const primary = !useAssetReferences && selected[0] ? imageFromBuffer(selected[0]) : undefined;
  const assetReferences = useAssetReferences ? selected.map(imageFromBuffer).slice(0, 3) : [];
  const lastFrame = !useAssetReferences && scene.sceneType === 'interaction' && selected[1]
    ? imageFromBuffer(selected[1])
    : undefined;
  const config = buildGeminiVideoConfig(
    providerAspectRatio(aspectRatio),
    quality,
    Boolean(lastFrame),
    lastFrame,
    assetReferences,
  );

  let operation: Awaited<ReturnType<typeof client.models.generateVideos>>;
  try {
    onStatus?.(`Submitting premium scene ${sceneIndex + 1}`);
    operation = await runQueuedProviderCall({
      kind: 'video',
      model,
      operation: 'video_generate_premium_scene',
      jobId,
      task: () => client.models.generateVideos({
        model,
        source: buildGeminiVideoSource(prompt, primary),
        config,
      } as never),
    });
  } catch (error) {
    const message = (error as Error).message || String(error);
    throw new Error(
      `Veo could not start premium scene ${sceneIndex + 1}. Automatic generation retries are disabled to prevent duplicate provider charges. ${message}`,
    );
  }

  const operationName = typeof (operation as { name?: unknown }).name === 'string'
    ? String((operation as { name?: string }).name)
    : 'unknown';
  const started = Date.now();
  let lastPollLogAt = 0;
  console.info(`[ai-video] job=${jobId} premium_scene=${sceneIndex + 1} submitted operation=${operationName} resolution=${quality}`);

  while (!operation.done) {
    const now = Date.now();
    if (deadlineAt && now >= deadlineAt) {
      throw new Error(`Premium AI video generation exceeded the overall timeout while waiting for scene ${sceneIndex + 1}.`);
    }
    if (now - started > GENERATION_TIMEOUT_MS) {
      throw new Error(`Veo timed out while generating premium scene ${sceneIndex + 1}.`);
    }
    if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
    if (now - lastPollLogAt >= POLL_LOG_MS) {
      lastPollLogAt = now;
      onStatus?.(`Premium scene ${sceneIndex + 1} · ${Math.round((now - started) / 1000)}s elapsed`);
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    try {
      operation = await client.operations.getVideosOperation({ operation } as never);
    } catch (error) {
      const message = (error as Error).message || String(error);
      if (!isRetryableGeminiError(message)) throw error;
      // Safe transport retry: poll the SAME paid operation, never submit a
      // second generation for the same scene.
      console.warn(`[ai-video] job=${jobId} premium_scene=${sceneIndex + 1} transient_poll_failure operation=${operationName}: ${message}`);
      onStatus?.(`Connection interrupted — continuing premium scene ${sceneIndex + 1}`);
    }
  }

  if (operation.error) {
    throw new Error(
      `Veo failed during premium scene ${sceneIndex + 1}. Production stopped without an automatic retry to protect provider spend. ${JSON.stringify(operation.error)}`,
    );
  }

  const video = operation.response?.generatedVideos?.[0]?.video as GeminiProviderVideo | undefined;
  if (!video) throw new Error(`Veo returned no video for premium scene ${sceneIndex + 1}.`);

  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  const output = path.join(dir, `premium-scene-${sceneIndex + 1}-provider.mp4`);
  onStatus?.(`Downloading premium scene ${sceneIndex + 1}`);
  await downloadProviderVideo(client, video, output);
  const seconds = await duration(output);
  const dimensions = await videoDimensions(output);
  const requiredShortEdge = minimumProviderShortEdge(quality);
  if (Math.min(dimensions.width, dimensions.height) < requiredShortEdge) {
    throw new Error(
      `Quality gate rejected premium scene ${sceneIndex + 1}: provider returned ${dimensions.width}x${dimensions.height} for requested ${quality}. No lower-resolution source will be upscaled and sold as ${quality}.`,
    );
  }

  await recordGenerationCost({
    jobId,
    provider: 'gemini',
    model,
    operation: 'video_premium_scene',
    quantity: seconds,
    unit: 'generated_second',
    unitCostUsd: videoProviderRate(model, quality),
    metadata: { scene: sceneIndex + 1, quality, premiumSceneRenderer: true },
  });
  console.info(
    `[ai-video] job=${jobId} premium_scene=${sceneIndex + 1} complete duration=${seconds.toFixed(2)}s frame=${dimensions.width}x${dimensions.height}`,
  );
  return output;
}

async function downloadProviderVideo(client: GoogleGenAI, video: GeminiProviderVideo, output: string) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await fs.rm(output, { force: true }).catch(() => {});
      await client.files.download({ file: video, downloadPath: output } as never);
      return;
    } catch (error) {
      lastError = error;
      if (attempt === 3) break;
      // Download retries are safe because they never create a second video.
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not download the completed premium AI video scene.');
}

async function normalizeSceneClip(
  input: string,
  output: string,
  aspectRatio: VideoAspectRatio,
  quality: '1080p' | '4k',
  frameRate: 24 | 30 | 60,
  deliverySeconds: number,
  keepNativeAudio: boolean,
) {
  const { width, height } = outputFrame(aspectRatio, quality);
  const sourceSize = await videoDimensions(input);
  const requiredShortEdge = minimumProviderShortEdge(quality);
  const actualShortEdge = Math.min(sourceSize.width, sourceSize.height);
  if (actualShortEdge < requiredShortEdge) {
    throw new Error(
      `Quality gate rejected ${path.basename(input)}: provider returned ${sourceSize.width}x${sourceSize.height} for requested ${quality}.`,
    );
  }

  const sourceHasAudio = await hasAudio(input);
  const videoFilter = `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},setsar=1,fps=${frameRate}`;
  const args = ['-y', '-hide_banner', '-loglevel', 'error', '-i', input];
  let filterComplex = `[0:v]${videoFilter}[v]`;
  const audioMap = '[a]';

  if (keepNativeAudio && sourceHasAudio) {
    const fadeOutAt = Math.max(0, deliverySeconds - 0.18).toFixed(3);
    filterComplex += `;[0:a]aresample=48000,aformat=channel_layouts=stereo,loudnorm=I=-18:LRA=10:TP=-1.5,afade=t=in:st=0:d=0.10,afade=t=out:st=${fadeOutAt}:d=0.18[a]`;
  } else {
    args.push('-f', 'lavfi', '-t', deliverySeconds.toFixed(3), '-i', 'anullsrc=channel_layout=stereo:sample_rate=48000');
    filterComplex += ';[1:a]anull[a]';
  }

  args.push(
    '-filter_complex', filterComplex,
    '-map', '[v]', '-map', audioMap,
    '-t', deliverySeconds.toFixed(3),
    '-c:v', 'libx264', '-preset', 'slow', '-crf', '12', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-movflags', '+faststart', output,
  );

  await execFileAsync('ffmpeg', args, { timeout: 25 * 60_000, maxBuffer: 12 * 1024 * 1024 });
  const seconds = await duration(output);
  if (seconds + 0.2 < deliverySeconds) {
    throw new Error(`Premium scene mastering returned ${seconds.toFixed(2)}s, shorter than required ${deliverySeconds}s.`);
  }
  return keepNativeAudio && sourceHasAudio;
}

async function concatSceneClips(jobId: string, clips: string[]) {
  if (!clips.length) throw new Error('No completed premium video scenes are available to assemble.');
  const dir = path.join(ASSETS_DIR, jobId);
  const list = path.join(dir, 'premium-scenes.concat.txt');
  const esc = (value: string) => value.replace(/'/g, "'\\''");
  await fs.writeFile(list, clips.map((clip) => `file '${esc(clip)}'`).join('\n'));
  const output = path.join(dir, 'premium-scenes-master.mp4');
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', list,
    '-c', 'copy', '-movflags', '+faststart', output,
  ], { timeout: 15 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  await duration(output);
  return output;
}

function atempoChain(speed: number) {
  if (!Number.isFinite(speed) || speed <= 1.000001) return '';
  const filters: string[] = [];
  let remaining = speed;
  while (remaining > 2) {
    filters.push('atempo=2');
    remaining /= 2;
  }
  filters.push(`atempo=${remaining.toFixed(6)}`);
  return filters.join(',');
}

async function finishPremiumAudio({
  jobId,
  source,
  output,
  audioMode,
  narrationAudioPath,
  exactDurationSeconds,
  partial,
}: {
  jobId: string;
  source: string;
  output: string;
  audioMode: AudioMode;
  narrationAudioPath?: Promise<string | null> | string | null;
  exactDurationSeconds: number;
  partial: boolean;
}): Promise<{ narrationError?: string }> {
  const target = exactDurationSeconds.toFixed(3);

  if (audioMode === 'silent') {
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source,
      '-map', '0:v:0', '-c:v', 'copy', '-an', '-t', target, '-movflags', '+faststart', output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return {};
  }

  if (audioMode === 'native_audio') {
    // Exactly one sequential provider-audio stream. Nothing is layered on top,
    // so there can be no narration/provider double-voice problem. A final
    // loudness pass smooths scene-to-scene level differences without touching video.
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source,
      '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy',
      '-af', 'loudnorm=I=-16:LRA=11:TP=-1.5,alimiter=limit=0.95',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-t', target, '-movflags', '+faststart', output,
    ], { timeout: 12 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return {};
  }

  const music = await createMusicOnlyBed(jobId, exactDurationSeconds);
  if (audioMode === 'music_only') {
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-i', music,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-t', target, '-movflags', '+faststart', output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return {};
  }

  // voice_music: provider audio is intentionally NOT part of this mix. Veo
  // always generates audio and may invent speech; mixing that with separately
  // generated TTS is the source of the "multiple voices/sounds" effect. Use one
  // controlled soundtrack plus one narration track only.
  if (partial) {
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-i', music,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-t', target, '-movflags', '+faststart', output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return {
      narrationError: 'Full-length narration was not applied because the provider stopped early and a shorter completed video was delivered.',
    };
  }

  let narration: string | null = null;
  try {
    narration = narrationAudioPath ? await narrationAudioPath : null;
  } catch (error) {
    const narrationError = (error as Error).message || String(error);
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-i', music,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-t', target, '-movflags', '+faststart', output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return { narrationError };
  }

  if (!narration) {
    await execFileAsync('ffmpeg', [
      '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-i', music,
      '-map', '0:v:0', '-map', '1:a:0', '-c:v', 'copy',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
      '-t', target, '-movflags', '+faststart', output,
    ], { timeout: 10 * 60_000, maxBuffer: 8 * 1024 * 1024 });
    return { narrationError: 'Narration track was unavailable for this render.' };
  }

  const narrationSeconds = await duration(narration).catch(() => 0);
  const speed = narrationSeconds > exactDurationSeconds + 0.25
    ? narrationSeconds / exactDurationSeconds
    : 1;
  const tempo = atempoChain(speed);
  const narrationTiming = tempo ? `${tempo},atrim=duration=${target},` : `atrim=duration=${target},`;
  const filter = [
    `[1:a]volume=0.20,afade=t=in:st=0:d=0.8,afade=t=out:st=${Math.max(0, exactDurationSeconds - 1.2).toFixed(3)}:d=1.2,apad=whole_dur=${target}[music]`,
    `[2:a]${narrationTiming}highpass=f=75,loudnorm=I=-16:LRA=7:TP=-1.5,apad=whole_dur=${target}[voice]`,
    `[music][voice]amix=inputs=2:weights='0.75 1.0':normalize=0:duration=first,alimiter=limit=0.95[a]`,
  ].join(';');
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error', '-i', source, '-i', music, '-i', narration,
    '-filter_complex', filter,
    '-map', '0:v:0', '-map', '[a]', '-c:v', 'copy',
    '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-ac', '2',
    '-t', target, '-movflags', '+faststart', output,
  ], { timeout: 12 * 60_000, maxBuffer: 8 * 1024 * 1024 });
  return {};
}

async function settlePartialDelivery({
  jobId,
  requestedSeconds,
  deliveredSeconds,
  outputQuality,
  audioMode,
}: {
  jobId: string;
  requestedSeconds: number;
  deliveredSeconds: number;
  outputQuality: '1080p' | '4k';
  audioMode: AudioMode;
}): Promise<PartialDeliveryMetadata | null> {
  const job = await getJob(jobId);
  if (!job?.user_id) throw new Error('Could not settle partial video billing because the production owner was unavailable.');
  const quote = videoCreditQuote(job.mode, audioMode !== 'voice_music', requestedSeconds, outputQuality);
  const metadata = buildPartialDeliveryMetadata(requestedSeconds, deliveredSeconds, quote.perSecondCredits);
  if (!metadata) return null;

  const refunded = await refundJobCredits(
    jobId,
    job.user_id,
    metadata.refundedCredits,
    `Partial premium video duration refund ${jobId}: ${metadata.deliveredSeconds}s/${metadata.requestedSeconds}s`,
  );
  if (refunded !== metadata.refundedCredits) {
    throw new Error(`Partial premium video billing could not be settled safely. Expected to refund ${metadata.refundedCredits} credits but refunded ${refunded}.`);
  }

  const latest = await getJob(jobId);
  const currentWorkflow = latest?.workflow_state && typeof latest.workflow_state === 'object'
    ? latest.workflow_state
    : {};
  const updated = await updateJob(jobId, {
    workflow_state: {
      ...currentWorkflow,
      partialDelivery: metadata,
    },
  });
  if (!updated) throw new Error('Partial premium video billing was refunded, but the delivery record could not be saved safely.');
  return metadata;
}

async function verifyFinalFile(
  file: string,
  aspectRatio: VideoAspectRatio,
  quality: '1080p' | '4k',
  expectedSeconds: number,
  audioMode: AudioMode,
) {
  const expectedFrame = outputFrame(aspectRatio, quality);
  const frame = await videoDimensions(file);
  if (frame.width !== expectedFrame.width || frame.height !== expectedFrame.height) {
    throw new Error(
      `Final format verification failed: requested ${aspectRatio} ${expectedFrame.width}x${expectedFrame.height}, but mastered file is ${frame.width}x${frame.height}.`,
    );
  }
  const seconds = await duration(file);
  if (Math.abs(seconds - expectedSeconds) > 0.75) {
    throw new Error(`Final duration verification failed: expected ${expectedSeconds}s, delivered ${seconds.toFixed(2)}s.`);
  }
  const streams = await audioStreamCount(file);
  const expectedAudioStreams = audioMode === 'silent' ? 0 : 1;
  if (streams !== expectedAudioStreams) {
    throw new Error(
      `Final audio verification failed: expected ${expectedAudioStreams} audio stream${expectedAudioStreams === 1 ? '' : 's'}, found ${streams}.`,
    );
  }
  return seconds;
}

async function cleanup(jobId: string) {
  const dir = path.join(ASSETS_DIR, jobId);
  let files: string[] = [];
  try { files = await fs.readdir(dir); } catch { return; }
  const temporary = /^(?:premium-scene-\d+-(?:provider|master)\.mp4|premium-scenes\.concat\.txt|premium-scenes-master\.mp4|music-only-bed\.m4a)$/;
  await Promise.all(files.filter((name) => temporary.test(name)).map((name) => fs.rm(path.join(dir, name), { force: true }).catch(() => {})));
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
): Promise<GeneratedVideo> {
  try {
    const sourceScenes = (storyboard.scenes ?? []).slice(0, 30);
    if (!sourceScenes.length) throw new Error('Production plan has no timeline beats.');
    const textOnlyAllowed = ['custom', 'ai-video', 'talking-scene'].includes(mode);
    if (!referenceImages.length && !textOnlyAllowed) {
      throw new Error('This production needs at least one real website or product reference image.');
    }

    const aspectRatio = storyboard.aspectRatio ?? '16:9';
    const outputQuality = storyboard.outputQuality ?? '1080p';
    const frameRate = storyboard.frameRate ?? 24;
    const targetDurationSeconds = Math.max(
      8,
      Math.round(
        storyboard.targetDurationSeconds
          ?? sourceScenes.reduce((sum, scene) => sum + Math.max(1, Number(scene.durationSeconds || 8)), 0),
      ),
    );
    const segments = buildSegmentScenes(sourceScenes, targetDurationSeconds, referenceImages.length, mode);
    if (segments.length > 18) throw new Error(`Premium scene renderer supports up to 144 seconds. Requested ${targetDurationSeconds}s.`);

    const model = geminiModelChain()[0];
    if (!model) throw new Error('No Gemini video model is configured.');
    const deadlineAt = Date.now() + totalGenerationTimeoutMs(segments.length, 1);
    const useAssetReferences = isStudioMode(mode);
    const completedClips: string[] = [];
    let completedSeconds = 0;
    let nativeAudioSeen = false;
    let stopReason: string | null = null;

    console.info(
      `[ai-video] job=${jobId} renderer=premium_scene mode=${mode} target=${targetDurationSeconds}s scenes=${segments.length} native_resolution=${outputQuality} native_aspect=${providerAspectRatio(aspectRatio)} delivery_aspect=${aspectRatio}`,
    );
    onProgress?.(80, `Starting ${segments.length} premium ${outputQuality} scene${segments.length === 1 ? '' : 's'}`, Math.max(60, segments.length * 90));

    for (let index = 0; index < segments.length; index++) {
      if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
      const scene = segments[index];
      const refs = sceneReferenceIndices(scene, index, referenceImages.length, mode);
      const selectedLabels = refs.map((refIndex) => referenceLabels[refIndex] || `Reference ${refIndex + 1}`);
      const prompt = buildAiVideoScenePrompt({
        mode,
        siteTitle,
        concept: storyboard.concept ?? 'Professional directed film',
        vibe: storyboard.vibe ?? 'premium, modern, cinematic',
        scene,
        sceneIndex: index,
        totalScenes: segments.length,
        targetDurationSeconds,
        creativeBrief: storyboard.creativeBrief,
        // Provider audio is only retained for Native Audio. Other audio modes
        // use one controlled final soundtrack, preventing duplicate voices.
        nativeAudio: audioMode === 'native_audio',
        musicOnly: audioMode === 'music_only',
        separateNarration: audioMode === 'voice_music',
        referenceLabels: selectedLabels,
        variantSeed: storyboard.variantSeed,
        aspectRatio,
        previousSceneSummary: index > 0 ? segments[index - 1].shotDescription : undefined,
        nextSceneSummary: index + 1 < segments.length ? segments[index + 1].shotDescription : undefined,
      });
      const pctBase = 80 + Math.round((index / Math.max(1, segments.length)) * 13);
      try {
        const provider = await waitForSceneOperation({
          jobId,
          sceneIndex: index,
          model,
          prompt,
          scene,
          references: referenceImages,
          referenceIndices: refs,
          aspectRatio,
          quality: outputQuality,
          useAssetReferences,
          onStatus: (message) => onProgress?.(
            Math.min(93, Math.max(81, pctBase + 1)),
            message,
            Math.max(35, (segments.length - index) * 80),
          ),
          shouldCancel,
          deadlineAt,
        });

        const normalized = path.join(ASSETS_DIR, jobId, `premium-scene-${index + 1}-master.mp4`);
        const sceneHasNative = await normalizeSceneClip(
          provider,
          normalized,
          aspectRatio,
          outputQuality,
          frameRate,
          scene.deliverySeconds,
          audioMode === 'native_audio',
        );
        nativeAudioSeen = nativeAudioSeen || sceneHasNative;
        completedClips.push(normalized);
        completedSeconds += scene.deliverySeconds;
        onProgress?.(
          Math.min(94, 81 + Math.round(((index + 1) / segments.length) * 13)),
          `Premium scene ${index + 1} of ${segments.length} ready`,
          Math.max(20, (segments.length - index - 1) * 75),
        );
      } catch (error) {
        if (shouldCancel && await shouldCancel()) throw error;
        stopReason = (error as Error).message || String(error);
        console.warn(
          `[ai-video] job=${jobId} premium_scene_renderer stopped_at=${index + 1}/${segments.length} completed_seconds=${completedSeconds} reason=${stopReason}`,
        );
        break;
      }
    }

    if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
    if (!completedClips.length) {
      throw new Error(stopReason || 'The first premium video scene could not be generated.');
    }

    const deliveredDurationSeconds = Math.min(targetDurationSeconds, completedSeconds);
    const partial = deliveredDurationSeconds < targetDurationSeconds;
    onProgress?.(95, partial
      ? `Securing the completed ${deliveredDurationSeconds}s premium video`
      : 'Assembling the premium full-resolution video', 35);
    const assembled = await concatSceneClips(jobId, completedClips);

    const suffix = partial ? `-partial-${deliveredDurationSeconds}of${targetDurationSeconds}` : '';
    const output = path.join(
      ASSETS_DIR,
      jobId,
      `ai-video-${mode}-premium-${storyboard.variantSeed || Date.now()}${suffix}.mp4`,
    );
    onProgress?.(97, 'Finishing one clean soundtrack and final master', 20);
    const audioResult = await finishPremiumAudio({
      jobId,
      source: assembled,
      output,
      audioMode,
      narrationAudioPath,
      exactDurationSeconds: deliveredDurationSeconds,
      partial,
    });

    const verifiedDuration = await verifyFinalFile(
      output,
      aspectRatio,
      outputQuality,
      deliveredDurationSeconds,
      audioMode,
    );
    const safeDeliveredSeconds = Math.max(8, Math.min(deliveredDurationSeconds, Math.floor(verifiedDuration + 0.25)));
    const partialDelivery = await settlePartialDelivery({
      jobId,
      requestedSeconds: targetDurationSeconds,
      deliveredSeconds: safeDeliveredSeconds,
      outputQuality,
      audioMode,
    });

    console.info(
      `[ai-video] job=${jobId} renderer=premium_scene output=${path.basename(output)} requested=${targetDurationSeconds}s delivered=${safeDeliveredSeconds}s partial=${Boolean(partialDelivery)} refund=${partialDelivery?.refundedCredits ?? 0} clips=${completedClips.length} resolution=${outputQuality} aspect=${aspectRatio} audio=${audioMode} native_audio_seen=${nativeAudioSeen}`,
    );

    return {
      url: `/api/assets/${jobId}/${path.basename(output)}`,
      aspectRatio,
      clipCount: completedClips.length,
      outputQuality,
      frameRate,
      narrationError: audioResult.narrationError,
      requestedDurationSeconds: targetDurationSeconds,
      deliveredDurationSeconds: safeDeliveredSeconds,
      partial: Boolean(partialDelivery),
      partialRefundCredits: partialDelivery?.refundedCredits ?? 0,
    };
  } finally {
    await cleanup(jobId);
  }
}
