import { validateUrl } from './ssrf.js';
import type { MapsDeps, PageFetch } from './maps-resolve.js';

const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

/** One Google request, redirects NOT followed, public addresses only. Presents itself like a browser that accepted consent. */
async function fetchPage(target: string): Promise<PageFetch> {
  const safe = await validateUrl(target);
  const response = await fetch(safe, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(9_000),
    headers: { 'User-Agent': BROWSER_UA, 'Accept-Language': 'en-US,en;q=0.9', Accept: 'text/html,application/xhtml+xml', Cookie: 'CONSENT=YES+cb; SOCS=CAI' },
  });
  const location = response.headers.get('location');
  let body = '';
  if (!location && response.ok) body = (await response.text()).slice(0, 400_000);
  else await response.body?.cancel();
  return { status: response.status, location, body };
}

/** Address / place-name lookup. Needs a Google key (GOOGLE_MAPS_SERVER_API_KEY); without one it returns null. */
async function geocode(text: string) {
  const key = process.env.GOOGLE_MAPS_SERVER_API_KEY;
  if (!key) return null;
  const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  endpoint.searchParams.set('address', text);
  endpoint.searchParams.set('key', key);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(8_000), redirect: 'error' });
  if (!response.ok) return null;
  const data = await response.json() as { status?: string; results?: Array<{ formatted_address?: string; geometry?: { location?: { lat: number; lng: number } } }> };
  const result = data.status === 'OK' ? data.results?.[0] : null;
  const latitude = result?.geometry?.location?.lat; const longitude = result?.geometry?.location?.lng;
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return null;
  return { latitude, longitude, label: result?.formatted_address?.slice(0, 150) ?? null };
}

export const defaultMapsDeps: MapsDeps = { fetchPage, geocode };
