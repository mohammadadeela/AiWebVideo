const googleHost = /^(?:(?:maps|www)\.)?google\.(?:com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i;
export function isGoogleMapsUrl(raw: string) {
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && (url.hostname === 'maps.app.goo.gl' || (url.hostname === 'goo.gl' && url.pathname.startsWith('/maps')) || googleHost.test(url.hostname));
  } catch { return false; }
}

export type MapsPrecision = 'pin' | 'view';

const LAT = '(-?\\d{1,2}(?:\\.\\d+)?)';
const LNG = '(-?\\d{1,3}(?:\\.\\d+)?)';

function valid(latitude: number, longitude: number) {
  return Number.isFinite(latitude) && Number.isFinite(longitude) && Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180;
}

/**
 * Where the link points. The order matters, and getting it wrong puts the building in the wrong place:
 *  1. the place PIN inside the link's data blob ("!3d<lat>!4d<lng>", ideally right after "!8m2")
 *  2. an explicit "lat,lng" in the link (?q=, ?query=, ?ll=, destination, or /search/lat,lng, /place/lat,lng)
 *  3. only then the "@lat,lng" part, which is where the MAP VIEW was centred when the link was copied, not where
 *     the place is (often hundreds of metres away). It is reported as precision "view" so the person can be asked
 *     for the exact pin.
 */
export function coordinatesFromMapsUrl(url: URL): { latitude: number; longitude: number; precision: MapsPrecision } | null {
  let decoded = url.toString();
  try { decoded = decodeURIComponent(decoded); } catch { /* use the encoded URL */ }
  const pair = (match: RegExpMatchArray | null, precision: MapsPrecision) => {
    if (!match) return null;
    const latitude = Number(match[1]); const longitude = Number(match[2]);
    return valid(latitude, longitude) ? { latitude, longitude, precision } : null;
  };

  // 1. the pin
  const pinned = decoded.match(new RegExp(`!8m2!3d${LAT}!4d${LNG}`));
  if (pinned) { const found = pair(pinned, 'pin'); if (found) return found; }
  const all = [...decoded.matchAll(new RegExp(`!3d${LAT}!4d${LNG}`, 'g'))];
  if (all.length) { const found = pair(all[all.length - 1], 'pin'); if (found) return found; }

  // 2. explicit coordinates
  for (const key of ['q', 'query', 'll', 'center', 'destination', 'daddr', 'saddr']) {
    const value = (url.searchParams.get(key) || '').replace(/^loc:/i, '');
    const found = pair(value.match(new RegExp(`^${LAT},\\s*${LNG}`)), 'pin');
    if (found) return found;
  }
  const inPath = pair(decoded.match(new RegExp(`/maps/(?:place|search|dir)/(?:[^/@]*/)*?${LAT},[\\s+]*${LNG}(?:[/?]|$)`)), 'pin');
  if (inPath) return inPath;

  // 3. the map view
  return pair(decoded.match(new RegExp(`@${LAT},${LNG}`)), 'view');
}
