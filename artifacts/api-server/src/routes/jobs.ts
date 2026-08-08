import { Router } from 'express';
import * as fs from 'fs/promises';
import * as path from 'path';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getOperationsSettings, productionCapacity } from '../lib/provider-config.js';
import { addJobMessage, claimRenderAndSpend, createAsset, createJobFromCapture, getAssetsByJob, getJob, getJobMessages, refundJobCredits, softDeleteJob, updateJob } from '../lib/queries.js';
import { tryAuth, requireAuth } from '../lib/auth.js';
import { AppError, sendError } from '../lib/errors.js';
import { generateStoryboard, storyboardModelName } from '../lib/gemini.js';
import { generateMarketingPhoto, generateCinematicSceneImage } from '../lib/imagen.js';
import { generateMarketingVideo } from '../lib/veo.js';
import { videoCreditCost, CREDIT_COSTS } from '../lib/credits.js';
import { ASSETS_DIR } from '../lib/capture.js';
import type { JobStatusResponse } from '../types.js';
import type { Storyboard, StoryboardScene } from '../lib/gemini.js';

const router = Router();

const CAPTURE_SOURCE_FILE = /^(?:screenshot(?:-full|-mobile|-mobile-full)?\.jpg|page-\d+\.jpg|scroll-recording\.mp4)$/;

/** Copy only immutable browser-capture sources into a new creative version. */
async function copyCaptureFiles(sourceJobId: string, targetJobId: string) {
  const fromDir = path.join(ASSETS_DIR, sourceJobId);
  const toDir = path.join(ASSETS_DIR, targetJobId);
  await fs.mkdir(toDir, { recursive: true });
  let names: string[] = [];
  try { names = await fs.readdir(fromDir); } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') return;
    throw err;
  }
  await Promise.all(names.filter((name) => CAPTURE_SOURCE_FILE.test(name)).map((name) =>
    fs.copyFile(path.join(fromDir, name), path.join(toDir, name))
  ));
}

function wantsExactCaptureEstimate(sceneCount: number, finishAllowanceSeconds: number) {
  // Conservative only until the first scene completes; live throughput then
  // replaces this value. Scenes are processed concurrently, so this is not a
  // simple sceneCount × duration calculation.
  return Math.min(360, Math.max(60, finishAllowanceSeconds + 35 + sceneCount * 15));
}

type CaptureMeta = {
  title?: string;
  description?: string | null;
  screenshotUrl?: string;
  pageCount?: number;
  recordingUrl?: string | null;
  hasScreenshotBuffer?: boolean;
  pages?: Array<{ url?: string; title?: string; screenshotUrl?: string }>;
};

/**
 * Load real browser screenshots in one stable order shared by storyboard
 * planning and deterministic rendering. This makes the planner's sourceIndices
 * directly executable by the video editor.
 */
async function loadReferenceCaptures(jobId: string, meta: CaptureMeta | null, aspectRatio: '16:9' | '9:16' | '1:1') {
  const captures: Array<{ label: string; buffer: Buffer }> = [];
  const add = async (filename: string, label: string) => {
    try {
      const buffer = await fs.readFile(path.join(ASSETS_DIR, jobId, filename));
      if (!buffer.length || captures.some((item) => item.buffer.equals(buffer))) return;
      captures.push({ label, buffer });
    } catch { /* optional capture */ }
  };

  if (aspectRatio === '9:16') {
    await add('screenshot-mobile.jpg', 'Real mobile homepage viewport');
    await add('screenshot-mobile-full.jpg', 'Real mobile homepage full page');
  }
  await add('screenshot.jpg', 'Real desktop homepage viewport');
  await add('screenshot-full.jpg', 'Real desktop homepage full page');

  // Use the screenshot URLs recorded in metadata instead of assuming page-1,
  // page-2, ... are contiguous. Slow/unsupported child pages can be skipped,
  // so the successful files may legitimately be page-2.jpg, page-4.jpg, etc.
  for (const [index, pageMeta] of (meta?.pages ?? []).slice(1, 10).entries()) {
    const screenshotUrl = pageMeta?.screenshotUrl;
    if (!screenshotUrl) continue;
    let filename = '';
    try { filename = path.basename(new URL(screenshotUrl, 'http://local').pathname); } catch { filename = path.basename(screenshotUrl); }
    if (!/^(?:page-\d+|screenshot(?:-full|-mobile|-mobile-full)?)\.jpg$/.test(filename)) continue;
    const detail = pageMeta?.title || pageMeta?.url || `internal page ${index + 2}`;
    await add(filename, `Real captured ${detail}`);
  }

  return captures.slice(0, 10);
}

