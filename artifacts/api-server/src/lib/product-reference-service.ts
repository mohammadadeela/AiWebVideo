import { AppError } from './errors.js';
import { readPublicUrl } from './external-reference.js';
import { logger } from './logger.js';
import { InFlight, normalizeProductUrl, TtlCache } from './product-reference-cache.js';
import { dedupeBestImages, isDirectImageUrl, looksLikeBotWall, parseProductPage, productNameFromUrl, upgradeImageUrl, type ProductFacts, type ParsedProductPage } from './product-html.js';
import { renderPage, type RenderedPage } from './rendered-page.js';
import { validateUrl } from './ssrf.js';

/**
 * How a product link was read (or why it was not). Server-side vocabulary for logs, the admin link checker and the page;
 * customers only ever see plain sentences, never these words.
 */
export type ProductExtractionStatus =
  | 'SUCCESS_HTTP'        // the plain page (or the shop's public product data) had the photos
  | 'SUCCESS_JSONLD'      // the page's own Product structured data named the photos
  | 'SUCCESS_PLAYWRIGHT'  // only a real browser could see them
  | 'PARTIAL_SUCCESS'     // photos found, but the product's name was not
  | 'DIRECT_IMAGE'        // the link was a picture
  | 'BLOCKED'             // the shop (or its bot protection) refuses automatic reading
  | 'TIMEOUT'
  | 'NO_PRODUCT_FOUND'    // the page was read but is not a product page
  | 'NO_IMAGE_FOUND'      // a product was found but no usable photo
  | 'INVALID_URL'
  | 'UNSUPPORTED_RESPONSE';

export type ProductSuccessStatus = Extract<ProductExtractionStatus, 'SUCCESS_HTTP' | 'SUCCESS_JSONLD' | 'SUCCESS_PLAYWRIGHT' | 'PARTIAL_SUCCESS' | 'DIRECT_IMAGE'>;

export interface ProductReadCore {
  title: string;
  description: string;
  images: string[];
  facts: ProductFacts;
}

export interface ProductReadResult extends ProductReadCore {
  url: string;
  /** Which strategy found the photos: the plain page, the shop's public JSON, or a rendered browser page. */
  source: 'page' | 'shop-data' | 'rendered';
  status: ProductSuccessStatus;
  /** When this was read (ISO). Cached answers keep the time of the original read. */
  extractedAt: string;
}

export interface ProductReadDeps {
  readHtml: (url: string, trace?: string[]) => Promise<{ url: string; html: string; contentType?: string }>;
  readJson: (url: string) => Promise<unknown>;
  render: (url: string) => Promise<RenderedPage | null>;
  /** Keeps only image URLs that resolve to a public address. */
  allowImage: (url: string) => Promise<string | null>;
  /** Rejects links that are not public http(s) addresses (private networks, file:, data:, javascript:...). */
  validateLink?: (url: string) => Promise<unknown>;
  /** One read never lasts longer than this (default 55 s). */
  timeoutMs?: number;
}

const HTML_OR_IMAGE = /^(?:text\/html|application\/xhtml\+xml|image\/(?:jpe?g|png|webp|avif))$/;

