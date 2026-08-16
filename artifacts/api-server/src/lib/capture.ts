import { chromium, type Page, type Browser } from 'playwright';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import { validateUrl } from './ssrf.js';

const execFileAsync = promisify(execFile);

export const ASSETS_DIR = process.env.ASSETS_DIR ?? '/tmp/aiwebvideo-assets';
const VIEWPORT = { width: 1440, height: 900 };
const MOBILE_VIEWPORT = { width: 430, height: 932 };
const MAX_PAGES = Math.min(20, Math.max(1, Number(process.env.CAPTURE_MAX_PAGES ?? 8)));
const SETTLE_MS = Math.max(300, Math.min(3000, Number(process.env.CAPTURE_SETTLE_MS ?? 900)));
const CAPTURE_CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.CAPTURE_CONCURRENCY ?? 1)));
// This is a soft budget, not a browser-killing timer. A slow optional page is
// skipped when the budget is nearly exhausted, while a successful homepage
// capture is still returned instead of being destroyed by a global timeout.
const CAPTURE_BUDGET_MS = Math.max(180_000, Number(process.env.CAPTURE_TIMEOUT_MS ?? 600_000));
const CHILD_PAGE_BUDGET_MS = Math.max(18_000, Math.min(75_000, Number(process.env.CAPTURE_CHILD_TIMEOUT_MS ?? 42_000)));
let activeCaptures = 0;
const captureWaiters: Array<() => void> = [];

export interface CapturedPage {
  url: string;
  title: string;
  screenshotUrl: string;
}

export interface SiteCapture {
  title: string;
  description: string | null;
  logoUrl: string | null;
  brandColors: string[];
  htmlLang: string | null;
  screenshotUrl: string;
  fullPageScreenshotUrl: string;
  mobileScreenshotUrl: string | null;
  mobileFullPageScreenshotUrl: string | null;
  recordingUrl: string | null;
  pages: CapturedPage[];
  pageCount: number;
}

export type CaptureProgress = (progress: number, message: string, etaSeconds: number) => void | Promise<void>;

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function acquireCaptureSlot() {
  if (activeCaptures < CAPTURE_CONCURRENCY) {
    activeCaptures++;
    return;
  }
  await new Promise<void>((resolve) => captureWaiters.push(resolve));
  activeCaptures++;
}

function releaseCaptureSlot() {
  activeCaptures = Math.max(0, activeCaptures - 1);
  captureWaiters.shift()?.();
}

async function guardNavigation(route: import('playwright').Route) {
  const request = route.request();
  if (!request.isNavigationRequest()) return route.continue();
  try {
    await validateUrl(request.url());
    await route.continue();
  } catch {
    await route.abort('blockedbyclient');
  }
}

export async function saveImageFile(jobId: string, name: string, data: Buffer): Promise<string> {
  const dir = path.join(ASSETS_DIR, jobId);
  await ensureDir(dir);
  await fs.writeFile(path.join(dir, name), data);
  return `/api/assets/${jobId}/${name}`;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error(`${label}_TIMEOUT`)), timeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function configurePage(page: Page) {
  page.setDefaultTimeout(15_000);
  page.setDefaultNavigationTimeout(40_000);
}

/**
 * Hydrate lazy media without letting one page monopolize the whole capture.
 * The homepage gets a deeper pass; child pages get a quicker single pass.
 */