/**
 * Demo mode does not crop real screenshots — every scene is one AI-generated
 * cinematic frame (device mockups, glassmorphism cards, generated backdrop).
 * This generates one still per scene (using the real captures only as
 * brand/product grounding references), reads each result back as a Buffer,
 * and hands back a scene list + image list shaped so they plug directly into
 * the SAME generateMarketingVideo()/FFmpeg push-pan-transition pipeline used
 * by every other video mode — no separate renderer needed.
 */
async function generateDemoSceneImages(
  jobId: string,
  siteTitle: string,
  concept: string,
  vibe: string,
  scenes: StoryboardScene[],
  brandReferenceImages: Buffer[],
  aspectRatio: '16:9' | '9:16' | '1:1',
  outputQuality: '1080p' | '4k',
  creativeBrief: string | undefined,
  onProgress?: (completed: number, total: number) => void,
): Promise<{ scenes: StoryboardScene[]; images: Buffer[] }> {
  let completed = 0;
  const results = await Promise.allSettled(
    scenes.map(async (scene, index) => {
      const generated = await generateCinematicSceneImage(
        jobId, index, siteTitle, concept,
        scene.shotDescription, scene.onScreenCopy, vibe,
        brandReferenceImages, aspectRatio, outputQuality, creativeBrief ?? null,
      );
      const buffer = await fs.readFile(path.join(ASSETS_DIR, jobId, path.basename(generated.url)));
      completed++;
      onProgress?.(completed, scenes.length);
      return { scene, buffer };
    })
  );

  const ok = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);
  if (!ok.length) {
    const firstError = results.find((result) => result.status === 'rejected') as PromiseRejectedResult | undefined;
    throw firstError?.reason instanceof Error ? firstError.reason : new Error('No cinematic scene image could be generated.');
  }
  if (ok.length < scenes.length) {
    console.warn(`[demo] job=${jobId} generated ${ok.length}/${scenes.length} cinematic scene stills`);
  }

  return {
    // Each generated still maps 1:1 to its own position in the images array;
    // composition is forced to 'single' since there is exactly one frame.
    scenes: ok.map(({ scene }, index) => ({ ...scene, sourceIndices: [index], composition: 'single' as const })),
    images: ok.map(({ buffer }) => buffer),
  };
}

// GET /api/jobs/:id
router.get('/:id', tryAuth, async (req, res) => {
  try {
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at) throw new AppError('Job not found.', 404, 'NOT_FOUND');
    if (job.user_id && job.user_id !== req.user?.id) {
      throw new AppError('Job not found.', 404, 'NOT_FOUND');
    }

    const assets = await getAssetsByJob(job.id);
    const messages = await getJobMessages(job.id);
    const isOwner = req.user?.id === job.user_id;

    const response: JobStatusResponse = {
      id: job.id,
      title: job.title,
      pinned: job.pinned,
      status: (job.status as never) === 'captured' ? ('capturing' as never) : job.status as never,
      progress: job.progress,
      statusMessage: job.status_message,
      etaSeconds: job.eta_seconds,
      mode: job.mode as never,
      sourceUrl: job.source_url,
      vibeBrief: job.vibe_brief,
      captureMetadata: job.capture_metadata as never,
      storyboard: job.storyboard as never,
      errorMessage: job.error_message,
      assets: assets.map((a) => ({
        id: a.id,
        type: a.type as never,
        aspectRatio: a.aspect_ratio,
        watermarked: a.watermarked,
        url: a.storage_url,
        downloadable: isOwner ? a.downloadable : false,
      })),
      messages: messages.map((message) => ({
        id: message.id,
        role: message.role,
        kind: message.kind,
        content: message.content,
        payload: message.payload,
        createdAt: message.created_at,
      })),
    };

    // Tell the client we're done capturing once capture_metadata is ready
    if (job.status === ('captured' as never) && job.capture_metadata) {
      response.status = 'capturing' as never;
      response.progress = 40;
      (response as never as { _done_capturing?: boolean })._done_capturing = true;
    }

    res.json(response);
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/jobs/:id — rename or pin a saved chat.
router.patch('/:id', requireAuth, async (req, res) => {
  try {
    const patch = z.object({
      title: z.string().trim().min(1).max(120).optional(),
      pinned: z.boolean().optional(),
    }).refine((value) => value.title !== undefined || value.pinned !== undefined).parse(req.body);
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at || job.user_id !== req.user!.id) throw new AppError('Job not found.', 404, 'NOT_FOUND');
    const updated = await updateJob(job.id, patch);
    res.json({ id: updated!.id, title: updated!.title, pinned: updated!.pinned, updatedAt: updated!.updated_at });
  } catch (err) { sendError(res, err); }
});

// DELETE /api/jobs/:id — soft delete so storage cleanup can be managed safely.
router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const deleted = await softDeleteJob(String(req.params.id), req.user!.id);
    if (!deleted) throw new AppError('Job not found.', 404, 'NOT_FOUND');
    res.json({ deleted: true });
  } catch (err) { sendError(res, err); }
});

