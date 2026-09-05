import { Router } from 'express';
import captureRouter from './capture.js';
import uploadsRouter from './uploads.js';
import jobsRouter from './jobs.js';
import userRouter from './user.js';
import paypalRouter from './paypal.js';
import adminRouter from './admin.js';
import * as path from 'path';
import * as fs from 'fs';
import { ASSETS_DIR } from '../lib/capture.js';
import { getMarketingSettings } from '../lib/marketing.js';
import { verifyPrivateAssetSignature } from '../lib/asset-access.js';

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
router.get('/assets/:jobId/:filename', (req, res) => {
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
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Asset not found.' });
    return;
  }
  // Playback stays range/stream friendly through sendFile. Explicit exports
  // use Content-Disposition so the browser begins a real streamed download
  // immediately instead of the frontend buffering the whole file first.
  res.setHeader('Accept-Ranges', 'bytes');
  if (req.query.download === '1') {
    res.setHeader('Cache-Control', 'private, no-store');
    res.download(filePath, filename, (error) => {
      if (error && !res.headersSent) res.status(500).json({ error: 'Download failed.' });
    });
    return;
  }
  res.setHeader(
    'Cache-Control',
    jobId.toLowerCase() === 'marketing'
      ? 'public, max-age=3600, stale-while-revalidate=86400'
      : 'private, max-age=300, no-transform',
  );
  res.removeHeader('Pragma');
  res.sendFile(filePath);
});

router.use('/capture', captureRouter);
router.use('/uploads', uploadsRouter);
router.use('/jobs', jobsRouter);
router.use('/user', userRouter);
router.use('/auth', userRouter);   // /api/auth/login, /register, /firebase
router.use('/paypal', paypalRouter);
router.use('/admin', adminRouter);

export default router;
