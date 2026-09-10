import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { GoogleGenAI } from '@google/genai';
import { ASSETS_DIR } from './capture.js';
import type { Storyboard } from './gemini.js';
import { buildContinuousBasePrompt, buildContinuousExtensionPrompt, buildContinuousVideoPrompt } from './video-prompts.js';
import { GEMINI_COST_CATALOG, recordGenerationCost } from './costs.js';
import { runQueuedProviderCall } from './provider-queue.js';
import { getJob, refundJobCredits, updateJob } from './queries.js';
import { videoCreditQuote } from './credits.js';
import { buildPartialDeliveryMetadata, type PartialDeliveryMetadata } from './partial-delivery.js';
import {
  buildContinuousBaseVideoConfig,
  buildGeminiVideoSource,
  continuousExtensionCount,
  createMusicOnlyBed,
  finishAudio,
  geminiModelChain,
  isRetryableGeminiError,
  selectContinuousReferenceIndices,
  totalGenerationTimeoutMs,
  type AudioMode,
  type GeneratedVideo as BaseGeneratedVideo,
  type VideoAspectRatio,
} from './veo-base.js';

const execFileAsync = promisify(execFile);
const POLL_MS = Math.max(2_000, Number(process.env.GEMINI_VIDEO_POLL_MS ?? 10_000));
const POLL_LOG_MS = Math.max(POLL_MS, Number(process.env.GEMINI_VIDEO_POLL_LOG_MS ?? 30_000));
const GENERATION_TIMEOUT_MS = Math.max(60_000, Number(process.env.GEMINI_VIDEO_TIMEOUT_MS ?? 12 * 60_000));

export interface GeneratedVideo extends BaseGeneratedVideo {
  requestedDurationSeconds: number;
  deliveredDurationSeconds: number;
  partial: boolean;
  partialRefundCredits: number;
}

type GeminiProviderVideo = Record<string, unknown>;

let geminiClient: GoogleGenAI | null = null;
function getGeminiClient() {
  if (!geminiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY environment variable is not set.');
    geminiClient = new GoogleGenAI({ apiKey });
  }
  return geminiClient;
}

function providerAspectRatio(aspectRatio: VideoAspectRatio): '16:9' | '9:16' {
  return aspectRatio === '9:16' ? '9:16' : '16:9';
}

function imageFromBuffer(buffer: Buffer) {
  return { imageBytes: buffer.toString('base64'), mimeType: 'image/jpeg' };
}

