import { Router } from 'express';
import { z } from 'zod';
import { AppError, sendError } from '../lib/errors.js';
import { readPublicUrl } from '../lib/external-reference.js';
import { validateUrl } from '../lib/ssrf.js';

const router = Router();
const attempts = new Map<string, { count: number; reset: number }>();
function decode(text: string) { return text.replace(/&amp;/gi, '&').replace(/&quot;/gi, '"').replace(/&#39;/g, "'").replace(/&lt;/gi, '<').replace(/&gt;/gi, '>'); }
function meta(html: string, key: string) {
  const tags = html.match(/<meta\b[^>]*>/gi) || [];
  for (const tag of tags) if (new RegExp(`(?:property|name)=["']${key}["']`, 'i').test(tag)) return decode(tag.match(/content=["']([^"']+)["']/i)?.[1] || '');
  return '';
}
function productData(html: string): Array<Record<string, unknown>> {
  const scripts = [...html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)];
  const products: Array<Record<string, unknown>> = [];
  for (const script of scripts) try {
    const parsed: unknown = JSON.parse(script[1]);
    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object') return;
      if (Array.isArray(node)) { node.forEach(walk); return; }
      const object = node as Record<string, unknown>;
      if (String(object['@type']).toLowerCase() === 'product') products.push(object);
      if (object['@graph']) walk(object['@graph']);
    };
    walk(parsed);
  } catch { /* invalid structured data is optional */ }
  return products;
}

function imageValues(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (Array.isArray(value)) return value.flatMap(imageValues);
  if (value && typeof value === 'object') {
    const image = value as Record<string, unknown>;
    return imageValues(image.contentUrl ?? image.url ?? image.src);
  }
  return [];
}

function socialImages(html: string): string[] {
  return (html.match(/<meta\b[^>]*>/gi) ?? []).filter((tag) =>
    /(?:property|name)=["'](?:og:image|twitter:image)(?::url)?["']/i.test(tag))
    .map((tag) => decode(tag.match(/content=["']([^"']+)["']/i)?.[1] || '')).filter(Boolean);
}

router.post('/extract', async (req, res) => {
  try {
    const ip = req.ip ?? req.socket.remoteAddress ?? 'unknown';
    const now = Date.now(); const previous = attempts.get(ip);
    const next = !previous || previous.reset < now ? { count: 1, reset: now + 10 * 60_000 } : { count: previous.count + 1, reset: previous.reset };
    attempts.set(ip, next);
    if (next.count > 10) throw new AppError('Try again in a few minutes.', 429, 'RATE_LIMITED');
    if (attempts.size > 2000) for (const [key, value] of attempts) if (value.reset < now) attempts.delete(key);
    const { url } = z.object({ url: z.string().trim().url().max(2048) }).parse(req.body);
    const fetched = await readPublicUrl(url, 2 * 1024 * 1024, /^text\/html$/);
    const html = fetched.buffer.toString('utf8');
    const product = productData(html)[0];
    const rawImages = [...imageValues(product?.image), ...socialImages(html)];
    const candidates = [...new Set(rawImages
      .map((value) => { try { const candidate = new URL(decode(value), fetched.url); return ['https:', 'http:'].includes(candidate.protocol) ? candidate.toString() : ''; } catch { return ''; } })
      .filter(Boolean))].slice(0, 8);
    const images = (await Promise.all(candidates.map((candidate) => validateUrl(candidate).catch(() => null)))).filter((value): value is string => Boolean(value));
    if (!images.length) throw new AppError('Could not find product images. Upload product images instead.', 422, 'PRODUCT_IMAGES_MISSING');
    res.json({ title: String(product?.name || meta(html, 'og:title') || '').slice(0, 180), description: String(product?.description || meta(html, 'og:description') || '').slice(0, 500), url: fetched.url, images });
  } catch (error) { sendError(res, error); }
});
export default router;
