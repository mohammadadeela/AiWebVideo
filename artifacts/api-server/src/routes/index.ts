import { Router } from 'express';
import captureRouter from './capture.js';
import jobsRouter from './jobs.js';
import userRouter from './user.js';
import stripeRouter from './stripe.js';
import adminRouter from './admin.js';
import * as path from 'path';
import * as fs from 'fs';
import { ASSETS_DIR } from '../lib/capture.js';

const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok', ts: new Date().toISOString() });
});

// Serve generated image assets
router.get('/assets/:jobId/:filename', (req, res) => {
  const { jobId, filename } = req.params;
  // Basic path traversal protection
  if (jobId.includes('..') || filename.includes('..') || filename.includes('/')) {
    res.status(400).json({ error: 'Invalid path.' });
    return;
  }
  const filePath = path.join(ASSETS_DIR, jobId, filename);
  if (!fs.existsSync(filePath)) {
    res.status(404).json({ error: 'Asset not found.' });
    return;
  }
  res.sendFile(filePath);
});

router.use('/capture', captureRouter);
router.use('/jobs', jobsRouter);
router.use('/user', userRouter);
router.use('/auth', userRouter);   // /api/auth/login, /register, /firebase
router.use('/stripe', stripeRouter);
router.use('/admin', adminRouter);

export default router;
