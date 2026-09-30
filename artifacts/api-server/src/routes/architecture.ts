import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { validateUrl } from '../lib/ssrf.js';
import { coordinatesFromMapsUrl, isGoogleMapsUrl } from '../lib/maps-url.js';

const router = Router();
const attempts = new Map<string, { count: number; reset: number }>();

router.post('/location', async (req, res) => {
  try {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now(); const previous = attempts.get(ip);
    const next = !previous || previous.reset < now ? { count: 1, reset: now + 10 * 60_000 } : { count: previous.count + 1, reset: previous.reset };
    attempts.set(ip, next);
    if (next.count > 20) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    if (attempts.size > 2000) for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
    const { link } = z.object({ link: z.string().trim().url().max(2048) }).parse(req.body);
    let url = new URL(link);
    if (!isGoogleMapsUrl(url.toString())) throw new AppError('Paste a Google Maps link.', 400, 'INVALID_MAP_LINK');
    for (let redirects = 0; redirects < 4 && url.hostname === 'maps.app.goo.gl'; redirects++) {
      const safe = await validateUrl(url.toString());
      const response = await fetch(safe, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AiWebVideo/1.0' } });
      const next = response.headers.get('location');
      await response.body?.cancel();
      if (!next || ![301, 302, 303, 307, 308].includes(response.status)) break;
      url = new URL(next, url);
      if (!isGoogleMapsUrl(url.toString())) throw new AppError('The map link redirects outside Google Maps.', 400, 'INVALID_MAP_LINK');
    }
    const position = coordinatesFromMapsUrl(url);
    const place = url.pathname.match(/\/place\/([^/]+)/)?.[1];
    let label = url.searchParams.get('q')?.slice(0, 150) || null;
    if (place) { try { label = decodeURIComponent(place.replace(/\+/g, ' ')).slice(0, 150); } catch { label = place.slice(0, 150); } }
    if (!position && !label) throw new AppError('Could not identify this location. Paste another Maps link or add a site screenshot.', 422, 'LOCATION_UNRESOLVED');
    res.json({ ...position, label, resolvedUrl: url.toString(), scale: 'unknown', imageryAvailable: false });
  } catch (error) { sendError(res, error); }
});

export default router;
