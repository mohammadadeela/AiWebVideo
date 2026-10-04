import { AppError } from './errors.js';
import { validateUrl } from './ssrf.js';

/**
 * A current desktop Chrome identity. Shops answer a plain "node" or tool-named client with a different (often empty or
 * blocked) page than they give a visitor, so reading a product page the way a visitor's browser asks for it is the
 * honest, ordinary way to see what the visitor sees. This never solves a challenge, signs in or tries to get around an
 * explicit access control: a shop that still refuses is reported as blocked and the customer is asked for a photo.
 */
export const BROWSER_USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36';

const MAX_REDIRECTS = 5;
const HOP_TIMEOUT_MS = 12_000;
const TOTAL_TIMEOUT_MS = 25_000;

export interface PublicRead {
  url: string;
  mime: string;
  buffer: Buffer;
  /** Final HTTP status (diagnostics only). */
  status: number;
  /** Every address visited on the way, host and path only (never query strings, never cookies). */
  hops: string[];
}

export interface PublicReadOptions {
  referer?: string;
  /** When the answer is a picture, return straight away without downloading it (it is only being recognised). */
  stopAtImage?: boolean;
  /** Receives plain-language diagnostic lines for the admin link checker. */
  trace?: string[];
  /** Which kind of request this is (headers differ for pages, pictures and data); inferred from the accepted types when omitted. */
  kind?: 'document' | 'image' | 'json';
}

type Kind = 'document' | 'image' | 'json';

function headersFor(kind: Kind, referer?: string): Record<string, string> {
  const common: Record<string, string> = {
    'User-Agent': BROWSER_USER_AGENT,
    'Accept-Language': 'en-US,en;q=0.9',
    'Sec-CH-UA': '"Chromium";v="131", "Not_A Brand";v="24"',
    'Sec-CH-UA-Mobile': '?0',
    'Sec-CH-UA-Platform': '"Windows"',
  };
  if (kind === 'image') {
    return { ...common, Accept: 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8', 'Sec-Fetch-Dest': 'image', 'Sec-Fetch-Mode': 'no-cors', 'Sec-Fetch-Site': 'cross-site', ...(referer ? { Referer: referer } : {}) };
  }
  if (kind === 'json') {
    return { ...common, Accept: 'application/json, text/javascript, */*;q=0.5', 'Sec-Fetch-Dest': 'empty', 'Sec-Fetch-Mode': 'cors', 'Sec-Fetch-Site': 'same-origin', ...(referer ? { Referer: referer } : {}) };
  }
  return {
    ...common,
    // image/* stays acceptable: a pasted link may itself be a picture, and that is recognised by its content type.
    Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/*;q=0.8,*/*;q=0.7',
    'Upgrade-Insecure-Requests': '1',
    'Sec-Fetch-Dest': 'document',
    'Sec-Fetch-Mode': 'navigate',
    'Sec-Fetch-Site': referer ? 'cross-site' : 'none',
    'Sec-Fetch-User': '?1',
    ...(referer ? { Referer: referer } : {}),
  };
}

function kindOf(allowedMime: RegExp): Kind {
  if (allowedMime.test('image/jpeg')) return 'image';
  if (allowedMime.test('application/json')) return 'json';
  return 'document';
}

/** Many shops set a cookie on the first redirect (a region or a session) and bounce forever without it, as they would for any browser. */
function collectCookies(response: Response, jar: Map<string, string>) {
  const lines = (response.headers as Headers & { getSetCookie?: () => string[] }).getSetCookie?.() ?? [];
  for (const line of lines) {
    const pair = line.split(';')[0] ?? '';
    const at = pair.indexOf('=');
    if (at > 0) jar.set(pair.slice(0, at).trim(), pair.slice(at + 1).trim());
  }
}

const hostAndPath = (url: string) => { try { const u = new URL(url); return `${u.hostname}${u.pathname}`.slice(0, 120); } catch { return 'invalid url'; } };

/** Redirects and each destination are checked before reading a bounded response. */
export async function readPublicUrl(raw: string, maxBytes: number, allowedMime: RegExp, options: PublicReadOptions = {}): Promise<PublicRead> {
  const kind = options.kind ?? kindOf(allowedMime);
  const deadline = Date.now() + TOTAL_TIMEOUT_MS;
  const hops: string[] = [];
  let jar = new Map<string, string>();
  let jarHost = '';
  let target = raw;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const safe = await validateUrl(target);          // EVERY hop is validated again, including DNS
    hops.push(hostAndPath(safe));
    const host = new URL(safe).hostname;
    if (host !== jarHost) { jar = new Map(); jarHost = host; }   // cookies never travel to another host
    const remaining = deadline - Date.now();
    if (remaining <= 0) throw new AppError('The shop took too long to answer.', 422, 'PRODUCT_TIMEOUT');

    const headers = headersFor(kind, options.referer);
    if (jar.size) headers.Cookie = [...jar].map(([name, value]) => `${name}=${value}`).join('; ');
    let response: Response;
    try {
      response = await fetch(safe, { redirect: 'manual', signal: AbortSignal.timeout(Math.min(HOP_TIMEOUT_MS, remaining)), headers });
    } catch (error) {
      const timedOut = error instanceof Error && (error.name === 'TimeoutError' || error.name === 'AbortError');
      options.trace?.push(`${hostAndPath(safe)}: ${timedOut ? 'no answer in time' : 'connection failed'}`);
      throw new AppError(timedOut ? 'The shop took too long to answer.' : 'Could not reach this shop.', 422, timedOut ? 'PRODUCT_TIMEOUT' : 'PRODUCT_READ_FAILED');
    }
    collectCookies(response, jar);

    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const next = response.headers.get('location');
      await response.body?.cancel();
      options.trace?.push(`HTTP ${response.status} redirect from ${hostAndPath(safe)}`);
      if (!next) break;
      target = new URL(next, safe).toString();
      continue;
    }
    const mime = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
    options.trace?.push(`HTTP ${response.status} ${mime || 'no content type'} from ${hostAndPath(safe)}`);
    if ([401, 403, 429, 451, 503].includes(response.status)) {
      // The shop (or its bot protection) refuses automatic readers: say so, so the next step can differ.
      await response.body?.cancel();
      throw new AppError('This shop blocks automatic reading.', 422, 'PRODUCT_BLOCKED');
    }
    if (options.stopAtImage && response.ok && /^image\/(?:jpe?g|png|webp|avif)$/.test(mime)) {
      await response.body?.cancel();
      return { url: safe, mime, buffer: Buffer.alloc(0), status: response.status, hops };
    }
    if (!response.ok || !allowedMime.test(mime) || Number(response.headers.get('content-length') || 0) > maxBytes) {
      await response.body?.cancel();
      throw new AppError('Could not read this product. Upload product images instead.', 422, response.ok && mime && !allowedMime.test(mime) ? 'PRODUCT_UNSUPPORTED_RESPONSE' : 'PRODUCT_READ_FAILED');
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
    return { url: safe, mime, buffer: Buffer.concat(chunks), status: response.status, hops };
  }
  throw new AppError('Could not follow this product link. Upload product images instead.', 422, 'PRODUCT_READ_FAILED');
}
