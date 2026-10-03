/** A small embedded map of one exact point (no key needed), so the customer can confirm it is the right spot. */
export function mapPreviewUrl(latitude: number, longitude: number) {
  return `https://www.google.com/maps?q=${latitude.toFixed(6)},${longitude.toFixed(6)}&z=18&output=embed`;
}

/**
 * True when pasted text is clearly coordinates rather than an address: two decimal numbers (31.5321, 35.0912),
 * or degrees-minutes (31°31'55"N), or a "geo:" link. The server does the exact parsing.
 */
export function looksLikeCoordinates(text: string): boolean {
  const value = text.trim();
  if (!value || value.length > 120) return false;
  return /^geo:/i.test(value)
    || /^-?\d{1,2}\.\d{2,}\s*[,\s]\s*-?\d{1,3}\.\d{2,}$/.test(value)
    || /-?\d{1,3}(?:\.\d+)?\s*°?\s*[NSEW]\b.*-?\d{1,3}(?:\.\d+)?\s*°?\s*[NSEW]\b/i.test(value)
    || /\d{1,3}\s*°\s*\d{1,2}\s*['′]/.test(value);
}
