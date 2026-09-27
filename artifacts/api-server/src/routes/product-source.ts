import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { validateUrl } from '../lib/ssrf.js';

const router = Router();
const MAX_HTML_BYTES = 1_500_000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const MAX_REDIRECTS = 4;

function decodeEntities(value: string) {
  return value
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&#x27;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(tag: string, name: string) {
  const escaped = name.replace(/[.*+?^$()|[\]\\{}]/g, '\\$&');
  const doubleQuoted = tag.match(new RegExp('\\b' + escaped + '\\s*=\\s*"([^"]*)"', 'i'));
  const singleQuoted = tag.match(new RegExp("\\b" + escaped + "\\s*=\\s*'([^']*)'", 'i'));
  const unquoted = tag.match(new RegExp('\\b' + escaped + '\\s*=\\s*([^\\s>]+)', 'i'));
  return decodeEntities(doubleQuoted?.[1] ?? singleQuoted?.[1] ?? unquoted?.[1] ?? '');
}

function meta(html: string, keys: string[]) {
  const wanted = new Set(keys.map((key) => key.toLowerCase()));
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const key = (attr(tag, 'property') || attr(tag, 'name') || attr(tag, 'itemprop')).toLowerCase();
    if (wanted.has(key)) {
      const content = attr(tag, 'content');
      if (content) return content;
    }
  }
  return '';
}

function firstTitle(html: string) {
  const social = meta(html, ['og:title', 'twitter:title']);
  if (social) return social;
  const match = html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i);
  return decodeEntities(match?.[1] ?? '');
}

function absoluteHttpUrl(value: string, base: string) {
  if (!value) return null;
  try {
    const parsed = new URL(value, base);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.toString() : null;
  } catch {
    return null;
  }
}

async function safeFetch(rawUrl: string, init: RequestInit = {}) {
  let current = await validateUrl(rawUrl);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      ...init,
      redirect: 'manual',
      signal: AbortSignal.timeout(12_000),
      headers: {
        'user-agent': 'Mozilla/5.0 (compatible; AiWebVideoProductImporter/1.0)',
        ...(init.headers ?? {}),
      },
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      if (!location || redirect === MAX_REDIRECTS) throw new Error('Product page redirected too many times.');
      current = await validateUrl(new URL(location, current).toString());
      continue;
    }
    return { response, finalUrl: current };
  }
  throw new Error('Product page could not be opened.');
}

router.post('/resolve', requireAuth, async (req, res) => {
  const input = z.object({ url: z.string().min(4).max(2_000) }).parse(req.body);
  const { response, finalUrl } = await safeFetch(input.url, {
    headers: { accept: 'text/html,application/xhtml+xml' },
  });
  if (!response.ok) {
    res.status(422).json({ error: 'Product page returned HTTP ' + response.status + '.', code: 'PRODUCT_SOURCE_UNAVAILABLE' });
    return;
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('text/html')) {
    res.status(422).json({ error: 'That URL is not an HTML product page.', code: 'PRODUCT_SOURCE_NOT_HTML' });
    return;
  }
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_HTML_BYTES) {
    res.status(413).json({ error: 'Product page is too large to import safely.', code: 'PRODUCT_SOURCE_TOO_LARGE' });
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_HTML_BYTES) {
    res.status(413).json({ error: 'Product page is too large to import safely.', code: 'PRODUCT_SOURCE_TOO_LARGE' });
    return;
  }
  const html = buffer.toString('utf8');
  const imageCandidates = [
    meta(html, ['og:image:secure_url']),
    meta(html, ['og:image']),
    meta(html, ['twitter:image']),
    meta(html, ['twitter:image:src']),
    meta(html, ['image']),
  ]
    .map((value) => absoluteHttpUrl(value, finalUrl))
    .filter((value): value is string => Boolean(value));
  const images = [...new Set(imageCandidates)].slice(0, 3);

  res.json({
    url: finalUrl,
    title: firstTitle(html).slice(0, 240),
    description: meta(html, ['og:description', 'twitter:description', 'description']).slice(0, 1_200),
    images,
  });
});

router.get('/image', requireAuth, async (req, res) => {
  const rawUrl = z.string().min(4).max(4_000).parse(req.query.url);
  const { response } = await safeFetch(rawUrl, { headers: { accept: 'image/webp,image/png,image/jpeg' } });
  if (!response.ok) {
    res.status(422).json({ error: 'Product image could not be downloaded.', code: 'PRODUCT_IMAGE_UNAVAILABLE' });
    return;
  }
  const type = response.headers.get('content-type')?.split(';')[0]?.trim() ?? '';
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) {
    res.status(415).json({ error: 'Product source did not return a supported image.', code: 'PRODUCT_IMAGE_INVALID' });
    return;
  }
  const declared = Number(response.headers.get('content-length') ?? 0);
  if (declared > MAX_IMAGE_BYTES) {
    res.status(413).json({ error: 'Product image is larger than 10MB.', code: 'PRODUCT_IMAGE_TOO_LARGE' });
    return;
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length > MAX_IMAGE_BYTES) {
    res.status(413).json({ error: 'Product image is larger than 10MB.', code: 'PRODUCT_IMAGE_TOO_LARGE' });
    return;
  }
  res.setHeader('Cache-Control', 'private, no-store');
  res.type(type).send(buffer);
});

export default router;
