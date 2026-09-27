export interface ArchitectureReference {
  buffer: Buffer;
  lat: number;
  lng: number;
  formattedAddress: string;
  source: 'streetview' | 'satellite';
}

function mapsKey() {
  const key = String(process.env.GOOGLE_MAPS_STATIC_API_KEY ?? '').trim();
  if (!key) throw new Error('GOOGLE_MAPS_STATIC_API_KEY is not configured.');
  return key;
}

function coordinatesFromText(value: string): { lat: number; lng: number } | null {
  const patterns = [
    /@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/,
    /!3d(-?\d{1,2}(?:\.\d+)?)[^!]*!4d(-?\d{1,3}(?:\.\d+)?)/,
    /(?:[?&](?:q|query|ll)=)(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/i,
    /^\s*(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)\s*$/,
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (!match) continue;
    const lat = Number(match[1]);
    const lng = Number(match[2]);
    if (Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) {
      return { lat, lng };
    }
  }
  return null;
}

async function expandGoogleMapsUrl(raw: string) {
  let parsed: URL;
  try { parsed = new URL(raw); } catch { return raw; }
  const hostname = parsed.hostname.toLowerCase();
  const allowed = hostname === 'maps.app.goo.gl'
    || hostname === 'goo.gl'
    || hostname === 'maps.google.com'
    || hostname.endsWith('.google.com');
  if (!allowed) return raw;
  if (hostname !== 'maps.app.goo.gl' && hostname !== 'goo.gl') return raw;
  const response = await fetch(parsed.toString(), {
    method: 'HEAD',
    redirect: 'follow',
    signal: AbortSignal.timeout(8_000),
  }).catch(() => null);
  const finalUrl = response?.url;
  if (!finalUrl) return raw;
  try {
    const finalHost = new URL(finalUrl).hostname.toLowerCase();
    return finalHost === 'google.com' || finalHost.endsWith('.google.com') ? finalUrl : raw;
  } catch {
    return raw;
  }
}

async function geocode(input: string, key: string) {
  const direct = coordinatesFromText(input);
  if (direct) return { ...direct, formattedAddress: input.trim() };

  const expanded = /^https?:\/\//i.test(input) ? await expandGoogleMapsUrl(input) : input;
  const fromExpanded = coordinatesFromText(expanded);
  if (fromExpanded) return { ...fromExpanded, formattedAddress: input.trim() };

  let address = input.trim();
  if (/^https?:\/\//i.test(expanded)) {
    try {
      const url = new URL(expanded);
      const query = url.searchParams.get('query') || url.searchParams.get('q');
      const placeMatch = url.pathname.match(/\/place\/([^/]+)/i);
      address = query || (placeMatch?.[1] ? decodeURIComponent(placeMatch[1].replace(/\+/g, ' ')) : '');
    } catch {}
  }
  if (!address) throw new Error('This Google Maps link does not contain a resolvable place or coordinate.');

  const endpoint = new URL('https://maps.googleapis.com/maps/api/geocode/json');
  endpoint.searchParams.set('address', address);
  endpoint.searchParams.set('key', key);
  const response = await fetch(endpoint, { signal: AbortSignal.timeout(10_000) });
  if (!response.ok) throw new Error('Google Maps could not resolve that location.');
  const data = await response.json() as {
    status?: string;
    error_message?: string;
    results?: Array<{ formatted_address?: string; geometry?: { location?: { lat?: number; lng?: number } } }>;
  };
  const first = data.results?.[0];
  const lat = Number(first?.geometry?.location?.lat);
  const lng = Number(first?.geometry?.location?.lng);
  if (data.status !== 'OK' || !Number.isFinite(lat) || !Number.isFinite(lng)) {
    throw new Error(data.error_message || 'Google Maps could not resolve that location.');
  }
  return { lat, lng, formattedAddress: first?.formatted_address || address };
}

async function fetchImage(url: URL) {
  const response = await fetch(url, { signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error('Location reference image could not be downloaded.');
  const type = response.headers.get('content-type') ?? '';
  if (!type.toLowerCase().startsWith('image/')) throw new Error('Google Maps returned an invalid location image.');
  const buffer = Buffer.from(await response.arrayBuffer());
  if (!buffer.length || buffer.length > 12 * 1024 * 1024) throw new Error('Location reference image is invalid.');
  return buffer;
}

export async function resolveArchitectureReference(input: string): Promise<ArchitectureReference> {
  const location = input.trim();
  if (!location) throw new Error('Enter a Google Maps link or address.');
  const key = mapsKey();
  const { lat, lng, formattedAddress } = await geocode(location, key);
  const point = lat.toFixed(7) + ',' + lng.toFixed(7);

  const metadata = new URL('https://maps.googleapis.com/maps/api/streetview/metadata');
  metadata.searchParams.set('location', point);
  metadata.searchParams.set('key', key);
  const metaResponse = await fetch(metadata, { signal: AbortSignal.timeout(8_000) }).catch(() => null);
  const meta = metaResponse?.ok ? await metaResponse.json().catch(() => null) as { status?: string } | null : null;

  if (meta?.status === 'OK') {
    const street = new URL('https://maps.googleapis.com/maps/api/streetview');
    street.searchParams.set('size', '640x640');
    street.searchParams.set('scale', '2');
    street.searchParams.set('location', point);
    street.searchParams.set('fov', '90');
    street.searchParams.set('pitch', '0');
    street.searchParams.set('key', key);
    return { buffer: await fetchImage(street), lat, lng, formattedAddress, source: 'streetview' };
  }

  const satellite = new URL('https://maps.googleapis.com/maps/api/staticmap');
  satellite.searchParams.set('center', point);
  satellite.searchParams.set('zoom', '19');
  satellite.searchParams.set('size', '640x640');
  satellite.searchParams.set('scale', '2');
  satellite.searchParams.set('maptype', 'satellite');
  satellite.searchParams.set('markers', 'color:0x8b5cf6|' + point);
  satellite.searchParams.set('key', key);
  return { buffer: await fetchImage(satellite), lat, lng, formattedAddress, source: 'satellite' };
}
