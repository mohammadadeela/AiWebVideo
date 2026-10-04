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
import { DrawingError, MAX_DRAWING_BYTES, drawingBrief, isUnitChoice, readDrawing, type ReadResult, type UnitChoice } from '../lib/cad-drawing.js';
import { renderDrawingJpeg } from '../lib/cad-render.js';
import { TARGET_KINDS, TARGET_LEVELS } from '../lib/studio-direction.js';
import { drawTargetMarker, markerLabel } from '../lib/target-marker.js';
import { generationModelForMode } from '../lib/generation-models.js';
import { readPublicUrl } from '../lib/external-reference.js';
import { coordinatesFromMapsUrl, isGoogleMapsUrl } from '../lib/maps-url.js';
import { TEMPLATE_REPLACEMENT_DIRECTION } from '../lib/studio-direction.js';
import { sanitizeProductFacts } from '../lib/studio-insights.js';
import { fetchSiteImageryDetailed } from '../lib/site-imagery.js';
import { findShowcaseSample, loadShowcaseStill } from '../lib/marketing.js';
import { z } from 'zod';

const router = Router();

const fileFilter: NonNullable<Parameters<typeof multer>[0]>['fileFilter'] = (_req, file, cb) => {
  // An engineer's drawing travels in its own field and is recognised by its extension (browsers report DXF/DWG
  // with many different MIME types). What is inside is checked by the reader, not trusted from the name.
  if (file.fieldname === 'drawing') {
    if (/\.(dxf|dwg)$/i.test(file.originalname)) cb(null, true);
    else cb(new AppError('Upload the drawing as a .dxf file (AutoCAD: Save As → DXF).', 400, 'UNSUPPORTED_FILE_TYPE'));
    return;
  }
  // HEIC/HEIF intentionally excluded: normalizeUploadToJpeg() shells out to
  // ffmpeg, and the ffmpeg build this app runs on does not include HEIC
  // decoding (no libheif).
  if (/^image\/(jpeg|png|webp)$/i.test(file.mimetype)) cb(null, true);
  else cb(new AppError(`Unsupported file type: ${file.mimetype}. Please upload JPEG, PNG, or WEBP photos (not HEIC — convert iPhone photos to JPEG first, or use "Most Compatible" format in your camera settings).`, 400, 'UNSUPPORTED_FILE_TYPE'));
};

// The multipart limit has to allow the largest thing in the request (a drawing); photos are held to their own
// 10MB limit right after parsing (see splitUploadFiles).
const userUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_DRAWING_BYTES, files: MAX_UPLOAD_PHOTOS + 1 },
  fileFilter,
});

// Administrators are trusted operators and may attach any number of photos in
// one batch. The per-file type and size safety checks still apply.
const adminUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DRAWING_BYTES }, fileFilter });

const uploadImages: RequestHandler = (req, res, next) => {
  const middleware = req.user?.isAdmin
    ? adminUpload.fields([{ name: 'images' }, { name: 'drawing', maxCount: 1 }])
    : userUpload.fields([{ name: 'images', maxCount: MAX_UPLOAD_PHOTOS }, { name: 'drawing', maxCount: 1 }]);
  middleware(req, res, (error?: unknown) => {
    if (error) { next(error); return; }
    // From here on `req.files` is the photo list, exactly as before; the drawing (if any) is `req.drawingFile`.
    const grouped = (req.files ?? {}) as Record<string, Express.Multer.File[]>;
    const images = grouped.images ?? [];
    const tooBig = images.find((file) => file.size > MAX_UPLOAD_BYTES);
    if (tooBig) { sendError(res, new AppError(`"${tooBig.originalname}" is larger than ${MAX_UPLOAD_BYTES / 1024 / 1024} MB. Use a smaller photo.`, 413, 'FILE_TOO_LARGE')); return; }
    req.files = images;
    (req as unknown as { drawingFile?: Express.Multer.File }).drawingFile = grouped.drawing?.[0];
    next();
  });
};

