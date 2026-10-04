import { bearingDegrees, dateLabelOf, distanceMetres, normalizeHeading } from './street-view.js';
import { validateUrl } from './ssrf.js';

/**
 * Free street-level photos near a plot, from Mapillary (volunteer-contributed, CC BY-SA 4.0: the photographer must be
 * credited wherever a photo is shown).
 *
 * MAPILLARY_ACCESS_TOKEN stays on the server. The page only receives picture links Mapillary signs for display (they carry
 * no token), and when a design is made the server downloads the chosen photo itself.
 *
 * Coverage depends on volunteers: some streets have many photos, some none. Nothing here invents a photo: no photos near the
 * plot simply means none are offered and the customer uses their own photo.
 */

export interface NearbyPhoto {
  id: string;
  /** Small and medium picture links for the page (signed by Mapillary, no token in them). */
  thumbUrl: string;
  previewUrl: string;
  dateLabel: string | null;
  /** Metres from the plot. */
  distanceM: number;
  /** The camera faces toward the plot (within 50 degrees). */
  facesPlot: boolean;
  /** Compass direction the camera faced, when known. */
  heading: number | null;
  /** Photographer's Mapillary name, for the attribution CC BY-SA requires. */
  credit: string | null;
}

type Env = NodeJS.ProcessEnv;
type Fetcher = typeof fetch;
interface Options { env?: Env; fetcher?: Fetcher; now?: number }

const GRAPH = 'https://graph.mapillary.com';
const FIELDS = 'id,captured_at,compass_angle,computed_compass_angle,computed_geometry,geometry,is_pano,quality_score,width,creator,thumb_256_url,thumb_1024_url';
const SEARCH_RADIUS_M = 90;
const MAX_PHOTOS = 9;

export function mapillaryEnabled(env: Env = process.env): boolean {
  return Boolean(env.MAPILLARY_ACCESS_TOKEN?.trim());
}

export const isMapillaryId = (value: unknown): value is string => typeof value === 'string' && /^\d{5,20}$/.test(value);

/** A box around the plot about SEARCH_RADIUS_M wide on each side (Mapillary limits the size of a search box). */
export function searchBox(point: { latitude: number; longitude: number }, radiusM = SEARCH_RADIUS_M) {
  const dLat = radiusM / 111_320;
  const dLon = radiusM / (111_320 * Math.max(0.2, Math.cos((point.latitude * Math.PI) / 180)));
  return [point.longitude - dLon, point.latitude - dLat, point.longitude + dLon, point.latitude + dLat].map((n) => Number(n.toFixed(6)));
}

const angleDiff = (a: number, b: number) => { const d = Math.abs(normalizeHeading(a) - normalizeHeading(b)); return d > 180 ? 360 - d : d; };
const httpsUrl = (value: unknown): string | null => { try { const u = new URL(String(value)); return u.protocol === 'https:' ? u.toString() : null; } catch { return null; } };
const cleanCredit = (value: unknown): string | null => {
  const text = typeof value === 'string' ? value : value && typeof value === 'object' ? String((value as { username?: unknown }).username ?? '') : '';
  const safe = text.replace(/[^\p{L}\p{N}_.\- ]/gu, '').trim().slice(0, 40);
  return safe || null;
};

interface RawImage {
  id?: unknown; captured_at?: unknown; compass_angle?: unknown; computed_compass_angle?: unknown; is_pano?: unknown; quality_score?: unknown; width?: unknown;
  computed_geometry?: { coordinates?: unknown }; geometry?: { coordinates?: unknown }; creator?: unknown; thumb_256_url?: unknown; thumb_1024_url?: unknown;
}

/**
 * Keeps the photos worth showing, best first: close to the plot, facing it, recent and sharp. Flat photos only (a 360
 * panorama shown as a flat picture is distorted and a tap on it would mean nothing), and no near-duplicates.
 */
