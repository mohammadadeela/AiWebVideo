import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { resolveMapsInput } from '../lib/maps-resolve.js';
import { defaultMapsDeps } from '../lib/maps-resolve-deps.js';
import { siteImageryEnabled } from '../lib/site-imagery.js';

const router = Router();
const attempts = new Map<string, { count: number; reset: number }>();

/**
 * Pin down the exact place a customer pasted: a Google Maps link (long or short), an OpenStreetMap or Apple Maps
 * link, an address, or coordinates. The answer says how sure the point is ("pin" = the place itself, "view" = only
 * where the map happened to be centred) and whether satellite/street imagery will be used for the design.
 */
router.post('/location', async (req, res) => {
  try {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now(); const previous = attempts.get(ip);
    const next = !previous || previous.reset < now ? { count: 1, reset: now + 10 * 60_000 } : { count: previous.count + 1, reset: previous.reset };
    attempts.set(ip, next);
    if (next.count > 20) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    if (attempts.size > 2000) for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
    const { link } = z.object({ link: z.string().trim().min(3).max(2048) }).parse(req.body);
    const found = await resolveMapsInput(link, defaultMapsDeps);
    if (found.precision === 'none' && !found.label) throw new AppError('Could not identify this location. Paste another Maps link, type coordinates, or add a screenshot of the plot.', 422, 'LOCATION_UNRESOLVED');
    const { trace: _trace, ...result } = found;
    res.json({ ...result, scale: 'unknown', imageryAvailable: siteImageryEnabled() });
  } catch (error) { sendError(res, error); }
});

export default router;
