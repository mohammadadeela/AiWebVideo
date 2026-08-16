import { Router } from 'express';
import type { RequestHandler } from 'express';
import multer from 'multer';
import { getOperationsSettings, productionCapacity } from '../lib/provider-config.js';
import { addJobMessage, createUploadJob, getJob, updateJob } from '../lib/queries.js';
import { requireAuth, tryAuth } from '../lib/auth.js';
import { AppError, sendError } from '../lib/errors.js';
import { saveImageFile } from '../lib/capture.js';
import { MAX_UPLOAD_BYTES, MAX_UPLOAD_PHOTOS, normalizeUploadToJpeg, sanitizeUploadTitle, uploadPhotoLabel } from '../lib/uploads.js';

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
    if (!files.length) throw new AppError('Please attach at least one photo.', 400, 'NO_FILES');

    const title = sanitizeUploadTitle(typeof req.body?.title === 'string' ? req.body.title : null);
    const userId = req.user?.id ?? null;

    // Placeholder id — the real job row (and its real id) is created after
    // normalizing/saving the files below, matching how the website capture
    // path saves screenshots under the job's own id.
    const job = await createUploadJob(userId, title, {});
    await addJobMessage(job.id, 'user', `Uploaded ${files.length} photo${files.length === 1 ? '' : 's'}`, 'upload');

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

    if (!pages.length) {
      throw new AppError('None of the uploaded files could be read as images. Please try again with JPEG, PNG, or WEBP photos.', 400, 'NO_VALID_FILES');
    }

    await updateJob(job.id, {
      capture_metadata: {
        title,
        description: null,
        logoUrl: null,
        brandColors: [],
        htmlLang: null,
        screenshotUrl: pages[0].screenshotUrl,
        fullPageScreenshotUrl: pages[0].screenshotUrl,
        mobileScreenshotUrl: null,
        mobileFullPageScreenshotUrl: null,
        recordingUrl: null,
        pages,
        pageCount: pages.length,
      } as never,
    });

    await addJobMessage(job.id, 'assistant', `Saved ${pages.length} photo${pages.length === 1 ? '' : 's'}. What would you like to create from them?`, 'status');
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
    if (!req.user?.isAdmin && pages.length + files.length > 20) throw new AppError('A project can use up to 20 captured and uploaded pages. Select the most important screens for a focused production.', 400, 'TOO_MANY_PAGES');
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
