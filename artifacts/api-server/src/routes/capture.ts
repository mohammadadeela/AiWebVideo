import { Router } from 'express';
import { z } from 'zod';
import { getOperationsSettings, productionCapacity } from '../lib/provider-config.js';
import { addJobMessage, createAsset, createJob, isCancelRequested, updateJob } from '../lib/queries.js';
import { validateUrl, SsrfError } from '../lib/ssrf.js';
import { captureSite } from '../lib/capture.js';
import { tryAuth } from '../lib/auth.js';
import { AppError, sendError } from '../lib/errors.js';

const router = Router();

const CaptureBody = z.object({
  url: z.string().url().min(1),
});

const CAPTURE_WINDOW_MS = 10 * 60 * 1000;
const CAPTURE_LIMIT = 5;
const captureAttempts = new Map<string, { count: number; resetAt: number }>();

function allowCapture(ip: string) {
  const now = Date.now();
  const current = captureAttempts.get(ip);
  if (!current || current.resetAt <= now) {
    captureAttempts.set(ip, { count: 1, resetAt: now + CAPTURE_WINDOW_MS });
    return true;
  }
  if (current.count >= CAPTURE_LIMIT) return false;
  current.count++;
  if (captureAttempts.size > 2000) {
    for (const [key, value] of captureAttempts) if (value.resetAt <= now) captureAttempts.delete(key);
  }
  return true;
}

router.post('/', tryAuth, async (req, res) => {
  try {
    const operations = await getOperationsSettings();
    if (operations.maintenanceMode && !req.user?.isAdmin) throw new AppError('Productions are temporarily paused for maintenance. Please try again shortly.', 503, 'MAINTENANCE_MODE');
    const capacity = await productionCapacity();
    if (!req.user?.isAdmin && capacity.active >= capacity.maximum) throw new AppError('The production queue is currently full. Please try again shortly.', 503, 'PRODUCTION_CAPACITY');
    if (!allowCapture(req.ip ?? req.socket.remoteAddress ?? 'unknown')) {
      throw new AppError('Too many capture requests. Please wait a few minutes and try again.', 429, 'RATE_LIMITED');
    }
    const { url } = CaptureBody.parse(req.body);

    // SSRF protection
    let safeUrl: string;
    try {
      safeUrl = await validateUrl(url);
    } catch (err) {
      if (err instanceof SsrfError) throw new AppError(err.message, 400, 'SSRF_BLOCKED');
      throw err;
    }

    const userId = req.user?.id ?? null;
    const job = await createJob(userId, safeUrl, 'video');
    await addJobMessage(job.id, 'user', safeUrl, 'url');
    await addJobMessage(job.id, 'assistant', 'Reading the website and saving its pages, screenshots, and scrolling capture.', 'status');

    // The job starts in "capturing" before the response is returned, so the
    // customer never sits on a fake 0% queue while work has already begun.
    const runCapture = async () => {
      try {
        const captureMetadata = await captureSite(job.id, safeUrl, async (progress, message, etaSeconds) => {
          // Cooperative cancellation checkpoint: onProgress fires ~10 times
          // during a capture, so a "Stop" click is noticed within a couple
          // of seconds. Capture never spends credits, so no refund is needed
          // here — just stop the browser work and settle the job.
          if (await isCancelRequested(job.id)) throw new Error('JOB_CANCELLED');
          await updateJob(job.id, {
            status: 'capturing', progress,
            status_message: message, eta_seconds: etaSeconds,
          });
        });

        await updateJob(job.id, {
          status: 'captured' as never,
          progress: 40,
          status_message: 'Website capture complete',
          eta_seconds: 0,
          title: captureMetadata.title || new URL(safeUrl).hostname,
          capture_metadata: captureMetadata as unknown as Record<string, unknown>,
        });
        // Register capture files immediately so they remain discoverable as
        // durable project assets even when the user never starts a render.
        await createAsset(job.id, 'screenshot', captureMetadata.screenshotUrl, '16:9', false, true);
        await createAsset(job.id, 'screenshot', captureMetadata.fullPageScreenshotUrl, null, false, true);
        if (captureMetadata.mobileScreenshotUrl) {
          await createAsset(job.id, 'screenshot', captureMetadata.mobileScreenshotUrl, '9:16', false, true);
        }
        if (captureMetadata.mobileFullPageScreenshotUrl) {
          await createAsset(job.id, 'screenshot', captureMetadata.mobileFullPageScreenshotUrl, '9:16', false, true);
        }
        for (const page of captureMetadata.pages.slice(1)) {
          await createAsset(job.id, 'screenshot', page.screenshotUrl, null, false, true);
        }
        if (captureMetadata.recordingUrl) {
          await createAsset(job.id, 'recording', captureMetadata.recordingUrl, '16:9', false, true);
        }
        await addJobMessage(
          job.id,
          'assistant',
          `Website capture saved with ${captureMetadata.pageCount} page${captureMetadata.pageCount === 1 ? '' : 's'}.`,
          'capture',
          {
            pageCount: captureMetadata.pageCount,
            screenshotUrl: captureMetadata.screenshotUrl,
            mobileScreenshotUrl: captureMetadata.mobileScreenshotUrl,
            recordingUrl: captureMetadata.recordingUrl,
          }
        );
      } catch (err) {
        if ((err as Error).message === 'JOB_CANCELLED') {
          await updateJob(job.id, { status: 'cancelled' as never, progress: 0, status_message: 'Cancelled', eta_seconds: 0 }).catch(() => {});
          await addJobMessage(job.id, 'assistant', 'Stopped — no credits were spent on this capture.', 'cancelled').catch(() => {});
          return;
        }
        console.error('[capture] async error:', (err as Error).message);
        const message = (err as Error).message;
        const timedOut = message === 'CAPTURE_TIMEOUT';
        // Chromium's network error codes for a broken/mismatched TLS
        // certificate on the TARGET site — Playwright correctly refuses to
        // load a page whose certificate doesn't validate, the same way any
        // browser would. This is not a bug in this app; it's almost always
        // the target website's own SSL misconfiguration (e.g. a certificate
        // issued only for "www.example.com" while "example.com" itself, or
        // vice versa, gets served the mismatched cert). Detected separately
        // from the generic failure case so the error message tells the site
        // owner what's actually wrong and who needs to fix it.
        const certError = /ERR_CERT_|ERR_SSL_PROTOCOL_ERROR|net::ERR_CERT/i.test(message);
        await updateJob(job.id, {
          status: 'failed',
          progress: 0,
          status_message: timedOut ? 'Website took too long to respond' : certError ? "Website's SSL certificate is invalid" : 'Website capture paused',
          eta_seconds: 0,
          error_message: timedOut
            ? 'This website did not finish loading in time. Nothing was charged. Try the homepage or a lighter page.'
            : certError
              ? "This website's SSL certificate is invalid or doesn't match its domain (a browser security check, not a limitation of this tool). Nothing was charged. This needs to be fixed on the website's own hosting/DNS — check that its certificate covers both the www and non-www versions of the domain, then try again."
              : 'We could not finish reading this website. Nothing was charged. Check that the page is public, then try again.',
        }).catch(() => {});
      }
    };
    setImmediate(() => void runCapture());

    res.json({ jobId: job.id, status: 'capturing' });
  } catch (err) {
    sendError(res, err);
  }
});

export default router;
