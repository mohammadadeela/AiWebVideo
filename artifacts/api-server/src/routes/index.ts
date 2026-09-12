import { Router } from 'express';
import captureRouter from './capture.js';
import uploadsRouter from './uploads.js';
import jobsRouter from './jobs.js';
import userRouter from './user.js';
import paypalRouter from './paypal.js';
import growthRouter, { settleGrowthCredits } from './growth.js';
import adminRouter from './admin.js';
import * as path from 'path';
import * as fs from 'fs';
import { Readable } from 'node:stream';
import { ASSETS_DIR } from '../lib/capture.js';
import { getMarketingSettings } from '../lib/marketing.js';
import { verifyPrivateAssetSignature } from '../lib/asset-access.js';
import { getR2Object } from '../lib/r2-storage.js';
import { requireAuth } from '../lib/auth.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// GET /api/marketing — public, read-only landing-page videos. Prices and plan
// copy are fixed in the application and are never loaded from this setting.
router.get('/marketing', async (_req, res) => {
  try {
    const settings = await getMarketingSettings();
    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.removeHeader('Pragma');
    res.json(settings);
  } catch {
    // Never break the landing page over this — fall back to "nothing configured yet".
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=60');
    res.removeHeader('Pragma');
    res.json({ heading: 'Made with AiWebVideo', description: 'See short examples created by people using the studio.', videos: { showcase: [] } });
  }
});

// Serve generated image assets
router.get('/assets/:jobId/:filename', async (req, res) => {
  const { jobId, filename } = req.params;
  // Basic path traversal protection
  if (!/^(?:[0-9a-f-]{36}|marketing)$/i.test(jobId) || !/^[a-z0-9][a-z0-9._-]{0,180}$/i.test(filename)) {
    res.status(400).json({ error: 'Invalid path.' });
    return;
  }
  if (jobId.toLowerCase() !== 'marketing' && !verifyPrivateAssetSignature(jobId, filename, req.query.expires, req.query.sig)) {
    res.status(403).json({ error: 'This media link is invalid or expired.', code: 'ASSET_LINK_EXPIRED' });
    return;
  }
  const filePath = path.join(ASSETS_DIR, jobId, filename);
  const cacheControl = jobId.toLowerCase() === 'marketing'
    ? 'public, max-age=3600, stale-while-revalidate=86400'
    : 'private, max-age=300, no-transform';

  // Keep the VPS copy as a hot processing/cache layer when it exists. R2 is
  // the durable source, so a restart or local cleanup no longer loses media.
  if (fs.existsSync(filePath)) {
    res.setHeader('Accept-Ranges', 'bytes');
    if (req.query.download === '1') {
      res.setHeader('Cache-Control', 'private, no-store');
      res.download(filePath, filename, (error) => {
        if (error && !res.headersSent) res.status(500).json({ error: 'Download failed.' });
      });
      return;
    }
    res.setHeader('Cache-Control', cacheControl);
    res.removeHeader('Pragma');
    res.sendFile(filePath);
    return;
  }

  try {
    const range = typeof req.headers.range === 'string' ? req.headers.range : null;
    const object = await getR2Object(jobId, filename, range);
    if (!object || object.status === 404) {
      res.status(404).json({ error: 'Asset not found.' });
      return;
    }
    if (!object.ok || !object.body) {
      console.error(`[r2] asset read failed job=${jobId} file=${filename} status=${object.status}`);
      res.status(502).json({ error: 'Asset storage is temporarily unavailable.' });
      return;
    }

    for (const header of ['content-type', 'content-length', 'content-range', 'etag', 'last-modified']) {
      const value = object.headers.get(header);
      if (value) res.setHeader(header, value);
    }
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', req.query.download === '1' ? 'private, no-store' : cacheControl);
    res.removeHeader('Pragma');
    if (req.query.download === '1') {
      res.setHeader('Content-Disposition', `attachment; filename="${filename.replace(/["\r\n]/g, '_')}"`);
    }
    res.status(object.status);
    Readable.fromWeb(object.body as never).pipe(res);
  } catch (error) {
    console.error(`[r2] asset read error job=${jobId} file=${filename}: ${(error as Error).message}`);
    if (!res.headersSent) res.status(502).json({ error: 'Asset storage is temporarily unavailable.' });
  }
});

// Every ordinary account refresh settles one-time growth grants first. The
// grants are idempotent and server-owned, so the browser cannot mint credits.
// Refresh the authenticated request snapshot too, so the very first /user/me
// after signup already returns the 50 customer-facing Starter Credits.
router.get('/user/me', requireAuth, async (req, _res, next) => {
  await settleGrowthCredits(req.user!.id)
    .then((growth) => {
      if (growth) req.user!.creditsBalance = growth.balanceInternal;
    })
    .catch((error) => {
      console.warn(`[growth] could not settle account ${req.user!.id}: ${(error as Error).message}`);
    });
  next();
});

router.use('/capture', captureRouter);
router.use('/uploads', uploadsRouter);
router.use('/jobs', jobsRouter);
router.use('/user', userRouter);
router.use('/auth', userRouter);   // /api/auth/login, /register, /firebase
router.use('/paypal', paypalRouter);
router.use('/growth', growthRouter);
router.use('/admin', adminRouter);

export default router;