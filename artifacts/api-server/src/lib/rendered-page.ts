import { chromium, type Browser, type BrowserContext } from 'playwright';
import { BROWSER_USER_AGENT } from './external-reference.js';
import { inlineScriptImages, productHintsFromUrl } from './product-html.js';
import { validateUrl } from './ssrf.js';

/**
 * Opens a page in a real headless browser and returns what a visitor would see after the page's own
 * JavaScript ran. Many shops (and every marketplace) ship an empty shell to a plain HTTP request, so this is
 * the fallback when the plain request finds no product photos.
 *
 * Safety: every request the page makes (including redirects and sub-requests) must resolve to a public address,
 * the same rule website capture uses. At most two pages render at once, one render never lasts longer than the
 * deadline below, and the page's browser context is ALWAYS closed afterwards, whatever happened. One Chromium process is
 * shared between renders (it closes itself after a quiet minute) instead of starting a new one per product link.
 * It never solves a challenge, signs in, or tries to look less like an automated browser than it is.
 */
const MAX_PARALLEL = 2;
const RENDER_DEADLINE_MS = 32_000;
const NAVIGATION_TIMEOUT_MS = 18_000;
const IDLE_CLOSE_MS = 60_000;
let active = 0;

export interface RenderedPage {
  url: string;
  html: string;
  /** Large images actually painted on the page, best first. */
  images: string[];
  /** HTTP status of the page itself (diagnostics). */
  status?: number;
  /** Pictures found in the page's own application state that carry this product's code or name. */
  stateImages?: string[];
}

let browserPromise: Promise<Browser> | null = null;
let idleTimer: NodeJS.Timeout | null = null;

