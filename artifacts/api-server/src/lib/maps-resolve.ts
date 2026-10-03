import { AppError } from './errors.js';
import { coordinatesFromMapsUrl, isGoogleMapsUrl, type MapsPrecision } from './maps-url.js';

/**
 * Turns whatever a customer pasted into an EXACT point on the map, and says how sure that point is.
 * Accepts: a Google Maps link (long, or a short maps.app.goo.gl link, which is followed), an OpenStreetMap or Apple
 * Maps link, or coordinates typed or pasted directly (decimal, degrees-minutes-seconds, "geo:" links).
 * Every step is recorded in `trace`, so a link that does not work can be diagnosed instead of guessed at.
 */
export interface MapsResolution {
  latitude?: number;
  longitude?: number;
  precision: MapsPrecision | 'none';
  label: string | null;
  resolvedUrl: string;
  trace: string[];
}

export interface PageFetch { status: number; location: string | null; body: string }
export interface MapsDeps {
  /** One request, redirects NOT followed. Must refuse non-public addresses. */
  fetchPage: (url: string) => Promise<PageFetch>;
  /** Optional address lookup for a place name with no coordinates in it. */
  geocode?: (text: string) => Promise<{ latitude: number; longitude: number; label: string | null } | null>;
}

const valid = (lat: number, lng: number) => Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;

// ---- typed coordinates ------------------------------------------------------------------------------------------

