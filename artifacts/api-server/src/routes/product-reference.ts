import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { readProductReference } from '../lib/product-reference-service.js';

const router = Router();
const attempts = new Map<string, { count: number; reset: number }>();
router.post('/extract', async (req, res) => {
  try {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now(); const previous = attempts.get(ip);
    const next = !previous || previous.reset < now ? { count: 1, reset: now + 10 * 60_000 } : { count: previous.count + 1, reset: previous.reset };
    attempts.set(ip, next);
    if (next.count > 30) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    if (attempts.size > 2000) for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
    const { url } = z.object({ url: z.string().trim().url().max(2048) }).parse(req.body);
    const product = await readProductReference(url);
    res.json({ title: product.title, description: product.description, url: product.url, images: product.images, facts: product.facts, source: product.source });
  } catch (error) { sendError(res, error); }
});
export default router;
