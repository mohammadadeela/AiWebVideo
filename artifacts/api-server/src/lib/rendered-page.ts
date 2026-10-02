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
      // Only the product's own pictures: the gallery nearest the title, never "related products", header, footer or
      // navigation. Everything after the first "other products" block that follows the title is ignored.
      const images = await page.evaluate(() => {
        const RELATED = /related|recommend|upsell|cross-?sell|you-?may-?also|also-?like|similar|recently-?viewed|more-?from|people-?also|customers-?also|bestsell|trending|featured-?products|suggested/i;
        const HEADING = /^(related products|related items|you may also like|you might also like|customers also|similar|recently viewed|more from|frequently bought|recommended)/i;
        const FOLLOWING = Node.DOCUMENT_POSITION_FOLLOWING;
        const h1 = document.querySelector('h1');
        const marker = Array.from(document.querySelectorAll('section, div, ul, aside, h2, h3, footer'))
          .filter((el) => {
            if (h1 && (el.contains(h1) || !(h1.compareDocumentPosition(el) & FOLLOWING))) return false;
            const label = `${el.getAttribute('class') || ''} ${el.id} ${el.getAttribute('aria-label') || ''}`;
            return el.tagName === 'FOOTER' || RELATED.test(label) || (/^H[23]$/.test(el.tagName) && HEADING.test((el.textContent || '').trim()));
          })[0];
        const usable = Array.from(document.images).filter((img) => {
          const src = img.currentSrc || img.src;
          if (!src || img.naturalWidth < 300 || img.naturalHeight < 300) return false;
          if (img.closest('header, nav, footer')) return false;
          if (marker && (marker.contains(img) || (marker.compareDocumentPosition(img) & FOLLOWING))) return false;
          return true;
        });
        // the smallest block around the title that holds at least two of those pictures is the product gallery
        let gallery: Element | null = h1;
        while (gallery && gallery !== document.body && usable.filter((img) => gallery!.contains(img)).length < 2) gallery = gallery.parentElement;
        const inGallery = gallery && gallery !== document.body ? usable.filter((img) => gallery!.contains(img)) : [];
        const area = (img: HTMLImageElement) => img.naturalWidth * img.naturalHeight;
        const ordered = [...inGallery.sort((a, b) => area(b) - area(a)), ...usable.filter((img) => !inGallery.includes(img)).sort((a, b) => area(b) - area(a))];
        return ordered.slice(0, 10).map((img) => img.currentSrc || img.src);
      }).catch(() => [] as string[]);
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