const DMS = /(\d{1,3})\s*(?:°|º|d|:|\s)\s*(\d{1,2})\s*(?:['′’:]|\s)\s*(\d{1,2}(?:\.\d+)?)\s*(?:["″”]|''|’’)?\s*([NSEW])/gi;
const DECIMAL_WITH_LETTER = /(-?\d{1,3}(?:\.\d+)?)\s*°?\s*([NSEW])/gi;

function signed(value: number, hemisphere: string) { return /[SW]/i.test(hemisphere) ? -Math.abs(value) : Math.abs(value); }

/**
 * Coordinates typed or pasted as text. Plain "12, 34" is NOT taken as coordinates (it could be a house number):
 * the numbers need a decimal part, a hemisphere letter, or degrees/minutes/seconds.
 */
export function parseTypedCoordinates(raw: string): { latitude: number; longitude: number } | null {
  const text = raw.trim().replace(/^geo:/i, '').replace(/[;()]/g, ' ').replace(/\bu=\d+\b/i, '');
  if (!text || text.length > 120) return null;
  const pair = (latitude: number, longitude: number) => (valid(latitude, longitude) ? { latitude, longitude } : null);

  // degrees minutes seconds with hemisphere letters, in either order
  const dms = [...text.matchAll(DMS)];
  if (dms.length === 2) {
    const toDecimal = (m: RegExpMatchArray) => signed(Number(m[1]) + Number(m[2]) / 60 + Number(m[3]) / 3600, m[4]);
    const [a, b] = dms;
    const aIsLat = /[NS]/i.test(a[4]);
    const bIsLat = /[NS]/i.test(b[4]);
    if (aIsLat !== bIsLat) return aIsLat ? pair(toDecimal(a), toDecimal(b)) : pair(toDecimal(b), toDecimal(a));
  }
  // decimal degrees with hemisphere letters
  const lettered = [...text.matchAll(DECIMAL_WITH_LETTER)];
  if (lettered.length === 2) {
    const [a, b] = lettered;
    const aIsLat = /[NS]/i.test(a[2]);
    const bIsLat = /[NS]/i.test(b[2]);
    if (aIsLat !== bIsLat) {
      const la = signed(Number(a[1]), a[2]); const lb = signed(Number(b[1]), b[2]);
      return aIsLat ? pair(la, lb) : pair(lb, la);
    }
  }
  // "lat, lng" (or "lat lng") where both have a decimal part
  const plain = text.match(/^(-?\d{1,2}\.\d+)\s*[,\s]\s*(-?\d{1,3}\.\d+)$/);
  if (plain) return pair(Number(plain[1]), Number(plain[2]));
  return null;
}

// ---- other map services -----------------------------------------------------------------------------------------

export function isOpenStreetMapUrl(raw: string) {
  try { const host = new URL(raw).hostname; return host === 'openstreetmap.org' || host === 'www.openstreetmap.org'; } catch { return false; }
}
export function isAppleMapsUrl(raw: string) {
  try { return new URL(raw).hostname === 'maps.apple.com'; } catch { return false; }
}

/** OpenStreetMap: "?mlat=&mlon=" is a pin; "#map=zoom/lat/lon" is only where the map was centred (a view). */
export function coordinatesFromOsmUrl(url: URL): { latitude: number; longitude: number; precision: MapsPrecision } | null {
  const mlat = Number(url.searchParams.get('mlat')); const mlon = Number(url.searchParams.get('mlon'));
  if (url.searchParams.has('mlat') && url.searchParams.has('mlon') && valid(mlat, mlon)) return { latitude: mlat, longitude: mlon, precision: 'pin' };
  const view = url.hash.match(/map=\d+(?:\.\d+)?\/(-?\d+(?:\.\d+)?)\/(-?\d+(?:\.\d+)?)/);
  if (view && valid(Number(view[1]), Number(view[2]))) return { latitude: Number(view[1]), longitude: Number(view[2]), precision: 'view' };
  return null;
}

/** Apple Maps: "?ll=lat,lng", "?q=lat,lng", "?coordinate=lat,lng" or "?sll=" (all pins), "?address=" has none. */
export function coordinatesFromAppleUrl(url: URL): { latitude: number; longitude: number; precision: MapsPrecision } | null {
  for (const key of ['ll', 'coordinate', 'q', 'sll']) {
    const found = (url.searchParams.get(key) || '').match(/^(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/);
    if (found && valid(Number(found[1]), Number(found[2]))) return { latitude: Number(found[1]), longitude: Number(found[2]), precision: 'pin' };
  }
  return null;
}

// ---- Google's detours -------------------------------------------------------------------------------------------

/** Google can send servers through a consent page; the real destination is in its "continue" parameter. */
export function unwrapConsentUrl(raw: string): string | null {
  try {
    const url = new URL(raw);
    if (!/^consent\.google\.[a-z.]+$/i.test(url.hostname)) return null;
    return url.searchParams.get('continue');
  } catch { return null; }
}

function decodeEntities(text: string) {
  return text
    .replace(/\\u003d/gi, '=').replace(/\\u0026/gi, '&').replace(/\\u002f/gi, '/').replace(/\\\//g, '/')
    .replace(/&amp;/g, '&').replace(/&#x2F;/gi, '/').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
}

/**
 * When a short link answers with a web page instead of a redirect, the long link (and the pin in it) is usually
 * inside that page: in a meta refresh, the canonical/og:url, a script, or the static map image's centre.
 */
export function mapsUrlsInHtml(html: string): string[] {
  const text = decodeEntities(html);
  const found = new Set<string>();
  for (const match of text.matchAll(/https?:\/\/(?:www\.|maps\.)?google\.[a-z.]+\/maps[^\s"'<>\\)]*/gi)) found.add(match[0].replace(/[.,;]+$/, ''));
  for (const match of text.matchAll(/(?:url|href|content)=["']?(https?:\/\/[^"'\s>]+)/gi)) if (/google\.[a-z.]+\/maps/i.test(match[1])) found.add(match[1]);
  // the static map used as the link preview image carries the point as center=lat,lng or markers=lat,lng
  for (const match of text.matchAll(/(?:center|markers)=(?:[^&"'\s]*?%7C)?(-?\d{1,2}\.\d+)(?:%2C|,)(-?\d{1,3}\.\d+)/gi)) found.add(`https://www.google.com/maps?q=${match[1]},${match[2]}`);
  return [...found];
}

const SHORT_HOSTS = new Set(['maps.app.goo.gl', 'goo.gl', 'g.co']);
const isShortLink = (url: URL) => SHORT_HOSTS.has(url.hostname) && (url.hostname !== 'goo.gl' || url.pathname.startsWith('/maps')) && (url.hostname !== 'g.co' || url.pathname.startsWith('/maps') || url.pathname.startsWith('/kgs'));
const isConsentHost = (url: URL) => /^consent\.google\.[a-z.]+$/i.test(url.hostname);

function labelFrom(url: URL | null, fallback: string | null): string | null {
  if (!url) return fallback ? fallback.slice(0, 150) : null;
  const place = url.pathname.match(/\/place\/([^/]+)/)?.[1];
  if (place) { try { return decodeURIComponent(place.replace(/\+/g, ' ')).slice(0, 150); } catch { return place.slice(0, 150); } }
  const q = url.searchParams.get('q') || url.searchParams.get('query');
  if (q && !/^-?\d+\.\d+\s*,/.test(q)) return q.slice(0, 150);
  return fallback ? fallback.slice(0, 150) : null;
}

// ---- the resolver -----------------------------------------------------------------------------------------------

export async function resolveMapsInput(input: string, deps: MapsDeps, trace: string[] = []): Promise<MapsResolution> {
  const text = input.trim();
  const done = (position: { latitude: number; longitude: number; precision: MapsPrecision } | null, label: string | null, resolvedUrl: string): MapsResolution => ({
    ...(position ?? {}), precision: position?.precision ?? 'none', label, resolvedUrl, trace,
  });

  // 1. coordinates typed or pasted directly
  const typed = parseTypedCoordinates(text);
  if (typed) { trace.push('typed coordinates'); return done({ ...typed, precision: 'pin' }, `${typed.latitude.toFixed(6)}, ${typed.longitude.toFixed(6)}`, ''); }

  // 2. not a link: an address or place name
  if (!/^https?:\/\//i.test(text)) {
    trace.push('plain text: looking the place up');
    const found = deps.geocode ? await deps.geocode(text).catch(() => null) : null;
    if (found) { trace.push('geocoder found the place'); return done({ latitude: found.latitude, longitude: found.longitude, precision: 'pin' }, found.label ?? text.slice(0, 150), ''); }
    trace.push(deps.geocode ? 'geocoder found nothing' : 'no geocoder configured: the address is kept as text only');
    return done(null, text.slice(0, 150), '');
  }

  // 3. a link
  let url = new URL(text);
  if (isOpenStreetMapUrl(url.toString())) {
    const found = coordinatesFromOsmUrl(url);
    trace.push(found ? `OpenStreetMap link: ${found.precision}` : 'OpenStreetMap link without a point');
    return done(found, labelFrom(url, null), url.toString());
  }
  if (isAppleMapsUrl(url.toString())) {
    const found = coordinatesFromAppleUrl(url);
    trace.push(found ? 'Apple Maps link: pin' : 'Apple Maps link without coordinates');
    return done(found, labelFrom(url, null), url.toString());
  }
  if (!isGoogleMapsUrl(url.toString())) throw new AppError('Paste a Google Maps link, an address, or coordinates.', 400, 'INVALID_MAP_LINK');

  for (let hop = 0; hop < 6; hop += 1) {
    const needsRequest = isShortLink(url) || isConsentHost(url);
    if (!needsRequest) break;
    trace.push(`following ${url.hostname}${url.pathname.slice(0, 24)}`);
    const page = await deps.fetchPage(url.toString());
    trace.push(`  -> HTTP ${page.status}${page.location ? ` redirect to ${new URL(page.location, url).hostname}` : ''}`);
    let next: string | null = page.location ? new URL(page.location, url).toString() : null;
    if (next) { const unwrapped = unwrapConsentUrl(next); if (unwrapped) { trace.push('  -> unwrapped Google consent page'); next = unwrapped; } }
    if (!next && page.body) {
      // a page instead of a redirect: look for the long link inside it
      const candidates = mapsUrlsInHtml(page.body);
      trace.push(`  -> page body: ${candidates.length} map link(s) inside`);
      for (const candidate of candidates) {
        try { if (coordinatesFromMapsUrl(new URL(candidate))) { next = candidate; break; } } catch { /* not a URL */ }
      }
      next ??= candidates.find((candidate) => { try { return !isShortLink(new URL(candidate)); } catch { return false; } }) ?? null;
    }
    if (!next) { trace.push('  -> no way forward'); break; }
    const target = new URL(next);
    if (!isGoogleMapsUrl(target.toString()) && !isConsentHost(target)) throw new AppError('The map link redirects outside Google Maps.', 400, 'INVALID_MAP_LINK');
    url = target;
  }

  let position = coordinatesFromMapsUrl(url);
  trace.push(position ? `point from the link: ${position.precision}` : 'no point in the link');
  let label = labelFrom(url, null);
  if (!position && label && deps.geocode) {
    const found = await deps.geocode(label).catch(() => null);
    if (found) { position = { latitude: found.latitude, longitude: found.longitude, precision: 'pin' }; label = found.label ?? label; trace.push('point from the geocoder'); }
  }
  return done(position, label, url.toString());
}