// Reading a drawing is real work, so it has its own, stricter allowance than photo uploads.
const PREVIEW_LIMIT = 12;
const previewAttempts = new Map<string, { count: number; resetAt: number }>();
function allowPreview(ip: string) {
  const now = Date.now();
  const current = previewAttempts.get(ip);
  if (!current || current.resetAt <= now) { previewAttempts.set(ip, { count: 1, resetAt: now + 10 * 60_000 }); return true; }
  if (current.count >= PREVIEW_LIMIT) return false;
  current.count += 1;
  if (previewAttempts.size > 2000) for (const [key, value] of previewAttempts) if (value.resetAt <= now) previewAttempts.delete(key);
  return true;
}
const previewUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_DRAWING_BYTES, files: 1 }, fileFilter }).single('drawing');

/** A drawing problem is something the customer can fix, so it is shown to them as written. */
function drawingFailure(error: unknown): never {
  if (error instanceof DrawingError) throw new AppError(error.message, 422, error.code);
  throw error;
}

function unitsFromBody(value: unknown): UnitChoice | undefined {
  return isUnitChoice(value) ? value : undefined;
}

/**
 * POST /api/uploads/drawing-preview — reads a CAD drawing and answers with what was found (sizes, units, rooms,
 * dimensions, warnings) and a to-scale picture, so the customer can check it BEFORE anything is generated or charged.
 */
