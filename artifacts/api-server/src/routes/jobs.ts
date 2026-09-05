import { Router } from "express";
import * as fs from "fs/promises";
import * as path from "path";
import { randomUUID } from "node:crypto";
import { z } from "zod";
import {
  getOperationsSettings,
  productionCapacity,
} from "../lib/provider-config.js";
import {
  addJobMessage,
  claimJob,
  claimRenderAndSpend,
  createAsset,
  createJobFromCapture,
  getAssetsByJob,
  getAssetsByJobs,
  getJob,
  getJobThreadJobs,
  getJobThreadMessages,
  refundJobCredits,
  reserveGenerationCredits,
  requestJobCancellation,
  isCancelRequested,
  softDeleteJob,
  updateJob,
} from "../lib/queries.js";
import { tryAuth, requireAuth } from "../lib/auth.js";
import { AppError, sendError } from "../lib/errors.js";
import {
  publicJobErrorMessage,
  publicJobMessageContent,
} from "../lib/public-errors.js";
import { generateStoryboard, storyboardModelName } from "../lib/gemini.js";
import { generateMarketingPhoto, generateWebsiteIcon } from "../lib/imagen.js";
import { continuousOperationCount, generateMarketingVideo, type AudioMode } from "../lib/veo.js";
import {
  generateVoiceoverScript,
  synthesizeVoiceover,
  resolveNarrationLanguage,
} from "../lib/voiceover.js";
import {
  videoCreditCost,
  videoCreditQuote,
  CREDIT_COSTS,
  MAX_VIDEO_SECONDS,
  MIN_VIDEO_SECONDS,
  VIDEO_SCENE_SECONDS,
} from "../lib/credits.js";
import { ASSETS_DIR } from "../lib/capture.js";
import { signAssetTree, signPrivateAssetUrl } from "../lib/asset-access.js";
import type { JobStatusResponse, JobWorkflowState } from "../types.js";
import type { Storyboard } from "../lib/gemini.js";

const router = Router();
const MAX_REFERENCE_CAPTURES = MAX_VIDEO_SECONDS / VIDEO_SCENE_SECONDS;

type ActionWindow = { count: number; resetAt: number };
const generationActionWindows = new Map<string, ActionWindow>();

