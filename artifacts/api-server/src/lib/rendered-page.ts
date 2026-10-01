import { chromium } from 'playwright';
import { validateUrl } from './ssrf.js';

/**
 * Opens a page in a real headless browser and returns what a visitor would see after the page's own
 * JavaScript ran. Many shops (and every marketplace) ship an empty shell to a plain HTTP request, so this is
 * the fallback when the plain request finds no product photos.
 *
 * Safety: every request the page makes (including redirects and sub-requests) must resolve to a public address,
 * the same rule website capture uses. At most two pages render at once, and one render never lasts long.
 */
const DESKTOP_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const MAX_PARALLEL = 2;
let active = 0;

export interface RenderedPage {
  url: string;
  html: string;
  /** Large images actually painted on the page, biggest first. */
  images: string[];
}

export async function renderPage(rawUrl: string): Promise<RenderedPage | null> {
  if (process.env.PRODUCT_RENDER_FALLBACK === '0' || active >= MAX_PARALLEL) return null;
  active += 1;
  try {
    const safe = await validateUrl(rawUrl);
    const browser = await chromium.launch({ headless: true, timeout: 15_000, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    try {
      const context = await browser.newContext({ viewport: { width: 1366, height: 900 }, userAgent: DESKTOP_UA, locale: 'en-US' });
      await context.route('**/*', async (route) => {
        try {
          const request = route.request();
          if (request.resourceType() === 'media' || request.resourceType() === 'font') { await route.abort(); return; }
          const target = new URL(request.url());
          if (target.protocol === 'http:' || target.protocol === 'https:') await validateUrl(target.toString());
          else if (target.protocol !== 'data:' && target.protocol !== 'blob:' && target.protocol !== 'about:') throw new Error('blocked scheme');
          await route.continue();
        } catch { await route.abort('blockedbyclient'); }
      });
      const page = await context.newPage();
      await page.goto(safe, { waitUntil: 'domcontentloaded', timeout: 16_000 });
      await page.waitForLoadState('networkidle', { timeout: 5_000 }).catch(() => {});
      // Lazy galleries only load what is scrolled into view.
      await page.evaluate(() => window.scrollBy(0, 700)).catch(() => {});
      await page.waitForTimeout(700);
      const html = await page.content();
      const images = await page.evaluate(() =>
        Array.from(document.images)
          .map((img) => ({ src: img.currentSrc || img.src, w: img.naturalWidth, h: img.naturalHeight }))
          .filter((img) => img.src && img.w >= 300 && img.h >= 300)
          .sort((a, b) => b.w * b.h - a.w * a.h)
          .slice(0, 12)
          .map((img) => img.src),
      ).catch(() => [] as string[]);
      return { url: page.url(), html, images };
    } finally {
      await browser.close().catch(() => {});
    }
  } catch {
    return null;
  } finally {
    active -= 1;
  }
}
