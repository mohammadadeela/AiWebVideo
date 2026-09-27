import { Router } from 'express';
import { z } from 'zod';
import { validateUrl } from '../lib/ssrf.js';

const router = Router();
const productSchema = z.object({ url: z.string().trim().min(4).max(2000) });
const locationSchema = z.object({ location: z.string().trim().min(2).max(2000) });

function decodeHtml(value: string) {
  return value.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;|&#x27;/gi, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>').replace(/\s+/g, ' ').trim();
}

function meta(html: string, keys: string[]) {
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
  return null;
}

function titleFromHtml(html: string) {
  return meta(html, ['og:title', 'twitter:title']) ?? decodeHtml(html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '');
}

async function safeFetch(rawUrl: string, init: RequestInit = {}, maxRedirects = 4): Promise<{ response: Response; finalUrl: string }> {
  let current = await validateUrl(rawUrl);
  for (let i = 0; i <= maxRedirects; i += 1) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const response = await fetch(current, {
        ...init,
        redirect: 'manual',
        signal: controller.signal,
        headers: {
          'User-Agent': 'AiWebVideo/1.0 (+https://aiwebvideo.com)',
          Accept: 'text/html,application/xhtml+xml,image/avif,image/webp,image/png,image/jpeg;q=0.9,*/*;q=0.2',
          ...(init.headers ?? {}),
        },
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location) return { response, finalUrl: current };
        current = await validateUrl(new URL(location, current).toString());
        continue;
      }
      return { response, finalUrl: current };
    } finally {
      clearTimeout(timer);
    }
  }
  throw new Error('Too many redirects.');
}

async function imageDataUrl(rawUrl: string) {
  const { response } = await safeFetch(rawUrl);
  if (!response.ok) throw new Error('Image download failed.');
  const type = (response.headers.get('content-type') ?? '').split(';')[0].trim().toLowerCase();
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/avif'].includes(type)) throw new Error('Unsupported product image.');
  const length = Number(response.headers.get('content-length') ?? '0');
  if (length > 8 * 1024 * 1024) throw new Error('Product image is too large.');
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 8 * 1024 * 1024) throw new Error('Product image is too large.');
  return 'data:' + type + ';base64,' + bytes.toString('base64');
}

router.post('/product', async (req, res) => {
  try {
    const input = productSchema.parse(req.body);
    const normalized = /^https?:\/\//i.test(input.url) ? input.url : 'https://' + input.url;
    const { response, finalUrl } = await safeFetch(normalized);
    if (!response.ok) {
      res.status(422).json({ error: 'We could not read that product page.', code: 'PRODUCT_PAGE_UNAVAILABLE' });
      return;
    }
    const type = (response.headers.get('content-type') ?? '').toLowerCase();
    if (!type.includes('text/html') && !type.includes('application/xhtml+xml')) {
      res.status(415).json({ error: 'That link does not look like a product webpage.', code: 'PRODUCT_PAGE_TYPE' });
      return;
    }
    const html = await response.text();
    if (html.length > 4_000_000) {
      res.status(413).json({ error: 'That product page is too large to inspect safely.', code: 'PRODUCT_PAGE_TOO_LARGE' });
      return;
    }
    const title = titleFromHtml(html) || new URL(finalUrl).hostname;
    const description = meta(html, ['og:description', 'twitter:description', 'description']) ?? '';
    const rawImages = [
      meta(html, ['og:image:secure_url', 'og:image', 'twitter:image']),
      ...Array.from(html.matchAll(/<img[^>]+(?:src|data-src)=["']([^"']+)["']/gi)).slice(0, 10).map((match) => match[1]),
    ].filter((value): value is string => Boolean(value));

    let imageUrl: string | null = null;
    let imageData: string | null = null;
    for (const candidate of rawImages) {
      try {
        const absolute = new URL(candidate, finalUrl).toString();
        await validateUrl(absolute);
        imageData = await imageDataUrl(absolute);
        imageUrl = absolute;
        break;
      } catch {}
    }

    res.json({ product: { sourceUrl: finalUrl, title: title.slice(0, 240), description: description.slice(0, 1200), imageUrl, imageData } });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid product link.', code: 'PRODUCT_LINK_INVALID' });
  }
});

function locationFromInput(value: string) {
  const trimmed = value.trim();
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  const parsed = new URL(trimmed);
  const at = parsed.pathname.match(/@(-?\d+(?:\.\d+)?),(-?\d+(?:\.\d+)?)/);
  if (at) return at[1] + ',' + at[2];
  for (const key of ['q', 'query', 'center', 'destination']) {
    const item = parsed.searchParams.get(key);
    if (item) return item;
  }
  const decodedPath = decodeURIComponent(parsed.pathname.replace(/\+/g, ' '));
  const place = decodedPath.match(/\/place\/([^/]+)/i)?.[1];
  if (place) return place.replace(/\+/g, ' ');
  return trimmed;
}

router.post('/location-preview', async (req, res) => {
  try {
    const input = locationSchema.parse(req.body);
    const apiKey = process.env.GOOGLE_MAPS_STATIC_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'Location preview is not configured yet. Add GOOGLE_MAPS_STATIC_API_KEY on the server.', code: 'MAPS_NOT_CONFIGURED' });
      return;
    }
    const center = locationFromInput(input.location);
    const params = new URLSearchParams({ center, zoom: '19', size: '900x900', scale: '2', maptype: 'satellite', key: apiKey });
    params.append('markers', 'color:0x8b5cf6|' + center);
    const response = await fetch('https://maps.googleapis.com/maps/api/staticmap?' + params.toString(), { signal: AbortSignal.timeout(10000) });
    if (!response.ok) {
      res.status(422).json({ error: 'Google Maps could not resolve that location.', code: 'LOCATION_NOT_FOUND' });
      return;
    }
    const type = (response.headers.get('content-type') ?? 'image/png').split(';')[0];
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length > 8 * 1024 * 1024) {
      res.status(413).json({ error: 'Location preview is too large.', code: 'LOCATION_PREVIEW_TOO_LARGE' });
      return;
    }
    res.json({ preview: { label: center, imageData: 'data:' + type + ';base64,' + bytes.toString('base64'), disclaimer: 'AI visualization for concept purposes — not a surveyed or construction-accurate plan.' } });
  } catch (error) {
    res.status(400).json({ error: error instanceof Error ? error.message : 'Invalid location.', code: 'LOCATION_INVALID' });
  }
});

export default router;