function allowGenerationAction(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = generationActionWindows.get(key);
  if (!current || current.resetAt <= now) {
    generationActionWindows.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}

function generationClientKey(req: { ip?: string; socket?: { remoteAddress?: string | null } }) {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

const CAPTURE_SOURCE_FILE =
  /^(?:screenshot(?:-full|-mobile|-mobile-full)?\.jpg|website-icon\.jpg|page-\d+\.jpg|private-page-\d+\.jpg|interaction-[a-z-]+\.jpg|scroll-recording\.mp4)$/;

/** Copy only immutable browser-capture sources into a new creative version. */
async function copyCaptureFiles(sourceJobId: string, targetJobId: string) {
  const fromDir = path.join(ASSETS_DIR, sourceJobId);
  const toDir = path.join(ASSETS_DIR, targetJobId);
  await fs.mkdir(toDir, { recursive: true });
  let names: string[] = [];
  try {
    names = await fs.readdir(fromDir);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return;
    throw err;
  }
  await Promise.all(
    names
      .filter((name) => CAPTURE_SOURCE_FILE.test(name))
      .map((name) =>
        fs.copyFile(path.join(fromDir, name), path.join(toDir, name)),
      ),
  );
}

function initialAiVideoEstimate(
  sceneCount: number,
  finishAllowanceSeconds: number,
) {
  // Conservative only until the first scene completes; live throughput then
  // replaces this value. Scenes are processed concurrently, so this is not a
  // simple sceneCount × duration calculation.
  return Math.min(
    360,
    Math.max(60, finishAllowanceSeconds + 35 + sceneCount * 15),
  );
}

type CaptureMeta = {
  title?: string;
  description?: string | null;
  screenshotUrl?: string | null;
  pageCount?: number;
  recordingUrl?: string | null;
  hasScreenshotBuffer?: boolean;
  htmlLang?: string | null;
  logoUrl?: string | null;
  pages?: Array<{ url?: string; title?: string; screenshotUrl?: string }>;
  sourceType?: "website" | "upload" | "studio";
  studioKind?: "product" | "idea" | "scenario" | null;
  ideaPrompt?: string | null;
};

function effectiveVideoModeForMeta(meta: CaptureMeta | null, requestedMode: string) {
  if (meta?.sourceType !== "studio") return requestedMode;
  if (meta.studioKind === "product") return requestedMode === "photos" ? "photos" : "product-video";
  if (meta.studioKind === "scenario") return "talking-scene";
  return "ai-video";
}

/**
 * Load real browser screenshots in one stable order shared by storyboard
 * planning and AI-video generation. This keeps the planner's sourceIndices aligned
 * with the exact screenshot buffers later sent to the video provider.
 */
async function loadReferenceCaptures(
  jobId: string,
  meta: CaptureMeta | null,
  aspectRatio: "16:9" | "9:16" | "1:1",
  selectedCaptureIds?: string[],
) {
  const captures: Array<{ id: string; label: string; buffer: Buffer }> = [];
  const uploadedMedia =
    meta?.sourceType === "upload" || meta?.sourceType === "studio";
  const firstMediaLabel =
    meta?.pages?.[0]?.title ||
    (uploadedMedia
      ? "Uploaded reference photo 1"
      : "Real desktop homepage full page");
  const add = async (filename: string, label: string) => {
    try {
      const buffer = await fs.readFile(path.join(ASSETS_DIR, jobId, filename));
      if (!buffer.length || captures.some((item) => item.buffer.equals(buffer)))
        return;
      captures.push({ id: filename, label, buffer });
    } catch {
      /* optional capture */
    }
  };

  if (aspectRatio === "9:16") {
    await add("screenshot-mobile.jpg", "Real mobile homepage viewport");
    await add("screenshot-mobile-full.jpg", "Real mobile homepage full page");
  }
  await add(
    "screenshot.jpg",
    uploadedMedia
      ? "Uploaded reference photo 1"
      : "Real desktop homepage viewport",
  );
  await add("screenshot-full.jpg", firstMediaLabel);

  // Use the screenshot URLs recorded in metadata instead of assuming page-1,
  // page-2, ... are contiguous. Slow/unsupported child pages can be skipped,
  // so the successful files may legitimately be page-2.jpg, page-4.jpg, etc.
  // Interaction-state captures (product option selected, added to cart, cart,
  // AI assistant) are appended at the end of meta.pages by the capture step,
  // but they're exactly what buy/tour/tutorial scenes most need — so they're
  // prioritized here rather than risking getting pushed out of the final
  // 10-capture cap by an ordinary page that happened to be discovered first.
  const restPages = (meta?.pages ?? []).slice(1);
  const isInteractionPage = (pageMeta: { screenshotUrl?: string }) => {
    try {
      return /^interaction-/.test(
        path.basename(
          new URL(pageMeta.screenshotUrl ?? "", "http://local").pathname,
        ),
      );
    } catch {
      return false;
    }
  };
  const orderedRest = [
    ...restPages.filter(isInteractionPage),
    ...restPages.filter((p) => !isInteractionPage(p)),
  ];
  for (const [index, pageMeta] of orderedRest.entries()) {
    const screenshotUrl = pageMeta?.screenshotUrl;
    if (!screenshotUrl) continue;
    let filename = "";
    try {
      filename = path.basename(new URL(screenshotUrl, "http://local").pathname);
    } catch {
      filename = path.basename(screenshotUrl);
    }
    if (
      !/^(?:page-\d+|screenshot(?:-full|-mobile|-mobile-full)?|interaction-[a-z-]+)\.jpg$/.test(
        filename,
      )
    )
      continue;
    const detail =
      pageMeta?.title ||
      pageMeta?.url ||
      (uploadedMedia
        ? `reference photo ${index + 2}`
        : `internal page ${index + 2}`);
    await add(
      filename,
      uploadedMedia ? String(detail) : `Real captured ${detail}`,
    );
  }

  // Reserve the final reference slot for the site's own icon. It is a brand
  // reference, not a webpage state, and is used for icon concepts plus the
  // video's intentional closing identity treatment.
  let websiteIcon: Buffer | null = null;
  try {
    websiteIcon = await fs.readFile(
      path.join(ASSETS_DIR, jobId, "website-icon.jpg"),
    );
  } catch {
    /* optional */
  }
  const selectedIds = selectedCaptureIds ?? [];
  const selectedSet = selectedIds.length ? new Set(selectedIds) : null;
  const selectedPages = selectedSet
    ? selectedIds
        .map((id) => captures.find((capture) => capture.id === id))
        .filter(
          (capture): capture is { id: string; label: string; buffer: Buffer } =>
            Boolean(capture),
        )
    : captures;
  const pageCaptures = selectedPages.slice(
    0,
    websiteIcon?.length ? MAX_REFERENCE_CAPTURES - 1 : MAX_REFERENCE_CAPTURES,
  );
  if (websiteIcon?.length)
    pageCaptures.push({
      id: "website-icon.jpg",
      label:
        "Real captured WEBSITE ICON / LOGO — use for brand identity and the closing card",
      buffer: websiteIcon,
    });
  return pageCaptures;
}

// GET /api/jobs/:id
router.get("/:id", tryAuth, async (req, res) => {
  try {
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at)
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    if (job.user_id && job.user_id !== req.user?.id) {
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    }

    const assets = await getAssetsByJob(job.id);
    const threadJobs = await getJobThreadJobs(job.id);
    const messages = await getJobThreadMessages(job.id);
    const threadAssets = await getAssetsByJobs(threadJobs.map((item) => item.id));
    const assetsByJob = new Map<string, typeof threadAssets>();
    for (const asset of threadAssets) {
      const current = assetsByJob.get(asset.job_id) ?? [];
      current.push(asset);
      assetsByJob.set(asset.job_id, current);
    }
    const isOwner = req.user?.id === job.user_id;
    const showTechnicalErrors = req.user?.isAdmin === true;

    const response: JobStatusResponse = {
      id: job.id,
      title: job.title,
      pinned: job.pinned,
      status: job.status as never,
      progress: job.progress,
      statusMessage: job.status_message,
      etaSeconds: job.eta_seconds,
      creditsSpent: isOwner ? Math.max(0, job.credits_spent || 0) : 0,
      mode: job.mode as never,
      sourceUrl: job.source_url,
      vibeBrief: job.vibe_brief,
      captureMetadata: signAssetTree(job.capture_metadata) as never,
      storyboard: job.storyboard as never,
      workflowState: job.workflow_state as never,
      errorMessage: showTechnicalErrors
        ? job.error_message
        : publicJobErrorMessage(job.error_message),
      assets: assets.map((a) => ({
        id: a.id,
        type: a.type as never,
        aspectRatio: a.aspect_ratio,
        watermarked: a.watermarked,
        url: signPrivateAssetUrl(a.storage_url),
        downloadable: isOwner ? a.downloadable : false,
      })),
      messages: messages.map((message) => {
        const resultAssets = message.kind === "result"
          ? (assetsByJob.get(message.job_id) ?? []).filter((asset) => asset.type === "video" || asset.type === "photo")
          : [];
        return {
          id: message.id,
          role: message.role,
          kind: message.kind,
          content: showTechnicalErrors
            ? message.content
            : publicJobMessageContent(message.content),
          payload: {
            ...(message.payload ?? {}),
            ...(resultAssets.length
              ? {
                  resultAssets: resultAssets.map((asset) => ({
                    id: asset.id,
                    type: asset.type,
                    aspectRatio: asset.aspect_ratio,
                    watermarked: asset.watermarked,
                    url: signPrivateAssetUrl(asset.storage_url),
                    downloadable: isOwner ? asset.downloadable : false,
                  })),
                }
              : {}),
          },
          createdAt: message.created_at,
        };
      }),
    };

    res.json(response);
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/claim — attach a guest chat (started before sign-in) to
// the now-authenticated account, so it appears in "Your chats" and every
// owner-only action (pin, delete, reuse, render) works immediately. A no-op,
// not an error, if the job is already claimed by someone else or by this
// same user, so the frontend can call it unconditionally right after sign-in.
router.post("/:id/claim", requireAuth, async (req, res) => {
  try {
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at)
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    if (job.user_id && job.user_id !== req.user!.id) {
      // Already owned by someone else — silently succeed as "not claimed"
      // rather than leaking whether the job exists to another account.
      res.json({ claimed: false });
      return;
    }
    const claimed = await claimJob(job.id, req.user!.id);
    res.json({ claimed });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/jobs/:id — rename or pin a saved chat.
router.patch("/:id", requireAuth, async (req, res) => {
  try {
    const patch = z
      .object({
        title: z.string().trim().min(1).max(120).optional(),
        pinned: z.boolean().optional(),
      })
      .refine(
        (value) => value.title !== undefined || value.pinned !== undefined,
      )
      .parse(req.body);
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at || job.user_id !== req.user!.id)
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    const updated = await updateJob(job.id, patch);
    res.json({
      id: updated!.id,
      title: updated!.title,
      pinned: updated!.pinned,
      updatedAt: updated!.updated_at,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// PATCH /api/jobs/:id/workflow — persist the exact interactive studio step
// and every choice needed to continue it after refresh, navigation, sign-out,
// or another device opening the same account. Provider work remains governed
// by jobs.status; this state only restores the safe UI around that work.
router.patch("/:id/workflow", tryAuth, async (req, res) => {
  try {
    const workflowState = z
      .object({
        savedAt: z.number().int().positive(),
        stage: z.enum([
          "capturing",
          "preview_ready",
          "awaiting_private_pages",
          "awaiting_mode",
          "awaiting_duration",
          "awaiting_format",
          "awaiting_features",
          "awaiting_brief",
          "storyboarding",
          "ready_to_render",
          "rendering",
          "done",
          "failed",
        ]),
        mode: z.enum([
          "video",
          "photos",
          "icon",
          "both",
          "demo",
          "tutorial",
          "buy",
          "tour",
          "mockup",
          "linkedin",
          "custom",
        ]),
        durationSeconds: z.number().int().min(8).max(MAX_VIDEO_SECONDS),
        featuresText: z.string().max(2000).nullable(),
        creativeBrief: z.string().max(8000).nullable(),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
        outputQuality: z.enum(["1080p", "4k"]),
        frameRate: z.union([z.literal(24), z.literal(30), z.literal(60)]),
        selectedCaptureIds: z.array(z.string().max(180)).max(30),
        audioMode: z.enum([
          "voice_music",
          "native_audio",
          "music_only",
          "silent",
        ]),
        narrationLanguage: z.string().trim().min(2).max(12),
        websiteAutoFlow: z.boolean().optional(),
        manualRenderAfterPlan: z.boolean().optional(),
        requestedDurationSeconds: z
          .union([z.literal("auto"), z.number().int().min(8).max(MAX_VIDEO_SECONDS)])
          .optional(),
      })
      .parse(req.body);
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at || (job.user_id && job.user_id !== req.user?.id))
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    const updated = await updateJob(job.id, { workflow_state: workflowState });
    res.json({ saved: true, updatedAt: updated!.updated_at });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/jobs/:id — soft delete so storage cleanup can be managed safely.
router.delete("/:id", requireAuth, async (req, res) => {
  try {
    const deleted = await softDeleteJob(String(req.params.id), req.user!.id);
    if (!deleted) throw new AppError("Job not found.", 404, "NOT_FOUND");
    res.json({ deleted: true });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/cancel — stop an in-progress capture/plan/render. The
// in-flight work checks cancel_requested cooperatively and refunds/settles
// itself; this endpoint just records the request (and settles trivially for
// a job that hasn't started spending anything yet).
router.post("/:id/cancel", requireAuth, async (req, res) => {
  try {
    const result = await requestJobCancellation(
      String(req.params.id),
      req.user!.id,
    );
    if (!result.ok) {
      if (result.reason === "not_found")
        throw new AppError("Job not found.", 404, "NOT_FOUND");
      if (result.reason === "not_owner")
        throw new AppError("Job not found.", 404, "NOT_FOUND");
      throw new AppError(
        "This job already finished, failed, or was already cancelled — there is nothing left to stop.",
        409,
        "NOT_CANCELLABLE",
      );
    }
    await addJobMessage(
      String(req.params.id),
      "assistant",
      "Stopping at your request…",
      "cancel_requested",
    ).catch(() => {});
    res.json({ cancelling: true, immediate: result.immediate });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/messages — persist chat choices and assistant updates.
router.post("/:id/messages", tryAuth, async (req, res) => {
  try {
    const input = z
      .object({
        role: z.enum(["user", "assistant", "system"]),
        kind: z.string().trim().min(1).max(40).optional().default("text"),
        content: z.string().trim().min(1).max(8000),
        payload: z.record(z.string(), z.unknown()).nullable().optional(),
      })
      .parse(req.body);
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at || (job.user_id && job.user_id !== req.user?.id))
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    const message = await addJobMessage(
      job.id,
      input.role,
      input.content,
      input.kind,
      input.payload,
    );
    res.status(201).json({ id: message.id, createdAt: message.created_at });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/reuse — make a new chat from saved capture files.
router.post("/:id/reuse", requireAuth, async (req, res) => {
  try {
    const source = await getJob(String(req.params.id));
    if (
      !source ||
      source.deleted_at ||
      source.user_id !== req.user!.id ||
      !source.capture_metadata
    ) {
      throw new AppError("Saved capture not found.", 404, "NOT_FOUND");
    }
    const job = await createJobFromCapture(req.user!.id, source);
    await copyCaptureFiles(source.id, job.id);
    const sourceMeta = source.capture_metadata as CaptureMeta | null;
    const continuationLabel =
      sourceMeta?.sourceType === "studio"
        ? sourceMeta.studioKind === "product"
          ? "Product references carried into the next direction."
          : sourceMeta.studioKind === "scenario"
            ? "Scene references carried into the next take."
            : "Creative references carried into the next direction."
        : sourceMeta?.sourceType === "upload"
          ? "Uploaded references carried into the next direction."
          : "Website source carried into the next campaign direction.";
    await addJobMessage(
      job.id,
      "assistant",
      continuationLabel,
      "source_continuation",
      { sourceJobId: source.id },
    );
    res.status(201).json({ jobId: job.id, status: "captured" });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/preflight — exact, read-only credit gate used before
// any paid AI planning/provider work. Website browser capture remains free and
// is intentionally handled by /api/capture without this gate.
router.post("/:id/preflight", requireAuth, async (req, res) => {
  try {
    const input = z.object({
      mode: z.enum([
        "video", "photos", "icon", "both", "demo", "tutorial", "buy",
        "tour", "mockup", "linkedin", "custom",
      ]),
      durationSeconds: z.number().int().min(MIN_VIDEO_SECONDS).max(MAX_VIDEO_SECONDS),
      outputQuality: z.enum(["1080p", "4k"]).optional().default("1080p"),
      audioMode: z.enum(["voice_music", "native_audio", "music_only", "silent"]).optional().default("native_audio"),
    }).parse(req.body);
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at || job.user_id !== req.user!.id) {
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    }
    const quote = videoCreditQuote(
      input.mode,
      input.audioMode !== "voice_music",
      input.durationSeconds,
      input.outputQuality,
    );
    const balance = req.user!.creditsBalance;
    res.json({
      ...quote,
      balance,
      shortfall: Math.max(0, quote.totalCredits - balance),
      affordable: req.user!.isAdmin || balance >= quote.totalCredits,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/storyboard
router.post("/:id/storyboard", requireAuth, async (req, res) => {
  try {
    console.info(`[storyboard] request received job=${String(req.params.id)}`);
    const clientKey = generationClientKey(req);
    if (!allowGenerationAction(`storyboard-ip:${clientKey}`, 16, 10 * 60 * 1000)) {
      throw new AppError(
        "Too many production-planning requests. Please wait a few minutes and try again.",
        429,
        "RATE_LIMITED",
      );
    }
    if (!allowGenerationAction(`storyboard-job:${String(req.params.id)}`, 8, 10 * 60 * 1000)) {
      throw new AppError(
        "This project has received too many planning requests in a short period. Please wait a few minutes before trying again.",
        429,
        "RATE_LIMITED",
      );
    }

    const storyboardInput = z
      .object({
        mode: z.enum([
          "video",
          "photos",
          "icon",
          "both",
          "demo",
          "tutorial",
          "buy",
          "tour",
          "mockup",
          "linkedin",
          "custom",
        ]),
        vibeBrief: z.string().min(1).max(500),
        durationSeconds: z
          .number()
          .int()
          .min(MIN_VIDEO_SECONDS)
          .max(MAX_VIDEO_SECONDS)
          .optional()
          .default(8),
        featuresText: z.string().max(1000).optional(),
        creativeBrief: z.string().max(8000).optional(),
        aspectRatio: z.enum(["16:9", "9:16", "1:1"]).optional().default("16:9"),
        outputQuality: z.enum(["1080p", "4k"]).optional().default("1080p"),
        audioMode: z.enum(["voice_music", "native_audio", "music_only", "silent"]).optional(),
        frameRate: z
          .union([z.literal(24), z.literal(30), z.literal(60)])
          .optional()
          .default(24),
        selectedCaptureIds: z
          .array(
            z
              .string()
              .regex(
                /^(?:screenshot(?:-full|-mobile|-mobile-full)?|page-\d+|private-page-\d+|interaction-[a-z-]+)\.jpg$/,
              ),
          )
          .max(MAX_REFERENCE_CAPTURES)
          .optional(),
      })
      .parse(req.body);
    const {
      mode,
      vibeBrief,
      durationSeconds,
      featuresText,
      creativeBrief,
      outputQuality,
      audioMode: requestedAudioMode,
      frameRate,
      selectedCaptureIds,
    } = storyboardInput;
    const aspectRatio =
      mode === "icon" ? ("1:1" as const) : storyboardInput.aspectRatio;

    let job = await getJob(String(req.params.id));
    if (!job || job.deleted_at) throw new AppError("Job not found.", 404, "NOT_FOUND");
    if (job.user_id !== req.user!.id) {
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    }

    const savedWorkflowForCredit = job.workflow_state as Partial<JobWorkflowState> | null;
    const planningAudioMode = requestedAudioMode ?? savedWorkflowForCredit?.audioMode ?? "native_audio";
    const planningQuote = videoCreditQuote(
      mode,
      planningAudioMode !== "voice_music",
      durationSeconds,
      outputQuality,
    );
    if (!req.user!.isAdmin && req.user!.creditsBalance < planningQuote.totalCredits) {
      const shortfall = planningQuote.totalCredits - req.user!.creditsBalance;
      throw new AppError(
        `This production needs ${planningQuote.totalCredits} credits. You have ${req.user!.creditsBalance}, so add ${shortfall} more before AI generation starts. Your saved source and references remain available, and no paid AI/provider API was used.`,
        402,
        "INSUFFICIENT_CREDITS",
      );
    }

    // Never regenerate into a completed job. A completed production is immutable
    // history; every new concept/version gets a fresh job ID and clean output
    // directory while reusing only the saved browser captures. This prevents old
    // MP4/assets from being returned as the new result.
    const existingAssets = await getAssetsByJob(job.id);
    const hasGeneratedResult = existingAssets.some(
      (asset) => asset.type === "video" || asset.type === "photo",
    );
    if (job.status === "done" || hasGeneratedResult) {
      const ownerId = req.user!.id;
      if (!ownerId)
        throw new AppError(
          "Sign in to create another version.",
          401,
          "AUTH_REQUIRED",
        );
      const source = job;
      job = await createJobFromCapture(ownerId, source);
      await copyCaptureFiles(source.id, job.id);
      const sourceMeta = source.capture_metadata as CaptureMeta | null;
      const variantLabel =
        sourceMeta?.sourceType === "studio"
          ? sourceMeta.studioKind === "product"
            ? "Fresh product direction started. Previous results remain in this conversation."
            : sourceMeta.studioKind === "scenario"
              ? "Fresh scene take started. Previous results remain in this conversation."
              : "Fresh creative direction started. Previous results remain in this conversation."
          : sourceMeta?.sourceType === "upload"
            ? "Fresh direction started from the project references. Previous results remain in this conversation."
            : "Fresh campaign direction started from the website source. Previous results remain in this conversation.";
      await addJobMessage(
        job.id,
        "assistant",
        variantLabel,
        "variant",
        { sourceJobId: source.id },
      );
    }

    // Atomically reserve the complete production budget before any paid AI or
    // media-provider call. Capture/screenshots have already happened for free.
    const reservation = await reserveGenerationCredits(
      job.id,
      req.user!.id,
      planningQuote.totalCredits,
    );
    if (!reservation.ok && reservation.reason === "insufficient_credits") {
      throw new AppError(
        `This production needs ${planningQuote.totalCredits} credits. Your available balance changed before generation could start. Add credits and try again. No paid AI/provider API was used.`,
        402,
        "INSUFFICIENT_CREDITS",
      );
    }
    if (!reservation.ok && reservation.reason === "already_started") {
      throw new AppError(
        "This production has already started. Open the existing production instead of starting it twice.",
        409,
        "PRODUCTION_ALREADY_STARTED",
      );
    }
    if (!reservation.ok && reservation.reason === "already_failed") {
      throw new AppError(
        "This production attempt is closed. Start a fresh version to try again.",
        409,
        "PRODUCTION_CLOSED",
      );
    }
    if (!reservation.ok) {
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    }

    const meta = job.capture_metadata as CaptureMeta | null;
    const plannerMode = effectiveVideoModeForMeta(meta, mode);
    const variationKey = `${job.id}:${Date.now()}:${randomUUID()}`;
    const previousWorkflow =
      job.workflow_state as Partial<JobWorkflowState> | null;
    const planningWorkflow: JobWorkflowState = {
      savedAt: Date.now(),
      stage: "storyboarding",
      mode,
      durationSeconds,
      featuresText: featuresText ?? null,
      creativeBrief: creativeBrief ?? null,
      aspectRatio,
      outputQuality,
      frameRate,
      selectedCaptureIds: selectedCaptureIds ?? [],
      audioMode: planningAudioMode,
      narrationLanguage: previousWorkflow?.narrationLanguage ?? "en",
      websiteAutoFlow: previousWorkflow?.websiteAutoFlow,
      manualRenderAfterPlan: previousWorkflow?.manualRenderAfterPlan,
      requestedDurationSeconds: previousWorkflow?.requestedDurationSeconds,
    };

    // Clear any previous storyboard so clients don't mistake stale data for the new one.
    // If this local setup fails, restore the reservation because no provider ran.
    try {
      await updateJob(job.id, {
        mode,
        vibe_brief: vibeBrief,
        status: "storyboarding",
        progress: 48,
        status_message: "Designing your scene plan",
        eta_seconds: 45,
        storyboard: null as never,
        workflow_state: planningWorkflow as unknown as Record<string, unknown>,
      });
      await addJobMessage(
        job.id,
        "user",
        `${mode} · ${vibeBrief}`,
        "creative_choice",
        {
          mode,
          vibeBrief,
          durationSeconds,
          featuresText,
          creativeBrief,
          aspectRatio,
          outputQuality,
          frameRate,
          selectedCaptureIds,
        },
      );
    } catch (setupError) {
      await refundJobCredits(
        job.id,
        req.user!.id,
        planningQuote.totalCredits,
        `Planning setup failed ${job.id}`,
      ).catch(() => {});
      await updateJob(job.id, {
        status: "captured",
        progress: 40,
        status_message: "Website preview ready",
        eta_seconds: 0,
        credits_spent: 0,
      }).catch(() => {});
      throw setupError;
    }

    // Kick off async storyboard generation
    void (async () => {
      try {
        // Load all useful real screenshots in the exact same index order that
        // the AI-video generator will later use. The planner can therefore choose
        // real starting states and real before/after interaction states that exist.
        let screenshotBase64: string | null = null;
        let fullPageBase64: string | null = null;
        try {
          const buf = await fs.readFile(
            path.join(ASSETS_DIR, job.id, "screenshot.jpg"),
          );
          screenshotBase64 = buf.toString("base64");
        } catch {
          /* no viewport screenshot cached */
        }
        try {
          const buf = await fs.readFile(
            path.join(ASSETS_DIR, job.id, "screenshot-full.jpg"),
          );
          fullPageBase64 = buf.toString("base64");
        } catch {
          /* no full-page screenshot cached */
        }

        const plannerCaptures = await loadReferenceCaptures(
          job.id,
          meta,
          aspectRatio,
          selectedCaptureIds,
        );
        if (
          selectedCaptureIds?.length &&
          plannerCaptures.filter((capture) => capture.id !== "website-icon.jpg")
            .length === 0
        ) {
          throw new Error(
            "None of the selected photos or screenshots are available. Return to media selection and choose another item.",
          );
        }

        const plannerRequest = {
          jobId: job.id,
          siteUrl: job.source_url,
          pageTitle:
            meta?.title ??
            (job.source_url.startsWith("upload://")
              ? "Uploaded media"
              : new URL(job.source_url).hostname),
          description: meta?.description ?? null,
          screenshotBase64,
          fullPageScreenshotBase64: fullPageBase64,
          referenceCaptures: plannerCaptures.map((capture) => ({
            label: capture.label,
            base64: capture.buffer.toString("base64"),
          })),
          mode: plannerMode,
          vibeBrief,
          targetDurationSeconds: durationSeconds,
          featuresText: featuresText ?? null,
          creativeBrief: creativeBrief ?? null,
          aspectRatio,
          outputQuality,
          frameRate,
          variationKey,
        };
        // Credits were atomically reserved before this point. This is the first
        // paid AI/provider call in the website flow.
        const { storyboard, aiError } = await generateStoryboard(plannerRequest);
        storyboard.sceneCaptureIds = storyboard.scenes.map((scene) =>
          (scene.sourceIndices ?? [])
            .map((sourceIndex) => plannerCaptures[sourceIndex]?.id)
            .filter((id): id is string => Boolean(id) && id !== "website-icon.jpg"),
        );
        storyboard.selectedCaptureIds = Array.from(new Set(storyboard.sceneCaptureIds.flat()));

        if (await isCancelRequested(job.id)) {
          await refundJobCredits(
            job.id,
            req.user!.id,
            planningQuote.totalCredits,
            `Cancelled before production ${job.id}`,
          ).catch(() => {});
          await updateJob(job.id, {
            status: "cancelled" as never,
            progress: 0,
            status_message: "Cancelled · credits restored",
            eta_seconds: 0,
            credits_spent: 0,
          });
          await addJobMessage(
            job.id,
            "assistant",
            "Stopped — reserved production credits were restored.",
            "cancelled",
          ).catch(() => {});
          return;
        }

        await updateJob(job.id, {
          storyboard: storyboard as never,
          status: "storyboarding",
          progress: 75,
          status_message: "Production plan ready",
          eta_seconds: 0,
          workflow_state: {
            ...planningWorkflow,
            savedAt: Date.now(),
            stage: "ready_to_render",
          },
        });
        // Tell the user, in exact terms, whenever the AI planner itself could
        // not be reached/used — a built-in backup plan still runs so
        // production isn't blocked, but the AI failure must not be hidden.
        console.info(`[storyboard] plan ready job=${job.id} requested_mode=${mode} planner_mode=${plannerMode} beats=${storyboard.scenes.length} refs=${storyboard.selectedCaptureIds?.length ?? 0}`);
        if (aiError) {
          await addJobMessage(
            job.id,
            "assistant",
            `⚠️ AI creative planning was unavailable, so a built-in backup plan was used instead. Exact reason: ${aiError}`,
            "ai_warning",
          );
        }
        await addJobMessage(
          job.id,
          "assistant",
          storyboard.concept,
          "storyboard",
          {
            sceneCount: storyboard.scenes.length,
            targetDurationSeconds: storyboard.targetDurationSeconds,
          },
        );
      } catch (err) {
        const reason = (err as Error).message;
        console.error("[storyboard] error:", reason);
        await refundJobCredits(
          job.id,
          req.user!.id,
          planningQuote.totalCredits,
          `Planning failed ${job.id}`,
        ).catch(() => {});
        await updateJob(job.id, {
          status: "failed",
          progress: 50,
          status_message: "Planning paused · credits restored",
          eta_seconds: 0,
          credits_spent: 0,
          error_message: `We couldn't finish planning your production this time. Reserved credits were restored. Exact error: ${reason}. Please try again in a moment${job.mode === "custom" ? " with a clearer idea or different reference photo." : ", or try a different page from your site."}`,
        }).catch(() => {});
      }
    })();

    res.json({
      jobId: job.id,
      status: "storyboarding",
      creditsReserved: planningQuote.totalCredits,
      creditsRemaining: reservation.remaining,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// Exact server quote used before checkout or rendering. The render endpoint
// recalculates the same quote and atomically charges it, so the client can
// never start an unaffordable long production or rely on stale arithmetic.
router.post("/:id/quote", requireAuth, async (req, res) => {
  try {
    const input = z
      .object({
        audioMode: z
          .enum(["voice_music", "native_audio", "music_only", "silent"])
          .optional()
          .default("voice_music"),
      })
      .parse(req.body);
    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at || job.user_id !== req.user!.id)
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    const storyboard = job.storyboard as Storyboard | null;
    if (!storyboard)
      throw new AppError(
        "Production plan is not ready yet.",
        400,
        "STORYBOARD_NOT_READY",
      );
    const quote = videoCreditQuote(
      job.mode,
      input.audioMode !== "voice_music",
      storyboard.targetDurationSeconds || 8,
      storyboard.outputQuality ?? "1080p",
    );
    const balance = req.user!.creditsBalance;
    const reservedCredits = Math.max(0, job.credits_spent || 0);
    const additionalRequired = Math.max(0, quote.totalCredits - reservedCredits);
    res.json({
      ...quote,
      balance,
      reservedCredits,
      additionalRequired,
      shortfall: Math.max(0, additionalRequired - balance),
      affordable: req.user!.isAdmin || balance >= additionalRequired,
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/jobs/:id/render
router.post("/:id/render", requireAuth, async (req, res) => {
  try {
    console.info(`[render] request received job=${String(req.params.id)}`);
    const operations = await getOperationsSettings();
    if (operations.maintenanceMode && !req.user?.isAdmin)
      throw new AppError(
        "Productions are temporarily paused for maintenance. Please try again shortly.",
        503,
        "MAINTENANCE_MODE",
      );
    const capacity = await productionCapacity();
    if (!req.user?.isAdmin && capacity.active >= capacity.maximum)
      throw new AppError(
        "The production queue is currently full. Please try again shortly.",
        503,
        "PRODUCTION_CAPACITY",
      );
    const renderInput = z
      .object({
        skipVoiceover: z.boolean().optional().default(false),
        audioMode: z
          .enum(["voice_music", "native_audio", "music_only", "silent"])
          .optional(),
        narrationLanguage: z
          .enum([
            "en",
            "ar",
            "fr",
            "es",
            "de",
            "it",
            "tr",
            "hi",
            "ur",
            "pt",
            "ru",
            "zh",
            "ja",
            "ko",
          ])
          .optional()
          .default("en"),
      })
      .parse(req.body);
    const audioMode: AudioMode =
      renderInput.audioMode ??
      (renderInput.skipVoiceover ? "silent" : "voice_music");
    const skipVoiceover = audioMode !== "voice_music";
    const narrationLanguage = renderInput.narrationLanguage;

    const job = await getJob(String(req.params.id));
    if (!job || job.deleted_at) throw new AppError("Job not found.", 404, "NOT_FOUND");

    // Owned jobs can only be rendered by their owner. Anonymous preview jobs
    // are claimed atomically with the credit charge below.
    if (job.user_id && job.user_id !== req.user!.id) {
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    }

    const meta = job.capture_metadata as CaptureMeta | null;
    const storyboard = job.storyboard as Storyboard | null;

    if (!storyboard)
      throw new AppError(
        "Storyboard not ready yet.",
        400,
        "STORYBOARD_NOT_READY",
      );
    const existingWorkflow = job.workflow_state as JobWorkflowState | null;
    const renderWorkflow: JobWorkflowState = {
      savedAt: Date.now(),
      stage: "rendering",
      mode: job.mode as JobWorkflowState["mode"],
      durationSeconds: storyboard.targetDurationSeconds || 8,
      featuresText: existingWorkflow?.featuresText ?? null,
      creativeBrief:
        storyboard.creativeBrief ?? existingWorkflow?.creativeBrief ?? null,
      aspectRatio:
        storyboard.aspectRatio ?? existingWorkflow?.aspectRatio ?? "16:9",
      outputQuality:
        storyboard.outputQuality ?? existingWorkflow?.outputQuality ?? "1080p",
      frameRate: storyboard.frameRate ?? existingWorkflow?.frameRate ?? 24,
      selectedCaptureIds:
        storyboard.selectedCaptureIds ??
        existingWorkflow?.selectedCaptureIds ??
        [],
      audioMode,
      narrationLanguage,
      websiteAutoFlow: existingWorkflow?.websiteAutoFlow,
      manualRenderAfterPlan: existingWorkflow?.manualRenderAfterPlan,
      requestedDurationSeconds: existingWorkflow?.requestedDurationSeconds,
    };

    // Generation is balance-based. One-time credit buyers can render without
    // being mislabeled as subscribers; the atomic claim below is the paywall.
    const targetDuration = storyboard.targetDurationSeconds || 8;
    const cost = videoCreditCost(
      job.mode,
      skipVoiceover,
      targetDuration,
      storyboard.outputQuality ?? "1080p",
    );
    const claim = await claimRenderAndSpend(job.id, req.user!.id, cost);
    if (!claim.ok && claim.reason === "already_started") {
      throw new AppError(
        "This job is already rendering or has finished.",
        409,
        "RENDER_ALREADY_STARTED",
      );
    }
    if (!claim.ok && claim.reason === "already_failed") {
      // Deliberately refuse to re-render the same job/storyboard after a
      // failure: doing so would replay the exact same edit plan and could
      // look like "the same video every time." The client must start a
      // fresh version (new job id, new storyboard, new variant seed) first.
      throw new AppError(
        "This creative plan already tried to render once and failed. Start a fresh direction to try again with a new production plan.",
        409,
        "RENDER_ALREADY_FAILED",
      );
    }
    if (
      !claim.ok &&
      (claim.reason === "not_found" || claim.reason === "not_owner")
    ) {
      throw new AppError("Job not found.", 404, "NOT_FOUND");
    }
    if (!claim.ok) {
      throw new AppError(
        `Insufficient credits. This job costs ${cost} credits. Please top up or upgrade your plan.`,
        402,
        "INSUFFICIENT_CREDITS",
      );
    }
    const remaining = claim.remaining;
    const renderStartedAt = Date.now();
    const sceneCount = Math.max(
      1,
      Math.min(MAX_REFERENCE_CAPTURES, storyboard.scenes?.length ?? 1),
    );
    const finishAllowanceSeconds = storyboard.outputQuality === "4k" ? 90 : 35;
    const continuousOps = continuousOperationCount(targetDuration);
    // One provider-generated film is created, then the SAME Veo video is
    // extended when the requested duration is longer than 8s. Estimate by
    // provider operations, not by independent scene clips.
    const initialVideoEta =
      initialAiVideoEstimate(continuousOps, finishAllowanceSeconds) +
      Math.max(0, continuousOps - 1) * 45;
    const initialPhotoEta =
      job.mode === "photos" || job.mode === "icon" || job.mode === "both"
        ? 150
        : 0;
    const initialEta = Math.max(
      job.mode === "photos" || job.mode === "icon" ? 0 : initialVideoEta,
      initialPhotoEta,
    );
    const audioLabel =
      audioMode === "voice_music"
        ? "AI narration + soundtrack"
        : audioMode === "native_audio"
          ? "cinematic scene audio"
          : audioMode === "music_only"
            ? "music only · no talking"
            : "silent master";
    const renderRequest =
      job.mode === "icon"
        ? "Generate four website icon concepts"
        : job.mode === "photos"
          ? "Generate four marketing images"
          : `Generate with ${audioLabel}`;
    await addJobMessage(job.id, "user", renderRequest, "render_request");
    await updateJob(job.id, {
      status_message: "Preparing your production",
      eta_seconds: initialEta,
      workflow_state: renderWorkflow as unknown as Record<string, unknown>,
    });

    void (async () => {
      let refundedCredits = 0;
      const refund = async (amount: number, reason: string) => {
        if (amount <= 0) return;
        const refunded = await refundJobCredits(
          job.id,
          req.user!.id,
          amount,
          reason,
        );
        refundedCredits += refunded;
      };
      // Polls independently of the various progress callbacks below (video,
      // AI video generation and photo generation report progress
      // differently) so a "Stop" click is noticed within ~2s regardless of
      // which stage is running. AI video polling also checks the same flag,
      // so Stop exits the server-side wait quickly. A remote provider may still
      // finish an already-submitted operation and bill it, but its result is
      // never kept or charged to the user's credit balance.
      let cancelledDuringRender = false;
      // Serialize render progress writes. Multiple AI scenes finish/poll in
      // parallel; without this queue an older asynchronous DB update can land
      // after a newer one and make the UI appear to move backwards or show a
      // stale status message.
      let progressWriteChain: Promise<void> = Promise.resolve();
      const publishRenderProgress = (
        patch: Parameters<typeof updateJob>[1],
      ) => {
        if (cancelledDuringRender) return;
        progressWriteChain = progressWriteChain
          .then(async () => {
            if (cancelledDuringRender) return;
            await updateJob(job.id, patch);
          })
          .catch((error) => {
            console.warn(
              `[render] job=${job.id} progress update failed: ${(error as Error).message}`,
            );
          });
      };
      const cancelWatcher = setInterval(() => {
        if (cancelledDuringRender) return;
        void isCancelRequested(job.id)
          .then((cancelled) => {
            if (!cancelled || cancelledDuringRender) return;
            cancelledDuringRender = true;
            void updateJob(job.id, {
              status: "cancelled" as never,
              status_message: "Cancelling…",
              eta_seconds: 0,
            }).catch(() => {});
          })
          .catch(() => {});
      }, 2000);
      try {
        // Reuse the same stable capture list that the AI planner saw. This is
        // what makes the planner's sourceIndices point at real browser states.
        const loadedCaptures = await loadReferenceCaptures(
          job.id,
          meta,
          storyboard.aspectRatio ?? "16:9",
          storyboard.selectedCaptureIds,
        );
        const referenceImages = loadedCaptures.map((capture) => capture.buffer);
        if (
          referenceImages.length === 0 &&
          meta?.screenshotUrl &&
          /^https?:\/\//i.test(meta.screenshotUrl)
        ) {
          // Last-resort fallback for legacy jobs whose metadata points at an
          // absolute external screenshot URL (e.g. thum.io). Local asset paths
          // were already read from disk above and cannot be fetched here.
          const res2 = await fetch(meta.screenshotUrl).catch(() => null);
          if (res2?.ok)
            referenceImages.push(Buffer.from(await res2.arrayBuffer()));
        }
        console.info(
          `[video] job=${job.id} variation=${storyboard.variantSeed ?? "n/a"} mode=${job.mode} screenshots=${referenceImages.length} storyboard_model=${storyboardModelName()} renderer=ai-video scrolling_recording_used=false`,
        );
        const siteTitle =
          meta?.title ??
          (job.mode === "custom"
            ? "Custom idea"
            : new URL(job.source_url).hostname);
        const brandOverlayLabel = !job.source_url.startsWith("upload://")
          ? new URL(job.source_url).hostname.replace(/^www\./i, "")
          : undefined;
        const concept = storyboard.concept ?? "Professional promo";
        const vibe = storyboard.vibe ?? "modern";
        const scenes = storyboard.scenes ?? [];
        const effectiveVideoMode = effectiveVideoModeForMeta(meta, job.mode);

        const wantsVideo = job.mode !== "photos" && job.mode !== "icon";
        const wantsPhotos =
          job.mode === "photos" || job.mode === "icon" || job.mode === "both";

        // Narration runs concurrently with scene-clip generation (it's only
        // actually awaited right before the final audio mix in veo.ts), so
        // it adds effectively zero wall-clock time on top of a normal render.
        // A failure here must never fail the video — it's caught and
        // reported as a note, and the render proceeds without narration.
        let narrationErrorMessage: string | null = null;
        const wantsNarration = wantsVideo && audioMode === "voice_music";
        const narrationPromise: Promise<string | null> = wantsNarration
          ? (async () => {
              try {
                const language = resolveNarrationLanguage(
                  storyboard.creativeBrief,
                  meta?.htmlLang ?? null,
                  narrationLanguage,
                );
                const script = await generateVoiceoverScript({
                  jobId: job.id,
                  siteTitle,
                  concept,
                  vibe,
                  scenes: scenes.map((scene) => ({
                    shotDescription: scene.shotDescription,
                    sceneType: scene.sceneType,
                  })),
                  targetDurationSeconds: targetDuration,
                  language,
                  creativeBrief: storyboard.creativeBrief,
                  mode: effectiveVideoMode,
                });
                const narration = await synthesizeVoiceover(
                  job.id,
                  script,
                  0,
                  effectiveVideoMode,
                );
                console.info(
                  `[voiceover] job=${job.id} language=${language.code} duration=${narration.durationSeconds.toFixed(1)}s`,
                );
                return narration.path;
              } catch (err) {
                narrationErrorMessage = (err as Error).message;
                console.warn(
                  `[voiceover] job=${job.id} unavailable: ${narrationErrorMessage}`,
                );
                return null;
              }
            })()
          : Promise.resolve(null);

        // Kick off photo + video production in parallel.
        const photoScenes =
          wantsPhotos && scenes.length > 0
            ? Array.from(
                { length: 4 },
                (_, index) => scenes[index % scenes.length],
              )
            : [];
        let completedPhotos = 0;
        const photoPromise = Promise.allSettled(
          photoScenes.map(async (scene, i) => {
            try {
              if (job.mode === "icon") {
                const iconReferences =
                  referenceImages.length > 1
                    ? [
                        referenceImages[referenceImages.length - 1],
                        ...referenceImages.slice(0, -1),
                      ]
                    : referenceImages;
                return await generateWebsiteIcon(
                  job.id,
                  i,
                  siteTitle,
                  vibe,
                  iconReferences,
                  storyboard.outputQuality ?? "1080p",
                  storyboard.creativeBrief ?? null,
                );
              }
              return await generateMarketingPhoto(
                job.id,
                i,
                siteTitle,
                concept,
                scene.shotDescription,
                scene.onScreenCopy,
                vibe,
                referenceImages,
                storyboard.aspectRatio ?? "16:9",
                storyboard.outputQuality ?? "1080p",
                storyboard.creativeBrief ?? null,
              );
            } finally {
              completedPhotos++;
              if (!wantsVideo) {
                const pct =
                  80 +
                  Math.round(
                    (completedPhotos / Math.max(1, photoScenes.length)) * 16,
                  );
                const elapsedSeconds = Math.max(
                  1,
                  (Date.now() - renderStartedAt) / 1000,
                );
                const averagePerPhoto =
                  elapsedSeconds / Math.max(1, completedPhotos);
                const photosLeft = Math.max(
                  0,
                  photoScenes.length - completedPhotos,
                );
                publishRenderProgress({
                  progress: pct,
                  status_message:
                    completedPhotos === photoScenes.length
                      ? "Finishing your files"
                      : `Creating campaign image ${completedPhotos + 1} of ${photoScenes.length}`,
                  eta_seconds:
                    completedPhotos === photoScenes.length
                      ? 10
                      : Math.max(10, Math.round(averagePerPhoto * photosLeft)),
                });
              }
            }
          }),
        );

        const videoPromise: Promise<
          PromiseSettledResult<
            Awaited<ReturnType<typeof generateMarketingVideo>>
          >
        > = wantsVideo
          ? generateMarketingVideo(
              job.id,
              siteTitle,
              {
                concept,
                vibe,
                scenes: scenes as Storyboard["scenes"],
                creativeBrief: storyboard.creativeBrief,
                aspectRatio: storyboard.aspectRatio,
                outputQuality: storyboard.outputQuality,
                frameRate: storyboard.frameRate,
                variantSeed: storyboard.variantSeed,
                targetDurationSeconds: storyboard.targetDurationSeconds ?? targetDuration,
              },
              referenceImages,
              true,
              audioMode,
              effectiveVideoMode,
              (pct, message, providerEtaSeconds) => {
                const elapsedSeconds = Math.max(
                  1,
                  (Date.now() - renderStartedAt) / 1000,
                );
                // Below this floor, pct is pinned at 81 because zero scenes
                // have actually completed yet — extrapolating remaining time
                // from "(pct-80)/14 done" divides by a near-zero fraction and
                // balloons without bound the longer the very first scene
                // takes (a real Veo generation legitimately taking a few
                // minutes could otherwise show "30+ min left"). Stay on the
                // conservative static initial estimate until at least one
                // scene has really finished and there is real throughput to
                // extrapolate from.
                let calculatedEta: number;
                if (pct <= 81) {
                  calculatedEta = Math.max(
                    8,
                    Math.min(1800, Math.round(initialEta - elapsedSeconds)),
                  );
                } else {
                  const sceneFraction = Math.max(
                    0.01,
                    Math.min(1, (pct - 80) / 14),
                  );
                  const remainingSceneSeconds =
                    pct >= 94
                      ? 0
                      : (elapsedSeconds / sceneFraction) * (1 - sceneFraction);
                  const finishingSeconds =
                    pct >= 96
                      ? finishAllowanceSeconds
                      : finishAllowanceSeconds + 20;
                  calculatedEta = Math.max(
                    8,
                    Math.min(
                      1800,
                      Math.round(remainingSceneSeconds + finishingSeconds),
                    ),
                  );
                }
                const liveEta =
                  providerEtaSeconds == null
                    ? calculatedEta
                    : Math.max(
                        8,
                        Math.min(1800, Math.round(providerEtaSeconds)),
                      );
                publishRenderProgress({
                  progress: pct,
                  status_message:
                    message ??
                    (pct >= 96
                      ? "Finishing your AI video"
                      : "Generating one continuous AI video"),
                  eta_seconds: liveEta,
                });
              },
              narrationPromise,
              loadedCaptures.map((capture) => capture.label),
              () => isCancelRequested(job.id),
              brandOverlayLabel,
            ).then(
              (value) => ({ status: "fulfilled" as const, value }),
              (reason) => ({ status: "rejected" as const, reason }),
            )
          : Promise.resolve({
              status: "rejected" as const,
              reason: new Error("not requested"),
            });

        const [photoResults, videoResult] = await Promise.all([
          photoPromise,
          videoPromise,
        ]);
        // No queued progress write may be allowed to arrive after a terminal
        // success/failure/cancel update below.
        await progressWriteChain;

        // The user clicked Stop while this was running. The provider/image
        // work above may have run to completion regardless (nothing kills it mid-flight
        // in this version), but its result must never be kept or charged for
        // once cancellation was requested — discard everything and refund
        // the full amount, rather than the normal success/failure handling.
        if (cancelledDuringRender || (await isCancelRequested(job.id))) {
          await refund(
            Math.max(0, cost - refundedCredits),
            `Cancelled render refund ${job.id}`,
          ).catch(() => {});
          // Best-effort cleanup of whatever finished generating after the
          // stop was requested — it was never registered as an asset, so
          // nothing references it, but no need to leave it on disk either.
          const orphaned = [
            ...(videoResult.status === "fulfilled"
              ? [videoResult.value.url]
              : []),
            ...photoResults.flatMap((result) =>
              result.status === "fulfilled" ? [result.value.url] : [],
            ),
          ];
          await Promise.all(
            orphaned.map((url) =>
              fs
                .rm(path.join(ASSETS_DIR, job.id, path.basename(url)), {
                  force: true,
                })
                .catch(() => {}),
            ),
          );
          await updateJob(job.id, {
            status: "cancelled" as never,
            progress: 0,
            status_message: "Cancelled",
            eta_seconds: 0,
            credits_spent: 0,
          }).catch(() => {});
          await addJobMessage(
            job.id,
            "assistant",
            "Stopped — all reserved credits for this render were restored.",
            "cancelled",
          ).catch(() => {});
          return;
        }

        let shortDeliveryNote: string | null = null;
        if (videoResult.status === "fulfilled") {
          await createAsset(
            job.id,
            "video",
            videoResult.value.url,
            videoResult.value.aspectRatio,
            false,
            true,
          );

          // Narration was requested and charged for, but couldn't be produced
          // — refund that specific surcharge and say exactly why, rather than
          // silently delivering a silent video after charging for sound.
          const finalNarrationError =
            videoResult.value.narrationError ?? narrationErrorMessage;
          if (wantsNarration && finalNarrationError) {
            await refund(
              CREDIT_COSTS.VOICEOVER,
              `Voiceover unavailable refund ${job.id}`,
            );
            const narrationNote = `Voiceover narration wasn't available for this render, so the ${CREDIT_COSTS.VOICEOVER}-credit narration charge was refunded. The AI video's own native cinematic audio remains when the selected provider generated it. Exact error: ${finalNarrationError}`;
            shortDeliveryNote = shortDeliveryNote
              ? `${shortDeliveryNote} ${narrationNote}`
              : narrationNote;
          }
        } else if (wantsVideo) {
          console.error(
            "[render] video generation failed:",
            (videoResult.reason as Error)?.message,
          );
        }

        let photoCount = 0;
        for (const result of photoResults) {
          if (result.status === "fulfilled") {
            await createAsset(
              job.id,
              "photo",
              result.value.url,
              result.value.aspectRatio,
              false,
              true,
            );
            photoCount++;
          }
        }

        const hasVideo = videoResult.status === "fulfilled";
        if (photoCount === 0 && !hasVideo) {
          const photoErr = photoResults.find((r) => r.status === "rejected") as
            PromiseRejectedResult | undefined;
          const videoErr = wantsVideo
            ? ((videoResult as PromiseRejectedResult).reason as
                Error | undefined)
            : undefined;
          const parts = [
            videoErr ? `video: ${videoErr.message}` : null,
            photoErr ? `photos: ${(photoErr.reason as Error)?.message}` : null,
          ].filter(Boolean);
          throw new Error(
            parts.length
              ? parts.join(" | ")
              : "All generation attempts failed for an unknown reason.",
          );
        }

        if (wantsPhotos && photoCount < photoScenes.length) {
          const missingPhotos = photoScenes.length - photoCount;
          const photoRefund = missingPhotos * CREDIT_COSTS.PHOTO_SINGLE;
          await refund(photoRefund, `Partial photo refund ${job.id}`);
          shortDeliveryNote = `${shortDeliveryNote ? `${shortDeliveryNote} ` : ""}${missingPhotos} photo${missingPhotos === 1 ? "" : "s"} couldn't be generated and ${photoRefund} credits were refunded.`;
        }

        // If video was requested but failed while photos succeeded, refund the
        // video portion of the charge and surface a partial note
        if (wantsVideo && !hasVideo && photoCount > 0) {
          const videoPortion = cost - CREDIT_COSTS.PHOTO_SET_4;
          await refund(videoPortion, `Video failure refund ${job.id}`);
          const videoReason = (videoResult as PromiseRejectedResult).reason as
            Error | undefined;
          await updateJob(job.id, {
            status: "done",
            progress: 100,
            status_message: "Ready to view",
            eta_seconds: 0,
            workflow_state: {
              ...renderWorkflow,
              savedAt: Date.now(),
              stage: "done",
            },
            error_message: `Video generation failed — photos were delivered instead and the video credits were refunded. Exact error: ${videoReason?.message ?? "unknown error"}. Please try again for video.${shortDeliveryNote ? ` ${shortDeliveryNote}` : ""}`,
          });
        } else {
          await updateJob(job.id, {
            status: "done",
            progress: 100,
            status_message: "Ready to view",
            eta_seconds: 0,
            workflow_state: {
              ...renderWorkflow,
              savedAt: Date.now(),
              stage: "done",
            },
            error_message: shortDeliveryNote as never,
          });
        }
        await addJobMessage(
          job.id,
          "assistant",
          shortDeliveryNote || "Your production is ready to view and download.",
          "result",
        );
        return;
      } catch (err) {
        const reason = (err as Error).message || "Unknown error";
        console.error("[render] error:", reason);
        // Refund whatever portion has not already been refunded above.
        await refund(
          Math.max(0, cost - refundedCredits),
          `Failed render refund ${job.id}`,
        ).catch((refundErr) => {
          console.error(
            "[render] refund failed:",
            (refundErr as Error).message,
          );
        });
        await updateJob(job.id, {
          status: "failed",
          status_message: "Production paused",
          eta_seconds: 0,
          credits_spent: 0,
          workflow_state: {
            ...renderWorkflow,
            savedAt: Date.now(),
            stage: "failed",
          },
          error_message: `Something went wrong while producing your files. Exact error: ${reason}. All your credits for this render have been refunded automatically — please try again with a fresh version.`,
        }).catch(() => {});
        await addJobMessage(
          job.id,
          "assistant",
          "Production paused. Reserved credits were restored and the saved chat remains available.",
          "error",
        ).catch(() => {});
      } finally {
        clearInterval(cancelWatcher);
      }
    })();

    res.json({
      jobId: job.id,
      status: "rendering",
      creditsSpent: cost,
      creditsRemaining: remaining,
    });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
