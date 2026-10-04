import { siteImageryEnabled, type SiteImage } from './imagery-config.js';

/**
 * Google Street View for an architecture site: what the street in front of the plot really looks like.
 *
 * Only runs when the site owner switched map imagery on (ARCHITECTURE_MAPS_IMAGERY=1 and GOOGLE_MAPS_API_KEY, see
 * site-imagery.ts). The key never leaves the server: pages get images through the proxy route, never a URL with the key.
 *
 * Accuracy comes from three things: (1) ONE panorama is chosen and used for every view, so the views agree with each other;
 * (2) the camera is aimed at the plot from where that panorama really stands (a real bearing, not a guess); and
 * (3) the capture date travels with the images, so an old photo is never presented as the current state of the street.
 */

export interface StreetViewMeta {
  panoId: string;
  /** Where the panorama was taken (not where the plot is). */
  latitude: number;
  longitude: number;
  /** "2017-02" as Google reports it, and "Feb 2017" for people. */
  date: string | null;
  dateLabel: string | null;
  /** How far the panorama stands from the plot, in metres. */
  distanceM: number;
  /** Compass heading (0-359, 0 = north) that looks from the panorama at the plot; null when they are the same spot. */
  headingToPlot: number | null;
  copyright: string | null;
}

type Env = NodeJS.ProcessEnv;
type Fetcher = typeof fetch;
interface Options { env?: Env; fetcher?: Fetcher }

const API = 'https://maps.googleapis.com/maps/api/streetview';
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
const SEARCH_RADIUS_M = 80;
const MIN_USEFUL_DISTANCE_M = 6;

const rad = (degrees: number) => (degrees * Math.PI) / 180;
export const normalizeHeading = (degrees: number) => ((Math.round(degrees) % 360) + 360) % 360;
export const compassName = (heading: number) => COMPASS[Math.round(normalizeHeading(heading) / 45) % 8];

/** Great-circle distance in metres. */
export function distanceMetres(a: { latitude: number; longitude: number }, b: { latitude: number; longitude: number }): number {
  const dLat = rad(b.latitude - a.latitude);
  const dLon = rad(b.longitude - a.longitude);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.latitude)) * Math.cos(rad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6_371_000 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing (0 = north, 90 = east) from one point to another. */
export function bearingDegrees(from: { latitude: number; longitude: number }, to: { latitude: number; longitude: number }): number {
  const dLon = rad(to.longitude - from.longitude);
  const y = Math.sin(dLon) * Math.cos(rad(to.latitude));
  const x = Math.cos(rad(from.latitude)) * Math.sin(rad(to.latitude)) - Math.sin(rad(from.latitude)) * Math.cos(rad(to.latitude)) * Math.cos(dLon);
  return normalizeHeading((Math.atan2(y, x) * 180) / Math.PI);
}

export function dateLabelOf(date: string | null | undefined): string | null {
  const match = /^(\d{4})-(\d{1,2})$/.exec(date ?? '');
  if (!match) return /^\d{4}$/.test(date ?? '') ? String(date) : null;
  const month = Number(match[2]);
  return month >= 1 && month <= 12 ? `${MONTHS[month - 1]} ${match[1]}` : match[1];
}

/**
 * The picture is 4:3 (640 x 480): wide enough for a street frontage and tall enough for the floors above. The page shows the same
 * frame, so where the customer taps on it is where the server marks it. The camera can look down to a basement entrance or up
 * to the upper floors, and zoom in on one shop.
 */
export const FRAME = { width: 640, height: 480 } as const;
export const CAMERA_LIMITS = { pitch: { min: -20, max: 70 }, fov: { min: 30, max: 110 } } as const;
export const DEFAULT_CAMERA = { pitch: 5, fov: 90 } as const;

export const clampPitch = (value: number) => Math.max(CAMERA_LIMITS.pitch.min, Math.min(CAMERA_LIMITS.pitch.max, Math.round(value)));
export const clampFov = (value: number) => Math.max(CAMERA_LIMITS.fov.min, Math.min(CAMERA_LIMITS.fov.max, Math.round(value)));

export function streetViewImageUrl(params: { panoId: string; heading: number; pitch?: number; fov?: number }, key: string): string {
  const { panoId, heading, pitch = DEFAULT_CAMERA.pitch, fov = DEFAULT_CAMERA.fov } = params;
  return `${API}?size=${FRAME.width}x${FRAME.height}&pano=${encodeURIComponent(panoId)}&heading=${normalizeHeading(heading)}&pitch=${clampPitch(pitch)}&fov=${clampFov(fov)}&source=outdoor&key=${encodeURIComponent(key)}`;
}

/**
 * The nearest outdoor panorama to the plot, aimed at it. null when imagery is off, when there is no coverage within
 * 80 m, or when Google cannot be reached: the production simply carries on without Street View.
 */
export async function fetchStreetViewMeta(point: { latitude: number; longitude: number }, options: Options = {}): Promise<StreetViewMeta | null> {
  const env = options.env ?? process.env;
  if (!siteImageryEnabled(env)) return null;
  const fetcher = options.fetcher ?? fetch;
  const url = `${API}/metadata?location=${point.latitude.toFixed(6)},${point.longitude.toFixed(6)}&radius=${SEARCH_RADIUS_M}&source=outdoor&key=${encodeURIComponent(env.GOOGLE_MAPS_API_KEY!.trim())}`;
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(8_000) });
    if (!response.ok) return null;
    const data = (await response.json()) as { status?: string; pano_id?: string; date?: string; copyright?: string; location?: { lat?: number; lng?: number } };
    const lat = data.location?.lat, lng = data.location?.lng;
    if (data.status !== 'OK' || !data.pano_id || typeof lat !== 'number' || typeof lng !== 'number' || !/^[A-Za-z0-9_-]{10,64}$/.test(data.pano_id)) return null;
    const pano = { latitude: lat, longitude: lng };
    const distanceM = distanceMetres(pano, point);
    return {
      panoId: data.pano_id,
      ...pano,
      date: typeof data.date === 'string' ? data.date : null,
      dateLabel: dateLabelOf(data.date),
      distanceM: Number(distanceM.toFixed(1)),
      headingToPlot: distanceM >= MIN_USEFUL_DISTANCE_M ? bearingDegrees(pano, point) : null,
      copyright: typeof data.copyright === 'string' ? data.copyright.slice(0, 80) : null,
    };
  } catch {
    return null;
  }
}

