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
  /** What the page offered, for diagnostics and for choosing the extraction status. */
  signals: ProductPageSignals;
}

export interface ProductPageSignals {
  /** The page has a JSON-LD block of any kind. */
  jsonLd: boolean;
  /** JSON-LD described a Product / ProductGroup. */
  productJsonLd: boolean;
  /** How many of the returned photos were declared by that product's JSON-LD. */
  jsonLdImages: number;
  ogImage: boolean;
  /** Application state (__NEXT_DATA__, __INITIAL_STATE__, Shopify product JSON...) mentioning image files. */
  embeddedState: boolean;
  /** Where the title came from: the product's own data, the social title, or only the page's <title> (often just a site name). */
  titleFrom: 'product' | 'social' | 'page';
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


/**
 * What the link and the page say this product is: its code (\"SG7459186-BNN\") and the words of its name. A picture whose
 * file name carries them is almost surely this product's own photo, while a banner or a neighbour's photo does not.
 */
export interface ProductHints { codes: string[]; words: string[] }
const NO_HINTS: ProductHints = { codes: [], words: [] };
const FILLER_WORDS = new Set(['with', 'and', 'the', 'for', 'womens', 'women', 'mens', 'men', 'kids', 'new', 'sale', 'html', 'htm', 'shop', 'buy', 'product', 'products', 'item', 'accessories', 'collection']);

export function productHintsFromUrl(rawUrl: string, extraCodes: string[] = []): ProductHints {
  const codes = new Set<string>();
  const words = new Set<string>();
  for (const code of extraCodes) { const clean = code.toLowerCase().replace(/[^a-z0-9]/g, ''); if (clean.length >= 5) codes.add(clean); }
  try {
    const segments = new URL(rawUrl).pathname.split('/').filter(Boolean).map((segment) => {
      try { return decodeURIComponent(segment); } catch { return segment; }
    });
    for (const raw of segments.slice(-3)) {
      const segment = raw.replace(/\.(?:html?|php|aspx?)$/i, '');
      // a code mixes letters and digits (\"SG7459186-BNN\", \"B0B2RM68G2\"): the whole thing, and each long piece of it
      if (/\d/.test(segment) && /[a-z]/i.test(segment) && segment.length <= 40 && !/[a-z]{4,}-[a-z]{3,}-/i.test(segment)) {
        const joined = segment.toLowerCase().replace(/[^a-z0-9]/g, '');
        if (joined.length >= 5) codes.add(joined);
        for (const piece of segment.toLowerCase().split(/[-_]/)) if (/\d/.test(piece) && piece.length >= 5) codes.add(piece.replace(/[^a-z0-9]/g, ''));
      } else if (/^\d{5,}$/.test(segment)) codes.add(segment);
      for (const word of segment.toLowerCase().split(/[-_+\s]+/)) {
        if (/^[a-z]{4,}$/.test(word) && !FILLER_WORDS.has(word)) words.add(word);
      }
    }
  } catch { /* no hints */ }
  return { codes: [...codes], words: [...words].slice(0, 12) };
}

/** How strongly an image address or its alt text points at THIS product. */
export function hintScore(identity: string, hints: ProductHints): number {
  if (!hints.codes.length && !hints.words.length) return 0;
  const squashed = identity.toLowerCase().replace(/[^a-z0-9]/g, '');
  let score = 0;
  for (const code of hints.codes) if (squashed.includes(code)) { score += 120; break; }
  const lower = identity.toLowerCase();
  const matched = hints.words.filter((word) => lower.includes(word)).length;
  if (matched >= 2) score += 40 + 10 * Math.min(matched, 4);
  return score;
}

const IMAGE_URL_IN_TEXT = /(?:https?:)?\/\/[^\s"'\\<>()]+?(?:\.(?:jpe?g|png|webp|avif)(?:\?[^\s"'\\<>()]*)?|\/is\/image\/[^\s"'\\<>()]+|\/image\/upload\/[^\s"'\\<>()]+)/gi;

/**
 * Many stores keep the whole gallery in a script (a Redux/Pinia state, a Shopify product object, a hydration blob), often
 * with escaped slashes. Every inline script is searched for picture addresses, but ONLY pictures that carry this product's
 * code or name are returned: a script also lists banners and other products, and those must never become references.
 */
export function inlineScriptImages(html: string, hints: ProductHints): string[] {
  if (!hints.codes.length && !hints.words.length) return [];
  const scored: Array<{ url: string; score: number; at: number }> = [];
  let at = 0;
  for (const script of html.matchAll(/<script\b(?![^>]*\bsrc\s*=)(?![^>]*ld\+json)[^>]*>([\s\S]*?)<\/script>/gi)) {
    const body = script[1];
    if (body.length < 40 || body.length > 3_000_000) continue;
    const text = body.replace(/\\u002F/gi, '/').replace(/\\u0026/gi, '&').replace(/\\\//g, '/').replace(/&amp;/g, '&');
    for (const match of text.matchAll(IMAGE_URL_IN_TEXT)) {
      const url = match[0].startsWith('//') ? `https:${match[0]}` : match[0];
      if (JUNK.test(url) || /\.(?:svg|gif)(?:\?|$)/i.test(url)) continue;
      const score = hintScore(url, hints);
      if (score >= 60) scored.push({ url, score, at: at++ });
    }
  }
  return narrowToFullCode(scored.sort((a, b) => b.score - a.score || a.at - b.at).slice(0, 24).map((entry) => entry.url), hints);
}

/**
 * Colours of one style share a style number ("SG7459186") and differ in the full code ("SG7459186-BNN"). When any picture
 * carries the FULL code, only those are this product's: the neighbouring colours' photos must never be offered.
 */
export function narrowToFullCode(urls: string[], hints: ProductHints): string[] {
  const full = hints.codes[0];
  if (!full || hints.codes.length < 2) return urls;
  const exact = urls.filter((url) => url.toLowerCase().replace(/[^a-z0-9]/g, '').includes(full));
  return exact.length ? exact : urls;
}

/**
 * The product the page is about. A page for one colour often lists several variants: the one whose code or address matches
 * the link wins, then the first with photos. A group with no photos of its own borrows the photos of its first variant.
 */
function pickProduct(nodes: Array<Record<string, unknown>>, hints: ProductHints): Record<string, unknown> | undefined {
  const products = nodes.filter((node) => typesOf(node).includes('product'));
  // The most specific code that appears in a variant's own sku/address wins: two colours share a style number, only one has the full code.
  const matchLength = (node: Record<string, unknown>) => {
    const own = `${text(node.sku) ?? ''} ${String(node.url ?? '')} ${String(node['@id'] ?? '')} ${text(node.mpn) ?? ''}`.toLowerCase().replace(/[^a-z0-9]/g, '');
    return hints.codes.reduce((best, code) => (own.includes(code) ? Math.max(best, code.length) : best), 0);
  };
  const hasImages = (node: Record<string, unknown>) => imageValues(node.image).length > 0;
  const matching = products.filter((node) => matchLength(node) > 0 && hasImages(node)).sort((a, b) => matchLength(b) - matchLength(a));
  return matching[0] ?? products.find(hasImages) ?? products[0] ?? nodes.find(hasImages) ?? nodes[0];
}

function largestFromSrcset(srcset: string) {
  const candidates = srcset.split(',').map((part) => part.trim().split(/\s+/)).filter((part) => part[0]);
  candidates.sort((a, b) => (parseFloat(b[1] ?? '0') || 0) - (parseFloat(a[1] ?? '0') || 0));
  return candidates[0]?.[0] ?? '';
}

/** <img> fallback for shops with no structured data or social image. Ranked by "looks like the product photo". */
/**
 * Where shops keep the BIG photo while "src" holds a thumbnail or a 1-pixel placeholder, in the order to trust them:
 * WooCommerce (data-large_image), zoom plugins, and the common lazy-loading plugins.
 */
const LAZY_IMAGE_ATTRS = [
  'data-zoom-image', 'data-large-image', 'data-large_image', 'data-full-url', 'data-full', 'data-zoom',
  'data-original', 'data-original-src', 'data-lazy-src', 'data-lazy', 'data-image', 'data-src',
];

function pageImages(html: string, hints: ProductHints = NO_HINTS): string[] {
  const scored: Array<{ url: string; score: number }> = [];
  const tags = html.match(/<img\b[^>]*>/gi) ?? [];
  tags.forEach((tag, index) => {
    const raw = LAZY_IMAGE_ATTRS.map((name) => attr(tag, name)).find(Boolean)
      || largestFromSrcset(attr(tag, 'srcset') || attr(tag, 'data-srcset') || attr(tag, 'data-lazy-srcset')) || attr(tag, 'src');
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
    score += hintScore(`${raw} ${attr(tag, 'alt')}`, hints);
    if (/thumb|swatch|mini|nav|menu|promo|campaign/i.test(identity)) score -= 40;
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
    } else if (/\/dw\/image\/v2\//i.test(url.pathname)) {
      // Salesforce Commerce Cloud (Demandware) resizes by "sw": ask for a sharp size, never a small preview.
      const width = Number(url.searchParams.get('sw'));
      if (width && width < 1200) { url.searchParams.set('sw', '1200'); url.searchParams.delete('sh'); }
    } else if (/(^|\.)scene7\.com$/.test(host) && /\/is\/image\//i.test(url.pathname)) {
      const width = Number(url.searchParams.get('wid'));
      if (width && width < 1200) { url.searchParams.set('wid', '1200'); url.searchParams.delete('hei'); }
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

/**
 * Where the product's own part of the page ends. Everything after a "related products" / "you may also like" block
 * or the footer belongs to OTHER products and must never be offered as this product's photos. The search starts a
 * little after the product title, so a class name near the top of the page cannot cut the real gallery off.
 */
const RELATED_ATTR = /(?:class|id|data-[\w-]+|aria-label)\s*=\s*["'][^"']*(?:related|recommend|upsell|cross-?sell|you-?may-?also|also-?like|also-?bought|similar|recently-?viewed|more-?from|people-?also|customers-?also|bestsell|trending|featured-?products|product-?recs?|suggested)[^"']*["']/i;
const RELATED_HEADING = />\s*(?:related products|related items|you may also like|you might also like|customers also (?:viewed|bought)|similar (?:items|products)|recently viewed|more from|frequently bought|people also (?:viewed|bought)|recommended for you)\b/i;

export function productSectionOf(html: string): string {
  const titleAt = html.search(/<h1\b/i);
  const titleEnd = titleAt >= 0 ? html.indexOf('</h1>', titleAt) : -1;
  const floor = titleEnd >= 0 ? titleEnd + 5 : titleAt >= 0 ? titleAt + 20 : Math.min(2500, Math.floor(html.length * 0.15));
  const tail = html.slice(floor);
  const cuts = [tail.search(RELATED_ATTR), tail.search(RELATED_HEADING), tail.search(/<footer\b/i)].filter((index) => index >= 0);
  return cuts.length ? html.slice(0, floor + Math.min(...cuts)) : html;
}

/** One photo served at several sizes counts once. */
export function imageKey(url: string): string {
  try {
    const parsed = new URL(upgradeImageUrl(url));
    const path = parsed.pathname
      .replace(/[-_.](?:\d{2,4}x\d{0,4}|\d{0,4}x\d{2,4}|thumb(?:nail)?|small|medium|large|grande|master|zoom|preview)(?=\.[a-z]+$|[-_.])/gi, '')
      .replace(/\.(?:jpe?g|png|webp|avif)$/i, '');
    return `${parsed.hostname}${path}`.toLowerCase();
  } catch { return url; }
}

/**
 * How sharp a URL asks the picture to be: the width in its query or file name. A link with no size at all is the shop's
 * default (usually the full picture), so it ranks as large.
 */
export function imageQuality(url: string): number {
  try {
    const parsed = new URL(url);
    for (const key of ['sw', 'w', 'width', 'wid', 'imwidth', 'sz', 'size']) {
      const value = Number.parseInt(parsed.searchParams.get(key) ?? '', 10);
      if (Number.isFinite(value) && value > 0) return value;
    }
    const sized = /[-_.](\d{2,4})x\d{0,4}(?=\.[a-z]+$|[-_.])/i.exec(parsed.pathname);
    if (sized) return Number(sized[1]);
    return 1600;
  } catch { return 0; }
}

/** One photo served at several sizes counts once, and the sharpest version is the one kept (in the first one's place). */
export function dedupeBestImages(urls: string[]): string[] {
  const order: string[] = [];
  const best = new Map<string, string>();
  for (const url of urls) {
    const key = imageKey(url);
    const current = best.get(key);
    if (!current) { order.push(key); best.set(key, url); }
    else if (imageQuality(url) > imageQuality(current)) best.set(key, url);
  }
  return order.map((key) => best.get(key)!);
}

function absolutize(values: Array<string | undefined>, baseUrl: string): string[] {
  const out: string[] = [];
  for (const value of values) {
    if (!value) continue;
    try {
      const url = new URL(decode(value), baseUrl);
      if (!['https:', 'http:'].includes(url.protocol)) continue;
      out.push(upgradeImageUrl(url.toString()));
    } catch { /* skip malformed URLs */ }
  }
  return dedupeBestImages(out);
}

export function parseProductPage(html: string, baseUrl: string): ParsedProductPage {
  const nodes = productNodes(html);
  const urlHints = productHintsFromUrl(baseUrl);
  const product = pickProduct(nodes, urlHints);
  const hints = productHintsFromUrl(baseUrl, [text(product?.sku) ?? '', text(product?.mpn) ?? '']);

  // Tier 1: what the page itself declares for THIS product (its main structured data and its social image).
  // Other products' structured data (lists, recommendations) and organisation logos are never used.
  const own = product ? imageValues(product.image) : [];
  const tier1Own = absolutize(own, baseUrl);
  const ogImages = [
    meta(html, 'og:image:secure_url'),
    meta(html, 'og:image'),
    meta(html, 'twitter:image'),
    meta(html, 'twitter:image:src'),
    ...(html.match(/<link\b[^>]*>/gi) ?? []).filter((tag) => /image_src/i.test(attr(tag, 'rel'))).map((tag) => attr(tag, 'href')),
  ];
  const tier1 = absolutize([...own, ...ogImages], baseUrl);

  // Tier 2: the gallery, taken ONLY from the product's own part of the page (before any related-products block),
  // plus anything an inline script lists under THIS product's code or name.
  const section = productSectionOf(html);
  const stateFromScripts = inlineScriptImages(html, hints);
  const tier2 = absolutize([...amazonDynamicImages(section), ...embeddedStateImages(section), ...stateFromScripts, ...sourceImages(section), ...pageImages(section, hints)], baseUrl);

  // A page that declares several photos is trusted as it is; otherwise the gallery completes it.
  const merged = tier1.length >= 3 ? tier1 : [...tier1, ...tier2];
  // Pictures whose file names carry this product's code lead, because they are surely this product.
  const coded = hints.codes.length ? narrowToFullCode(merged.filter((href) => hintScore(href, { codes: hints.codes, words: [] }) >= 120), hints) : [];
  // With the full code in the file names, the other colours' photos are dropped; otherwise the coded ones lead.
  const ordered = coded.length >= 2 && hints.codes.length > 1 && coded.every((href) => href.toLowerCase().replace(/[^a-z0-9]/g, '').includes(hints.codes[0]))
    ? coded
    : coded.length >= 2 ? [...coded, ...merged.filter((href) => !coded.includes(href))] : merged;
  const images = dedupeBestImages(ordered);
  return {
    title: String(product?.name || meta(html, 'og:title') || html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1] || '').trim().slice(0, 180),
    description: String(product?.description || meta(html, 'og:description') || meta(html, 'description') || '').trim().slice(0, 500),
    images: images.slice(0, 8),
    facts: productFacts(product, html),
    signals: {
      titleFrom: product?.name ? 'product' : meta(html, 'og:title') ? 'social' : 'page',
      jsonLd: /application\/ld\+json/i.test(html),
      productJsonLd: Boolean(product && (typesOf(product).includes('product') || typesOf(product).includes('productgroup'))),
      jsonLdImages: tier1Own.filter((href) => images.some((image) => imageKey(image) === imageKey(href))).length,
      ogImage: ogImages.some(Boolean),
      embeddedState: stateFromScripts.length > 0 || embeddedStateImages(html).length > 0,
    },
  };
}


/**
 * Some shops (and every big marketplace) answer a server with a "prove you are human" page and a normal 200 status.
 * Its logo and icons must never be offered as the product's photos. The title is the strongest sign; the other
 * markers only count on a short page, because plenty of real shops embed a captcha script in a contact form.
 */
export function looksLikeBotWall(html: string): boolean {
  const title = (html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim();
  if (/robot check|just a moment|attention required|access denied|are you (?:a )?(?:robot|human)|security check|verify (?:you are|that you(?:'|’)re) (?:a )?human|pardon our interruption|request blocked|checking your browser|captcha|bot verification|one more step|you have been blocked|forbidden/i.test(title)) return true;
  if (html.length > 40_000) return false;
  return /cf-browser-verification|challenge-platform|cf-challenge|px-captcha|g-recaptcha-response|hcaptcha|enable javascript and cookies to continue|verify you are human|type the characters you see|unusual traffic|automated access/i.test(html);
}


const GENERIC_PATH_WORDS = new Set(['dp', 'gp', 'product', 'products', 'p', 'item', 'items', 'itm', 'shop', 'store', 'collections', 'collection', 'catalog', 'pd', 'buy', 'detail', 'details', 'en', 'us', 'ref', 's', 'c', 'category', 'categories', 'browse', 'listing', 'sku', 'www']);

/**
 * A product's name as the shop wrote it into the link ("/Biodance-Bio-Collagen-Mask/dp/B0B2RM68G2"). Used when the page
 * itself cannot be read (shops that block automatic reading) so the AI still knows what the product is called.
 * Returns '' when the link does not carry a readable name.
 */
export function productNameFromUrl(rawUrl: string): string {
  let url: URL;
  try { url = new URL(rawUrl); } catch { return ''; }
  const segments = url.pathname.split('/').filter(Boolean).map((segment) => {
    try { return decodeURIComponent(segment); } catch { return segment; }
  });
  let best = '';
  let bestWords = 1;
  for (const raw of segments) {
    if (raw.includes('=') || GENERIC_PATH_WORDS.has(raw.toLowerCase())) continue;
    const segment = raw.replace(/\.(?:html?|php|aspx?)$/i, '');
    if (/^[A-Z0-9]{10}$/.test(segment) || /^\d+$/.test(segment)) continue;           // an Amazon ASIN or a numeric id
    const words = segment.split(/[-_+\s]+/).filter((word) => /\p{L}{2,}/u.test(word) && !/^\d+$/.test(word));
    if (words.length > bestWords) { best = words.join(' '); bestWords = words.length; }
  }
  const cleaned = best.replace(/[^\p{L}\p{N} &'.,()+-]/gu, ' ').replace(/\s+/g, ' ').trim().slice(0, 120);
  return cleaned ? cleaned.charAt(0).toUpperCase() + cleaned.slice(1) : '';
}

/**
 * A link that IS a picture (what "Copy image address" gives on a shop page). Shop images come from public image servers
 * that do not ask visitors to prove they are human, so these can be used even when the product page itself cannot be read.
 */
export function isDirectImageUrl(rawUrl: string): boolean {
  try {
    const url = new URL(rawUrl);
    if (!/^https?:$/.test(url.protocol)) return false;
    if (/\.(?:jpe?g|png|webp|avif)$/i.test(url.pathname)) return true;
    return /(?:^|\.)(?:m\.media-amazon\.com|images-na\.ssl-images-amazon\.com)$/i.test(url.hostname) && /^\/images\//i.test(url.pathname);
  } catch { return false; }
}