function sharedBrowser(): Promise<Browser> {
  if (!browserPromise) {
    const launching = chromium
      .launch({ headless: true, timeout: 15_000, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
      .then((browser) => {
        browser.on('disconnected', () => { if (browserPromise === launching) browserPromise = null; });
        return browser;
      })
      .catch((error) => { if (browserPromise === launching) browserPromise = null; throw error; });
    browserPromise = launching;
  }
  return browserPromise;
}

function scheduleIdleClose() {
  if (idleTimer) clearTimeout(idleTimer);
  idleTimer = setTimeout(() => {
    if (active > 0 || !browserPromise) return;
    const closing = browserPromise;
    browserPromise = null;
    void closing.then((browser) => browser.close()).catch(() => {});
  }, IDLE_CLOSE_MS);
  idleTimer.unref?.();
}

/** Closes the shared browser (tests and shutdown). */
export async function closeRenderBrowser(): Promise<void> {
  if (idleTimer) clearTimeout(idleTimer);
  const closing = browserPromise;
  browserPromise = null;
  await closing?.then((browser) => browser.close()).catch(() => {});
}

interface PaintedImage { src: string; width: number; height: number; score: number }

/** Runs inside the page. Kept free of closures over Node values. */
function collectPaintedImages(): { images: PaintedImage[]; state: string } {
  const RELATED = /related|recommend|upsell|cross-?sell|you-?may-?also|also-?like|similar|recently-?viewed|more-?from|people-?also|customers-?also|bestsell|trending|featured-?products|suggested/i;
  const HEADING = /^(related products|related items|you may also like|you might also like|customers also|similar|recently viewed|more from|frequently bought|recommended)/i;
  const GALLERY = /product|gallery|media|carousel|slider|swiper|pdp|zoom|hero|primary|main-?image|image-?viewer/i;
  const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
  const h1 = document.querySelector('h1');
  const titleWords = ((h1?.textContent || document.title || '').toLowerCase().match(/[a-z]{4,}/g) || []).slice(0, 10);

  const marker = Array.from(document.querySelectorAll('section, div, ul, aside, h2, h3, footer'))
    .filter((el) => {
      if (h1 && (el.contains(h1) || !(h1.compareDocumentPosition(el) & FOLLOWING))) return false;
      const label = `${el.getAttribute('class') || ''} ${el.id} ${el.getAttribute('aria-label') || ''}`;
      return el.tagName === 'FOOTER' || RELATED.test(label) || (/^H[23]$/.test(el.tagName) && HEADING.test((el.textContent || '').trim()));
    })[0];

  const largestOfSrcset = (srcset: string) => {
    const parts = srcset.split(',').map((part) => part.trim().split(/\s+/)).filter((part) => part[0]);
    parts.sort((a, b) => (parseFloat(b[1] || '0') || 0) - (parseFloat(a[1] || '0') || 0));
    return parts[0]?.[0] || '';
  };

  const usable = Array.from(document.images).filter((img) => {
    const src = img.currentSrc || img.src;
    if (!src || src.startsWith('data:')) return false;
    const w = img.naturalWidth, h = img.naturalHeight;
    if (w < 300 || h < 300) return false;
    if (w / h > 4 || h / w > 4) return false;               // banners and rulers
    if (img.closest('header, nav, footer')) return false;
    if (marker && (marker.contains(img) || (marker.compareDocumentPosition(img) & FOLLOWING))) return false;
    return true;
  });

  // the smallest block around the title that holds at least two of those pictures is the product gallery
  let gallery: Element | null = h1;
  while (gallery && gallery !== document.body && usable.filter((img) => gallery!.contains(img)).length < 2) gallery = gallery.parentElement;
  const inGallery = gallery && gallery !== document.body ? usable.filter((img) => gallery!.contains(img)) : [];

  const images: PaintedImage[] = usable.map((img) => {
    let score = Math.min((img.naturalWidth * img.naturalHeight) / 12_000, 120);
    if (inGallery.includes(img)) score += 90;
    let node: Element | null = img.parentElement;
    for (let depth = 0; node && depth < 7; depth++, node = node.parentElement) {
      const label = `${node.getAttribute('class') || ''} ${node.id} ${node.getAttribute('data-testid') || ''}`;
      if (/thumb|swatch|mini-?cart|recent/i.test(label)) { score -= 60; break; }
      if (GALLERY.test(label)) { score += 40; break; }
    }
    const alt = (img.alt || '').toLowerCase();
    if (titleWords.length && titleWords.filter((word) => alt.includes(word)).length >= 2) score += 30;
    // the picture sources a responsive image can choose from: the sharpest of them is the product photo
    const bigger = largestOfSrcset(img.srcset || img.getAttribute('data-srcset') || '');
    const chosen = bigger ? new URL(bigger, document.baseURI).toString() : (img.currentSrc || img.src);
    return { src: chosen, width: img.naturalWidth, height: img.naturalHeight, score };
  });

  // Hydration state is where many stores keep the full gallery. Only well-known globals, size-capped.
  const w = window as unknown as Record<string, unknown>;
  const globals = ['__NEXT_DATA__', '__INITIAL_STATE__', '__PRELOADED_STATE__', '__APOLLO_STATE__', '__NUXT__', 'dataLayer', 'utag_data'];
  const parts: string[] = [];
  let total = 0;
  const take = (value: unknown) => {
    try {
      const text = JSON.stringify(value);
      if (text && text.length < 700_000 && total + text.length < 1_800_000) { parts.push(text); total += text.length; }
    } catch { /* circular or huge: skip */ }
  };
  for (const key of globals) if (w[key]) take(w[key]);
  const shopify = (w.ShopifyAnalytics as { meta?: unknown } | undefined)?.meta ?? (w.meta as unknown);
  if (shopify) take(shopify);
  return { images: images.sort((a, b) => b.score - a.score).slice(0, 14), state: parts.join('\n') };
}

async function readRendered(context: BrowserContext, safeUrl: string): Promise<RenderedPage | null> {
  const page = await context.newPage();
  const response = await page.goto(safeUrl, { waitUntil: 'domcontentloaded', timeout: NAVIGATION_TIMEOUT_MS });
  // Never rely on the network going quiet: shops keep connections open. Wait for the product's own markers instead, briefly.
  await page.waitForSelector('script[type="application/ld+json"], h1, [itemtype*="Product"]', { timeout: 4_000 }).catch(() => {});
  await page.waitForLoadState('networkidle', { timeout: 3_500 }).catch(() => {});
  // Lazy galleries only load what is scrolled into view.
  for (const step of [500, 900]) {
    await page.evaluate((y) => window.scrollBy(0, y), step).catch(() => {});
    await page.waitForTimeout(350);
  }
  await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
  await page.waitForTimeout(300);

  const finalUrl = page.url();
  const html = await page.content();
  const painted = await page.evaluate(collectPaintedImages).catch(() => ({ images: [] as PaintedImage[], state: '' }));
  const hints = productHintsFromUrl(finalUrl);
  const stateImages = painted.state ? inlineScriptImages(`<script>${painted.state.replace(/<\/script/gi, '<\\/script')}</script>`, hints) : [];
  return { url: finalUrl, html, images: painted.images.map((image) => image.src), status: response?.status(), stateImages };
}

export async function renderPage(rawUrl: string): Promise<RenderedPage | null> {
  if (process.env.PRODUCT_RENDER_FALLBACK === '0' || active >= MAX_PARALLEL) return null;
  active += 1;
  let context: BrowserContext | null = null;
  let deadline: NodeJS.Timeout | undefined;
  try {
    const safe = await validateUrl(rawUrl);
    const browser = await sharedBrowser();
    context = await browser.newContext({
      viewport: { width: 1366, height: 900 },
      userAgent: BROWSER_USER_AGENT,
      locale: 'en-US',
      timezoneId: 'America/New_York',
      extraHTTPHeaders: { 'Accept-Language': 'en-US,en;q=0.9' },
      serviceWorkers: 'block',
      acceptDownloads: false,
    });
    // each host is checked once per render (DNS included); a different host is checked when it first appears
    const verdicts = new Map<string, boolean>();
    await context.route('**/*', async (route) => {
      try {
        const request = route.request();
        if (request.resourceType() === 'media' || request.resourceType() === 'font') { await route.abort(); return; }
        const target = new URL(request.url());
        if (target.protocol === 'http:' || target.protocol === 'https:') {
          let allowed = verdicts.get(target.hostname);
          if (allowed === undefined) {
            allowed = await validateUrl(target.toString()).then(() => true, () => false);
            verdicts.set(target.hostname, allowed);
          }
          if (!allowed) throw new Error('blocked host');
        } else if (target.protocol !== 'data:' && target.protocol !== 'blob:' && target.protocol !== 'about:') throw new Error('blocked scheme');
        await route.continue();
      } catch { await route.abort('blockedbyclient').catch(() => {}); }
    });
    const work = readRendered(context, safe).catch(() => null);
    const timeout = new Promise<null>((resolve) => { deadline = setTimeout(() => resolve(null), RENDER_DEADLINE_MS); });
    return await Promise.race([work, timeout]);
  } catch {
    return null;
  } finally {
    if (deadline) clearTimeout(deadline);
    // Closing the context also cancels anything the page is still doing after a timeout.
    await context?.close().catch(() => {});
    active -= 1;
    scheduleIdleClose();
  }
}