// POST /api/jobs/:id/messages — persist chat choices and assistant updates.
router.post('/:id/messages', tryAuth, async (req, res) => {
  try {
    const input = z.object({
      role: z.enum(['user', 'assistant', 'system']),
      kind: z.string().trim().min(1).max(40).optional().default('text'),
      content: z.string().trim().min(1).max(8000),
      payload: z.record(z.string(), z.unknown()).nullable().optional(),
    }).parse(req.body);
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at || (job.user_id && job.user_id !== req.user?.id)) throw new AppError('Job not found.', 404, 'NOT_FOUND');
    const message = await addJobMessage(job.id, input.role, input.content, input.kind, input.payload);
    res.status(201).json({ id: message.id, createdAt: message.created_at });
  } catch (err) { sendError(res, err); }
});

// POST /api/jobs/:id/reuse — make a new chat from saved capture files.
router.post('/:id/reuse', requireAuth, async (req, res) => {
  try {
    const source = await getJob(String(req.params.id));
    if (!source || source.deleted_at || source.user_id !== req.user!.id || !source.capture_metadata) {
      throw new AppError('Saved capture not found.', 404, 'NOT_FOUND');
    }
    const job = await createJobFromCapture(req.user!.id, source);
    await copyCaptureFiles(source.id, job.id);
    await addJobMessage(job.id, 'assistant', `Reusing the saved website capture from “${source.title || source.source_url}”. No recapture is needed.`, 'capture_reuse', { sourceJobId: source.id });
    res.status(201).json({ jobId: job.id, status: 'captured' });
  } catch (err) { sendError(res, err); }
});

