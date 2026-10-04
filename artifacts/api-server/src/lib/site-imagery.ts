/**
 * OPTIONAL map imagery for an architecture site: a satellite view and Google Street View (three views of the street, aimed
 * at the plot, from one panorama; see street-view.ts).
 *
 * OFF by default. It runs only when BOTH `ARCHITECTURE_MAPS_IMAGERY=1` and `GOOGLE_MAPS_API_KEY` are set.
 * Google's Maps Platform terms restrict how its imagery may be stored, derived from and shown, and using it as
 * input to an image generator may fall outside them. Turning this on is the site owner's compliance decision.
 * Without it, the site is still understood from the location through the analysis step, and customers can add
 * their own screenshot or photo of the plot.
 */
import { siteImageryEnabled, type SiteImage } from './imagery-config.js';
import { fetchStreetViewSet, type StreetViewMeta } from './street-view.js';

export { siteImageryEnabled, type SiteImage };

export function buildImageryUrls(latitude: number, longitude: number, key: string) {
  const point = `${latitude.toFixed(6)},${longitude.toFixed(6)}`;
  const k = encodeURIComponent(key);
  return {
    satellite: `https://maps.googleapis.com/maps/api/staticmap?center=${point}&zoom=19&size=640x640&scale=2&maptype=satellite&key=${k}`,
    streetViewMetadata: `https://maps.googleapis.com/maps/api/streetview/metadata?location=${point}&radius=60&key=${k}`,
    streetView: `https://maps.googleapis.com/maps/api/streetview?size=640x640&location=${point}&radius=60&fov=90&key=${k}`,
  };
}

async function image(url: string, fetcher: typeof fetch): Promise<Buffer | null> {
  const response = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) return null;
  const buffer = Buffer.from(await response.arrayBuffer());
  return buffer.length > 1_000 && buffer.length < 8 * 1024 * 1024 ? buffer : null;
}

export interface SiteImageryResult {
  images: SiteImage[];
  /** The Street View panorama the views came from (its date, distance and aim), or null when there is no coverage. */
  streetView: StreetViewMeta | null;
}

/** Best effort: returns whatever imagery exists; never throws (the production continues without it). */
export async function fetchSiteImageryDetailed(
  point: { latitude: number; longitude: number },
  options: { env?: NodeJS.ProcessEnv; fetcher?: typeof fetch; /** The camera the customer chose: compass direction, tilt and zoom. */ heading?: number | null; pitch?: number; fov?: number } = {},
): Promise<SiteImageryResult> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  if (!siteImageryEnabled(env)) return { images: [], streetView: null };
  const urls = buildImageryUrls(point.latitude, point.longitude, env.GOOGLE_MAPS_API_KEY!.trim());
  const found: SiteImage[] = [];
  try {
    const satellite = await image(urls.satellite, fetcher);
    if (satellite) found.push({ label: 'Satellite view of the site', buffer: satellite, mimeType: 'image/png' });
  } catch { /* skip */ }
  let streetView: StreetViewMeta | null = null;
  try {
    const set = await fetchStreetViewSet(point, { env, fetcher, heading: options.heading, pitch: options.pitch, fov: options.fov });
    if (set) { streetView = set.meta; found.push(...set.images); }
  } catch { /* skip */ }
  return { images: found, streetView };
}

export async function fetchSiteImagery(
  point: { latitude: number; longitude: number },
  options: { env?: NodeJS.ProcessEnv; fetcher?: typeof fetch; heading?: number | null; pitch?: number; fov?: number } = {},
): Promise<SiteImage[]> {
  return (await fetchSiteImageryDetailed(point, options)).images;
}
