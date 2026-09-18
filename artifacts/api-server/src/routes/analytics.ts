import { Router } from 'express';
import { z } from 'zod';
import { ensureGrowthAnalyticsSchema, recordGrowthEvent } from '../lib/growth-analytics.js';

const router = Router();
const eventSchema = z.object({
  event: z.string().trim().min(1).max(80), sessionId: z.string().trim().max(180).optional(),
  path: z.string().trim().max(500).optional(), referrer: z.string().trim().max(1000).optional(),
  landingPage: z.string().trim().max(500).optional(), deviceClass: z.string().trim().max(30).optional(),
  utmSource: z.string().trim().max(180).optional(), utmMedium: z.string().trim().max(180).optional(),
  utmCampaign: z.string().trim().max(180).optional(), metadata: z.record(z.string(), z.unknown()).optional(),
});
void ensureGrowthAnalyticsSchema().catch((error) => console.warn(`[growth-analytics] schema setup deferred: ${(error as Error).message}`));

router.post('/events', async (req, res) => {
  try { await recordGrowthEvent(eventSchema.parse(req.body ?? {})); res.status(204).end(); }
  catch (error) { res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid analytics event.' }); }
});
export default router;