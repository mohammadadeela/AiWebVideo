import { chromium, type Page } from 'playwright';
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
    const colors = new Set<string>();
    const add = (value: string) => {
      const match = value.match(/#[0-9a-f]{6}\b/ig);
      match?.forEach((color) => colors.size < 6 && colors.add(color.toLowerCase()));
    };
    add(document.documentElement.innerHTML.slice(0, 500_000));
    return { title, description, logoUrl: logo, brandColors: Array.from(colors) };
  }, fallbackUrl);
}

function pagePriority(url: URL) {
  const pathName = url.pathname.toLowerCase();
  const positive = ['product', 'shop', 'collection', 'category', 'dress', 'clothes', 'shoe', 'sale', 'pricing', 'feature', 'demo', 'about', 'location'];
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
    await onProgress?.(40, `Website capture complete — ${pages.length} page${pages.length === 1 ? '' : 's'} saved`, 0);
    return {
      ...meta,
      screenshotUrl,
      fullPageScreenshotUrl,
      mobileScreenshotUrl,
      mobileFullPageScreenshotUrl,
      recordingUrl,
      pages,
      pageCount: pages.length,
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
