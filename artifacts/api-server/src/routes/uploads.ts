import { Router } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { getOperationsSettings, productionCapacity } from '../lib/provider-config.js';
import { addJobMessage, createUploadJob, getJob, updateJob } from '../lib/queries.js';
import { requireAuth, tryAuth } from '../lib/auth.js';
import { AppError, sendError } from '../lib/errors.js';
import { saveImageFile } from '../lib/capture.js';
import { MAX_VIDEO_SECONDS, MIN_VIDEO_SECONDS, videoCreditCost } from '../lib/credits.js';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PHOTOS, normalizeUploadToJpeg, sanitizeUploadTitle, uploadPhotoLabel } from '../lib/uploads.js';
import { generationModelForMode } from '../lib/generation-models.js';
import { readPublicUrl } from '../lib/external-reference.js';
import { coordinatesFromMapsUrl, isGoogleMapsUrl } from '../lib/maps-url.js';
import { z } from 'zod';

const router = Router();

const fileFilter: NonNullable<Parameters<typeof multer>[0]>['fileFilter'] = (_req, file, cb) => {
  // HEIC/HEIF intentionally excluded: normalizeUploadToJpeg() shells out to
  // ffmpeg, and the ffmpeg build this app runs on does not include HEIC
  // decoding (no libheif).
  if (/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) cb(null, true);
  else cb(new AppError(`Unsupported file type: ${file.mimetype}. Please upload JPEG, PNG, or WEBP photos (not HEIC — convert iPhone photos to JPEG first, or use "Most Compatible" format in your camera settings).`, 400, 'UNSUPPORTED_FILE_TYPE'));
};

const userUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES, files: MAX_UPLOAD_PHOTOS },
  fileFilter,
});

// Administrators are trusted operators and may attach any number of photos in
// one batch. The per-file type and 10MB safety checks still apply.
const adminUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_UPLOAD_BYTES }, fileFilter });
const uploadImages: RequestHandler = (req, res, next) => {
  const middleware = req.user?.isAdmin ? adminUpload.array('images') : userUpload.array('images', MAX_UPLOAD_PHOTOS);
  middleware(req, res, next);
};

const UPLOAD_WINDOW_MS = 10 * 60 * 1000;
const UPLOAD_LIMIT = 5;
const uploadAttempts = new Map<string, { count: number; resetAt: number }>();

function allowUpload(ip: string) {
  const now = Date.now();
  const current = uploadAttempts.get(ip);
  if (!current || current.resetAt <= now) {
    uploadAttempts.set(ip, { count: 1, resetAt: now + UPLOAD_WINDOW_MS });
    return true;
  }
  if (current.count >= UPLOAD_LIMIT) return false;
  current.count++;
  if (uploadAttempts.size > 2000) {
    for (const [key, value] of uploadAttempts) if (value.resetAt <= now) uploadAttempts.delete(key);
  }
  return true;
}

/**
 * POST /api/uploads — creates a job directly from user-uploaded photos
 * instead of a live website capture. Lands the job in the exact same
 * 'captured' state with the exact same capture_metadata shape
 * (title + a `pages` array of {url, title, screenshotUrl}) that the
 * Playwright website-capture path produces, so every downstream step —
 * storyboard planning, loadReferenceCaptures() in jobs.ts, AI video
 * generation, the frontend's existing capture->awaiting_mode polling
 * transition — needs no special-casing for "this came from an upload".
 */
