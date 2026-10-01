/** Reads a product page's HTML and returns the title, description and the best product images. */

export interface ProductFacts {
  brand?: string;
  price?: string;
  currency?: string;
  availability?: string;
  sku?: string;
  category?: string;
  color?: string;
  material?: string;
}

export interface ParsedProductPage {
  title: string;
  description: string;
  images: string[];
  /** What the page itself says about the product (used to brief the AI accurately). */
  facts: ProductFacts;
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


/**
 * Thumbnails are common on shop pages ("..._100x100.jpg"). The AI should be given the sharp photo, so known
 * CDN size tokens are removed to get the original file. Unknown hosts are left exactly as they are.
 */
export function upgradeImageUrl(raw: string): string {
  try {
    const url = new URL(raw);
    const host = url.hostname.toLowerCase();
    if (/(^|\.)media-amazon\.com$|(^|\.)ssl-images-amazon\.com$/.test(host)) {
      url.pathname = url.pathname.replace(/\._[A-Za-z0-9,_-]+_\.(jpe?g|png|webp)$/i, '.$1');
    } else if (/(^|\.)cdn\.shopify\.com$|(^|\.)shopifycdn\.com$/.test(host)) {
      url.pathname = url.pathname.replace(/_(?:\d+x\d*|\d*x\d+|pico|icon|thumb|small|compact|medium|large|grande)(?=\.(?:jpe?g|png|webp)$)/i, '');
      for (const key of ['width', 'height', 'w', 'h']) url.searchParams.delete(key);
    } else if (/(^|\.)alicdn\.com$/.test(host)) {
      url.pathname = url.pathname.replace(/(\.(?:jpe?g|png|webp))_\d+x\d+[a-z0-9]*\.(?:jpe?g|png|webp)(?:_\.webp)?$/i, '$1');
    }
    return url.toString();
  } catch { return raw; }
}

function pushUnique(list: string[], value: string) {
  if (value && !list.includes(value)) list.push(value);
}

/** Amazon keeps every size of the main photo in a JSON attribute: pick the biggest. */
function amazonDynamicImages(html: string): string[] {
  const found: string[] = [];
  for (const tag of html.match(/<img\b[^>]*data-a-dynamic-image[^>]*>/gi) ?? []) {
    try {
      const map = JSON.parse(attr(tag, 'data-a-dynamic-image')) as Record<string, [number, number]>;
      const best = Object.entries(map).sort((a, b) => (b[1][0] * b[1][1]) - (a[1][0] * a[1][1]))[0];
      if (best) pushUnique(found, best[0]);
    } catch { /* ignore */ }
  }
  return found;
}

/** <picture><source srcset> and preload hints list photos that never appear as a plain <img src>. */
function sourceImages(html: string): string[] {
  const found: string[] = [];
  for (const tag of html.match(/<source\b[^>]*>/gi) ?? []) {
    const best = largestFromSrcset(attr(tag, 'srcset') || attr(tag, 'data-srcset'));
    if (best && !/\.(svg|gif)(\?|$)/i.test(best) && !JUNK.test(best)) pushUnique(found, best);
  }
  for (const tag of html.match(/<link\b[^>]*>/gi) ?? []) {
    if (/preload/i.test(attr(tag, 'rel')) && /image/i.test(attr(tag, 'as'))) {
      const href = attr(tag, 'href');
      if (href && !JUNK.test(href)) pushUnique(found, href);
    }
  }
  return found;
}

/** Modern shops hydrate from a JSON blob (Next.js and similar). Image URLs inside it are the real gallery. */
function embeddedStateImages(html: string): string[] {
  const found: string[] = [];
  for (const match of html.matchAll(/<script\b[^>]*(?:id\s*=\s*["']__NEXT_DATA__["']|type\s*=\s*["']application\/json["'])[^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const walk = (node: unknown, depth: number) => {
        if (found.length >= 12 || depth > 14) return;
        if (typeof node === 'string') {
          if (/^https?:\/\/[^\s"']+\.(?:jpe?g|png|webp)(?:\?[^\s"']*)?$/i.test(node) && !JUNK.test(node)) pushUnique(found, node);
        } else if (Array.isArray(node)) node.forEach((item) => walk(item, depth + 1));
        else if (node && typeof node === 'object') Object.values(node as Record<string, unknown>).forEach((item) => walk(item, depth + 1));
      };
      walk(JSON.parse(match[1]), 0);
    } catch { /* not JSON we understand */ }
  }
  return found;
}

function text(value: unknown): string | undefined {
  if (typeof value === 'string') return value.trim().slice(0, 120) || undefined;
  if (value && typeof value === 'object') return text((value as Record<string, unknown>).name);
  return undefined;
}

function productFacts(product: Record<string, unknown> | undefined, html: string): ProductFacts {
  const facts: ProductFacts = {};
  if (product) {
    facts.brand = text(product.brand);
    facts.sku = text(product.sku);
    facts.category = text(product.category);
    facts.color = text(product.color);
    facts.material = text(product.material);
    const offer = (Array.isArray(product.offers) ? product.offers[0] : product.offers) as Record<string, unknown> | undefined;
    if (offer && typeof offer === 'object') {
      const price = offer.price ?? offer.lowPrice;
      if (price !== undefined && price !== null && String(price).trim()) facts.price = String(price).slice(0, 20);
      facts.currency = text(offer.priceCurrency);
      facts.availability = text(offer.availability)?.replace(/^https?:\/\/schema\.org\//i, '');
    }
  }
  facts.price ??= meta(html, 'product:price:amount') || meta(html, 'og:price:amount') || undefined;
  facts.currency ??= meta(html, 'product:price:currency') || meta(html, 'og:price:currency') || undefined;
  facts.brand ??= meta(html, 'product:brand') || meta(html, 'og:brand') || undefined;
  return Object.fromEntries(Object.entries(facts).filter(([, value]) => value)) as ProductFacts;
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
    ...amazonDynamicImages(html),
    ...embeddedStateImages(html),
    ...sourceImages(html),
    ...pageImages(html),
  ];
  const images: string[] = [];
  for (const value of raw) {
    if (!value) continue;
    try {
      const url = new URL(decode(value), baseUrl);
      if (!['https:', 'http:'].includes(url.protocol)) continue;
      const href = upgradeImageUrl(url.toString());
      if (!images.includes(href)) images.push(href);
    } catch { /* skip malformed URLs */ }
  }
  return {
    title: String(product?.name || meta(html, 'og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim().slice(0, 180),
    description: String(product?.description || meta(html, 'og:description') || meta(html, 'description') || '').trim().slice(0, 500),
    images: images.slice(0, 12),
    facts: productFacts(product, html),
  };
}