const defaultDeps: ProductReadDeps = {
  readHtml: async (url, trace) => {
    // A link that turns out to be a picture is recognised by its content type and never downloaded here.
    const fetched = await readPublicUrl(url, 6 * 1024 * 1024, HTML_OR_IMAGE, { kind: 'document', stopAtImage: true, trace });
    return { url: fetched.url, html: fetched.mime.startsWith('image/') ? '' : fetched.buffer.toString('utf8'), contentType: fetched.mime };
  },
  readJson: async (url) => {
    const fetched = await readPublicUrl(url, 2 * 1024 * 1024, /^application\/(?:json|javascript)|^text\/(?:javascript|plain)/, { kind: 'json' });
    return JSON.parse(fetched.buffer.toString('utf8')) as unknown;
  },
  render: renderPage,
  allowImage: (candidate) => validateUrl(candidate).catch(() => null),
  validateLink: validateUrl,
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

export function parseShopifyProduct(data: unknown, baseUrl: string): ProductReadCore | null {
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

function reasonFor(error: unknown): 'blocked' | 'timeout' | 'unsupported' | 'failed' {
  if (!(error instanceof AppError)) return 'failed';
  if (error.code === 'PRODUCT_BLOCKED') return 'blocked';
  if (error.code === 'PRODUCT_TIMEOUT') return 'timeout';
  if (error.code === 'PRODUCT_UNSUPPORTED_RESPONSE') return 'unsupported';
  return 'failed';
}

/** What was already learned about the product, kept even when no photo is found, so nothing found is thrown away. */
interface Gathered { title: string; description: string; facts: ProductFacts; blocked: boolean; timedOut: boolean; unsupported: boolean; sawProductPage: boolean }

const SUCCESS_BY_SOURCE = { page: 'SUCCESS_HTTP', 'shop-data': 'SUCCESS_HTTP', rendered: 'SUCCESS_PLAYWRIGHT' } as const;

function failureFor(gathered: Gathered, rawUrl: string, finalUrl: string): AppError {
  const nameFromLink = productNameFromUrl(finalUrl) || productNameFromUrl(rawUrl);
  const name = gathered.title || nameFromLink;
  const status: ProductExtractionStatus = gathered.blocked ? 'BLOCKED'
    : gathered.timedOut ? 'TIMEOUT'
    : gathered.unsupported ? 'UNSUPPORTED_RESPONSE'
    : gathered.sawProductPage ? 'NO_IMAGE_FOUND'
    : 'NO_PRODUCT_FOUND';
  const details: Record<string, string> = { extractionStatus: status };
  if (name) details.productName = name;
  if (gathered.description) details.productDescription = gathered.description.slice(0, 500);
  if (Object.keys(gathered.facts).length) details.productFacts = JSON.stringify(gathered.facts);
  const code = status === 'BLOCKED' ? 'PRODUCT_BLOCKED' : status === 'TIMEOUT' ? 'PRODUCT_TIMEOUT' : status === 'UNSUPPORTED_RESPONSE' ? 'PRODUCT_UNSUPPORTED_RESPONSE' : 'PRODUCT_IMAGES_MISSING';
  const message = status === 'BLOCKED' ? "This shop doesn't allow automatic reading. Upload a photo or screenshot of the product instead."
    : status === 'TIMEOUT' ? 'That shop took too long to answer. Upload a photo of the product instead, or try the link again in a moment.'
    : status === 'UNSUPPORTED_RESPONSE' ? "That link isn't a product page we can read. Paste the product page or a picture of the product, or upload a photo instead."
    : "We couldn't find the product photos on that page. Make sure it is a product page, or upload a photo of the product instead.";
  return new AppError(message, 422, code, details);
}

/**
 * Finds the product's name, facts and photos. Tries the cheapest way first and only escalates when a step finds
 * no usable photos: the plain page (JSON-LD, social tags, gallery, page scripts), then the shop's public JSON, then a
 * real browser. Throws one clear error, carrying everything learned, if all fail.
 */
export async function readProductReference(rawUrl: string, deps: ProductReadDeps = defaultDeps, trace: string[] = []): Promise<ProductReadResult> {
  if (deps.validateLink) {
    try { await deps.validateLink(rawUrl); } catch (error) {
      trace.push(`link rejected: ${error instanceof Error ? error.message.slice(0, 80) : 'invalid'}`);
      throw new AppError("That link doesn't look like a public web address. Paste the product page link.", 400, 'PRODUCT_INVALID_URL', { extractionStatus: 'INVALID_URL' });
    }
  }
  const gathered: Gathered = { title: '', description: '', facts: {}, blocked: false, timedOut: false, unsupported: false, sawProductPage: false };
  const location = { finalUrl: rawUrl };
  const limit = deps.timeoutMs ?? 55_000;
  let timer: NodeJS.Timeout | undefined;
  const expired = new Promise<'expired'>((resolve) => { timer = setTimeout(() => resolve('expired'), limit); });
  try {
    const outcome = await Promise.race([resolveProduct(rawUrl, deps, trace, gathered, location), expired]);
    if (outcome === 'expired') {
      gathered.timedOut = true;
      trace.push(`stopped after ${Math.round(limit / 1000)}s: the shop was too slow`);
      throw failureFor(gathered, rawUrl, location.finalUrl);
    }
    return outcome;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function resolveProduct(rawUrl: string, deps: ProductReadDeps, trace: string[], gathered: Gathered, location: { finalUrl: string }): Promise<ProductReadResult> {
  // A page's bare <title> is often just the shop's name, so it is never kept as the product's name.
  const remember = (parsed: Pick<ParsedProductPage, 'title' | 'description' | 'facts'> & { trustedTitle?: boolean }) => {
    if (parsed.trustedTitle !== false) gathered.title ||= parsed.title;
    gathered.description ||= parsed.description;
    gathered.facts = { ...parsed.facts, ...gathered.facts };
  };
  const trusted = (parsed: ParsedProductPage) => parsed.signals.titleFrom !== 'page';
  const finish = async (found: ProductReadCore & { url: string; source: ProductReadResult['source']; status: ProductSuccessStatus }): Promise<ProductReadResult | null> => {
    const checked = (await Promise.all(dedupeBestImages(found.images).map((image) => deps.allowImage(image)))).filter((value): value is string => Boolean(value));
    if (!checked.length) return null;
    const title = found.title || gathered.title;
    return {
      ...found,
      title,
      description: found.description || gathered.description,
      facts: { ...gathered.facts, ...found.facts },
      images: checked.slice(0, 8),
      // photos without a name is still a success, but a smaller one
      status: !title && found.status !== 'DIRECT_IMAGE' ? 'PARTIAL_SUCCESS' : found.status,
      extractedAt: new Date().toISOString(),
    };
  };

  // 0. The link is already a picture ("Copy image address"): nothing to read, and image servers do not block visitors.
  if (isDirectImageUrl(rawUrl)) {
    trace.push('direct image link');
    const direct = await finish({ title: '', description: '', url: rawUrl, images: [rawUrl], facts: {}, source: 'page', status: 'DIRECT_IMAGE' });
    if (direct) return direct;
  }

  // 1. The plain page.
  let staticParsed: ParsedProductPage | null = null;
  try {
    const page = await deps.readHtml(rawUrl, trace);
    location.finalUrl = page.url;
    if (page.contentType?.startsWith('image/')) {
      // an address without a file extension whose answer is a picture (a CDN link, "Copy image address" on some shops)
      trace.push(`the link answers with a picture (${page.contentType})`);
      const direct = await finish({ title: '', description: '', url: page.url, images: [page.url], facts: {}, source: 'page', status: 'DIRECT_IMAGE' });
      if (direct) return direct;
    } else if (looksLikeBotWall(page.html)) {
      gathered.blocked = true;
      trace.push('plain page: the shop answered with a "prove you are human" page');
    } else {
      staticParsed = parseProductPage(page.html, page.url);
      const signals = staticParsed.signals;
      gathered.sawProductPage ||= signals.productJsonLd || trusted(staticParsed);
      remember({ ...staticParsed, trustedTitle: trusted(staticParsed) });
      trace.push(`plain page: ${staticParsed.images.length} candidate photo(s), title "${staticParsed.title.slice(0, 60)}"`);
      trace.push(`page offers: product data ${signals.productJsonLd ? 'yes' : 'no'}, JSON-LD ${signals.jsonLd ? 'yes' : 'no'}, social image ${signals.ogImage ? 'yes' : 'no'}, page-script state ${signals.embeddedState ? 'yes' : 'no'}`);
      const result = await finish({ title: staticParsed.title, description: staticParsed.description, url: page.url, images: staticParsed.images, facts: staticParsed.facts, source: 'page', status: signals.jsonLdImages > 0 ? 'SUCCESS_JSONLD' : 'SUCCESS_HTTP' });
      if (result) return result;
    }
  } catch (error) {
    const reason = reasonFor(error);
    gathered.blocked ||= reason === 'blocked';
    gathered.timedOut ||= reason === 'timeout';
    gathered.unsupported ||= reason === 'unsupported';
    if (!trace.some((line) => line.startsWith('plain page'))) trace.push(`plain page: ${error instanceof AppError ? error.code : 'failed'} (${error instanceof Error ? error.message.slice(0, 80) : 'error'})`);
  }

  // 2. The shop's public product data (works even when the page itself hides behind scripts).
  const shopUrl = shopifyProductUrl(location.finalUrl);
  if (shopUrl) {
    trace.push('shop data: trying the public product data');
    try {
      const shop = parseShopifyProduct(await deps.readJson(shopUrl), location.finalUrl);
      if (shop) {
        gathered.sawProductPage = true;
        remember(shop);
        const result = await finish({ ...shop, url: location.finalUrl, source: 'shop-data', status: 'SUCCESS_HTTP' });
        if (result) return { ...result, title: result.title || staticParsed?.title || '' };
      }
    } catch { /* fall through */ }
  }

  // 3. A real browser: what a visitor sees after the page's own scripts ran.
  const rendered = await deps.render(location.finalUrl);
  if (!rendered) trace.push('browser: not available or busy (JavaScript-only shops cannot be read)');
  if (rendered) {
    const parsed = parseProductPage(rendered.html, rendered.url);
    const title = (rendered.html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
    trace.push(`browser: HTTP ${rendered.status ?? '?'}, landed on ${(() => { try { const u = new URL(rendered.url); return `${u.hostname}${u.pathname}`.slice(0, 100); } catch { return 'unknown'; } })()}, page title "${title}"`);
    if (looksLikeBotWall(rendered.html)) {
      gathered.blocked = true;
      trace.push('browser: the shop showed a "prove you are human" page');
    } else {
      gathered.sawProductPage ||= parsed.signals.productJsonLd || trusted(parsed);
      remember({ ...parsed, trustedTitle: trusted(parsed) });
      trace.push(`browser: ${rendered.images.length} painted photo(s), ${parsed.images.length} from the page, ${rendered.stateImages?.length ?? 0} from page state`);
      // The browser's view of the gallery is the most precise, so it leads; one photo at several sizes counts once.
      const merged = dedupeBestImages([...rendered.images.map(upgradeImageUrl), ...(rendered.stateImages ?? []).map(upgradeImageUrl), ...parsed.images]);
      const result = await finish({
        title: parsed.title || staticParsed?.title || '',
        description: parsed.description || staticParsed?.description || '',
        url: rendered.url,
        images: merged,
        facts: { ...(staticParsed?.facts ?? {}), ...parsed.facts },
        source: 'rendered',
        status: 'SUCCESS_PLAYWRIGHT',
      });
      if (result) return result;
    }
  }

  // Everything found is kept: the name the shop put in the link or the page survives even when no photo can be read.
  throw failureFor(gathered, rawUrl, location.finalUrl);
}

// ---------------------------------------------------------------- cache, sharing and limits

const successCache = new TtlCache<ProductReadResult>(6 * 60 * 60_000, 500);
/** A short memory of links that could not be read, so a refused shop is not retried (and Chromium not started) on every paste. */
const failureCache = new TtlCache<AppError>(3 * 60_000, 300);
const inFlight = new InFlight<ProductReadResult>();

export function clearProductReferenceCache(): void { successCache.clear(); failureCache.clear(); }

const hostOf = (value: string) => { try { return new URL(value).hostname.replace(/^www\./i, ''); } catch { return 'invalid'; } };

/**
 * The production entry point: one read per product link per few hours, shared between simultaneous callers, with every
 * outcome logged (host, status, method and photo count only: never cookies, headers or the full link).
 */
export async function readProductReferenceCached(rawUrl: string, deps: ProductReadDeps = defaultDeps): Promise<ProductReadResult & { cached: boolean }> {
  const key = normalizeProductUrl(rawUrl);
  const hit = successCache.get(key);
  if (hit) return { ...hit, cached: true };
  const refused = failureCache.get(key);
  if (refused) throw refused;
  const started = Date.now();
  const trace: string[] = [];
  try {
    const result = await inFlight.run(key, () => readProductReference(rawUrl, deps, trace));
    successCache.set(key, result);
    logger.info({ host: hostOf(result.url), status: result.status, method: result.source, images: result.images.length, ms: Date.now() - started }, 'product link read');
    return { ...result, cached: false };
  } catch (error) {
    const code = error instanceof AppError ? error.code : 'UNEXPECTED';
    const status = error instanceof AppError ? error.details?.extractionStatus : 'FAILED';
    logger.warn({ host: hostOf(rawUrl), code, status, ms: Date.now() - started, trace }, 'product link not read');
    if (error instanceof AppError && (code === 'PRODUCT_BLOCKED' || code === 'PRODUCT_IMAGES_MISSING')) failureCache.set(key, error);
    throw error;
  }
}
