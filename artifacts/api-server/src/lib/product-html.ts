/** Reads a product page's HTML and returns the title, description and the best product images. */

export interface ParsedProductPage {
  title: string;
  description: string;
  images: string[];
}

function decode(text: string) {
  return text
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#x2F;/gi, '/');
}

function attr(tag: string, name: string) {
  const match = new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, 'i').exec(tag);
  return decode(match?.[2] ?? match?.[3] ?? match?.[4] ?? '');
}

function meta(html: string, key: string) {
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const name = attr(tag, 'property') || attr(tag, 'name');
    if (name.toLowerCase() === key) return attr(tag, 'content');
  }
  return '';
}

function typesOf(node: Record<string, unknown>): string[] {
  const raw = node['@type'];
  return (Array.isArray(raw) ? raw : [raw]).map((value) => String(value ?? '').toLowerCase());
}

export function productNodes(html: string): Array<Record<string, unknown>> {
  const found: Array<Record<string, unknown>> = [];
  for (const script of html.matchAll(/<script\b[^>]*type\s*=\s*["']?application\/ld\+json["']?[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (node: unknown) => {
        if (!node || typeof node !== 'object') return;
        if (Array.isArray(node)) { node.forEach(walk); return; }
        const object = node as Record<string, unknown>;
        const types = typesOf(object);
        if (types.includes('product') || types.includes('productgroup')) found.push(object);
        for (const key of ['@graph', 'mainEntity', 'hasVariant', 'itemListElement', 'item']) walk(object[key]);
      };
      walk(JSON.parse(script[1]));
    } catch { /* invalid structured data is optional */ }
  }
  return found;
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

const JUNK = /(sprite|logo|icon|favicon|avatar|badge|flag|payment|paypal|visa|mastercard|pixel|tracking|spinner|loader|placeholder|blank|banner|social|facebook|instagram|twitter|star|rating|arrow|cart|menu|close|search)/i;

function largestFromSrcset(srcset: string) {
  const candidates = srcset.split(',').map((part) => part.trim().split(/\s+/)).filter((part) => part[0]);
  candidates.sort((a, b) => (parseFloat(b[1] ?? '0') || 0) - (parseFloat(a[1] ?? '0') || 0));
  return candidates[0]?.[0] ?? '';
}

/** <img> fallback for shops with no structured data or social image. Ranked by "looks like the product photo". */
function pageImages(html: string): string[] {
  const scored: Array<{ url: string; score: number }> = [];
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  tags.forEach((tag, index) => {
    const raw = attr(tag, 'data-zoom-image') || attr(tag, 'data-large-image') || attr(tag, 'data-original')
      || largestFromSrcset(attr(tag, 'srcset') || attr(tag, 'data-srcset')) || attr(tag, 'data-src') || attr(tag, 'src');
    if (!raw || raw.startsWith('data:') || /\.(svg|gif)(\?|$)/i.test(raw)) return;
    const identity = `${raw} ${attr(tag, 'alt')} ${attr(tag, 'class')} ${attr(tag, 'id')}`;
    if (JUNK.test(identity)) return;
    const width = Number(attr(tag, 'width')) || 0;
    const height = Number(attr(tag, 'height')) || 0;
    if ((width && width < 120) || (height && height < 120)) return;
    let score = 100 - Math.min(index, 60);
    if (/product|gallery|main|primary|featured|zoom|hero/i.test(identity)) score += 60;
    if (/\.(jpe?g|png|webp)(\?|$)/i.test(raw)) score += 10;
    if (width >= 400 || height >= 400) score += 25;
    scored.push({ url: raw, score });
  });
  return scored.sort((a, b) => b.score - a.score).map((entry) => entry.url);
}

export function parseProductPage(html: string, baseUrl: string): ParsedProductPage {
  const nodes = productNodes(html);
  const product = nodes.find((node) => typesOf(node).includes('product')) ?? nodes[0];
  const raw = [
    ...nodes.flatMap((node) => imageValues(node.image)),
    meta(html, 'og:image:secure_url'),
    meta(html, 'og:image'),
    meta(html, 'twitter:image'),
    meta(html, 'twitter:image:src'),
    ...(html.match(/<link\b[^>]*>/gi) ?? []).filter((tag) => /image_src/i.test(attr(tag, 'rel'))).map((tag) => attr(tag, 'href')),
    ...pageImages(html),
  ];
  const images: string[] = [];
  for (const value of raw) {
    if (!value) continue;
    try {
      const url = new URL(decode(value), baseUrl);
      if (!['https:', 'http:'].includes(url.protocol)) continue;
      const href = url.toString();
      if (!images.includes(href)) images.push(href);
    } catch { /* skip malformed URLs */ }
  }
  return {
    title: String(product?.name || meta(html, 'og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim().slice(0, 180),
    description: String(product?.description || meta(html, 'og:description') || meta(html, 'description') || '').trim().slice(0, 500),
    images: images.slice(0, 10),
  };
}