export function rankPhotos(raw: unknown, plot: { latitude: number; longitude: number }, now = Date.now()): NearbyPhoto[] {
  const list = (raw as { data?: unknown })?.data;
  if (!Array.isArray(list)) return [];
  const scored: Array<{ photo: NearbyPhoto; score: number; at: { latitude: number; longitude: number } }> = [];
  for (const item of list as RawImage[]) {
    const id = String(item?.id ?? '');
    const coordinates = (item.computed_geometry?.coordinates ?? item.geometry?.coordinates) as unknown;
    const thumbUrl = httpsUrl(item.thumb_256_url), previewUrl = httpsUrl(item.thumb_1024_url);
    if (!isMapillaryId(id) || !Array.isArray(coordinates) || coordinates.length < 2 || !thumbUrl || !previewUrl) continue;
    const [lng, lat] = coordinates as [unknown, unknown];
    if (typeof lat !== 'number' || typeof lng !== 'number' || item.is_pano === true) continue;
    if (typeof item.width === 'number' && item.width < 1000) continue;
    const at = { latitude: lat, longitude: lng };
    const distanceM = distanceMetres(at, plot);
    if (distanceM > SEARCH_RADIUS_M + 15) continue;

    const headingRaw = typeof item.computed_compass_angle === 'number' ? item.computed_compass_angle : typeof item.compass_angle === 'number' ? item.compass_angle : null;
    const heading = headingRaw === null ? null : normalizeHeading(headingRaw);
    const delta = heading !== null && distanceM >= 6 ? angleDiff(heading, bearingDegrees(at, plot)) : null;
    const facesPlot = delta !== null && delta <= 50;

    const capturedMs = typeof item.captured_at === 'number' ? item.captured_at : null;
    const ageYears = capturedMs ? Math.max(0, (now - capturedMs) / (365.25 * 86_400_000)) : null;
    const month = capturedMs ? new Date(capturedMs).toISOString().slice(0, 7) : null;

    let score = 40 * (1 - Math.min(1, distanceM / SEARCH_RADIUS_M));
    if (delta !== null) { score += delta <= 60 ? 40 * (1 - delta / 60) : 0; if (delta > 120) score -= 15; }
    if (ageYears !== null) score += Math.max(0, 20 - ageYears * 3);
    if (typeof item.quality_score === 'number') score += 15 * Math.max(0, Math.min(1, item.quality_score));
    if (typeof item.width === 'number' && item.width >= 2000) score += 5;

    scored.push({ photo: { id, thumbUrl, previewUrl, dateLabel: dateLabelOf(month), distanceM: Number(distanceM.toFixed(1)), facesPlot, heading, credit: cleanCredit(item.creator) }, score, at });
  }
  scored.sort((a, b) => b.score - a.score);
  const kept: typeof scored = [];
  for (const candidate of scored) {
    // two shots from nearly the same spot looking the same way add nothing
    const duplicate = kept.some((other) => distanceMetres(other.at, candidate.at) < 6 && (other.photo.heading === null || candidate.photo.heading === null || angleDiff(other.photo.heading, candidate.photo.heading) < 25));
    if (!duplicate) kept.push(candidate);
    if (kept.length >= MAX_PHOTOS) break;
  }
  return kept.map((entry) => entry.photo);
}

/** The best nearby photos for the plot. [] when Mapillary is off, has nothing there, or cannot be reached. */
export async function findNearbyPhotos(plot: { latitude: number; longitude: number }, options: Options = {}): Promise<NearbyPhoto[]> {
  const env = options.env ?? process.env;
  if (!mapillaryEnabled(env)) return [];
  const fetcher = options.fetcher ?? fetch;
  const url = `${GRAPH}/images?fields=${FIELDS}&bbox=${searchBox(plot).join(',')}&limit=100&access_token=${encodeURIComponent(env.MAPILLARY_ACCESS_TOKEN!.trim())}`;
  try {
    const response = await fetcher(url, { signal: AbortSignal.timeout(9_000) });
    if (!response.ok) return [];
    return rankPhotos(await response.json(), plot, options.now);
  } catch {
    return [];
  }
}

export interface DesignPhoto { buffer: Buffer; credit: string | null; dateLabel: string | null }

/** The chosen photo at 2048 px for the design itself (downloaded by the server, so the page never needs a token). */
export async function fetchPhotoForDesign(id: string, options: Options = {}): Promise<DesignPhoto | null> {
  const env = options.env ?? process.env;
  if (!mapillaryEnabled(env) || !isMapillaryId(id)) return null;
  const fetcher = options.fetcher ?? fetch;
  try {
    const meta = await fetcher(`${GRAPH}/${id}?fields=thumb_2048_url,thumb_1024_url,creator,captured_at&access_token=${encodeURIComponent(env.MAPILLARY_ACCESS_TOKEN!.trim())}`, { signal: AbortSignal.timeout(9_000) });
    if (!meta.ok) return null;
    const data = (await meta.json()) as { thumb_2048_url?: unknown; thumb_1024_url?: unknown; creator?: unknown; captured_at?: unknown };
    const link = httpsUrl(data.thumb_2048_url) ?? httpsUrl(data.thumb_1024_url);
    if (!link) return null;
    const safe = await validateUrl(link);                      // the picture host must be a public address like any other
    const picture = await fetcher(safe, { signal: AbortSignal.timeout(15_000) });
    if (!picture.ok || !(picture.headers.get('content-type') ?? '').startsWith('image/')) return null;
    const buffer = Buffer.from(await picture.arrayBuffer());
    if (buffer.length < 2_000 || buffer.length > 12 * 1024 * 1024) return null;
    const month = typeof data.captured_at === 'number' ? new Date(data.captured_at).toISOString().slice(0, 7) : null;
    return { buffer, credit: cleanCredit(data.creator), dateLabel: dateLabelOf(month) };
  } catch {
    return null;
  }
}