export interface StreetViewShot { heading: number; pitch: number; fov: number; role: 'front' | 'left' | 'right'; description: string }

/**
 * The three views that describe a street frontage: straight at the plot, and the street to either side (the neighbours).
 * `preferred` is the compass direction the customer chose to look in; otherwise the camera faces the plot.
 */
export function planStreetViews(
  meta: Pick<StreetViewMeta, 'headingToPlot'>,
  preferred?: number | null,
  camera: { pitch?: number; fov?: number } = {},
): StreetViewShot[] {
  const base = typeof preferred === 'number' && Number.isFinite(preferred) ? normalizeHeading(preferred) : (meta.headingToPlot ?? 0);
  const pitch = clampPitch(camera.pitch ?? DEFAULT_CAMERA.pitch);
  const fov = clampFov(camera.fov ?? DEFAULT_CAMERA.fov);
  return [
    { heading: base, pitch, fov, role: 'front', description: typeof preferred === 'number' || meta.headingToPlot === null ? `looking ${compassName(base)}` : 'looking at the plot straight on' },
    { heading: normalizeHeading(base - 60), pitch, fov, role: 'left', description: 'the street and neighbours to the left' },
    { heading: normalizeHeading(base + 60), pitch, fov, role: 'right', description: 'the street and neighbours to the right' },
  ];
}

async function readImage(url: string, fetcher: Fetcher): Promise<Buffer | null> {
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(10_000) });
    if (!response.ok || !(response.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const buffer = Buffer.from(await response.arrayBuffer());
    return buffer.length > 1_000 && buffer.length < 8 * 1024 * 1024 ? buffer : null;
  } catch {
    return null;
  }
}

/** One Street View picture for the page (through the server, so the key stays private). */
export async function fetchStreetViewImage(params: { panoId: string; heading: number; pitch?: number; fov?: number }, options: Options = {}): Promise<Buffer | null> {
  const env = options.env ?? process.env;
  if (!siteImageryEnabled(env) || !/^[A-Za-z0-9_-]{10,64}$/.test(params.panoId)) return null;
  return readImage(streetViewImageUrl(params, env.GOOGLE_MAPS_API_KEY!.trim()), options.fetcher ?? fetch);
}

/** The panorama, and its three views as references for the design. Never throws; empty when nothing is available. */
export async function fetchStreetViewSet(
  point: { latitude: number; longitude: number },
  options: Options & { heading?: number | null; pitch?: number; fov?: number } = {},
): Promise<{ meta: StreetViewMeta; images: SiteImage[] } | null> {
  const meta = await fetchStreetViewMeta(point, options);
  if (!meta) return null;
  const when = meta.dateLabel ? `captured ${meta.dateLabel}` : 'capture date unknown';
  const images: SiteImage[] = [];
  for (const shot of planStreetViews(meta, options.heading, { pitch: options.pitch, fov: options.fov })) {
    const buffer = await fetchStreetViewImage({ panoId: meta.panoId, heading: shot.heading, pitch: shot.pitch, fov: shot.fov }, options);
    if (buffer) images.push({ label: `STREET VIEW (Google, ${when}) — ${shot.description}, facing ${compassName(shot.heading)}`, buffer, mimeType: 'image/jpeg', role: shot.role });
  }
  return images.length ? { meta, images } : null;
}
