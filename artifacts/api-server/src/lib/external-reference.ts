import { AppError } from './errors.js';
import { validateUrl } from './ssrf.js';

/** Redirects and each destination are checked before reading a bounded response. */
export async function readPublicUrl(raw: string, maxBytes: number, allowedMime: RegExp): Promise<{ url: string; mime: string; buffer: Buffer }> {
  let target = raw;
  for (let redirect = 0; redirect <= 3; redirect++) {
    const safe = await validateUrl(target);
    const response = await fetch(safe, { redirect: 'manual', signal: AbortSignal.timeout(12_000), headers: { 'User-Agent': 'AiWebVideo product reference/1.0', Accept: 'text/html,image/*' } });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get('location');
      await response.body?.cancel();
      if (!next) break;
      target = new URL(next, safe).toString();
      continue;
    }
    const mime = (response.headers.get('content-type') || '').split(';')[0].toLowerCase();
    if (!response.ok || !allowedMime.test(mime) || Number(response.headers.get('content-length') || 0) > maxBytes) {
      await response.body?.cancel();
      throw new AppError('Could not read this product. Upload product images instead.', 422, 'PRODUCT_READ_FAILED');
    }
    const reader = response.body?.getReader();
    if (!reader) throw new AppError('Product response is empty.', 422, 'PRODUCT_READ_FAILED');
    const chunks: Buffer[] = []; let length = 0;
    try {
      while (true) {
        const { done, value } = await reader.read(); if (done) break;
        length += value.byteLength;
        if (length > maxBytes) throw new AppError('Product response is too large.', 422, 'PRODUCT_READ_FAILED');
        chunks.push(Buffer.from(value));
      }
    } finally { await reader.cancel().catch(() => {}); }
    return { url: safe, mime, buffer: Buffer.concat(chunks) };
  }
  throw new AppError('Could not follow this product link. Upload product images instead.', 422, 'PRODUCT_READ_FAILED');
}