router.post('/drawing-preview', (req, res, next) => previewUpload(req, res, (error?: unknown) => (error ? sendError(res, error) : next())), (req, res) => {
  try {
    if (!allowPreview(req.ip ?? req.socket.remoteAddress ?? 'unknown')) throw new AppError('Too many drawings read in a short time. Please wait a few minutes.', 429, 'RATE_LIMITED');
    const file = req.file;
    if (!file) throw new AppError('Choose a drawing (.dxf) to read.', 400, 'NO_FILES');
    let read: ReadResult;
    try { read = readDrawing(file.buffer, file.originalname, { units: unitsFromBody(req.body?.units) }); } catch (error) { drawingFailure(error); }
    const { facts, svg } = read;
    res.json({
      fileName: facts.fileName,
      units: facts.units,
      extents: facts.extents,
      outerBoundary: facts.outerBoundary,
      rooms: facts.rooms.slice(0, 12),
      roomCount: facts.rooms.length,
      dimensionCount: facts.dimensions.length,
      dimensionCheck: facts.dimensionCheck,
      layers: facts.layers.slice(0, 8),
      warnings: facts.warnings,
      // A picture of the plan to look at (an image, so it cannot run anything). Left out when it would be huge.
      previewSvg: svg.length <= 1_500_000 ? svg : null,
    });
  } catch (error) { sendError(res, error); }
});

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
    const drawingFile = (req as unknown as { drawingFile?: Express.Multer.File }).drawingFile;
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
    // Hidden creative direction (from an Idea chip). Stored separately so it never shows in the chat.
    const clientDirection = typeof req.body?.studioDirection === 'string' ? req.body.studioDirection.trim().slice(0, 6000) : '';
    const templateId = typeof req.body?.templateId === 'string' ? req.body.templateId.trim().slice(0, 80) : '';
    // What the product page itself says (title, description, price...). Untrusted text: sanitised before use.
    let productFacts: ReturnType<typeof sanitizeProductFacts> = null;
    try { productFacts = sanitizeProductFacts(JSON.parse(String(req.body?.productFacts || 'null'))); } catch { productFacts = null; }
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
          streetViewHeading: z.number().min(0).max(360).optional(),
          streetViewPitch: z.number().min(-20).max(70).optional(),
          streetViewFov: z.number().min(30).max(110).optional(),
          // what the customer pointed at, and where on which picture
          targetKind: z.enum(TARGET_KINDS).optional(),
          targetLevel: z.enum(TARGET_LEVELS).optional(),
          targetX: z.number().min(0).max(1).optional(),
          targetY: z.number().min(0).max(1).optional(),
          targetSource: z.enum(['street', 'photo']).optional(),
          targetPhoto: z.number().int().min(0).max(9).optional(),
          // set by the server only (below): whatever the page sends here is discarded
          targetMarked: z.boolean().optional(),
          streetViewDate: z.string().max(24).optional(),
          streetViewViews: z.number().int().min(0).max(6).optional(),
        }).parse(architectureInput)
      : null;
    // Whether Street View was attached, and from when, is the server's to say: never taken from the page.
    if (architecture) {
      delete architecture.streetViewDate; delete architecture.streetViewViews; delete architecture.targetMarked;
      // The target: a kind is needed for the rest to mean anything, a tap needs both coordinates, and a level only applies to a unit or a floor.
      if (!architecture.targetKind) {
        delete architecture.targetLevel; delete architecture.targetX; delete architecture.targetY; delete architecture.targetSource; delete architecture.targetPhoto;
      } else {
        if (architecture.targetKind === 'unit') architecture.targetLevel ??= 'ground';
        else if (architecture.targetKind === 'floor') architecture.targetLevel ??= '1';
        else delete architecture.targetLevel;
        const tapped = typeof architecture.targetX === 'number' && typeof architecture.targetY === 'number';
        if (tapped) architecture.targetSource ??= 'street';
        if (!tapped || (architecture.targetSource === 'photo' && typeof architecture.targetPhoto !== 'number')) {
          delete architecture.targetX; delete architecture.targetY; delete architecture.targetSource; delete architecture.targetPhoto;
        }
        if (architecture.targetSource !== 'photo') delete architecture.targetPhoto;
      }
    }
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
      if (studioKind === 'interior' && !files.length && !drawingFile) {
        throw new AppError('Upload at least one interior photo, plan, sketch, elevation, drawing, or reference image.', 400, 'INTERIOR_REFERENCE_REQUIRED');
      }
      if (studioKind === 'architecture') {
        // A reference (site screenshot, plan, building to place) improves accuracy but is not required: without one
        // the site is understood from the location and the customer's words.
        if (!architecture?.location && !architecture?.mapUrl) throw new AppError('Add a Google Maps link or address.', 400, 'LOCATION_REQUIRED');
        // Plot figures are optional: a shop inside an existing building or a shop front has no use for them. Without
        // figures the plot is treated as estimated, so nothing is invented as exact.
        if (!architecture.plotWidth || !architecture.plotDepth) architecture.estimatedScale = true;
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

    // An engineer's drawing (Interior Design and Architecture): read it BEFORE a job exists, so a problem with the file never
    // leaves half a production behind. The figures come from the file's own geometry; the customer must have confirmed the
    // units whenever the file did not state them clearly, so a wrong scale can never go through silently.
    let drawing: ReadResult | null = null;
    let drawingJpeg: Buffer | null = null;
    if (drawingFile) {
      if (studioKind !== 'interior' && studioKind !== 'architecture') {
        throw new AppError('Drawings can be used with Interior Design and Architecture.', 400, 'DRAWING_NOT_SUPPORTED_HERE');
      }
      const chosenUnits = unitsFromBody(req.body?.drawingUnits);
      try { drawing = readDrawing(drawingFile.buffer, drawingFile.originalname, { units: chosenUnits }); } catch (error) { drawingFailure(error); }
      if (drawing.facts.units.needsConfirmation) {
        throw new AppError('Confirm the units of your drawing (millimetres, centimetres, metres, inches or feet) before generating, so every size is exact.', 422, 'DRAWING_UNITS_UNCONFIRMED');
      }
      drawingJpeg = await renderDrawingJpeg(drawing.svg);
      if (!drawingJpeg && !files.length && !(studioKind === 'architecture' && (architecture?.location || architecture?.mapUrl))) {
        throw new AppError('Your drawing was read, but its picture could not be prepared right now. Add a photo of the space or try again in a moment.', 503, 'DRAWING_RENDER_UNAVAILABLE');
      }
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
    let photoTappedOn: Buffer | null = null;
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
      if (architecture?.targetSource === 'photo' && architecture.targetPhoto === index) photoTappedOn = jpeg;
    }

    // Architecture: the customer tapped on one of their own photos. A marked copy goes next to the clean photo (it is a locating aid only).
    if (studioKind === 'architecture' && architecture?.targetKind && architecture.targetSource === 'photo' && typeof architecture.targetX === 'number' && typeof architecture.targetY === 'number') {
      const marked = photoTappedOn ? await drawTargetMarker(photoTappedOn, { x: architecture.targetX, y: architecture.targetY }, architecture.targetKind) : null;
      if (marked) {
        const pageIndex = pages.length;
        const screenshotUrl = await saveImageFile(job.id, pageIndex === 0 ? 'screenshot-full.jpg' : `page-${pageIndex}.jpg`, marked);
        pages.push({ url: `target-marker://${pageIndex}`, title: markerLabel(architecture.targetKind, 'photo'), screenshotUrl });
        architecture.targetMarked = true;
      } else {
        delete architecture.targetX; delete architecture.targetY; delete architecture.targetSource; delete architecture.targetPhoto;
      }
    }

    if (drawing && drawingJpeg) {
      try {
        const jpeg = await normalizeUploadToJpeg(drawingJpeg);
        const pageIndex = pages.length;
        const filename = pageIndex === 0 ? 'screenshot-full.jpg' : `page-${pageIndex}.jpg`;
        const screenshotUrl = await saveImageFile(job.id, filename, jpeg);
        pages.push({ url: `drawing://${job.id}`, title: 'DRAWING — exact to-scale plan from the customer\'s CAD file (its geometry and proportions are authoritative)', screenshotUrl });
        await addJobMessage(job.id, 'user', `Added drawing ${drawing.facts.fileName}`, 'upload');
      } catch (err) {
        console.warn(`[uploads] job=${job.id} drawing picture skipped: ${(err as Error).message}`);
      }
    }

    let downloadedProductImages = 0;
    for (const [index, imageUrl] of productImageUrls.entries()) {
      try {
        // Many shops refuse hot-linked images: present the product page as the referrer, and skip a photo that
        // still cannot be fetched instead of failing the whole production.
        const source = await readPublicUrl(imageUrl, 10 * 1024 * 1024, /^image\/(?:jpe?g|png|webp|avif)$/, { referer: productUrl || undefined, kind: 'image' });
        const jpeg = await normalizeUploadToJpeg(source.buffer);
        const pageIndex = pages.length;
        const filename = pageIndex === 0 ? 'screenshot-full.jpg' : `page-${pageIndex}.jpg`;
        const screenshotUrl = await saveImageFile(job.id, filename, jpeg);
        pages.push({ url: `product-reference://${index}`, title: `Product image ${index + 1}`, screenshotUrl });
        downloadedProductImages += 1;
      } catch (err) {
        console.warn(`[uploads] job=${job.id} product image ${index + 1} skipped: ${(err as Error).message}`);
      }
    }
    if (productImageUrls.length && !downloadedProductImages && !pages.length) {
      throw new AppError('We could not download the product photos from that page. Upload a photo of the product instead.', 422, 'PRODUCT_IMAGES_UNREADABLE');
    }

    // Architecture: optional map imagery of the site (off unless the site owner enabled it).
    if (studioKind === 'architecture' && typeof architecture?.latitude === 'number' && typeof architecture?.longitude === 'number') {
      const imagery = await fetchSiteImageryDetailed({ latitude: architecture.latitude, longitude: architecture.longitude }, { heading: architecture.streetViewHeading, pitch: architecture.streetViewPitch, fov: architecture.streetViewFov });
      architecture.streetViewViews = imagery.images.filter((shot) => shot.label.startsWith('STREET VIEW')).length || undefined;
      architecture.streetViewDate = imagery.streetView?.dateLabel ?? undefined;
      for (const shot of imagery.images) {
        try {
          const jpeg = await normalizeUploadToJpeg(shot.buffer);
          const pageIndex = pages.length;
          const filename = pageIndex === 0 ? 'screenshot-full.jpg' : `page-${pageIndex}.jpg`;
          const screenshotUrl = await saveImageFile(job.id, filename, jpeg);
          pages.push({ url: `site-imagery://${pageIndex}`, title: shot.label, screenshotUrl });
        } catch (err) {
          console.warn(`[uploads] job=${job.id} site imagery skipped: ${(err as Error).message}`);
        }
      }
      // The customer tapped on the Street View frame: a marked copy of the FRONT picture (the one they looked at) goes next to it.
      if (architecture.targetKind && architecture.targetSource === 'street' && typeof architecture.targetX === 'number' && typeof architecture.targetY === 'number') {
        const front = imagery.images.find((shot) => shot.role === 'front');
        const marked = front ? await drawTargetMarker(front.buffer, { x: architecture.targetX, y: architecture.targetY }, architecture.targetKind) : null;
        if (marked) {
          try {
            const pageIndex = pages.length;
            const screenshotUrl = await saveImageFile(job.id, pageIndex === 0 ? 'screenshot-full.jpg' : `page-${pageIndex}.jpg`, marked);
            pages.push({ url: `target-marker://${pageIndex}`, title: markerLabel(architecture.targetKind, 'street'), screenshotUrl });
            architecture.targetMarked = true;
          } catch (err) {
            console.warn(`[uploads] job=${job.id} target marker skipped: ${(err as Error).message}`);
          }
        } else {
          // no Street View picture to point at: the customer's choice of target still counts, the tap does not
          delete architecture.targetX; delete architecture.targetY; delete architecture.targetSource;
        }
      }
    } else if (studioKind === 'architecture' && architecture?.targetSource === 'street') {
      // Street View was not available, so there is no picture the tap could refer to
      delete architecture.targetX; delete architecture.targetY; delete architecture.targetSource;
    }

    // "Make one like this with my product": attach the chosen showcase sample as the LAST reference.
    let usedTemplateId: string | null = null;
    if (templateId && studioKind) {
      const sample = await findShowcaseSample(templateId);
      const still = sample ? await loadShowcaseStill(sample) : null;
      if (sample && still) {
        try {
          const jpeg = await normalizeUploadToJpeg(still);
          const pageIndex = pages.length;
          const filename = pageIndex === 0 ? 'screenshot-full.jpg' : `page-${pageIndex}.jpg`;
          const screenshotUrl = await saveImageFile(job.id, filename, jpeg);
          pages.push({ url: `template://${sample.id}`, title: 'STYLE SAMPLE — copy its look, replace its subject with the customer references', screenshotUrl });
          usedTemplateId = sample.id;
        } catch (err) {
          console.warn(`[uploads] job=${job.id} template ${templateId} skipped: ${(err as Error).message}`);
        }
      }
    }
    const studioDirection = [usedTemplateId ? TEMPLATE_REPLACEMENT_DIRECTION : '', clientDirection].filter(Boolean).join('\n\n');

    // Text-only Custom Idea and Scenario jobs never call an image provider at
    // upload time. The paid render transaction is the first expensive model
    // call, so this endpoint cannot be abused for free image generation.
    const directTextToVideo = ((studioKind === 'idea' || studioKind === 'scenario') && studioMode === 'custom' && Boolean(ideaPrompt) && !files.length && !productImageUrls.length && !usedTemplateId)
      // Architecture from a location alone: no reference images, the site is understood from the place and the words.
      || (studioKind === 'architecture' && !pages.length && Boolean(architecture?.location || architecture?.mapUrl));

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
              narrationLanguage: 'auto',
            } as never,
          }
        : {}),
      capture_metadata: {
        title,
        sourceType: studioKind ? 'studio' : 'upload',
        studioKind,
        productUrl,
        productFacts,
        productImageUrls: productImageUrls.length,
        architecture,
        drawing: drawing
          ? {
              fileName: drawing.facts.fileName,
              units: drawing.facts.units.name,
              brief: drawingBrief(drawing.facts),
              summary: {
                widthM: drawing.facts.extents?.widthM ?? null,
                depthM: drawing.facts.extents?.depthM ?? null,
                areaM2: drawing.facts.outerBoundary?.areaM2 ?? null,
                rooms: drawing.facts.rooms.length,
                dimensions: drawing.facts.dimensions.length,
              },
            }
          : null,
        studioDirection: studioKind && studioDirection ? studioDirection : null,
        templateId: usedTemplateId,
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
