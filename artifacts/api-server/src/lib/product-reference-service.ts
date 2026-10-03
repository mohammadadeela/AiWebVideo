import { AppError } from './errors.js';
import { readPublicUrl } from './external-reference.js';
import { imageKey, looksLikeBotWall, parseProductPage, upgradeImageUrl, type ProductFacts } from './product-html.js';
import { renderPage, type RenderedPage } from './rendered-page.js';
import { validateUrl } from './ssrf.js';

export interface ProductReadResult {
  title: string;
  description: string;
  url: string;
  images: string[];
  facts: ProductFacts;
  /** Which strategy found the photos: the plain page, the shop's public JSON, or a rendered browser page. */
  source: 'page' | 'shop-data' | 'rendered';
}

export interface ProductReadDeps {
  readHtml: (url: string) => Promise<{ url: string; html: string }>;
  readJson: (url: string) => Promise<unknown>;
  render: (url: string) => Promise<RenderedPage | null>;
  /** Keeps only image URLs that resolve to a public address. */
  allowImage: (url: string) => Promise<string | null>;
}

const defaultDeps: ProductReadDeps = {
  readHtml: async (url) => {
    const fetched = await readPublicUrl(url, 6 * 1024 * 1024, /^(?:text\/html|application\/xhtml\+xml)$/);
    return { url: fetched.url, html: fetched.buffer.toString('utf8') };
  },
  readJson: async (url) => {
    const fetched = await readPublicUrl(url, 2 * 1024 * 1024, /^application\/(?:json|javascript)|^text\/(?:javascript|plain)/);
    return JSON.parse(fetched.buffer.toString('utf8')) as unknown;
  },
  render: renderPage,
  allowImage: (candidate) => validateUrl(candidate).catch(() => null),
};

function stripTags(value: string) {
  return value.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Shopify (and every store built on it) publishes each product as public JSON at "<product page>.js". */
export function shopifyProductUrl(rawUrl: string): string | null {
  try {
    const url = new URL(rawUrl);
    const match = /^(.*\/products\/[^/]+?)(?:\.js|\.json)?\/?$/i.exec(url.pathname);
    return match ? `${url.origin}${match[1]}.js` : null;
  } catch { return null; }
}

export function parseShopifyProduct(data: unknown, baseUrl: string): Omit<ProductReadResult, 'source' | 'url'> | null {
  const product = data as { title?: unknown; body_html?: unknown; vendor?: unknown; type?: unknown; price?: unknown; images?: unknown; featured_image?: unknown } | null;
  if (!product || typeof product !== 'object') return null;
  const listed = Array.isArray(product.images) ? product.images : [];
  const raw = [...listed, product.featured_image].filter((value): value is string => typeof value === 'string' && value.length > 0);
  const images = raw
    .map((value) => { try { return upgradeImageUrl(new URL(value.startsWith('//') ? `https:${value}` : value, baseUrl).toString()); } catch { return ''; } })
    .filter((value, index, all) => value && all.indexOf(value) === index);
  if (!images.length) return null;
  const facts: ProductFacts = {};
  if (typeof product.vendor === 'string' && product.vendor) facts.brand = product.vendor;
  if (typeof product.type === 'string' && product.type) facts.category = product.type;
  if (typeof product.price === 'number') facts.price = (product.price / 100).toFixed(2);
  return {
    title: typeof product.title === 'string' ? product.title.slice(0, 180) : '',
    description: typeof product.body_html === 'string' ? stripTags(product.body_html).slice(0, 500) : '',
    images: images.slice(0, 12),
    facts,
  };
}

function reasonFor(error: unknown): 'blocked' | 'failed' {
  return error instanceof AppError && error.code === 'PRODUCT_BLOCKED' ? 'blocked' : 'failed';
}

/**
 * Finds the product's name, facts and photos. Tries the cheapest way first and only escalates when a step finds
 * no photos: plain page, then the shop's public JSON, then a real browser. Throws one clear error if all fail.
 */
export async function readProductReference(rawUrl: string, deps: ProductReadDeps = defaultDeps, trace: string[] = []): Promise<ProductReadResult> {
  let blocked = false;
  const finish = async (found: Omit<ProductReadResult, 'images'> & { images: string[] }): Promise<ProductReadResult | null> => {
    const checked = (await Promise.all(found.images.map((image) => deps.allowImage(image)))).filter((value): value is string => Boolean(value));
    return checked.length ? { ...found, images: checked.slice(0, 8) } : null;
  };

  // 1. The plain page.
  let staticParsed: ReturnType<typeof parseProductPage> | null = null;
  let finalUrl = rawUrl;
  try {
    const page = await deps.readHtml(rawUrl);
    finalUrl = page.url;
    if (looksLikeBotWall(page.html)) {
      blocked = true;
      trace.push('plain page: the shop answered with a "prove you are human" page');
      throw new AppError('This shop blocks automatic reading.', 422, 'PRODUCT_BLOCKED');
    }
    staticParsed = parseProductPage(page.html, page.url);
    trace.push(`plain page: ${staticParsed.images.length} candidate photo(s), title "${staticParsed.title.slice(0, 60)}"`);
    const result = await finish({ title: staticParsed.title, description: staticParsed.description, url: page.url, images: staticParsed.images, facts: staticParsed.facts, source: 'page' });
    if (result) return result;
  } catch (error) {
    blocked = blocked || reasonFor(error) === 'blocked';
    if (!trace.some((line) => line.startsWith('plain page'))) trace.push(`plain page: ${error instanceof AppError ? error.code : 'failed'} (${error instanceof Error ? error.message.slice(0, 80) : 'error'})`);
  }

  // 2. The shop's public product data (works even when the page itself hides behind scripts).
  const shopUrl = shopifyProductUrl(finalUrl);
  if (shopUrl) {
    trace.push('shop data: trying the public product data');
    try {
      const shop = parseShopifyProduct(await deps.readJson(shopUrl), finalUrl);
      if (shop) {
        const result = await finish({ ...shop, url: finalUrl, source: 'shop-data' });
        if (result) return { ...result, title: result.title || staticParsed?.title || '' };
      }
    } catch { /* fall through */ }
  }

  // 3. A real browser: what a visitor sees after the page's own scripts ran.
  const rendered = await deps.render(finalUrl);
  if (!rendered) trace.push('browser: not available or busy (JavaScript-only shops cannot be read)');
  if (rendered && looksLikeBotWall(rendered.html)) {
    blocked = true;
    trace.push('browser: the shop showed a "prove you are human" page');
  } else if (rendered) {
    const parsed = parseProductPage(rendered.html, rendered.url);
    trace.push(`browser: ${rendered.images.length} painted photo(s), ${parsed.images.length} from the page`);
    // The browser's view of the gallery is the most precise, so it leads; one photo at several sizes counts once.
    const merged = [...rendered.images.map(upgradeImageUrl), ...parsed.images].filter((value, index, all) => all.findIndex((other) => imageKey(other) === imageKey(value)) === index);
    const result = await finish({
      title: parsed.title || staticParsed?.title || '',
      description: parsed.description || staticParsed?.description || '',
      url: rendered.url,
      images: merged,
      facts: { ...(staticParsed?.facts ?? {}), ...parsed.facts },
      source: 'rendered',
    });
    if (result) return result;
  }

  throw new AppError(
    blocked
      ? "This shop doesn't allow automatic reading. Upload a photo or screenshot of the product instead."
      : "We couldn't find the product photos on that page. Make sure it is a product page, or upload a photo of the product instead.",
    422,
    blocked ? 'PRODUCT_BLOCKED' : 'PRODUCT_IMAGES_MISSING',
  );
}
