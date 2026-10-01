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
    const { link } = z.object({ link: z.string().trim().min(3).max(2048) }).parse(req.body);
    let url: URL | null = /^https?:\/\//i.test(link) ? new URL(link) : null;
    if (url && !isGoogleMapsUrl(url.toString())) throw new AppError('Paste a Google Maps link or address.', 400, 'INVALID_MAP_LINK');
    for (let redirects = 0; url && redirects < 4 && (url.hostname === 'maps.app.goo.gl' || url.hostname === 'goo.gl'); redirects++) {
      const safe = await validateUrl(url.toString());
      const response = await fetch(safe, { method: 'GET', redirect: 'manual', signal: AbortSignal.timeout(8000), headers: { 'User-Agent': 'AiWebVideo/1.0' } });
      const next = response.headers.get('location');
      await response.body?.cancel();
      if (!next || ![301, 302, 303, 307, 308].includes(response.status)) break;
      url = new URL(next, url);
      if (!isGoogleMapsUrl(url.toString())) throw new AppError('The map link redirects outside Google Maps.', 400, 'INVALID_MAP_LINK');
    }
    let position = url ? coordinatesFromMapsUrl(url) : null;
    const place = url?.pathname.match(/\/place\/([^/]+)/)?.[1];
    let label = (url ? url.searchParams.get('q') || url.searchParams.get('query') : link)?.slice(0, 150) || null;
    if (place) { try { label = decodeURIComponent(place.replace(/\+/g, ' ')).slice(0, 150); } catch { label = place.slice(0, 150); } }
    // Coordinates in a Maps URL are authoritative for location only. For
    // place names/addresses, use Google's server-side geocoder when configured.
    // It does not supply parcel boundaries or measured building dimensions.
    const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
    if (!position && label && key) {
      const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json');
      endpoint.searchParams.set('address', label);
      endpoint.searchParams.set('key', key);
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000), redirect: 'error' });
      if (response.ok) {
        const data = await response.json() as { status?: string; results?: Array<{ formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }> };
        const result = data.status === 'OK' ? data.results?.[0] : null;
        const latitude = result?.geometry?.location?.lat, longitude = result?.geometry?.location?.lng;
        if (typeof latitude === 'number' && typeof longitude === 'number'
          && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180) {
          position = { latitude, longitude, precision: 'pin' };
          label = result?.formatted_address?.slice(0, 150) || label;
        }
      }
    }
    if (!position && !label) throw new AppError('Could not identify this location. Paste another Maps link or add a site screenshot.', 422, 'LOCATION_UNRESOLVED');
    res.json({ ...position, label, resolvedUrl: url?.toString() ?? '', scale: 'unknown', imageryAvailable: false, precision: position?.precision ?? 'none' });
  } catch (error) { sendError(res, error); }
});

export default router;
