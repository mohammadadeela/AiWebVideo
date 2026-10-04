import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { readProductReferenceCached } from '../lib/product-reference-service.js';

const router = Router();
const attempts = new Map<string, { count: number; reset: number }>();
/** Reading a product link can start a real browser: only a few reads run at once, the rest are asked to wait a moment. */
const MAX_CONCURRENT_READS = 6;
let activeReads = 0;
router.post('/extract', async (req, res) => {
  let counted = false;
  try {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now(); const previous = attempts.get(ip);
    const next = !previous || previous.reset < now ? { count: 1, reset: now + 10 * 60_000 } : { count: previous.count + 1, reset: previous.reset };
    attempts.set(ip, next);
    if (next.count > 30) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    if (attempts.size > 2000) for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
    const { url } = z.object({ url: z.string().trim().url().max(2048) }).parse(req.body);
    if (activeReads >= MAX_CONCURRENT_READS) throw new AppError('Many product links are being read right now. Try again in a moment.', 429, 'PRODUCT_BUSY');
    activeReads += 1; counted = true;
    const product = await readProductReferenceCached(url);
    res.json({ title: product.title, description: product.description, url: product.url, images: product.images, facts: product.facts, source: product.source, status: product.status });
  } catch (error) { sendError(res, error); } finally { if (counted) activeReads -= 1; }
});
export default router;
