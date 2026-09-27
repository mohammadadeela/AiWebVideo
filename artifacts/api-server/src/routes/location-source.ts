import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';

const router = Router();

function coordinatesFromText(value: string) {
  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /[?&](?:q|query|center)=(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/i,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) return { lat, lng };
  }
  return null;
}

function approvedMapsHost(hostname: string) {
  const host = hostname.toLowerCase();
  return host === 'maps.app.goo.gl' || host === 'goo.gl' || host === 'google.com' || host.endsWith('.google.com');
}

async function resolveMapsRedirect(raw: string) {
  let current = raw;
  for (let i = 0; i < 5; i += 1) {
    const parsed = new URL(current);
    if (!approvedMapsHost(parsed.hostname)) throw new Error('Only Google Maps links or a written address are supported.');
    const direct = coordinatesFromText(current);
    if (direct) return { ...direct, resolvedUrl: current };
    const response = await fetch(current, {
      method: 'GET',
      redirect: 'manual',
      signal: AbortSignal.timeout(8_000),
      headers: { 'user-agent': 'Mozilla/5.0 (compatible; AiWebVideoLocationResolver/1.0)' },
    });
    const location = response.headers.get('location');
    if (!location) return { resolvedUrl: current, ...coordinatesFromText(current) };
    current = new URL(location, current).toString();
  }
  return { resolvedUrl: current, ...coordinatesFromText(current) };
}

router.post('/preview', requireAuth, async (req, res) => {
  const input = z.object({ location: z.string().min(3).max(2_000) }).parse(req.body);
  const apiKey = process.env.GOOGLE_MAPS_API_KEY?.trim();
  if (!apiKey) {
    res.status(503).json({
      error: 'Architecture location preview is not configured yet. Add GOOGLE_MAPS_API_KEY on the server.',
      code: 'MAPS_NOT_CONFIGURED',
    });
    return;
  }

  let coordinates = coordinatesFromText(input.location);
  let label = input.location.trim();
  if (!coordinates && /^https?:\/\//i.test(input.location)) {
    try {
      const resolved = await resolveMapsRedirect(input.location);
      coordinates = resolved.lat != null && resolved.lng != null ? { lat: resolved.lat, lng: resolved.lng } : null;
      label = resolved.resolvedUrl;
    } catch (error) {
      res.status(422).json({ error: (error as Error).message, code: 'MAPS_LINK_INVALID' });
      return;
    }
  }

  if (!coordinates) {
    const geocodeUrl = new URL('https://maps.googleapis.com/maps/api/geocode/json');
    geocodeUrl.searchParams.set('address', label);
    geocodeUrl.searchParams.set('key', apiKey);
    const geocode = await fetch(geocodeUrl, { signal: AbortSignal.timeout(10_000) });
    const payload = await geocode.json() as {
      status?: string;
      results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }>;
    };
    const first = payload.results?.[0];
    const lat = Number(first?.geometry?.location?.lat);
    const lng = Number(first?.geometry?.location?.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(422).json({ error: 'Could not resolve that address or Google Maps link.', code: 'LOCATION_NOT_FOUND' });
      return;
    }
    coordinates = { lat, lng };
    label = first?.formatted_address || label;
  }

  const staticUrl = new URL('https://maps.googleapis.com/maps/api/staticmap');
  staticUrl.searchParams.set('center', String(coordinates.lat) + ',' + String(coordinates.lng));
  staticUrl.searchParams.set('zoom', '19');
  staticUrl.searchParams.set('size', '640x640');
  staticUrl.searchParams.set('scale', '2');
  staticUrl.searchParams.set('maptype', 'satellite');
  staticUrl.searchParams.set('key', apiKey);
  const image = await fetch(staticUrl, { signal: AbortSignal.timeout(12_000) });
  if (!image.ok) {
    res.status(502).json({ error: 'Google Maps could not provide the satellite reference.', code: 'MAPS_IMAGE_UNAVAILABLE' });
    return;
  }
  const type = image.headers.get('content-type')?.split(';')[0] || 'image/jpeg';
  const bytes = Buffer.from(await image.arrayBuffer());
  if (bytes.length > 6 * 1024 * 1024) {
    res.status(413).json({ error: 'Location reference image is unexpectedly large.', code: 'MAPS_IMAGE_TOO_LARGE' });
    return;
  }

  res.json({
    label,
    lat: coordinates.lat,
    lng: coordinates.lng,
    imageDataUrl: 'data:' + type + ';base64,' + bytes.toString('base64'),
    disclaimer: 'AI visualization for concept purposes — not a surveyed or construction-accurate plan.',
  });
});

export default router;
