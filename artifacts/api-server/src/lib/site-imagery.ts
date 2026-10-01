/**
 * OPTIONAL map imagery for an architecture site (satellite view and street-level view at the point).
 *
 * OFF by default. It runs only when BOTH `ARCHITECTURE_MAPS_IMAGERY=1` and `GOOGLE_MAPS_API_KEY` are set.
 * Google's Maps Platform terms restrict how its imagery may be stored, derived from and shown, and using it as
 * input to an image generator may fall outside them. Turning this on is the site owner's compliance decision.
 * Without it, the site is still understood from the location through the analysis step, and customers can add
 * their own screenshot or photo of the plot.
 */
export interface SiteImage { label: string; buffer: Buffer; mimeType: string }

export function siteImageryEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.ARCHITECTURE_MAPS_IMAGERY === '1' && Boolean(env.GOOGLE_MAPS_API_KEY?.trim());
}

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

/** Best effort: returns whatever imagery exists; never throws (the production continues without it). */
export async function fetchSiteImagery(
  point: { latitude: number; longitude: number },
  options: { env?: NodeJS.ProcessEnv; fetcher?: typeof fetch } = {},
): Promise<SiteImage[]> {
  const env = options.env ?? process.env;
  const fetcher = options.fetcher ?? fetch;
  if (!siteImageryEnabled(env)) return [];
  const urls = buildImageryUrls(point.latitude, point.longitude, env.GOOGLE_MAPS_API_KEY!.trim());
  const found: SiteImage[] = [];
  try {
    const satellite = await image(urls.satellite, fetcher);
    if (satellite) found.push({ label: 'Satellite view of the site', buffer: satellite, mimeType: 'image/png' });
  } catch { /* skip */ }
  try {
    const meta = await fetcher(urls.streetViewMetadata, { signal: AbortSignal.timeout(8_000) });
    const status = meta.ok ? ((await meta.json()) as { status?: string }).status : null;
    if (status === 'OK') {
      const street = await image(urls.streetView, fetcher);
      if (street) found.push({ label: 'Street-level view at the site', buffer: street, mimeType: 'image/jpeg' });
    }
  } catch { /* skip */ }
  return found;
}
