import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { readPublicUrl } from '../lib/external-reference.js';
import { validateUrl } from '../lib/ssrf.js';
import { parseProductPage } from '../lib/product-html.js';

const router = Router();
const attempts = new Map<string, { count: number; reset: number }>();
router.post('/extract', async (req, res) => {
  try {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now(); const previous = attempts.get(ip);
    const next = !previous || previous.reset < now ? { count: 1, reset: now + 10 * 60_000 } : { count: previous.count + 1, reset: previous.reset };
    attempts.set(ip, next);
    if (next.count > 10) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    if (attempts.size > 2000) for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
    const { url } = z.object({ url: z.string().trim().url().max(2048) }).parse(req.body);
    const fetched = await readPublicUrl(url, 6 * 1024 * 1024, /^(?:text\/html|application\/xhtml\+xml)$/);
    const parsed = parseProductPage(fetched.buffer.toString('utf8'), fetched.url);
    // Only images that pass the public-address check are offered to the browser and later downloaded.
    const images = (await Promise.all(parsed.images.map((candidate) => validateUrl(candidate).catch(() => null))))
      .filter((value): value is string => Boolean(value)).slice(0, 8);
    if (!images.length) throw new AppError('Could not find product images. Upload product images instead.', 422, 'PRODUCT_IMAGES_MISSING');
    res.json({ title: parsed.title, description: parsed.description, url: fetched.url, images });
  } catch (error) { sendError(res, error); }
});
export default router;