async function waitForReady(page: Page, deep = false) {
  await page.waitForLoadState('domcontentloaded', { timeout: 40_000 });
  await page.waitForLoadState('networkidle', { timeout: deep ? 10_000 : 5_000 }).catch(() => {});

  await withTimeout(page.evaluate(async ({ passes, maxSteps, stepDelay }) => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const hydrate = () => {
      for (const img of Array.from(document.images).slice(0, 500)) {
        img.loading = 'eager';
        const source = img.dataset.src || img.dataset.lazySrc || img.dataset.original || img.getAttribute('data-original-src') || img.getAttribute('data-lazy') || img.getAttribute('data-src');
        const sourceSet = img.dataset.srcset || img.getAttribute('data-srcset');
        if (source && img.src !== source) img.src = source;
        if (sourceSet && img.srcset !== sourceSet) img.srcset = sourceSet;
        img.decode?.().catch(() => {});
      }
      for (const source of Array.from(document.querySelectorAll('picture source, video source'))) {
        const lazySrc = source.getAttribute('data-src');
        const lazySet = source.getAttribute('data-srcset');
        if (lazySrc) source.setAttribute('src', lazySrc);
        if (lazySet) source.setAttribute('srcset', lazySet);
      }
      for (const element of Array.from(document.querySelectorAll<HTMLElement>('[data-bg], [data-background-image], [data-lazy-background]')).slice(0, 250)) {
        const background = element.dataset.bg || element.dataset.backgroundImage || element.dataset.lazyBackground;
        if (background) element.style.backgroundImage = background.startsWith('url(') ? background : `url("${background}")`;
      }
      for (const video of Array.from(document.querySelectorAll('video')).slice(0, 30)) {
        video.preload = 'metadata';
        video.muted = true;
        video.load();
      }
    };

    hydrate();
    for (let pass = 0; pass < passes; pass++) {
      const height = Math.max(document.body.scrollHeight, document.documentElement.scrollHeight);
      const maxY = Math.max(0, height - innerHeight);
      const stepCount = Math.max(1, Math.min(maxSteps, Math.ceil(maxY / Math.max(500, innerHeight * 0.85))));
      for (let step = 0; step <= stepCount; step++) {
        const y = stepCount === 0 ? 0 : Math.round((maxY * step) / stepCount);
        window.scrollTo(0, y);
        hydrate();
        await sleep(stepDelay);
      }
    }
    window.scrollTo(0, 0);
    hydrate();
    await sleep(350);
  }, { passes: deep ? 2 : 1, maxSteps: deep ? 16 : 10, stepDelay: deep ? 140 : 100 }), deep ? 14_000 : 7_000, 'HYDRATE').catch(() => {});

  await page.waitForLoadState('networkidle', { timeout: deep ? 7_000 : 3_000 }).catch(() => {});
  await withTimeout(page.evaluate(async () => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) await fonts.ready.catch(() => {});
    const images = Array.from(document.images).slice(0, 250);
    await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, 2500);
    })));
  }), deep ? 7_000 : 4_000, 'MEDIA').catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
}