function outputFrame(aspectRatio: VideoAspectRatio, quality: '1080p' | '4k') {
  const scale = quality === '4k' ? 2 : 1;
  if (aspectRatio === '9:16') return { width: 1080 * scale, height: 1920 * scale };
  if (aspectRatio === '1:1') return { width: 1080 * scale, height: 1080 * scale };
  return { width: 1920 * scale, height: 1080 * scale };
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

function videoProviderRate(model: string, resolution: '720p' | '1080p' | '4k') {
  if (model.includes('lite')) {
    return resolution === '1080p' ? GEMINI_COST_CATALOG.video.lite1080 : GEMINI_COST_CATALOG.video.lite720;
  }
  if (model.includes('fast')) {
    if (resolution === '4k') return GEMINI_COST_CATALOG.video.fast4k;
    if (resolution === '1080p') return GEMINI_COST_CATALOG.video.fast1080;
    return GEMINI_COST_CATALOG.video.fast720;
  }
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
  if (Date.now() >= (deadlineAt ?? Number.POSITIVE_INFINITY)) {
    throw new Error(`Continuous AI video generation exceeded the overall timeout before ${label}.`);
  }
  if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');

  let operation: Awaited<ReturnType<typeof client.models.generateVideos>>;
  try {
    onStatus?.(`Submitting ${label} to Veo`);
    operation = await createOperation();
  } catch (error) {
    const message = (error as Error).message || String(error);
    throw new Error(`Veo could not start ${label}. Automatic generation retries are disabled to prevent duplicate provider charges. ${message}`);
  }

  const operationName = typeof (operation as { name?: unknown }).name === 'string'
    ? String((operation as { name?: string }).name)
    : 'unknown';
  const started = Date.now();
  let lastPollLogAt = 0;
  console.info(`[ai-video] job=${jobId} continuous ${label} submitted operation=${operationName}`);

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
      // Keep polling the SAME already-accepted operation. This is a connection
      // retry, not a second paid generation request.
      console.warn(`[ai-video] job=${jobId} continuous ${label} transient_poll_failure operation=${operationName}: ${message}`);
      onStatus?.(`Connection interrupted — continuing the same ${label}`);
    }
  }

  if (operation.error) {
    const operationError = JSON.stringify(operation.error);
    throw new Error(`Veo failed during ${label}. Production stopped without an automatic retry to protect provider spend. ${operationError}`);
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
      // Retrying a file transfer is safe: it does not create another video.
      await new Promise((resolve) => setTimeout(resolve, attempt * 2_000));
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Could not download the completed AI video.');
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
    '-c:v', 'libx264', '-preset', 'medium', '-crf', quality === '4k' ? '13' : '14', '-pix_fmt', 'yuv420p',
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

async function cleanup(jobId: string) {
  const dir = path.join(ASSETS_DIR, jobId);
  let files: string[] = [];
  try { files = await fs.readdir(dir); } catch { return; }
  const temporary = /^(?:ai-video-continuous-provider\.mp4|ai-video-continuous-master\.mp4|music-only-bed\.m4a)$/;
  await Promise.all(files.filter((name) => temporary.test(name)).map((name) => fs.rm(path.join(dir, name), { force: true }).catch(() => {})));
}

function safeWholeDeliveredSeconds(requestedSeconds: number, providerExpectedSeconds: number, actualSeconds: number) {
  const actualWhole = Math.max(0, Math.floor(actualSeconds + 0.25));
  return Math.max(0, Math.min(Math.round(requestedSeconds), Math.round(providerExpectedSeconds), actualWhole));
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
    `Partial video duration refund ${jobId}: ${metadata.deliveredSeconds}s/${metadata.requestedSeconds}s`,
  );
  if (refunded !== metadata.refundedCredits) {
    throw new Error(`Partial video billing could not be settled safely. Expected to refund ${metadata.refundedCredits} credits but refunded ${refunded}.`);
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
  if (!updated) throw new Error('Partial video billing was refunded, but the delivery record could not be saved safely.');
  return metadata;
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
    const deadlineAt = generationStartedAt + totalGenerationTimeoutMs(operationCount, 1);
    const model = geminiModelChain()[0];
    if (!model) throw new Error('No Gemini video model is configured.');
    const client = getGeminiClient();
    const providerResolution: '720p' | '1080p' | '4k' = targetDurationSeconds > 8 ? '720p' : outputQuality;
    const apiAspect: '16:9' | '9:16' = targetDurationSeconds > 8 ? '16:9' : providerAspectRatio(aspectRatio);
    const selectedReferenceIndices = selectContinuousReferenceIndices(scenes, referenceImages.length);
    const selectedReferenceLabels = selectedReferenceIndices.map((index) => referenceLabels[index] || `Reference ${index + 1}`);
    const masterPrompt = buildContinuousVideoPrompt({
      mode,
      siteTitle,
      concept: storyboard.concept ?? 'Professional directed film',
      vibe: storyboard.vibe ?? 'premium',
      scenes,
      targetDurationSeconds,
      creativeBrief: storyboard.creativeBrief,
      referenceLabels: selectedReferenceLabels,
      aspectRatio,
      outputQuality,
      frameRate,
      nativeAudio: !silent,
      musicOnly,
      separateNarration: audioMode === 'voice_music',
      variantSeed,
    });
    const basePrompt = buildContinuousBasePrompt(masterPrompt, targetDurationSeconds);
    const referenceAssets = selectedReferenceIndices.map((index) => ({
      image: imageFromBuffer(referenceImages[index]),
      referenceType: 'asset' as const,
    }));
    const baseConfig = buildContinuousBaseVideoConfig(apiAspect, providerResolution, referenceAssets);

    console.info(`[ai-video] job=${jobId} provider=gemini mode=${mode} continuous_video=true target=${targetDurationSeconds}s extensions=${extensionCount} refs=${referenceAssets.length} provider_resolution=${providerResolution} provider_aspect=${apiAspect} delivery=${outputQuality} aspect=${aspectRatio}`);
    onProgress?.(80, 'Starting one continuous AI video', Math.max(60, operationCount * 75));

    // Base failure has no usable video to deliver, so it bubbles to the render
    // route and receives the normal full-refund failure handling.
    let providerVideo = await waitForContinuousOperation({
      jobId,
      model,
      label: 'continuous base video',
      createOperation: () => runQueuedProviderCall({
        kind: 'video',
        model,
        operation: 'video_generate_base',
        jobId,
        task: () => client.models.generateVideos({ model, source: buildGeminiVideoSource(basePrompt), config: baseConfig } as never),
      }),
      generatedSeconds: 8,
      billingResolution: providerResolution,
      onStatus: (message) => onProgress?.(82, message, Math.max(45, operationCount * 60)),
      shouldCancel,
      deadlineAt,
    });

    let providerSeconds = 8;
    let extensionFailure: string | null = null;
    for (let index = 0; index < extensionCount; index++) {
      if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
      const nextProviderSeconds = providerSeconds + 7;
      const extensionPrompt = buildContinuousExtensionPrompt(masterPrompt, providerSeconds, targetDurationSeconds);
      const progressBase = 82 + Math.round(((index + 1) / Math.max(1, extensionCount)) * 11);
      onProgress?.(Math.min(93, progressBase), `Continuing the same film · ${Math.min(nextProviderSeconds, targetDurationSeconds)}s of ${targetDurationSeconds}s`, Math.max(35, (extensionCount - index) * 60));
      const previousVideo = providerVideo;
      try {
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
      } catch (error) {
        // User-requested Stop remains a full cancellation/refund and never
        // becomes a partial delivery. Any provider/timeout failure after at
        // least the base succeeded instead preserves the last completed film.
        if (shouldCancel && await shouldCancel()) throw error;
        extensionFailure = (error as Error).message || String(error);
        providerVideo = previousVideo;
        console.warn(`[ai-video] job=${jobId} extension_stopped_at=${index + 1}/${extensionCount} completed_seconds=${providerSeconds} reason=${extensionFailure}`);
        onProgress?.(94, `AI provider stopped early — securing the completed ${Math.min(providerSeconds, targetDurationSeconds)}s`, 45);
        break;
      }
    }

    if (shouldCancel && await shouldCancel()) throw new Error('AI video generation was cancelled by the user.');
    const dir = path.join(ASSETS_DIR, jobId);
    await fs.mkdir(dir, { recursive: true });
    const providerOutput = path.join(dir, 'ai-video-continuous-provider.mp4');
    onProgress?.(94, extensionFailure ? 'Downloading your completed partial video' : 'Downloading the continuous film', 40);
    await downloadProviderVideo(client, providerVideo, providerOutput);
    const providerDuration = await duration(providerOutput);
    let deliveryDurationSeconds = safeWholeDeliveredSeconds(targetDurationSeconds, providerSeconds, providerDuration);
    if (deliveryDurationSeconds < 8) {
      throw new Error(`The provider video was too short to deliver safely (${providerDuration.toFixed(2)}s).`);
    }
    const partial = deliveryDurationSeconds < targetDurationSeconds;
    if (partial && !extensionFailure) {
      extensionFailure = `Provider returned ${providerDuration.toFixed(2)}s, shorter than the requested ${targetDurationSeconds}s.`;
      console.warn(`[ai-video] job=${jobId} provider_returned_short_video requested=${targetDurationSeconds}s deliverable=${deliveryDurationSeconds}s actual=${providerDuration.toFixed(2)}s`);
    }

    const masteredSource = path.join(dir, 'ai-video-continuous-master.mp4');
    onProgress?.(95, partial ? `Mastering the completed ${deliveryDurationSeconds}s video` : 'Mastering the complete film to your format', 30);
    const nativeAudioPresent = await masterContinuousVideo(providerOutput, masteredSource, aspectRatio, outputQuality, frameRate, deliveryDurationSeconds);

    let narrationError: string | undefined;
    let narration: string | null = null;
    if (partial && audioMode === 'voice_music') {
      // A narration written for the original longer film should never be
      // unnaturally compressed into a shortened delivery. The route already
      // refunds the voiceover surcharge whenever narrationError is present.
      narrationError = 'Full-length narration was not applied because the video provider stopped early and a shorter completed video was delivered.';
    } else if (!silent && narrationAudioPath) {
      try { narration = await narrationAudioPath; }
      catch (err) {
        narrationError = (err as Error).message;
        console.warn(`[ai-video] job=${jobId} narration unavailable: ${narrationError}`);
      }
    }

    const partialSuffix = partial ? `-partial-${deliveryDurationSeconds}of${targetDurationSeconds}` : '';
    const output = path.join(dir, `ai-video-${mode}-${variantSeed || Date.now()}${partialSuffix}.mp4`);
    const musicBed = musicOnly ? await createMusicOnlyBed(jobId, deliveryDurationSeconds) : null;
    await finishAudio(
      masteredSource,
      output,
      silent,
      musicOnly ? musicBed : partial && audioMode === 'voice_music' ? null : narration,
      musicOnly ? false : nativeAudioPresent,
      deliveryDurationSeconds,
    );

    const expectedFrame = outputFrame(aspectRatio, outputQuality);
    const finalFrame = await videoDimensions(output);
    if (finalFrame.width !== expectedFrame.width || finalFrame.height !== expectedFrame.height) {
      throw new Error(`Final format verification failed: requested ${aspectRatio} ${expectedFrame.width}x${expectedFrame.height}, but mastered file is ${finalFrame.width}x${finalFrame.height}.`);
    }
    const seconds = await duration(output);
    if (Math.abs(seconds - deliveryDurationSeconds) > 1.0) {
      throw new Error(`Final duration verification failed: expected ${deliveryDurationSeconds}s, delivered ${seconds.toFixed(2)}s.`);
    }
    // Bill conservatively from the verified file. If container timing rounds a
    // fraction below the intended second, refund that extra second too.
    deliveryDurationSeconds = Math.min(
      deliveryDurationSeconds,
      Math.max(0, Math.floor(seconds + 0.25)),
    );
    if (deliveryDurationSeconds < 8) throw new Error('Final video is too short to deliver safely.');

    const partialDelivery = await settlePartialDelivery({
      jobId,
      requestedSeconds: targetDurationSeconds,
      deliveredSeconds: deliveryDurationSeconds,
      outputQuality,
      audioMode,
    });

    console.info(`[ai-video] job=${jobId} output=${path.basename(output)} continuous=true requested=${targetDurationSeconds}s delivered=${deliveryDurationSeconds}s partial=${Boolean(partialDelivery)} refund=${partialDelivery?.refundedCredits ?? 0} frame=${finalFrame.width}x${finalFrame.height} provider_source=${providerResolution} delivery=${outputQuality} native_audio=${nativeAudioPresent} narration=${Boolean(narration)}`);

    return {
      url: `/api/assets/${jobId}/${path.basename(output)}`,
      aspectRatio,
      clipCount: 1,
      outputQuality,
      frameRate,
      narrationError,
      requestedDurationSeconds: targetDurationSeconds,
      deliveredDurationSeconds: deliveryDurationSeconds,
      partial: Boolean(partialDelivery),
      partialRefundCredits: partialDelivery?.refundedCredits ?? 0,
    };
  } finally {
    await cleanup(jobId);
  }
}