router.post('/', tryAuth, uploadImages, async (req, res) => {
  try {
    const operations = await getOperationsSettings();
    if (operations.maintenanceMode && !req.user?.isAdmin) throw new AppError('Productions are temporarily paused for maintenance. Please try again shortly.', 503, 'MAINTENANCE_MODE');
    const capacity = await productionCapacity();
    if (!req.user?.isAdmin && capacity.active >= capacity.maximum) throw new AppError('The production queue is currently full. Please try again shortly.', 503, 'PRODUCTION_CAPACITY');
    if (!req.user?.isAdmin && !allowUpload(req.ip ?? req.socket.remoteAddress ?? 'unknown')) {
      throw new AppError('Too many uploads. Please wait a few minutes and try again.', 429, 'RATE_LIMITED');
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const productUrl = typeof req.body?.productUrl === 'string' ? req.body.productUrl.slice(0, 2048) : null;
    let productImageUrls: string[] = [];
    if (req.body?.productImageUrls) {
      try {
        productImageUrls = JSON.parse(req.body.productImageUrls);
      } catch {
        throw new AppError('Choose valid product images.', 400, 'INVALID_PRODUCT_IMAGES');
      }
      if (!Array.isArray(productImageUrls) || productImageUrls.length > 6 || productImageUrls.some((url) => typeof url !== 'string' || url.length > 2048)) {
        throw new AppError('Choose up to six valid product images.', 400, 'INVALID_PRODUCT_IMAGES');
      }
    }
    const ideaPrompt = typeof req.body?.ideaPrompt === 'string' ? req.body.ideaPrompt.trim() : '';
    if (ideaPrompt.length > 8000) {
      throw new AppError('Your prompt is longer than 8,000 characters. Shorten it slightly so every detail can be sent without hidden truncation.', 400, 'PROMPT_TOO_LONG');
    }
    const studioKind = ['product', 'idea', 'scenario', 'interior', 'architecture'].includes(req.body?.studioKind)
      ? req.body.studioKind as 'product' | 'idea' | 'scenario' | 'interior' | 'architecture'
      : null;
    let architectureInput: unknown = {};
    if (studioKind === 'architecture') {
      try {
        architectureInput = JSON.parse(req.body?.architecture || '{}');
      } catch {
        throw new AppError('Check the architecture site details.', 400, 'INVALID_SITE_DETAILS');
      }
    }
    const architecture = studioKind === 'architecture'
      ? z.object({
          location: z.string().max(2048).optional(),
          mapUrl: z.string().url().max(2048).optional(),
          latitude: z.number().min(-90).max(90).optional(),
          longitude: z.number().min(-180).max(180).optional(),
          plotWidth: z.number().positive().max(100_000).optional(),
          plotDepth: z.number().positive().max(100_000).optional(),
          floors: z.number().int().positive().max(200).optional(),
          setback: z.number().min(0).max(10_000).optional(),
          estimatedScale: z.boolean().optional(),
        }).parse(architectureInput)
      : null;
    const studioMode = ['video', 'photos', 'both', 'custom'].includes(req.body?.mode) ? req.body.mode as 'video' | 'photos' | 'both' | 'custom' : null;
    const studioAudioMode = ['voice_music', 'native_audio', 'music_only', 'silent'].includes(req.body?.audioMode)
      ? req.body.audioMode as 'voice_music' | 'native_audio' | 'music_only' | 'silent'
      : 'native_audio';
    const studioQuality = req.body?.outputQuality === '4k' ? '4k' as const : '1080p' as const;
    const publicModelId = typeof req.body?.modelId === 'string' ? req.body.modelId.trim() : undefined;
    const requestedDuration = Number(req.body?.durationSeconds ?? MIN_VIDEO_SECONDS);
    const studioDuration = Number.isInteger(requestedDuration)
      && requestedDuration >= MIN_VIDEO_SECONDS
      && requestedDuration <= MAX_VIDEO_SECONDS
      ? requestedDuration
      : null;

    if (studioKind) {
      if (!req.user) throw new AppError('Sign in before starting an AI Studio generation.', 401, 'AUTH_REQUIRED');
      if (!ideaPrompt) throw new AppError('Describe what you want to create before generation starts.', 400, 'PROMPT_REQUIRED');
      if (!studioMode || !studioDuration) throw new AppError('Choose a valid production type and duration.', 400, 'INVALID_STUDIO_OPTIONS');
      if (studioKind === 'product' && !['video', 'photos', 'both'].includes(studioMode)) {
        throw new AppError('Choose product photos, product video, or both.', 400, 'INVALID_STUDIO_MODE');
      }
      if ((studioKind === 'idea' || studioKind === 'scenario') && studioMode !== 'custom') {
        throw new AppError('Custom Idea and Scenario productions use the independent custom-video engine.', 400, 'INVALID_STUDIO_MODE');
      }
      if ((studioKind === 'interior' || studioKind === 'architecture') && !['photos', 'custom'].includes(studioMode)) {
        throw new AppError('Interior and Architecture modes use image generation or custom video mode.', 400, 'INVALID_STUDIO_MODE');
      }
      if (studioKind === 'interior' && !files.length) {
        throw new AppError('Upload at least one interior photo, plan, sketch, elevation, or reference image.', 400, 'INTERIOR_REFERENCE_REQUIRED');
      }
      if (studioKind === 'architecture') {
        if (!files.length) throw new AppError('Add a site screenshot, site photo, plan, or building reference.', 400, 'SITE_REFERENCE_REQUIRED');
        if (!architecture?.location && !architecture?.mapUrl) throw new AppError('Add a Google Maps link or address.', 400, 'LOCATION_REQUIRED');
        if (!architecture.estimatedScale && (!architecture.plotWidth || !architecture.plotDepth)) {
          throw new AppError('Add plot width and depth or choose estimated site scale.', 400, 'PLOT_DIMENSIONS_REQUIRED');
        }
        if (architecture.mapUrl && !isGoogleMapsUrl(architecture.mapUrl)) {
          throw new AppError('Use a Google Maps link.', 400, 'INVALID_MAP_LINK');
        }
        if (architecture.mapUrl) {
          const position = coordinatesFromMapsUrl(new URL(architecture.mapUrl));
          if (position) {
            architecture.latitude = position.latitude;
            architecture.longitude = position.longitude;
          } else {
            delete architecture.latitude;
            delete architecture.longitude;
          }
        } else {
          delete architecture.latitude;
          delete architecture.longitude;
        }
      }
      if (studioKind === 'product' && !files.length && !productImageUrls.length) {
        throw new AppError('Add a product photo or import a product link before generating.', 400, 'PRODUCT_PHOTO_REQUIRED');
      }
      const selectedModel = generationModelForMode(publicModelId, studioMode, studioKind);
      if (studioQuality === '4k' && !selectedModel.supports4k) {
        throw new AppError('The selected AiWebVideo model does not support 4K. Choose 1080p or a higher model.', 400, 'MODEL_QUALITY_UNSUPPORTED');
      }
      const requiredCredits = videoCreditCost(
        studioMode,
        studioAudioMode !== 'voice_music',
        studioDuration,
        studioQuality,
        selectedModel.id,
        studioKind,
      );
      if (req.user.creditsBalance < requiredCredits) {
        throw new AppError(`This production needs ${requiredCredits} credits. Add credits before generation starts.`, 402, 'INSUFFICIENT_CREDITS');
      }
    }
    if (!files.length && !productImageUrls.length && !ideaPrompt) {
      throw new AppError('Please attach at least one photo, import a product link, or describe your idea.', 400, 'NO_FILES');
    }
    if (!files.length && !productImageUrls.length && ideaPrompt && !studioKind) {
      throw new AppError('Start a Custom Idea or Scenario production before using a text-only prompt.', 400, 'INVALID_STUDIO_OPTIONS');
    }
    // Text-only studio jobs are account-bound; their first provider call is
    // protected by the atomic paid-render charge.
    if (!files.length && !productImageUrls.length && ideaPrompt && !req.user) {
      throw new AppError('Sign in to generate a starting image from your idea.', 401, 'AUTH_REQUIRED');
    }

    const title = sanitizeUploadTitle(typeof req.body?.title === 'string' ? req.body.title : (ideaPrompt ? ideaPrompt.slice(0, 80) : null));
    const userId = req.user?.id ?? null;
    const aspectRatio = (['16:9', '9:16', '1:1'] as const).includes(req.body?.aspectRatio) ? req.body.aspectRatio as '16:9' | '9:16' | '1:1' : '16:9';

    // Placeholder id — the real job row (and its real id) is created after
    // normalizing/saving the files below, matching how the website capture
    // path saves screenshots under the job's own id.
    const job = await createUploadJob(userId, title, {});
    if (files.length) {
      await addJobMessage(job.id, 'user', `Uploaded ${files.length} photo${files.length === 1 ? '' : 's'}`, 'upload');
    }
    if (ideaPrompt) {
      await addJobMessage(job.id, 'user', ideaPrompt, 'prompt');
    }
    if (studioKind && studioMode && studioDuration) {
      const audioLabel = studioAudioMode === 'voice_music'
        ? 'Narration'
        : studioAudioMode === 'native_audio'
          ? 'Scene audio'
          : studioAudioMode === 'music_only'
            ? 'Music only'
            : 'Silent';
      await addJobMessage(
        job.id,
        'user',
        `Setup: ${studioDuration}s · ${req.body?.aspectRatio || '16:9'} · ${studioQuality} · ${audioLabel}`,
        'setup',
      );
    }

    const pages: Array<{ url: string; title: string; screenshotUrl: string }> = [];
    for (const [index, file] of files.entries()) {
      let jpeg: Buffer;
      try {
        jpeg = await normalizeUploadToJpeg(file.buffer);
      } catch (err) {
        // One bad file shouldn't nuke the whole upload — skip it and keep going.
        console.warn(`[uploads] job=${job.id} file ${index + 1} rejected: ${(err as Error).message}`);
        continue;
      }
      // First photo reuses the same filename the website-capture path uses
      // for its primary/full-page screenshot; every subsequent photo reuses
      // the same page-N.jpg convention captured child pages use. This is
      // what lets loadReferenceCaptures() in jobs.ts pick these up with zero
      // changes — it already expects exactly this filename+metadata shape.
      const filename = index === 0 ? 'screenshot-full.jpg' : `page-${index}.jpg`;
      const screenshotUrl = await saveImageFile(job.id, filename, jpeg);
      pages.push({ url: `upload://${job.id}/${index}`, title: uploadPhotoLabel(index, file.originalname), screenshotUrl });
    }

    for (const [index, imageUrl] of productImageUrls.entries()) {
      const source = await readPublicUrl(imageUrl, 10 * 1024 * 1024, /^image\/(?:jpeg|png|webp)$/);
      const jpeg = await normalizeUploadToJpeg(source.buffer);
      const pageIndex = pages.length;
      const filename = pageIndex === 0 ? 'screenshot-full.jpg' : `page-${pageIndex}.jpg`;
      const screenshotUrl = await saveImageFile(job.id, filename, jpeg);
      pages.push({ url: `product-reference://${index}`, title: `Product image ${index + 1}`, screenshotUrl });
    }

    // Text-only Custom Idea and Scenario jobs never call an image provider at
    // upload time. The paid render transaction is the first expensive model
    // call, so this endpoint cannot be abused for free image generation.
    const directTextToVideo = (studioKind === 'idea' || studioKind === 'scenario') && studioMode === 'custom' && Boolean(ideaPrompt);

    if (!pages.length && !directTextToVideo) {
      throw new AppError('None of the uploaded files could be read as images. Please try again with JPEG, PNG, or WEBP photos.', 400, 'NO_VALID_FILES');
    }

    await updateJob(job.id, {
      ...(studioKind && studioMode && studioDuration
        ? {
            workflow_state: {
              savedAt: Date.now(),
              stage: 'preview_ready',
              mode: studioMode,
              modelId: generationModelForMode(publicModelId, studioMode, studioKind).id,
              durationSeconds: studioDuration,
              featuresText: null,
              creativeBrief: ideaPrompt || null,
              aspectRatio,
              outputQuality: studioQuality,
              frameRate: 24,
              selectedCaptureIds: [],
              audioMode: studioAudioMode,
              narrationLanguage: 'en',
            } as never,
          }
        : {}),
      capture_metadata: {
        title,
        sourceType: studioKind ? 'studio' : 'upload',
        studioKind,
        productUrl,
        productImageUrls: productImageUrls.length,
        architecture,
        ideaPrompt: studioKind ? ideaPrompt : null,
        description: null,
        logoUrl: null,
        brandColors: [],
        htmlLang: null,
        screenshotUrl: pages[0]?.screenshotUrl ?? null,
        fullPageScreenshotUrl: pages[0]?.screenshotUrl ?? null,
        mobileScreenshotUrl: null,
        mobileFullPageScreenshotUrl: null,
        recordingUrl: null,
        pages,
        pageCount: pages.length,
      } as never,
    });

    await addJobMessage(
      job.id,
      'assistant',
      directTextToVideo
        ? 'Your idea is ready. This production will be generated directly from your text — no website or screenshot is required.'
        : `Saved ${pages.length} photo${pages.length === 1 ? '' : 's'}. What would you like to create from them?`,
      'status',
    );
    res.status(201).json({ jobId: job.id, status: 'captured' });
  } catch (err) {
    sendError(res, err);
  }
});

/** Add screenshots of signed-in/admin/private pages that browser capture cannot reach. */
router.post('/:jobId/add', requireAuth, uploadImages, async (req, res) => {
  try {
    const job = await getJob(String(req.params.jobId));
    if (!job || job.deleted_at || job.user_id !== req.user!.id || !job.capture_metadata) {
      throw new AppError('Sign in to the account that owns this project before adding private-page screenshots.', 404, 'NOT_FOUND');
    }
    if (!['captured', 'storyboarding', 'failed'].includes(job.status)) {
      throw new AppError('Private-page screenshots must be added before generation starts.', 409, 'JOB_ALREADY_STARTED');
    }
    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    if (!files.length) throw new AppError('Choose at least one screenshot.', 400, 'NO_FILES');
    const meta = job.capture_metadata as { pages?: Array<{ url: string; title: string; screenshotUrl: string }>; [key: string]: unknown };
    const pages = [...(meta.pages ?? [])];
    const privatePageCount = pages.filter((page) => String(page.url || '').startsWith('private://')).length;
    if (!req.user?.isAdmin && privatePageCount + files.length > 20) {
      throw new AppError('You can attach up to 20 private screenshots to one project. Public website captures do not count against this attachment limit.', 400, 'TOO_MANY_PAGES');
    }
    let added = 0;
    for (const file of files) {
      const jpeg = await normalizeUploadToJpeg(file.buffer);
      const filename = `private-page-${pages.length + added}.jpg`;
      const screenshotUrl = await saveImageFile(job.id, filename, jpeg);
      pages.push({ url: `private://${job.id}/${added}`, title: uploadPhotoLabel(added, file.originalname).replace('Uploaded photo', 'Private page'), screenshotUrl });
      added++;
    }
    await updateJob(job.id, { capture_metadata: { ...meta, pages, pageCount: pages.length } as never });
    await addJobMessage(job.id, 'user', `Added ${added} private-page screenshot${added === 1 ? '' : 's'}`, 'private_pages');
    res.status(201).json({ jobId: job.id, added, captureMetadata: { ...meta, pages, pageCount: pages.length } });
  } catch (err) { sendError(res, err); }
});

export default router;
