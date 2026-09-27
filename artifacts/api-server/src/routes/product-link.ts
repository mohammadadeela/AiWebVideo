import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { validateUrl, SsrfError } from '../lib/ssrf.js';

const router = Router();

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function metaContent(html: string, keys: string[]) {
  for (const key of keys) {
    const escaped = key.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
    const patterns = [
      new RegExp('<meta[^>]+(?:property|name)=["\\\']' + escaped + '["\\\'][^>]+content=["\\\']([^"\\\']+)["\\\'][^>]*>', 'i'),
      new RegExp('<meta[^>]+content=["\\\']([^"\\\']+)["\\\'][^>]+(?:property|name)=["\\\']' + escaped + '["\\\'][^>]*>', 'i'),
    ];
    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match?.[1]) return decodeHtml(match[1]);
    }
  }
  return '';
}

function pageTitle(html: string) {
  const meta = metaContent(html, ['og:title', 'twitter:title']);
  if (meta) return meta;
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  return match?.[1] ? decodeHtml(match[1].replace(/<[^>]+>/g, ' ')) : '';
}

function imageCandidates(html: string, baseUrl: string) {
  const raw: string[] = [];
  for (const key of ['og:image', 'og:image:url', 'twitter:image']) {
    const value = metaContent(html, [key]);
    if (value) raw.push(value);
  }
  const imageRegex = /<img\b[^>]*(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
  let match: RegExpExecArray | null;
  while ((match = imageRegex.exec(html)) && raw.length < 30) raw.push(match[1]);

  const unique = new Set<string>();
  for (const candidate of raw) {
    try {
      const url = new URL(candidate, baseUrl);
      if (!['http:', 'https:'].includes(url.protocol)) continue;
      unique.add(url.toString());
    } catch {}
  }
  return [...unique];
}

async function safeFetch(rawUrl: string, init: RequestInit, maxRedirects = 5): Promise<Response> {
  let current = await validateUrl(rawUrl);
  for (let hop = 0; hop <= maxRedirects; hop++) {
    const response = await fetch(current, { ...init, redirect: 'manual' });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location) return response;
    current = await validateUrl(new URL(location, current).toString());
  }
  throw new Error('Too many redirects.');
}

async function downloadProductImage(rawUrl: string, index: number) {
  const response = await safeFetch(rawUrl, {
    signal: AbortSignal.timeout(12_000),
    headers: {
      'User-Agent': 'AiWebVideo/1.0 product-reference-fetcher',
      Accept: 'image/avif,image/webp,image/png,image/jpeg,*/*;q=0.4',
    },
  });
  if (!response.ok) throw new Error('Image returned HTTP ' + response.status);
  const mimeType = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(mimeType)) throw new Error('Unsupported image format');
  const size = Number(response.headers.get('content-length') ?? 0);
  if (size > 5 * 1024 * 1024) throw new Error('Product image is too large');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (!bytes.length || bytes.length > 5 * 1024 * 1024) throw new Error('Product image is too large');
  const ext = mimeType === 'image/png' ? 'png' : mimeType === 'image/webp' ? 'webp' : 'jpg';
  return {
    name: 'product-link-' + (index + 1) + '.' + ext,
    mimeType,
    dataBase64: bytes.toString('base64'),
  };
}

router.post('/preview', async (req, res) => {
  try {
    const input = z.object({ url: z.string().trim().min(4).max(2000) }).parse(req.body);
    const normalized = /^https?:\/\//i.test(input.url) ? input.url : 'https://' + input.url;
    let safeUrl: string;
    try {
      safeUrl = await validateUrl(normalized);
    } catch (error) {
      if (error instanceof SsrfError) throw new AppError(error.message, 400, 'SSRF_BLOCKED');
      throw error;
    }

    const response = await safeFetch(safeUrl, {
      signal: AbortSignal.timeout(15_000),
      headers: {
        'User-Agent': 'Mozilla/5.0 AiWebVideo Product Link Preview',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!response.ok) throw new AppError('The product page returned HTTP ' + response.status + '.', 400, 'PRODUCT_LINK_FETCH_FAILED');
    const type = response.headers.get('content-type') ?? '';
    if (!/text\/html|application\/xhtml\+xml/i.test(type)) throw new AppError('That link is not a product webpage.', 400, 'PRODUCT_LINK_FETCH_FAILED');
    const html = (await response.text()).slice(0, 2_000_000);
    const sourceUrl = response.url || safeUrl;
    const title = pageTitle(html).slice(0, 240) || new URL(sourceUrl).hostname;
    const description = metaContent(html, ['og:description', 'description', 'twitter:description']).slice(0, 1200);
    const candidates = imageCandidates(html, sourceUrl).slice(0, 10);
    const settled = await Promise.allSettled(candidates.map((url, index) => downloadProductImage(url, index)));
    const images = settled
      .filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof downloadProductImage>>> => result.status === 'fulfilled')
      .map((result) => result.value)
      .slice(0, 4);

    if (!images.length) {
      throw new AppError('We found the product page, but no usable product image could be imported. Attach a product photo instead.', 422, 'PRODUCT_LINK_NO_IMAGE');
    }

    res.json({ title, description, sourceUrl, images });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
