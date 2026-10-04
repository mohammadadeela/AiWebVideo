import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { resolveMapsInput } from '../lib/maps-resolve.js';
import { defaultMapsDeps } from '../lib/maps-resolve-deps.js';
import { siteImageryEnabled } from '../lib/site-imagery.js';
import { tryAuth } from '../lib/auth.js';
import { CAMERA_LIMITS, fetchStreetViewImage, fetchStreetViewMeta } from '../lib/street-view.js';

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

// Street View for the page. Each look costs Google a request, so it has its own allowance. The key stays on the server:
// the page gets metadata and pictures, never a URL that contains it.
const viewAttempts = new Map<string, { count: number; reset: number }>();
function allowStreetView(ip: string): boolean {
  const now = Date.now();
  const current = viewAttempts.get(ip);
  if (!current || current.reset < now) { viewAttempts.set(ip, { count: 1, reset: now + 10 * 60_000 }); return true; }
  if (current.count >= 150) return false;
  current.count += 1;
  if (viewAttempts.size > 2000) for (const [key, value] of viewAttempts) if (value.reset < now) viewAttempts.delete(key);
  return true;
}

/** Is there Street View at the plot, from which panorama, how old, and which way does it have to look to face the plot? */
router.get('/street-view', tryAuth, async (req, res) => {
  try {
    const { lat, lng } = z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }).parse(req.query);
    if (!siteImageryEnabled()) {
      // Only the site owner is told what is missing; customers just see that Street View is not offered.
      const reason = res.locals.isAdmin === true
        ? (process.env.ARCHITECTURE_MAPS_IMAGERY !== '1' ? 'ARCHITECTURE_MAPS_IMAGERY is not set to 1' : 'GOOGLE_MAPS_API_KEY is not set')
        : undefined;
      res.json({ enabled: false, available: false, ...(reason ? { reason } : {}) });
      return;
    }
    if (!allowStreetView(req.ip ?? req.socket.remoteAddress ?? 'unknown')) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    const meta = await fetchStreetViewMeta({ latitude: lat, longitude: lng });
    if (!meta) { res.json({ enabled: true, available: false }); return; }
    const captured = /^(\d{4})-(\d{1,2})$/.exec(meta.date ?? '');
    const ageYears = captured ? Number(((Date.now() - Date.UTC(Number(captured[1]), Number(captured[2]) - 1, 1)) / (365.25 * 86_400_000)).toFixed(1)) : null;
    res.json({ enabled: true, available: true, panoId: meta.panoId, date: meta.date, dateLabel: meta.dateLabel, ageYears, distanceM: meta.distanceM, headingToPlot: meta.headingToPlot });
  } catch (error) { sendError(res, error); }
});

/** One Street View picture (a panorama and a compass heading), served through the server. */
router.get('/street-view/image', async (req, res) => {
  try {
    const query = z.object({
      pano: z.string().regex(/^[A-Za-z0-9_-]{10,64}$/),
      heading: z.coerce.number().min(0).max(360),
      fov: z.coerce.number().min(CAMERA_LIMITS.fov.min).max(CAMERA_LIMITS.fov.max).optional(),
      pitch: z.coerce.number().min(CAMERA_LIMITS.pitch.min).max(CAMERA_LIMITS.pitch.max).optional(),
    }).parse(req.query);
    if (!siteImageryEnabled()) throw new AppError('Street View is not switched on.', 404, 'STREET_VIEW_OFF');
    if (!allowStreetView(req.ip ?? req.socket.remoteAddress ?? 'unknown')) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    const picture = await fetchStreetViewImage({ panoId: query.pano, heading: query.heading, fov: query.fov, pitch: query.pitch });
    if (!picture) throw new AppError('Street View is not available for this view right now.', 502, 'STREET_VIEW_UNAVAILABLE');
    res.set({ 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=600', 'X-Content-Type-Options': 'nosniff' }).send(picture);
  } catch (error) { sendError(res, error); }
});

export default router;
