const googleHost = /^(?:(?:maps|www)\.)?google\.(?:com|[a-z]{2,3}|com\.[a-z]{2}|co\.[a-z]{2})$/i;
export function isGoogleMapsUrl(raw: string) {
  try {
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) && (url.hostname === 'maps.app.goo.gl' || googleHost.test(url.hostname));
  } catch { return false; }
}

export function coordinatesFromMapsUrl(url: URL): { latitude: number; longitude: number } | null {
  let decoded = url.toString();
  try { decoded = decodeURIComponent(decoded); } catch { /* use the encoded URL */ }
  const match = decoded.match(/@(-?\d{1,2}(?:\.\d+)?),(-?\d{1,3}(?:\.\d+)?)/)
    ?? decoded.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/)
    ?? (url.searchParams.get('q') || url.searchParams.get('ll') || url.searchParams.get('center') || '').match(/^(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/);
  if (!match) return null;
  const latitude = Number(match[1]), longitude = Number(match[2]);
  return Math.abs(latitude) <= 90 && Math.abs(longitude) <= 180 ? { latitude, longitude } : null;
}