// POST /api/jobs/:id/storyboard
router.post('/:id/storyboard', tryAuth, async (req, res) => {
  try {
    const { mode, vibeBrief, durationSeconds, featuresText, creativeBrief, aspectRatio, outputQuality, frameRate } = z.object({
      mode: z.enum(['video', 'photos', 'both', 'demo', 'tutorial', 'buy', 'tour']),
      vibeBrief: z.string().min(1).max(500),
      durationSeconds: z.number().int().min(8).max(64).optional().default(8),
      featuresText: z.string().max(1000).optional(),
      creativeBrief: z.string().max(8000).optional(),
      aspectRatio: z.enum(['16:9', '9:16', '1:1']).optional().default('16:9'),
      outputQuality: z.enum(['1080p', '4k']).optional().default('1080p'),
      frameRate: z.union([z.literal(30), z.literal(60)]).optional().default(30),
    }).parse(req.body);

    let job = await getJob(String(req.params.id));
    if (!job) throw new AppError('Job not found.', 404, 'NOT_FOUND');
    if (job.user_id && job.user_id !== req.user?.id) {
      throw new AppError('Job not found.', 404, 'NOT_FOUND');
    }

    // Never regenerate into a completed job. A completed production is immutable
    // history; every new concept/version gets a fresh job ID and clean output
    // directory while reusing only the saved browser captures. This prevents old
    // MP4/assets from being returned as the new result.
    const existingAssets = await getAssetsByJob(job.id);
    const hasGeneratedResult = existingAssets.some((asset) => asset.type === 'video' || asset.type === 'photo');
    if (job.status === 'done' || hasGeneratedResult) {
      const ownerId = req.user?.id ?? job.user_id;
      if (!ownerId) throw new AppError('Sign in to create another version.', 401, 'AUTH_REQUIRED');
      const source = job;
      job = await createJobFromCapture(ownerId, source);
      await copyCaptureFiles(source.id, job.id);
      await addJobMessage(job.id, 'assistant', 'Fresh creative version started from the saved website capture. Previous results remain unchanged.', 'variant', { sourceJobId: source.id });
    }

    const meta = job.capture_metadata as CaptureMeta | null;
    const variationKey = `${job.id}:${Date.now()}:${randomUUID()}`;

    // Clear any previous storyboard so clients don't mistake stale data for the new one
    await updateJob(job.id, {
      mode, vibe_brief: vibeBrief, status: 'storyboarding', progress: 48,
      status_message: 'Designing your scene plan', eta_seconds: 45,
      storyboard: null as never,
    });
    await addJobMessage(job.id, 'user', `${mode} · ${vibeBrief}`, 'creative_choice', {
      mode, vibeBrief, durationSeconds, featuresText, creativeBrief, aspectRatio, outputQuality, frameRate,
    });

    // Kick off async storyboard generation
    void (async () => {
      try {
        // Load all useful real screenshots in the exact same index order that
        // the renderer will later use. The planner can therefore choose pages,
        // split screens and detail shots that are actually executable.
        let screenshotBase64: string | null = null;
        let fullPageBase64: string | null = null;
        try {
          const buf = await fs.readFile(path.join(ASSETS_DIR, job.id, 'screenshot.jpg'));
          screenshotBase64 = buf.toString('base64');
        } catch { /* no viewport screenshot cached */ }
        try {
          const buf = await fs.readFile(path.join(ASSETS_DIR, job.id, 'screenshot-full.jpg'));
          fullPageBase64 = buf.toString('base64');
        } catch { /* no full-page screenshot cached */ }

        const plannerCaptures = await loadReferenceCaptures(job.id, meta, aspectRatio);

        const { storyboard, aiError } = await generateStoryboard({
          siteUrl: job.source_url,
          pageTitle: meta?.title ?? new URL(job.source_url).hostname,
          description: meta?.description ?? null,
          screenshotBase64,
          fullPageScreenshotBase64: fullPageBase64,
          referenceCaptures: plannerCaptures.map((capture) => ({ label: capture.label, base64: capture.buffer.toString('base64') })),
          mode,
          vibeBrief,
          targetDurationSeconds: durationSeconds,
          featuresText: featuresText ?? null,
          creativeBrief: creativeBrief ?? null,
          aspectRatio,
          outputQuality,
          frameRate,
          variationKey,
        });

        await updateJob(job.id, {
          storyboard: storyboard as never, status: 'storyboarding', progress: 75,
          status_message: 'Production plan ready', eta_seconds: 0,
        });
        // Tell the user, in exact terms, whenever the AI planner itself could
        // not be reached/used — a built-in backup plan still runs so
        // production isn't blocked, but the AI failure must not be hidden.
        if (aiError) {
          await addJobMessage(
            job.id, 'assistant',
            `⚠️ AI creative planning was unavailable, so a built-in backup plan was used instead. Exact reason: ${aiError}`,
            'ai_warning',
          );
        }
        await addJobMessage(job.id, 'assistant', storyboard.concept, 'storyboard', {
          sceneCount: storyboard.scenes.length,
          targetDurationSeconds: storyboard.targetDurationSeconds,
        });
      } catch (err) {
        const reason = (err as Error).message;
        console.error('[storyboard] error:', reason);
        await updateJob(job.id, {
          status: 'failed',
          progress: 50,
          status_message: 'Planning paused',
          eta_seconds: 0,
          error_message:
            `We couldn't finish planning your video this time — no credits were used. Exact error: ${reason}. Please try again in a moment, or try a different page from your site.`,
        }).catch(() => {});
      }
    })();

    res.json({ jobId: job.id, status: 'storyboarding' });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/render
router.post('/:id/render', requireAuth, async (req, res) => {
  try {
    const operations = await getOperationsSettings();
    if (operations.maintenanceMode && !req.user?.isAdmin) throw new AppError('Productions are temporarily paused for maintenance. Please try again shortly.', 503, 'MAINTENANCE_MODE');
    const capacity = await productionCapacity();
    if (!req.user?.isAdmin && capacity.active >= capacity.maximum) throw new AppError('The production queue is currently full. Please try again shortly.', 503, 'PRODUCTION_CAPACITY');
    const { skipVoiceover } = z.object({
      skipVoiceover: z.boolean().optional().default(false),
    }).parse(req.body);

    const job = await getJob(String(req.params.id));
    if (!job) throw new AppError('Job not found.', 404, 'NOT_FOUND');

    // Owned jobs can only be rendered by their owner. Anonymous preview jobs
    // are claimed atomically with the credit charge below.
    if (job.user_id && job.user_id !== req.user!.id) {
      throw new AppError('Job not found.', 404, 'NOT_FOUND');
    }

    const meta = job.capture_metadata as CaptureMeta | null;
    const storyboard = job.storyboard as Storyboard | null;

    if (!storyboard) throw new AppError('Storyboard not ready yet.', 400, 'STORYBOARD_NOT_READY');

    // Paywall: free plan can storyboard and preview, but rendering requires a plan.
    if (req.user!.plan === 'free') {
      throw new AppError(
        'Your video is storyboarded and ready — pick a plan to render it.',
        402,
        'PLAN_REQUIRED'
      );
    }

    // Credit check & deduction (60s videos cost more than 8s ones)
    const targetDuration = storyboard.targetDurationSeconds || 8;
    const cost = videoCreditCost(job.mode, skipVoiceover, targetDuration);
    const claim = await claimRenderAndSpend(job.id, req.user!.id, cost);
    if (!claim.ok && claim.reason === 'already_started') {
      throw new AppError('This job is already rendering or has finished.', 409, 'RENDER_ALREADY_STARTED');
    }
    if (!claim.ok && claim.reason === 'already_failed') {
      // Deliberately refuse to re-render the same job/storyboard after a
      // failure: doing so would replay the exact same edit plan and could
      // look like "the same video every time." The client must start a
      // fresh version (new job id, new storyboard, new variant seed) first.
      throw new AppError(
        'This creative plan already tried to render once and failed. Start a fresh version (reuse your saved screenshots) to try again with a new edit plan.',
        409,
        'RENDER_ALREADY_FAILED'
      );
    }
    if (!claim.ok && (claim.reason === 'not_found' || claim.reason === 'not_owner')) {
      throw new AppError('Job not found.', 404, 'NOT_FOUND');
    }
    if (!claim.ok) {
      throw new AppError(
        `Insufficient credits. This job costs ${cost} credits. Please top up or upgrade your plan.`,
        402,
        'INSUFFICIENT_CREDITS'
      );
    }
    const remaining = claim.remaining;
    const renderStartedAt = Date.now();
    const sceneCount = Math.max(1, Math.min(8, storyboard.scenes?.length ?? 1));
    const finishAllowanceSeconds = storyboard.outputQuality === '4k' ? 90 : 35;
    // Demo mode also generates one AI image per scene before FFmpeg assembly
    // even starts, so its initial estimate needs real extra headroom.
    const initialVideoEta = wantsExactCaptureEstimate(sceneCount, finishAllowanceSeconds) + (job.mode === 'demo' ? sceneCount * 25 : 0);
    const initialPhotoEta = job.mode === 'photos' || job.mode === 'both' ? 150 : 0;
    const initialEta = Math.max(job.mode === 'photos' ? 0 : initialVideoEta, initialPhotoEta);
    await addJobMessage(job.id, 'user', skipVoiceover ? 'Generate silent master' : 'Generate with cinematic sound', 'render_request');
    await updateJob(job.id, {
      status_message: 'Preparing your production',
      eta_seconds: initialEta,
    });

    void (async () => {
      let refundedCredits = 0;
      const refund = async (amount: number, reason: string) => {
        if (amount <= 0) return;
        const refunded = await refundJobCredits(job.id, req.user!.id, amount, reason);
        refundedCredits += refunded;
      };
      try {
        // Reuse the same stable capture list that the AI planner saw. This is
        // what makes sourceIndices/composition/motion from the prompt real.
        const loadedCaptures = await loadReferenceCaptures(job.id, meta, storyboard.aspectRatio ?? '16:9');
        const referenceImages = loadedCaptures.map((capture) => capture.buffer);
        if (referenceImages.length === 0 && meta?.screenshotUrl && /^https?:\/\//i.test(meta.screenshotUrl)) {
          // Last-resort fallback for legacy jobs whose metadata points at an
          // absolute external screenshot URL (e.g. thum.io). Local asset paths
          // were already read from disk above and cannot be fetched here.
          const res2 = await fetch(meta.screenshotUrl).catch(() => null);
          if (res2?.ok) referenceImages.push(Buffer.from(await res2.arrayBuffer()));
        }
        console.info(`[video] job=${job.id} variation=${storyboard.variantSeed ?? 'n/a'} mode=${job.mode} screenshots=${referenceImages.length} storyboard_model=${storyboardModelName()} renderer=ffmpeg scrolling_recording_used=false`);
        const siteTitle = meta?.title ?? new URL(job.source_url).hostname;
        const concept = storyboard.concept ?? 'Professional promo';
        const vibe = storyboard.vibe ?? 'modern';
        const scenes = storyboard.scenes ?? [];

        const wantsVideo = job.mode !== 'photos';
        const wantsPhotos = job.mode === 'photos' || job.mode === 'both';

        // Kick off photo + video production in parallel.
        const photoScenes = wantsPhotos && scenes.length > 0
          ? Array.from({ length: 4 }, (_, index) => scenes[index % scenes.length])
          : [];
        let completedPhotos = 0;
        const photoPromise = Promise.allSettled(
          photoScenes.map(async (scene, i) => {
            try {
              return await generateMarketingPhoto(
                job.id, i,
                siteTitle, concept,
                scene.shotDescription,
                scene.onScreenCopy,
                vibe,
                referenceImages,
                storyboard.aspectRatio ?? '16:9',
                storyboard.outputQuality ?? '1080p',
                storyboard.creativeBrief ?? null,
              );
            } finally {
              completedPhotos++;
              if (!wantsVideo) {
                const pct = 80 + Math.round((completedPhotos / Math.max(1, photoScenes.length)) * 16);
                const elapsedSeconds = Math.max(1, (Date.now() - renderStartedAt) / 1000);
                const averagePerPhoto = elapsedSeconds / Math.max(1, completedPhotos);
                const photosLeft = Math.max(0, photoScenes.length - completedPhotos);
                void updateJob(job.id, {
                  progress: pct,
                  status_message: completedPhotos === photoScenes.length ? 'Finishing your files' : `Creating campaign image ${completedPhotos + 1} of ${photoScenes.length}`,
                  eta_seconds: completedPhotos === photoScenes.length ? 10 : Math.max(10, Math.round(averagePerPhoto * photosLeft)),
                }).catch(() => {});
              }
            }
          })
        );

        const isDemoMode = job.mode === 'demo';

        const videoPromise: Promise<PromiseSettledResult<Awaited<ReturnType<typeof generateMarketingVideo>>>> = wantsVideo
          ? (isDemoMode
              // Demo mode: generate one AI cinematic still per scene first
              // (progress 80→90), then hand those generated frames to the
              // exact same FFmpeg push/pan/transition pipeline every other
              // video mode uses (progress remapped 90→97 below).
              ? generateDemoSceneImages(
                  job.id, siteTitle, concept, vibe, scenes,
                  referenceImages,
                  storyboard.aspectRatio ?? '16:9',
                  storyboard.outputQuality ?? '1080p',
                  storyboard.creativeBrief,
                  (completedScenes, totalScenes) => {
                    const pct = 80 + Math.round((completedScenes / Math.max(1, totalScenes)) * 10);
                    const elapsedSeconds = Math.max(1, (Date.now() - renderStartedAt) / 1000);
                    const averagePerScene = elapsedSeconds / Math.max(1, completedScenes);
                    const scenesLeft = Math.max(0, totalScenes - completedScenes);
                    void updateJob(job.id, {
                      progress: pct,
                      status_message: completedScenes === totalScenes
                        ? 'Assembling your cinematic scenes'
                        : `Generating cinematic scene ${completedScenes} of ${totalScenes}`,
                      eta_seconds: Math.max(10, Math.round(averagePerScene * scenesLeft) + finishAllowanceSeconds),
                    }).catch(() => {});
                  },
                ).then(({ scenes: demoScenes, images: demoImages }) => generateMarketingVideo(
                  job.id, siteTitle,
                  {
                    concept, vibe, scenes: demoScenes as Storyboard['scenes'],
                    creativeBrief: storyboard.creativeBrief,
                    aspectRatio: storyboard.aspectRatio,
                    outputQuality: storyboard.outputQuality,
                    frameRate: storyboard.frameRate,
                    variantSeed: storyboard.variantSeed,
                  },
                  demoImages,
                  // The renderer only ever crops/pans/transitions whatever
                  // frames it's given — for demo mode those frames are the
                  // AI-generated stills above, not real screenshots.
                  true,
                  skipVoiceover,
                  job.mode,
                  (rawPct) => {
                    const elapsedSeconds = Math.max(1, (Date.now() - renderStartedAt) / 1000);
                    const sceneFraction = Math.max(0.01, Math.min(1, (rawPct - 80) / 13));
                    const remainingSceneSeconds = rawPct >= 93 ? 0 : (elapsedSeconds / sceneFraction) * (1 - sceneFraction);
                    const finishingSeconds = rawPct >= 96 ? finishAllowanceSeconds : finishAllowanceSeconds + Math.min(25, sceneCount * 2);
                    const liveEta = Math.max(8, Math.min(600, Math.round(remainingSceneSeconds + finishingSeconds)));
                    const displayPct = 90 + Math.round(((Math.min(96, rawPct) - 80) / 16) * 7);
                    void updateJob(job.id, {
                      progress: displayPct,
                      status_message: rawPct >= 96 ? 'Finishing your files' : 'Assembling your cinematic scenes',
                      eta_seconds: liveEta,
                    }).catch(() => {});
                  },
                ))
              : generateMarketingVideo(
                  job.id, siteTitle,
                  {
                    concept, vibe, scenes: scenes as Storyboard['scenes'],
                    creativeBrief: storyboard.creativeBrief,
                    aspectRatio: storyboard.aspectRatio,
                    outputQuality: storyboard.outputQuality,
                    frameRate: storyboard.frameRate,
                    variantSeed: storyboard.variantSeed,
                  },
                  referenceImages,
                  // Exact-capture videos must always preserve the real
                  // captured pixels. Gemini plans source selection/
                  // composition/motion; FFmpeg executes that plan without
                  // redrawing the interface.
                  true,
                  skipVoiceover,
                  job.mode,
                  (pct) => {
                    const elapsedSeconds = Math.max(1, (Date.now() - renderStartedAt) / 1000);
                    // Scene work occupies progress 80–93. Use completed throughput,
                    // not the original duration guess, then reserve measured time
                    // for stitching/encoding. This estimate corrects itself after
                    // every completed scene.
                    const sceneFraction = Math.max(0.01, Math.min(1, (pct - 80) / 13));
                    const remainingSceneSeconds = pct >= 93
                      ? 0
                      : (elapsedSeconds / sceneFraction) * (1 - sceneFraction);
                    const finishingSeconds = pct >= 96
                      ? finishAllowanceSeconds
                      : finishAllowanceSeconds + Math.min(25, sceneCount * 2);
                    const liveEta = Math.max(8, Math.min(600, Math.round(remainingSceneSeconds + finishingSeconds)));
                    void updateJob(job.id, {
                      progress: pct,
                      status_message: pct >= 96 ? 'Finishing your files' : 'Creating and assembling scenes',
                      eta_seconds: liveEta,
                    }).catch(() => {});
                  }
                )
            ).then(
              (value) => ({ status: 'fulfilled' as const, value }),
              (reason) => ({ status: 'rejected' as const, reason })
            )
          : Promise.resolve({ status: 'rejected' as const, reason: new Error('not requested') });

        const [photoResults, videoResult] = await Promise.all([photoPromise, videoPromise]);

        let shortDeliveryNote: string | null = null;
        if (videoResult.status === 'fulfilled') {
          await createAsset(job.id, 'video', videoResult.value.url, videoResult.value.aspectRatio, false, true);

          // Reconcile billing with what was actually delivered: if some scene
          // clips failed, refund the undelivered portion.
          const expectedClips = Math.max(1, Math.round(targetDuration / 8));
          const deliveredClips = videoResult.value.clipCount;
          if (deliveredClips < expectedClips) {
            const videoRefund = (expectedClips - deliveredClips) * 8 * CREDIT_COSTS.VIDEO_PER_SECOND;
            await refund(videoRefund, `Short video refund ${job.id}`);
            shortDeliveryNote = `${expectedClips - deliveredClips} of ${expectedClips} scenes couldn't be generated — your video is shorter than planned and ${videoRefund} credits were refunded.`;
          }
        } else if (wantsVideo) {
          console.error('[render] video generation failed:', (videoResult.reason as Error)?.message);
        }

        let photoCount = 0;
        for (const result of photoResults) {
          if (result.status === 'fulfilled') {
            await createAsset(
              job.id, 'photo',
              result.value.url,
              result.value.aspectRatio,
              false, true
            );
            photoCount++;
          }
        }

        const hasVideo = videoResult.status === 'fulfilled';
        if (photoCount === 0 && !hasVideo) {
          const photoErr = photoResults.find((r) => r.status === 'rejected') as PromiseRejectedResult | undefined;
          const videoErr = wantsVideo ? (videoResult as PromiseRejectedResult).reason as Error | undefined : undefined;
          const parts = [
            videoErr ? `video: ${videoErr.message}` : null,
            photoErr ? `photos: ${(photoErr.reason as Error)?.message}` : null,
          ].filter(Boolean);
          throw new Error(parts.length ? parts.join(' | ') : 'All generation attempts failed for an unknown reason.');
        }

        if (wantsPhotos && photoCount < photoScenes.length) {
          const missingPhotos = photoScenes.length - photoCount;
          const photoRefund = missingPhotos * CREDIT_COSTS.PHOTO_SINGLE;
          await refund(photoRefund, `Partial photo refund ${job.id}`);
          shortDeliveryNote = `${shortDeliveryNote ? `${shortDeliveryNote} ` : ''}${missingPhotos} photo${missingPhotos === 1 ? '' : 's'} couldn't be generated and ${photoRefund} credits were refunded.`;
        }

        // If video was requested but failed while photos succeeded, refund the
        // video portion of the charge and surface a partial note
        if (wantsVideo && !hasVideo && photoCount > 0) {
          const videoPortion = cost - CREDIT_COSTS.PHOTO_SET_4;
          await refund(videoPortion, `Video failure refund ${job.id}`);
          const videoReason = (videoResult as PromiseRejectedResult).reason as Error | undefined;
          await updateJob(job.id, {
            status: 'done', progress: 100, status_message: 'Ready to view', eta_seconds: 0,
            credits_spent: 0,
            error_message: `Video generation failed — photos were delivered instead and the video credits were refunded. Exact error: ${videoReason?.message ?? 'unknown error'}. Please try again for video.${shortDeliveryNote ? ` ${shortDeliveryNote}` : ''}`,
          });
        } else {
          await updateJob(job.id, {
            status: 'done', progress: 100, status_message: 'Ready to view', eta_seconds: 0,
            credits_spent: 0,
            error_message: shortDeliveryNote as never,
          });
        }
        await addJobMessage(job.id, 'assistant', shortDeliveryNote || 'Your production is ready to view and download.', 'result');
        return;
      } catch (err) {
        const reason = (err as Error).message || 'Unknown error';
        console.error('[render] error:', reason);
        // Refund whatever portion has not already been refunded above.
        await refund(Math.max(0, cost - refundedCredits), `Failed render refund ${job.id}`).catch((refundErr) => {
          console.error('[render] refund failed:', (refundErr as Error).message);
        });
        await updateJob(job.id, {
          status: 'failed',
          status_message: 'Production paused',
          eta_seconds: 0,
          credits_spent: 0,
          error_message:
            `Something went wrong while producing your video. Exact error: ${reason}. All your credits for this render have been refunded automatically — please try again with a fresh version.`,
        }).catch(() => {});
        await addJobMessage(job.id, 'assistant', 'Production paused. Reserved credits were restored and the saved chat remains available.', 'error').catch(() => {});
      }
    })();

    res.json({ jobId: job.id, status: 'rendering', creditsSpent: cost, creditsRemaining: remaining });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