async function collectMetadata(page: Page, fallbackUrl: string) {
  return page.evaluate((url) => {
    const title = document.title.trim() || new URL(url).hostname;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() || null;
    const icon = document.querySelector<HTMLLinkElement>('link[rel*="icon"]')?.href || null;
    const logo = document.querySelector<HTMLImageElement>('header img, nav img, img[alt*="logo" i]')?.src || icon;
    const htmlLang = document.documentElement.lang?.trim() || null;
    const colors = new Set<string>();
    const add = (value: string) => {
      const match = value.match(/#[0-9a-f]{6}\b/ig);
      match?.forEach((color) => colors.size < 6 && colors.add(color.toLowerCase()));
    };
    add(document.documentElement.innerHTML.slice(0, 500_000));
    return { title, description, iconUrl: icon, logoUrl: logo, brandColors: Array.from(colors), htmlLang };
  }, fallbackUrl);
}

/**
 * Preserve a clean local copy of the site's own icon/logo. The source URL is
 * validated before it is loaded into a temporary square card, and Playwright
 * rasterizes SVG/ICO/PNG inputs to one dependable JPEG reference for later
 * icon generation and branded video endings.
 */
async function captureWebsiteIcon(page: Page, jobId: string, sourceUrl: string | null, fallbackName: string, brandColor?: string): Promise<string | null> {
  const renderCard = async (src: string | null) => {
    await page.evaluate(({ source, name, color }) => {
      document.querySelector('[data-aiwebvideo-brand-icon]')?.remove();
      const card = document.createElement('div');
      card.dataset.aiwebvideoBrandIcon = 'true';
      card.style.cssText = `position:fixed;left:16px;top:16px;width:512px;height:512px;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:96px;overflow:hidden;box-shadow:0 30px 80px rgba(20,15,39,.18);color:${/^#[0-9a-f]{6}$/i.test(color || '') ? color : '#6d4aff'}`;
      if (source) {
        const image = document.createElement('img');
        image.alt = '';
        image.src = source;
        image.style.cssText = 'display:block;max-width:70%;max-height:70%;object-fit:contain';
        card.appendChild(image);
      } else {
        const monogram = document.createElement('span');
        monogram.textContent = (name.trim()[0] || 'W').toLocaleUpperCase();
        monogram.style.cssText = 'font:700 250px/1 Arial,sans-serif;letter-spacing:-.08em;transform:translateX(-.04em)';
        card.appendChild(monogram);
      }
      document.body.appendChild(card);
    }, { source: src, name: fallbackName, color: brandColor });
    const card = page.locator('[data-aiwebvideo-brand-icon]');
    if (src) {
      await card.locator('img').waitFor({ state: 'visible', timeout: 6_000 });
      await page.waitForFunction(() => {
        const image = document.querySelector<HTMLImageElement>('[data-aiwebvideo-brand-icon] img');
        return Boolean(image?.complete && image.naturalWidth >= 8 && image.naturalHeight >= 8);
      }, undefined, { timeout: 6_000 });
    }
    const buffer = await card.screenshot({ type: 'jpeg', quality: 96 });
    await card.evaluate((element) => element.remove()).catch(() => {});
    return await saveImageFile(jobId, 'website-icon.jpg', buffer);
  };
  try {
    if (sourceUrl) {
      try {
        await validateUrl(sourceUrl);
        return await renderCard(sourceUrl);
      } catch (error) {
        console.warn(`[capture] original website icon unavailable, creating a brand monogram fallback: ${(error as Error).message}`);
      }
    }
    return await renderCard(null);
  } catch (error) {
    await page.locator('[data-aiwebvideo-brand-icon]').evaluateAll((elements) => elements.forEach((element) => element.remove())).catch(() => {});
    console.warn(`[capture] website icon skipped: ${(error as Error).message}`);
    return null;
  }
}

function pagePriority(url: URL) {
  const pathName = url.pathname.toLowerCase();
  const positive = ['product', 'shop', 'store', 'catalog', 'collection', 'category', 'dress', 'clothes', 'shoe', 'sale', 'pricing', 'plan', 'feature', 'solution', 'service', 'booking', 'reserve', 'dashboard', 'demo', 'about', 'location'];
  const negative = ['privacy', 'terms', 'policy', 'login', 'register', 'account', 'logout', 'search', 'tag', 'author'];
  let score = 0;
  for (const token of positive) if (pathName.includes(token)) score += 10;
  for (const token of negative) if (pathName.includes(token)) score -= 20;
  score -= Math.min(10, pathName.split('/').filter(Boolean).length);
  return score;
}

async function discoverInternalPages(page: Page, sourceUrl: string): Promise<string[]> {
  const origin = new URL(sourceUrl).origin;
  const hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
  const root = new URL(sourceUrl);
  root.hash = '';
  const candidates = new Map<string, number>();
  for (const href of hrefs) {
    try {
      const url = new URL(href);
      url.hash = '';
      if (url.origin !== origin || !['http:', 'https:'].includes(url.protocol)) continue;
      if (/\.(pdf|zip|jpe?g|png|gif|webp|svg|mp4|webm)$/i.test(url.pathname)) continue;
      const normalized = url.toString();
      if (normalized === root.toString()) continue;
      candidates.set(normalized, Math.max(candidates.get(normalized) ?? -999, pagePriority(url)));
    } catch { /* malformed link */ }
  }
  const sorted = [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
  return [root.toString(), ...sorted.slice(0, Math.max(0, MAX_PAGES - 1))];
}

/** Record only a concise, intentional tour. Returns the approximate recorded tour length. */
async function recordSmoothScroll(page: Page): Promise<number> {
  const started = Date.now();
  await withTimeout(page.evaluate(async () => {
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
    const maxY = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const steps = Math.max(1, Math.min(18, Math.ceil(maxY / Math.max(600, innerHeight * 0.85))));
    window.scrollTo(0, 0);
    await sleep(350);
    for (let index = 1; index <= steps; index++) {
      window.scrollTo({ top: Math.round((maxY * index) / steps), behavior: 'smooth' });
      await sleep(430);
    }
    await sleep(500);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    await sleep(850);
  }), 18_000, 'SCROLL_RECORDING');
  return Math.max(1, (Date.now() - started) / 1000);
}

async function convertRecording(input: string, output: string, startSeconds = 0, durationSeconds?: number) {
  let sourceDuration = 0;
  try {
    const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', input]);
    sourceDuration = Number(stdout.trim()) || 0;
  } catch { /* ffmpeg below will provide the real error if the file is invalid */ }
  const safeStart = sourceDuration > 1 ? Math.min(Math.max(0, startSeconds - 0.15), Math.max(0, sourceDuration - 1)) : Math.max(0, startSeconds - 0.15);
  const remaining = sourceDuration > 0 ? Math.max(0.8, sourceDuration - safeStart) : 22;
  const safeDuration = durationSeconds && durationSeconds > 0 ? Math.min(22, durationSeconds + 0.5, remaining) : Math.min(22, remaining);
  await execFileAsync('ffmpeg', [
    '-y',
    ...(safeStart > 0.15 ? ['-ss', safeStart.toFixed(3)] : []),
    '-i', input,
    ...(safeDuration > 0 ? ['-t', safeDuration.toFixed(3)] : []),
    '-vf', 'scale=1920:1080:force_original_aspect_ratio=decrease:flags=lanczos,pad=1920:1080:(ow-iw)/2:(oh-ih)/2:color=black',
    '-r', '30', '-c:v', 'libx264', '-preset', 'medium', '-crf', '18', '-pix_fmt', 'yuv420p',
    '-movflags', '+faststart', '-an', output,
  ], { timeout: 5 * 60_000, maxBuffer: 16 * 1024 * 1024 });
}

async function screenshotPage(page: Page, fullPage = true) {
  try {
    return await page.screenshot({ type: 'jpeg', quality: fullPage ? 90 : 94, fullPage, timeout: fullPage ? 25_000 : 15_000 });
  } catch (firstError) {
    // A huge/infinite page can make full-page capture expensive. Keep the real
    // visible page rather than failing the whole project.
    if (!fullPage) throw firstError;
    console.warn(`[capture] fallback viewport ${page.url()}: ${(firstError as Error).message}`);
    return page.screenshot({ type: 'jpeg', quality: 92, timeout: 15_000 });
  }
}

// Bilingual (English/Arabic) text heuristics — real e-commerce and support UI
// copy varies a lot, so several candidate strings are tried in order and the
// first visible match wins. Nothing here is ever shown to the end user; it
// only decides where the capture browser clicks.
const ADD_TO_CART_TEXTS = ['add to cart', 'add to bag', 'add to basket', 'buy now', 'أضف إلى السلة', 'أضف الى السلة', 'إضافة للسلة', 'اضافة للسلة', 'اشتري الآن', 'اشتر الآن'];
const CART_TEXTS = ['view cart', 'my cart', 'سلة التسوق', 'سلتي', 'عرض السلة', 'السلة'];
const CART_SELECTORS = ['a[href*="/cart" i]', 'a[href*="/basket" i]', 'button[aria-label*="cart" i]', '[role="button"][aria-label*="cart" i]', '[class*="cart" i] a'];
const CHECKOUT_TEXTS = ['checkout', 'proceed to checkout', 'secure checkout', 'الدفع', 'إتمام الطلب', 'اتمام الطلب', 'إكمال الطلب', 'اكمال الطلب'];
const CHECKOUT_SELECTORS = ['a[href*="checkout" i]', 'button[name*="checkout" i]', 'button[id*="checkout" i]', '[role="button"][aria-label*="checkout" i]'];
const CONVERSION_TEXTS = ['get started', 'start now', 'start free', 'sign up', 'create account', 'book now', 'reserve', 'choose plan', 'select plan', 'ابدأ الآن', 'ابدأ مجانا', 'إنشاء حساب', 'انشاء حساب', 'احجز الآن', 'اختر الخطة'];
const CHAT_TEXTS = ['chat', 'assistant', 'live chat', 'support', 'help', 'ask us', 'الدردشة', 'المساعد', 'الدعم', 'مساعدة', 'تواصل معنا'];
const OPTION_SELECTORS = [
  '[class*="size" i] button', '[class*="size" i] [role="button"]', '[class*="size" i] label',
  '[class*="variant" i] button', '[class*="option" i] button',
  'button[aria-label*="size" i]', '[data-option] button',
];
const CHAT_LAUNCHER_SELECTORS = [
  '[class*="chat-widget" i]', '[class*="chatwidget" i]', '[id*="chat-widget" i]',
  '[class*="livechat" i]', '[id*="livechat" i]', '[class*="live-chat" i]',
  '[class*="chat-launcher" i]', '[class*="chat-button" i]', '[class*="chatbot" i]',
  '[aria-label*="chat" i]', '[aria-label*="assistant" i]', '[aria-label*="support" i]',
  'iframe[title*="chat" i]', 'iframe[title*="assistant" i]',
];

/** Try each candidate locator/text in order; click and return true on the first visible hit. */
async function tryClickFirstVisible(page: Page, selectors: string[], texts: string[]): Promise<boolean> {
  for (const selector of selectors) {
    try {
      const el = page.locator(selector).first();
      if ((await el.count()) && (await el.isVisible().catch(() => false))) {
        await el.click({ timeout: 4000 });
        return true;
      }
    } catch { /* try the next candidate */ }
  }
  for (const text of texts) {
    try {
      const el = page.getByText(text, { exact: false }).first();
      if ((await el.count()) && (await el.isVisible().catch(() => false))) {
        await el.click({ timeout: 4000 });
        return true;
      }
    } catch { /* try the next candidate */ }
  }
  return false;
}

/**
 * Best-effort real interaction states that a purely link-crawling capture
 * can never reach on its own: a product with a real option selected, an
 * item actually added to the cart, the cart itself, a checkout entry
 * state (without submitting any payment/order), a generic conversion entry
 * state for non-store sites, and an opened AI assistant/live-chat widget. Every step is isolated
 * and optional — a site with different markup simply yields fewer of these
 * extra captures, and this never fails or slows down the core capture.
 */
async function captureInteractionStates(
  browser: Browser,
  jobId: string,
  sourceUrl: string,
  discoveredPages: CapturedPage[],
  deadlineAt: number,
): Promise<CapturedPage[]> {
  const extra: CapturedPage[] = [];
  if (Date.now() >= deadlineAt - 15_000) return extra;

  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.route('**/*', guardNavigation);

  try {
    // 1) Product page → select a real option → add to cart → view cart → checkout entry.
    const productCandidate = discoveredPages.find((p) => /product|shop|item|dress|shoe|bag|detail/i.test(p.url)) ?? discoveredPages[1];
    if (productCandidate && Date.now() < deadlineAt - 15_000) {
      const page = await context.newPage();
      configurePage(page);
      try {
        await withTimeout((async () => {
          await page.goto(productCandidate.url, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await waitForReady(page, false);

          const selectedOption = await tryClickFirstVisible(page, OPTION_SELECTORS, []);
          if (selectedOption) {
            await page.waitForTimeout(400);
            const buffer = await screenshotPage(page, false);
            extra.push({ url: page.url(), title: 'Product page — real option selected', screenshotUrl: await saveImageFile(jobId, 'interaction-product-selected.jpg', buffer) });
          }

          const added = await tryClickFirstVisible(page, [], ADD_TO_CART_TEXTS);
          if (added) {
            await page.waitForTimeout(700);
            const buffer = await screenshotPage(page, false);
            extra.push({ url: page.url(), title: 'Added to cart', screenshotUrl: await saveImageFile(jobId, 'interaction-added-to-cart.jpg', buffer) });

            const openedCart = await tryClickFirstVisible(page, CART_SELECTORS, CART_TEXTS);
            if (openedCart) {
              await page.waitForTimeout(600);
              const cartBuffer = await screenshotPage(page, false);
              extra.push({ url: page.url(), title: 'Shopping cart', screenshotUrl: await saveImageFile(jobId, 'interaction-cart.jpg', cartBuffer) });

              // Capture only the checkout ENTRY state. Never fill payment fields,
              // submit an order, or click a final purchase/confirmation control.
              if (Date.now() < deadlineAt - 7_000) {
                const openedCheckout = await tryClickFirstVisible(page, CHECKOUT_SELECTORS, CHECKOUT_TEXTS);
                if (openedCheckout) {
                  await page.waitForTimeout(800);
                  const checkoutBuffer = await screenshotPage(page, false);
                  extra.push({ url: page.url(), title: 'Checkout — real entry state', screenshotUrl: await saveImageFile(jobId, 'interaction-checkout.jpg', checkoutBuffer) });
                }
              }
            }
          }
        })(), 28_000, 'PRODUCT_INTERACTION');
      } catch (err) {
        console.warn('[capture] product interaction skipped:', (err as Error).message);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // 2) Generic conversion entry for SaaS/service/booking sites. This only
    // navigates to the first real signup/booking/plan entry state; it never
    // submits a form, creates an account, books, or purchases anything.
    if (Date.now() < deadlineAt - 10_000) {
      const page = await context.newPage();
      configurePage(page);
      try {
        await withTimeout((async () => {
          await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await waitForReady(page, false);
          const opened = await tryClickFirstVisible(page, [], CONVERSION_TEXTS);
          if (opened) {
            await page.waitForTimeout(800);
            const buffer = await screenshotPage(page, false);
            extra.push({ url: page.url(), title: 'Conversion / signup / booking entry state', screenshotUrl: await saveImageFile(jobId, 'interaction-conversion.jpg', buffer) });
          }
        })(), 18_000, 'CONVERSION_ENTRY');
      } catch (err) {
        console.warn('[capture] conversion entry skipped:', (err as Error).message);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // 3) AI assistant / live-chat widget, if the site has one.
    if (Date.now() < deadlineAt - 10_000) {
      const page = await context.newPage();
      configurePage(page);
      try {
        await withTimeout((async () => {
          await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 30_000 });
          await waitForReady(page, false);
          const opened = await tryClickFirstVisible(page, CHAT_LAUNCHER_SELECTORS, CHAT_TEXTS);
          if (opened) {
            await page.waitForTimeout(1000);
            const buffer = await screenshotPage(page, false);
            extra.push({ url: page.url(), title: 'AI assistant / live chat', screenshotUrl: await saveImageFile(jobId, 'interaction-ai-assistant.jpg', buffer) });
          }
        })(), 20_000, 'CHAT_WIDGET');
      } catch (err) {
        console.warn('[capture] chat widget skipped:', (err as Error).message);
      } finally {
        await page.close().catch(() => {});
      }
    }
  } finally {
    await context.close().catch(() => {});
  }
  return extra;
}

async function captureSiteNow(jobId: string, sourceUrl: string, onProgress?: CaptureProgress): Promise<SiteCapture> {
  const startedAt = Date.now();
  const deadlineAt = startedAt + CAPTURE_BUDGET_MS;
  const dir = path.join(ASSETS_DIR, jobId);
  const videoDir = path.join(dir, 'browser-video');
  await ensureDir(videoDir);

  await onProgress?.(8, 'Opening your website securely', 150);
  const browser = await chromium.launch({
    headless: true,
    timeout: 30_000,
    args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-background-timer-throttling'],
  });

  try {
    // Core desktop capture: no video recording here. This keeps loading/lazy
    // hydration work out of the user's smooth-scroll recording.
    const context = await browser.newContext({
      viewport: VIEWPORT,
      deviceScaleFactor: 1,
      userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36 AiWebVideoCapture/3.0',
    });
    await context.route('**/*', guardNavigation);
    const page = await context.newPage();
    configurePage(page);
    await onProgress?.(12, 'Loading the homepage', 125);
    console.info(`[capture] opening ${sourceUrl}`);
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await waitForReady(page, true);
    await onProgress?.(20, 'Saving the fully loaded homepage', 100);

    const meta = await collectMetadata(page, sourceUrl);
    const urls = await discoverInternalPages(page, sourceUrl);
    const viewportBuffer = await screenshotPage(page, false);
    const fullBuffer = await screenshotPage(page, true);
    const screenshotUrl = await saveImageFile(jobId, 'screenshot.jpg', viewportBuffer);
    const fullPageScreenshotUrl = await saveImageFile(jobId, 'screenshot-full.jpg', fullBuffer);
    const websiteIconUrl = await captureWebsiteIcon(page, jobId, meta.iconUrl || meta.logoUrl, meta.title, meta.brandColors[0]);
    console.info(`[capture] success ${sourceUrl} screenshot.jpg + screenshot-full.jpg`);
    await page.close();
    await context.close();
    await onProgress?.(27, 'Homepage captured in full quality', 80);

    // Optional smooth-scroll recording. Failure never destroys screenshots.
    let recordingUrl: string | null = null;
    if (Date.now() < deadlineAt - 25_000) {
      await onProgress?.(29, 'Saving a smooth-scroll preview', 65);
      const recordingContext = await browser.newContext({
        viewport: VIEWPORT,
        deviceScaleFactor: 1,
        recordVideo: { dir: videoDir, size: VIEWPORT },
        userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/126 Safari/537.36 AiWebVideoCapture/3.0',
      });
      await recordingContext.route('**/*', guardNavigation);
      const recordingPage = await recordingContext.newPage();
      configurePage(recordingPage);
      try {
        const videoClockStarted = Date.now();
        await recordingPage.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
        await waitForReady(recordingPage, false);
        const trimStart = Math.max(0, (Date.now() - videoClockStarted) / 1000);
        const tourDuration = await recordSmoothScroll(recordingPage);
        const recording = recordingPage.video();
        await recordingPage.close();
        await recordingContext.close();
        if (recording) {
          const webmPath = await recording.path();
          const mp4Path = path.join(dir, 'scroll-recording.mp4');
          await convertRecording(webmPath, mp4Path, trimStart, tourDuration);
          recordingUrl = `/api/assets/${jobId}/scroll-recording.mp4`;
        }
      } catch (err) {
        console.warn('[capture] smooth-scroll preview skipped:', (err as Error).message);
        await recordingPage.close().catch(() => {});
        await recordingContext.close().catch(() => {});
      }
    }

    // Responsive mobile capture is optional and isolated from desktop success.
    let mobileScreenshotUrl: string | null = null;
    let mobileFullPageScreenshotUrl: string | null = null;
    if (Date.now() < deadlineAt - 20_000) {
      const mobileContext = await browser.newContext({
        viewport: MOBILE_VIEWPORT,
        screen: MOBILE_VIEWPORT,
        deviceScaleFactor: 1,
        isMobile: true,
        hasTouch: true,
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 Version/17.5 Mobile/15E148 Safari/604.1 AiWebVideoCapture/3.0',
      });
      await mobileContext.route('**/*', guardNavigation);
      const mobilePage = await mobileContext.newPage();
      configurePage(mobilePage);
      try {
        await onProgress?.(32, 'Saving the real mobile layout', 55);
        await mobilePage.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 35_000 });
        await waitForReady(mobilePage, false);
        const mobileViewportBuffer = await screenshotPage(mobilePage, false);
        const mobileFullBuffer = await screenshotPage(mobilePage, true);
        mobileScreenshotUrl = await saveImageFile(jobId, 'screenshot-mobile.jpg', mobileViewportBuffer);
        mobileFullPageScreenshotUrl = await saveImageFile(jobId, 'screenshot-mobile-full.jpg', mobileFullBuffer);
      } catch (err) {
        console.warn('[capture] mobile layout skipped:', (err as Error).message);
      } finally {
        await mobilePage.close().catch(() => {});
        await mobileContext.close().catch(() => {});
      }
    }

    // Child pages share one lightweight context. Each page has its own local
    // budget; one slow route such as /our-location or /sales can be skipped
    // without killing the browser or invalidating all previous screenshots.
    const pages: CapturedPage[] = [{ url: sourceUrl, title: meta.title, screenshotUrl: fullPageScreenshotUrl }];
    let skippedPages = 0;
    const childContext = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    await childContext.route('**/*', guardNavigation);
    try {
      for (let i = 1; i < urls.length; i++) {
        if (Date.now() >= deadlineAt - 12_000) {
          console.warn(`[capture] soft budget reached after ${pages.length} page(s); returning successful partial capture`);
          break;
        }
        const child = await childContext.newPage();
        configurePage(child);
        try {
          await onProgress?.(
            33 + Math.round((i / Math.max(1, urls.length - 1)) * 6),
            `Capturing page ${i + 1} of ${urls.length}`,
            Math.max(10, (urls.length - i) * 12),
          );
          console.info(`[capture] opening ${urls[i]}`);
          await withTimeout((async () => {
            await child.goto(urls[i], { waitUntil: 'domcontentloaded', timeout: 32_000 });
            await waitForReady(child, false);
            const childMeta = await collectMetadata(child, urls[i]);
            const buffer = await screenshotPage(child, true);
            const pageScreenshotUrl = await saveImageFile(jobId, `page-${i}.jpg`, buffer);
            pages.push({ url: child.url(), title: childMeta.title, screenshotUrl: pageScreenshotUrl });
            console.info(`[capture] success ${urls[i]} page-${i}.jpg`);
          })(), Math.min(CHILD_PAGE_BUDGET_MS, Math.max(12_000, deadlineAt - Date.now() - 5_000)), 'CHILD_PAGE');
        } catch (err) {
          skippedPages++;
          console.warn(`[capture] skipped ${urls[i]} ${(err as Error).message}`);
        } finally {
          await child.close().catch(() => {});
        }
      }
    } finally {
      await childContext.close().catch(() => {});
    }

    console.info(`[capture] finished successful=${pages.length} failed=${skippedPages}`);
    // pageCount reflects distinct site pages visited, shown to the user as
    // "N pages captured". Interaction-state screenshots below are extra
    // states of pages already counted here (e.g. "product with a size
    // selected"), not new pages, so they're appended to `pages` for the AI
    // planner without inflating that count.
    const pageCount = pages.length;

    // Best-effort real interaction states (product option selected, added to
    // cart, cart view, AI assistant opened). These are what make buy/tour/
    // tutorial videos able to show a real purchase journey and a real
    // assistant widget instead of only static landing pages.
    if (Date.now() < deadlineAt - 15_000) {
      await onProgress?.(38, 'Capturing real interactions (options, cart, checkout, conversion, chat)', 20);
      const interactionPages = await captureInteractionStates(browser, jobId, sourceUrl, pages, deadlineAt);
      if (interactionPages.length) {
        console.info(`[capture] interaction states captured=${interactionPages.length}`);
        pages.push(...interactionPages);
      }
    }

    await onProgress?.(40, `Website capture complete — ${pageCount} page${pageCount === 1 ? '' : 's'} saved`, 0);
    return {
      ...meta,
      logoUrl: websiteIconUrl ?? meta.logoUrl,
      screenshotUrl,
      fullPageScreenshotUrl,
      mobileScreenshotUrl,
      mobileFullPageScreenshotUrl,
      recordingUrl,
      pages,
      pageCount,
    };
  } catch (err) {
    const message = (err as Error).message;
    if (/timeout/i.test(message) || Date.now() >= deadlineAt) throw new Error('CAPTURE_TIMEOUT');
    throw err;
  } finally {
    await browser.close().catch(() => {});
    // Playwright stores its raw WebM in browser-video/. The final trimmed MP4
    // lives at the job root, so remove the raw capture to avoid disk growth.
    await fs.rm(videoDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function captureSite(jobId: string, sourceUrl: string, onProgress?: CaptureProgress): Promise<SiteCapture> {
  await onProgress?.(
    5,
    activeCaptures >= CAPTURE_CONCURRENCY ? 'Waiting for an available capture slot' : 'Preparing website capture',
    activeCaptures >= CAPTURE_CONCURRENCY ? 180 : 150,
  );
  await acquireCaptureSlot();
  try {
    return await captureSiteNow(jobId, sourceUrl, onProgress);
  } finally {
    releaseCaptureSlot();
  }
}

export async function fetchScreenshot(url: string): Promise<{ screenshotUrl: string; screenshotBuffer: Buffer }> {
  const screenshotUrl = `https://image.thum.io/get/width/1440/crop/900/${url}`;
  try {
    const response = await fetch(screenshotUrl, { signal: AbortSignal.timeout(20_000) });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return { screenshotUrl, screenshotBuffer: Buffer.from(await response.arrayBuffer()) };
  } catch {
    return { screenshotUrl, screenshotBuffer: Buffer.alloc(0) };
  }
}
