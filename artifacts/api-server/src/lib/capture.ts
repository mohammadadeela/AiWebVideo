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
// Website campaigns need a small set of distinct, useful references — not a
// crawl archive. Keep the default intentionally tight so capture finishes fast
// and the planner receives only meaningful pages. Operators can still raise it
// for unusual sites, but the hard cap prevents runaway crawls.
const MAX_PAGES = Math.min(5, Math.max(2, Number(process.env.CAPTURE_MAX_PAGES ?? 5)));
const MAX_DISCOVERED_URLS = Math.max(60, Math.min(240, Number(process.env.CAPTURE_MAX_DISCOVERED_URLS ?? MAX_PAGES * 24)));
const SETTLE_MS = Math.max(200, Math.min(1500, Number(process.env.CAPTURE_SETTLE_MS ?? 450)));
const CAPTURE_CONCURRENCY = Math.max(1, Math.min(3, Number(process.env.CAPTURE_CONCURRENCY ?? 1)));
const ENABLE_SCROLL_RECORDING = /^(?:1|true|yes)$/i.test(process.env.CAPTURE_SCROLL_RECORDING ?? 'false');
const ENABLE_MOBILE_CAPTURE = /^(?:1|true|yes)$/i.test(process.env.CAPTURE_MOBILE_LAYOUT ?? 'false');
const MAX_INTERACTION_STATES = Math.min(1, Math.max(0, Number(process.env.CAPTURE_MAX_INTERACTIONS ?? 1)));
// This is a soft budget, not a browser-killing timer. The homepage is always
// preserved; optional pages are skipped as the budget approaches.
const CAPTURE_BUDGET_MS = Math.max(120_000, Number(process.env.CAPTURE_TIMEOUT_MS ?? 420_000));
const CHILD_PAGE_BUDGET_MS = Math.max(12_000, Math.min(38_000, Number(process.env.CAPTURE_CHILD_TIMEOUT_MS ?? 25_000)));
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

export type CaptureProgress = (progress: number, message: string, etaSeconds: number, partialCapture?: SiteCapture | null) => void | Promise<void>;

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

const networkHostChecks = new Map<string, { expiresAt: number; check: Promise<void> }>();

async function validateBrowserRequest(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol === 'data:' || parsed.protocol === 'blob:' || parsed.protocol === 'about:') return;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') throw new Error('Blocked non-web request scheme');
  const key = `${parsed.protocol}//${parsed.hostname.toLowerCase()}`;
  const now = Date.now();
  const cached = networkHostChecks.get(key);
  if (cached && cached.expiresAt > now) return cached.check;
  const check = validateUrl(parsed.toString()).then(() => undefined);
  networkHostChecks.set(key, { expiresAt: now + 60_000, check });
  if (networkHostChecks.size > 2_000) {
    for (const [host, value] of networkHostChecks) if (value.expiresAt <= now) networkHostChecks.delete(host);
  }
  return check;
}

async function guardNavigation(route: import('playwright').Route) {
  try {
    // Guard every network request, not only top-level navigation. This blocks
    // pages from smuggling requests to cloud metadata/private services through
    // images, scripts, iframes, redirects, fetches, or other subresources.
    await validateBrowserRequest(route.request().url());
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
  await page.waitForLoadState('networkidle', { timeout: deep ? 8_000 : 2_500 }).catch(() => {});

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
  }, { passes: deep ? 2 : 0, maxSteps: deep ? 14 : 1, stepDelay: deep ? 120 : 60 }), deep ? 12_000 : 3_000, 'HYDRATE').catch(() => {});

  await page.waitForLoadState('networkidle', { timeout: deep ? 5_000 : 1_500 }).catch(() => {});
  await withTimeout(page.evaluate(async ({ imageLimit, imageTimeout }) => {
    const fonts = (document as Document & { fonts?: FontFaceSet }).fonts;
    if (fonts) await fonts.ready.catch(() => {});
    const images = Array.from(document.images).slice(0, imageLimit);
    await Promise.all(images.map((img) => img.complete ? Promise.resolve() : new Promise<void>((resolve) => {
      const done = () => resolve();
      img.addEventListener('load', done, { once: true });
      img.addEventListener('error', done, { once: true });
      setTimeout(done, imageTimeout);
    })));
  }, { imageLimit: deep ? 220 : 100, imageTimeout: deep ? 2200 : 1200 }), deep ? 6_000 : 2_500, 'MEDIA').catch(() => {});
  await page.waitForTimeout(SETTLE_MS);
}

async function collectMetadata(page: Page, fallbackUrl: string) {
  return page.evaluate((url) => {
    const title = document.title.trim() || new URL(url).hostname;
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]')?.content?.trim() || null;

    // Browser-tab identity is the canonical brand mark for AiWebVideo.
    // Prefer the favicon/icon declared in <head>, because this is the exact
    // mark visitors see in the browser tab. Do not substitute a header logo
    // or wordmark from the page body.
    const allIconLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel]'))
      .filter((link) => /(?:^|\s)(?:shortcut\s+)?icon(?:\s|$)|apple-touch-icon/i.test(link.rel));
    const browserTabLinks = allIconLinks.filter((link) => !/apple-touch-icon/i.test(link.rel));
    const iconLinks = browserTabLinks.length ? browserTabLinks : allIconLinks;
    const icon = iconLinks
      .map((link) => {
        const sizes = Array.from(link.sizes ?? [])
          .map((value) => Number(value.split('x')[0]))
          .filter(Number.isFinite);
        const declaredSize = sizes.length ? Math.max(...sizes) : 0;
        const typeScore = /svg/i.test(link.type) ? 40 : /png|webp/i.test(link.type) ? 25 : /icon/i.test(link.type) ? 10 : 0;
        return { href: link.href, score: typeScore + Math.min(256, declaredSize) };
      })
      .filter((item) => item.href)
      .sort((a, b) => b.score - a.score)[0]?.href || new URL('/favicon.ico', url).href;

    const htmlLang = document.documentElement.lang?.trim() || null;
    const colors = new Set<string>();
    const add = (value: string) => {
      const match = value.match(/#[0-9a-f]{6}\b/ig);
      match?.forEach((color) => colors.size < 6 && colors.add(color.toLowerCase()));
    };
    add(document.documentElement.innerHTML.slice(0, 500_000));
    return { title, description, iconUrl: icon, logoUrl: icon, brandColors: Array.from(colors), htmlLang };
  }, fallbackUrl);
}

/**
 * Preserve a clean local copy of the site's browser-tab icon (favicon). The source URL is
 * validated before it is loaded into a temporary square card, and Playwright
 * rasterizes SVG/ICO/PNG inputs to one dependable JPEG reference for later
 * icon generation and branded video endings.
 */
async function captureWebsiteIcon(page: Page, jobId: string, sourceUrl: string | null): Promise<string | null> {
  if (!sourceUrl) return null;
  try {
    // Only the browser-tab favicon is accepted as website identity. If the
    // favicon is missing or invalid, leave the brand mark empty so the UI can
    // use its neutral website icon instead of inventing a monogram or pulling
    // a different logo from the page body.
    await validateUrl(sourceUrl);
    await page.evaluate((source) => {
      document.querySelector('[data-aiwebvideo-brand-icon]')?.remove();
      const card = document.createElement('div');
      card.dataset.aiwebvideoBrandIcon = 'true';
      card.style.cssText = 'position:fixed;left:16px;top:16px;width:512px;height:512px;z-index:2147483647;display:flex;align-items:center;justify-content:center;background:#fff;border-radius:96px;overflow:hidden;box-shadow:0 30px 80px rgba(20,15,39,.18)';
      const image = document.createElement('img');
      image.alt = '';
      image.src = source;
      image.style.cssText = 'display:block;width:76%;height:76%;object-fit:contain';
      card.appendChild(image);
      document.body.appendChild(card);
    }, sourceUrl);
    const card = page.locator('[data-aiwebvideo-brand-icon]');
    await card.locator('img').waitFor({ state: 'visible', timeout: 6_000 });
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>('[data-aiwebvideo-brand-icon] img');
      return Boolean(image?.complete && image.naturalWidth >= 8 && image.naturalHeight >= 8);
    }, undefined, { timeout: 6_000 });
    const buffer = await card.screenshot({ type: 'jpeg', quality: 96 });
    await card.evaluate((element) => element.remove()).catch(() => {});
    return await saveImageFile(jobId, 'website-icon.jpg', buffer);
  } catch (error) {
    await page.locator('[data-aiwebvideo-brand-icon]').evaluateAll((elements) => elements.forEach((element) => element.remove())).catch(() => {});
    console.warn(`[capture] browser-tab favicon skipped: ${(error as Error).message}`);
    return null;
  }
}

function pagePriority(url: URL) {
  const pathName = url.pathname.toLowerCase();
  const positive = ['product', 'shop', 'store', 'catalog', 'collection', 'category', 'dress', 'clothes', 'shoe', 'sale', 'pricing', 'plan', 'feature', 'solution', 'service', 'booking', 'reserve', 'dashboard', 'demo', 'portfolio', 'work', 'about', 'location', 'contact'];
  const negative = ['privacy', 'terms', 'policy', 'cookie', 'login', 'register', 'account', 'forgot', 'reset', 'search', 'tag', 'author', 'feed'];
  let score = 0;
  for (const token of positive) if (pathName.includes(token)) score += 12;
  for (const token of negative) if (pathName.includes(token)) score -= 18;
  score -= Math.min(12, pathName.split('/').filter(Boolean).length * 2);
  return score;
}

function pageFamily(url: URL) {
  const pathName = url.pathname.toLowerCase();
  if (pathName === '/' || pathName === '') return 'home';
  if (/(?:^|\/)(?:product|products|item|items|shop|store|catalog)(?:\/|$)/.test(pathName)) return 'product';
  if (/(?:^|\/)(?:collection|collections|category|categories)(?:\/|$)/.test(pathName)) return 'collection';
  if (/(?:^|\/)(?:pricing|plans?|subscriptions?)(?:\/|$)/.test(pathName)) return 'pricing';
  if (/(?:^|\/)(?:features?|solutions?|services?|how-it-works|howitworks|overview|tour)(?:\/|$)/.test(pathName)) return 'feature';
  if (/(?:^|\/)(?:booking|book|reserve|reservation)(?:\/|$)/.test(pathName)) return 'booking';
  if (/(?:^|\/)(?:portfolio|work|projects?|gallery)(?:\/|$)/.test(pathName)) return 'portfolio';
  if (/(?:^|\/)(?:about|story|team)(?:\/|$)/.test(pathName)) return 'about';
  if (/(?:^|\/)(?:contact|location|locations)(?:\/|$)/.test(pathName)) return 'contact';
  if (/(?:^|\/)(?:blog|news|article|articles)(?:\/|$)/.test(pathName)) return 'content';
  return pathName.split('/').filter(Boolean)[0] || 'other';
}

function familyLimit(family: string) {
  // A little extra room for product-led sites, while preventing ten nearly
  // identical product/detail pages from crowding out pricing/features/contact.
  if (family === 'product') return 2;
  return 1;
}

function isLowValuePage(url: URL) {
  const pathName = url.pathname.toLowerCase();
  return /(?:^|\/)(?:privacy|terms|policy|cookies?|login|log-in|register|sign-up|signup|account|profile|forgot|reset|search|tags?|authors?|feed)(?:\/|$)/.test(pathName);
}

type PageSignature = {
  heading: string;
  tokens: string[];
};

async function pageContentSignature(page: Page): Promise<PageSignature> {
  return page.evaluate(() => {
    const main =
      document.querySelector<HTMLElement>('main, [role="main"], #main, .main-content, .page-content') ||
      document.body;
    const heading =
      main.querySelector<HTMLElement>('h1, h2, [role="heading"]')?.innerText ||
      document.querySelector<HTMLElement>('h1, h2, [role="heading"]')?.innerText ||
      document.title ||
      '';
    const raw = (main.innerText || '').toLowerCase();
    const normalized = raw
      .replace(/https?:\/\/\S+/g, ' ')
      .replace(/[\d.,:%$€£¥₪]+/g, ' ')
      .replace(/[^\p{L}\p{N}\s]+/gu, ' ')
      .replace(/\s+/g, ' ')
      .trim();
    const tokens = Array.from(new Set(normalized.split(' ').filter((word) => word.length >= 3))).slice(0, 650);
    return {
      heading: heading.toLowerCase().replace(/\s+/g, ' ').trim().slice(0, 180),
      tokens,
    };
  });
}

function signatureSimilarity(a: PageSignature, b: PageSignature) {
  if (a.heading && b.heading && a.heading === b.heading && a.tokens.length > 40 && b.tokens.length > 40) return 1;
  const aSet = new Set(a.tokens);
  const bSet = new Set(b.tokens);
  if (!aSet.size || !bSet.size) return 0;
  let intersection = 0;
  for (const token of aSet) if (bSet.has(token)) intersection++;
  const union = aSet.size + bSet.size - intersection;
  return union ? intersection / union : 0;
}

function isNearDuplicateSignature(candidate: PageSignature, existing: PageSignature[]) {
  return existing.some((signature) => signatureSimilarity(candidate, signature) >= 0.78);
}

function isMeaningfulInteractionChange(before: PageSignature, after: PageSignature, beforeUrl: string, afterUrl: string) {
  try {
    const a = new URL(beforeUrl);
    const b = new URL(afterUrl);
    if (a.pathname !== b.pathname || a.search !== b.search) return true;
  } catch {
    if (beforeUrl !== afterUrl) return true;
  }
  if (before.heading && after.heading && before.heading !== after.heading) return true;
  return signatureSimilarity(before, after) < 0.9;
}

const NON_PAGE_EXTENSION = /\.(?:pdf|zip|rar|7z|jpe?g|png|gif|webp|svg|ico|mp4|webm|mov|mp3|wav|css|js|json|xml|txt|woff2?|ttf|eot)$/i;
const DANGEROUS_PAGE_PATH = /(?:^|\/)(?:logout|log-out|signout|sign-out|delete-account|remove-account)(?:\/|$)/i;
const TRACKING_QUERY_PARAM = /^(?:utm_.+|fbclid|gclid|dclid|msclkid|mc_cid|mc_eid|ref|referrer|source)$/i;

function normalizeInternalPageUrl(rawUrl: string, sourceUrl: string): string | null {
  try {
    const root = new URL(sourceUrl);
    const url = new URL(rawUrl, root);
    if (!['http:', 'https:'].includes(url.protocol) || url.origin !== root.origin) return null;
    if (NON_PAGE_EXTENSION.test(url.pathname) || DANGEROUS_PAGE_PATH.test(url.pathname)) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_QUERY_PARAM.test(key)) url.searchParams.delete(key);
    }
    // Sort the remaining semantic query parameters so equivalent links dedupe.
    url.searchParams.sort();
    // Treat /path and /path/ as one page while preserving the root slash.
    if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
    return url.toString();
  } catch {
    return null;
  }
}

async function discoverInternalPages(page: Page, sourceUrl: string): Promise<string[]> {
  const hrefs = await page.locator('a[href]').evaluateAll((anchors) => anchors.map((a) => (a as HTMLAnchorElement).href));
  const root = normalizeInternalPageUrl(sourceUrl, sourceUrl);
  const candidates = new Map<string, number>();
  for (const href of hrefs) {
    const normalized = normalizeInternalPageUrl(href, sourceUrl);
    if (!normalized || normalized === root) continue;
    const url = new URL(normalized);
    candidates.set(normalized, Math.max(candidates.get(normalized) ?? -999, pagePriority(url)));
    if (candidates.size >= MAX_DISCOVERED_URLS) break;
  }
  return [...candidates.entries()].sort((a, b) => b[1] - a[1]).map(([url]) => url);
}

async function fetchSameOriginText(rawUrl: string, sourceUrl: string): Promise<string | null> {
  try {
    const root = new URL(sourceUrl);
    const target = new URL(rawUrl, root);
    if (!['http:', 'https:'].includes(target.protocol) || target.origin !== root.origin) return null;
    await validateUrl(target.toString());
    const response = await fetch(target, {
      headers: { 'user-agent': 'AiWebVideoCapture/3.0' },
      redirect: 'manual',
      signal: AbortSignal.timeout(10_000),
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location) return null;
      const redirected = new URL(location, target);
      if (redirected.origin !== root.origin) return null;
      await validateUrl(redirected.toString());
      const redirectedResponse = await fetch(redirected, {
        headers: { 'user-agent': 'AiWebVideoCapture/3.0' },
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!redirectedResponse.ok) return null;
      return (await redirectedResponse.text()).slice(0, 8_000_000);
    }
    if (!response.ok) return null;
    return (await response.text()).slice(0, 8_000_000);
  } catch {
    return null;
  }
}

async function discoverSitemapPages(sourceUrl: string): Promise<string[]> {
  const root = new URL(sourceUrl);
  const sitemapQueue: string[] = [new URL('/sitemap.xml', root).toString()];
  const robots = await fetchSameOriginText(new URL('/robots.txt', root).toString(), sourceUrl);
  if (robots) {
    for (const match of robots.matchAll(/^\s*Sitemap:\s*(\S+)\s*$/gim)) {
      try {
        const sitemap = new URL(match[1], root);
        if (sitemap.origin === root.origin && !sitemapQueue.includes(sitemap.toString())) sitemapQueue.push(sitemap.toString());
      } catch { /* ignore invalid robots entries */ }
    }
  }

  const visitedSitemaps = new Set<string>();
  const pages = new Set<string>();
  while (sitemapQueue.length && visitedSitemaps.size < 4 && pages.size < MAX_DISCOVERED_URLS) {
    const sitemapUrl = sitemapQueue.shift()!;
    if (visitedSitemaps.has(sitemapUrl) || /\.gz(?:$|\?)/i.test(sitemapUrl)) continue;
    visitedSitemaps.add(sitemapUrl);
    const xml = await fetchSameOriginText(sitemapUrl, sourceUrl);
    if (!xml) continue;
    for (const match of xml.matchAll(/<loc>\s*([^<]+?)\s*<\/loc>/gi)) {
      const raw = match[1].replace(/&amp;/g, '&').trim();
      if (!raw) continue;
      try {
        const candidate = new URL(raw, root);
        if (candidate.origin !== root.origin) continue;
        if (/sitemap/i.test(candidate.pathname) && /\.xml(?:$|\?)/i.test(candidate.toString())) {
          if (!visitedSitemaps.has(candidate.toString())) sitemapQueue.push(candidate.toString());
          continue;
        }
      } catch { continue; }
      const normalized = normalizeInternalPageUrl(raw, sourceUrl);
      if (normalized) pages.add(normalized);
      if (pages.size >= MAX_DISCOVERED_URLS) break;
    }
  }
  return [...pages];
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
  if (MAX_INTERACTION_STATES <= 0 || Date.now() >= deadlineAt - 15_000) return extra;

  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  await context.route('**/*', guardNavigation);

  const canSaveMore = () => extra.length < MAX_INTERACTION_STATES && Date.now() < deadlineAt - 6_000;

  try {
    // Product flows: change a real option if available, then prefer visibly
    // distinct states (cart / checkout) over multiple almost-identical product
    // screenshots. The option selection itself is used to make the next action
    // valid but is not saved unless no stronger state can be reached.
    const productCandidate = discoveredPages.find((p) => /product|shop|item|dress|shoe|bag|detail/i.test(p.url));
    if (productCandidate && canSaveMore()) {
      const page = await context.newPage();
      configurePage(page);
      try {
        await withTimeout((async () => {
          await page.goto(productCandidate.url, { waitUntil: 'domcontentloaded', timeout: 25_000 });
          await waitForReady(page, false);

          const selectedOption = await tryClickFirstVisible(page, OPTION_SELECTORS, []);
          if (selectedOption) await page.waitForTimeout(300);

          const added = await tryClickFirstVisible(page, [], ADD_TO_CART_TEXTS);
          if (added) {
            await page.waitForTimeout(550);
            const openedCart = await tryClickFirstVisible(page, CART_SELECTORS, CART_TEXTS);
            if (openedCart && canSaveMore()) {
              await page.waitForTimeout(500);
              const cartBuffer = await screenshotPage(page, false);
              extra.push({ url: page.url(), title: 'Shopping cart', screenshotUrl: await saveImageFile(jobId, 'interaction-cart.jpg', cartBuffer) });

              if (canSaveMore()) {
                const openedCheckout = await tryClickFirstVisible(page, CHECKOUT_SELECTORS, CHECKOUT_TEXTS);
                if (openedCheckout) {
                  await page.waitForTimeout(650);
                  const checkoutBuffer = await screenshotPage(page, false);
                  extra.push({ url: page.url(), title: 'Checkout — real entry state', screenshotUrl: await saveImageFile(jobId, 'interaction-checkout.jpg', checkoutBuffer) });
                }
              }
            } else if (canSaveMore()) {
              const buffer = await screenshotPage(page, false);
              extra.push({ url: page.url(), title: 'Added to cart', screenshotUrl: await saveImageFile(jobId, 'interaction-added-to-cart.jpg', buffer) });
            }
          } else if (selectedOption && canSaveMore()) {
            const buffer = await screenshotPage(page, false);
            extra.push({ url: page.url(), title: 'Product option selected', screenshotUrl: await saveImageFile(jobId, 'interaction-product-selected.jpg', buffer) });
          }
        })(), 24_000, 'PRODUCT_INTERACTION');
      } catch (err) {
        console.warn('[capture] product interaction skipped:', (err as Error).message);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // Generic conversion entry for SaaS/service/booking sites. Capture only one
    // meaningful entry state and only while the interaction budget has room.
    if (canSaveMore()) {
      const page = await context.newPage();
      configurePage(page);
      try {
        await withTimeout((async () => {
          await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
          await waitForReady(page, false);
          const beforeUrl = page.url();
          const beforeSignature = await pageContentSignature(page);
          const opened = await tryClickFirstVisible(page, [], CONVERSION_TEXTS);
          if (opened && canSaveMore()) {
            await page.waitForTimeout(650);
            const afterSignature = await pageContentSignature(page);
            if (isMeaningfulInteractionChange(beforeSignature, afterSignature, beforeUrl, page.url())) {
              const buffer = await screenshotPage(page, false);
              extra.push({ url: page.url(), title: 'Conversion / booking entry', screenshotUrl: await saveImageFile(jobId, 'interaction-conversion.jpg', buffer) });
            } else {
              console.info('[capture] interaction conversion skipped: state did not meaningfully change');
            }
          }
        })(), 15_000, 'CONVERSION_ENTRY');
      } catch (err) {
        console.warn('[capture] conversion entry skipped:', (err as Error).message);
      } finally {
        await page.close().catch(() => {});
      }
    }

    // Chat is useful only when it is a real feature and there is still room.
    if (canSaveMore()) {
      const page = await context.newPage();
      configurePage(page);
      try {
        await withTimeout((async () => {
          await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 25_000 });
          await waitForReady(page, false);
          const beforeUrl = page.url();
          const beforeSignature = await pageContentSignature(page);
          const opened = await tryClickFirstVisible(page, CHAT_LAUNCHER_SELECTORS, CHAT_TEXTS);
          if (opened && canSaveMore()) {
            await page.waitForTimeout(750);
            const afterSignature = await pageContentSignature(page);
            if (isMeaningfulInteractionChange(beforeSignature, afterSignature, beforeUrl, page.url())) {
              const buffer = await screenshotPage(page, false);
              extra.push({ url: page.url(), title: 'AI assistant / live chat', screenshotUrl: await saveImageFile(jobId, 'interaction-ai-assistant.jpg', buffer) });
            } else {
              console.info('[capture] interaction chat skipped: launcher did not produce a distinct state');
            }
          }
        })(), 16_000, 'CHAT_WIDGET');
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

  const reportProgress: CaptureProgress = async (progress, message, etaSeconds, partialCapture) => {
    if (!onProgress) return;
    try {
      await withTimeout(Promise.resolve(onProgress(progress, message, etaSeconds, partialCapture)), 6_000, 'CAPTURE_PROGRESS');
    } catch (error) {
      console.warn(`[capture] progress update skipped after timeout/error: ${(error as Error).message}`);
    }
  };

  await reportProgress(8, 'Opening your website securely', 70);
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
    await reportProgress(12, 'Loading the homepage', 55);
    console.info(`[capture] opening ${sourceUrl}`);
    await page.goto(sourceUrl, { waitUntil: 'domcontentloaded', timeout: 40_000 });
    await waitForReady(page, true);
    await reportProgress(20, 'Saving the homepage', 45);

    const meta = await collectMetadata(page, sourceUrl);
    const homepageDiscoveredUrls = await discoverInternalPages(page, sourceUrl);
    const homepageSignature = await pageContentSignature(page);
    const viewportBuffer = await screenshotPage(page, false);
    const fullBuffer = await screenshotPage(page, true);
    const screenshotUrl = await saveImageFile(jobId, 'screenshot.jpg', viewportBuffer);
    const fullPageScreenshotUrl = await saveImageFile(jobId, 'screenshot-full.jpg', fullBuffer);
    const websiteIconUrl = await captureWebsiteIcon(page, jobId, meta.iconUrl);
    console.info(`[capture] success ${sourceUrl} screenshot.jpg + screenshot-full.jpg`);
    await page.close();
    await context.close();
    await reportProgress(27, 'Homepage ready — choosing the strongest supporting pages', 45, {
      ...meta,
      logoUrl: websiteIconUrl ?? meta.logoUrl,
      screenshotUrl,
      fullPageScreenshotUrl,
      mobileScreenshotUrl: null,
      mobileFullPageScreenshotUrl: null,
      recordingUrl: null,
      pages: [{ url: sourceUrl, title: meta.title, screenshotUrl: fullPageScreenshotUrl }],
      pageCount: 1,
    });
    const sitemapDiscoveredUrls = await discoverSitemapPages(sourceUrl);
    const initialDiscoveredUrls = [...new Set([...homepageDiscoveredUrls, ...sitemapDiscoveredUrls])];

    // Scroll recording is optional and disabled by default because it is not
    // used as an AI-video grounding source. This saves a noticeable amount of
    // time for the normal website-to-video flow.
    let recordingUrl: string | null = null;
    if (ENABLE_SCROLL_RECORDING && Date.now() < deadlineAt - 25_000) {
      await reportProgress(29, 'Saving a smooth-scroll preview', 65);
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

    // Mobile capture is also opt-in. The campaign planner uses the selected
    // desktop references by default, so saving another copy of the homepage
    // should not delay every generation.
    let mobileScreenshotUrl: string | null = null;
    let mobileFullPageScreenshotUrl: string | null = null;
    if (ENABLE_MOBILE_CAPTURE && Date.now() < deadlineAt - 20_000) {
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
        await reportProgress(32, 'Saving the real mobile layout', 55);
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

    // Smart capture: keep the homepage, then select a small diverse set of
    // useful pages. We still inspect nested links so important pages are not
    // missed, but repeated/low-value routes and near-duplicate content are
    // skipped before a screenshot is saved.
    const rootCanonical = normalizeInternalPageUrl(sourceUrl, sourceUrl) ?? sourceUrl;
    const pages: CapturedPage[] = [{ url: sourceUrl, title: meta.title, screenshotUrl: fullPageScreenshotUrl }];
    const currentCaptureSnapshot = (): SiteCapture => ({
      ...meta,
      logoUrl: websiteIconUrl ?? meta.logoUrl,
      screenshotUrl,
      fullPageScreenshotUrl,
      mobileScreenshotUrl,
      mobileFullPageScreenshotUrl,
      recordingUrl,
      pages: [...pages],
      pageCount: pages.length,
    });
    await reportProgress(33, `Homepage saved · selecting up to ${MAX_PAGES - 1} distinct supporting pages`, Math.max(8, (MAX_PAGES - 1) * 5), currentCaptureSnapshot());
    const capturedCanonicalUrls = new Set<string>([rootCanonical]);
    const attemptedUrls = new Set<string>([rootCanonical]);
    const queuedUrls = new Set<string>();
    const queue: Array<{ url: string; score: number }> = [];
    const familyCounts = new Map<string, number>([['home', 1]]);
    const savedSignatures: PageSignature[] = [homepageSignature];
    let skippedPages = 0;
    let duplicatePages = 0;
    let discoveredCount = 1;
    let pageFileIndex = 1;

    const enqueue = (urls: string[]) => {
      for (const raw of urls) {
        if (attemptedUrls.size + queuedUrls.size >= MAX_DISCOVERED_URLS) break;
        const normalized = normalizeInternalPageUrl(raw, sourceUrl);
        if (!normalized || attemptedUrls.has(normalized) || queuedUrls.has(normalized)) continue;
        const parsed = new URL(normalized);
        if (isLowValuePage(parsed)) continue;
        queuedUrls.add(normalized);
        queue.push({ url: normalized, score: pagePriority(parsed) });
        discoveredCount++;
      }
      queue.sort((a, b) => b.score - a.score);
    };

    enqueue(initialDiscoveredUrls);

    const childContext = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
    await childContext.route('**/*', guardNavigation);
    try {
      while (queue.length > 0 && pages.length < MAX_PAGES) {
        if (Date.now() >= deadlineAt - 15_000) {
          console.warn(`[capture] safety budget reached with ${queue.length} discovered page(s) still queued after ${pages.length} successful captures`);
          break;
        }

        const next = queue.shift()!;
        queuedUrls.delete(next.url);
        if (attemptedUrls.has(next.url)) continue;
        attemptedUrls.add(next.url);

        const child = await childContext.newPage();
        configurePage(child);
        let captured = false;
        try {
          const estimatedRemaining = Math.max(1, queue.length + 1);
          await reportProgress(
            Math.min(38, 33 + Math.round((pages.length / Math.max(2, discoveredCount)) * 5)),
            `Checking candidate ${Math.min(attemptedUrls.size, MAX_DISCOVERED_URLS)} · ${pages.length}/${MAX_PAGES} strong pages saved`,
            Math.max(8, Math.min(45, estimatedRemaining * 4)),
          );
          console.info(`[capture] opening ${next.url}`);

          let lastError: unknown = null;
          for (let attempt = 1; attempt <= 2 && !captured; attempt++) {
            try {
              await withTimeout((async () => {
                await child.goto(next.url, { waitUntil: 'domcontentloaded', timeout: 32_000 });
                await waitForReady(child, false);

                // Discover deeper routes even if this URL redirects to a page
                // already captured. That prevents redirects/navigation hubs from
                // hiding valid nested pages from the crawler.
                enqueue(await discoverInternalPages(child, sourceUrl));

                const finalCanonical = normalizeInternalPageUrl(child.url(), sourceUrl);
                if (!finalCanonical || capturedCanonicalUrls.has(finalCanonical)) {
                  captured = true;
                  duplicatePages++;
                  return;
                }

                const finalUrl = new URL(finalCanonical);
                const family = pageFamily(finalUrl);
                const currentFamilyCount = familyCounts.get(family) ?? 0;
                if (currentFamilyCount >= familyLimit(family)) {
                  captured = true;
                  duplicatePages++;
                  console.info(`[capture] diversity skip ${child.url()} family=${family}`);
                  return;
                }

                const signature = await pageContentSignature(child);
                if (isNearDuplicateSignature(signature, savedSignatures)) {
                  captured = true;
                  duplicatePages++;
                  console.info(`[capture] duplicate-content skip ${child.url()}`);
                  return;
                }

                const childMeta = await collectMetadata(child, next.url);
                const buffer = await screenshotPage(child, false);
                const filename = `page-${pageFileIndex++}.jpg`;
                const pageScreenshotUrl = await saveImageFile(jobId, filename, buffer);
                pages.push({ url: child.url(), title: childMeta.title, screenshotUrl: pageScreenshotUrl });
                capturedCanonicalUrls.add(finalCanonical);
                familyCounts.set(family, currentFamilyCount + 1);
                savedSignatures.push(signature);
                captured = true;
                await reportProgress(
                  Math.min(38, 33 + Math.round((pages.length / Math.max(2, MAX_PAGES)) * 5)),
                  `${pages.length}/${MAX_PAGES} strong pages saved · duplicates skipped automatically`,
                  Math.max(6, Math.min(35, (MAX_PAGES - pages.length) * 5)),
                  currentCaptureSnapshot(),
                );
                console.info(`[capture] success ${child.url()} ${filename} family=${family} total=${pages.length}`);
              })(), Math.min(CHILD_PAGE_BUDGET_MS, Math.max(12_000, deadlineAt - Date.now() - 5_000)), 'CHILD_PAGE');
            } catch (error) {
              lastError = error;
              if (attempt < 2 && Date.now() < deadlineAt - 20_000) {
                console.warn(`[capture] retry ${attempt}/2 ${next.url}: ${(error as Error).message}`);
                await child.waitForTimeout(500).catch(() => {});
              }
            }
          }

          if (!captured) {
            skippedPages++;
            console.warn(`[capture] skipped after retry ${next.url} ${(lastError as Error | null)?.message ?? 'unknown error'}`);
          }
        } finally {
          await child.close().catch(() => {});
        }
      }
    } finally {
      await childContext.close().catch(() => {});
    }

    if (queue.length > 0 && pages.length >= MAX_PAGES) {
      console.warn(`[capture] page safety cap reached (${MAX_PAGES}); ${queue.length} additional discovered URL(s) were not captured. Increase CAPTURE_MAX_PAGES for unusually large sites.`);
    }
    console.info(`[capture] finished successful=${pages.length} failed=${skippedPages} duplicate_or_low_value=${duplicatePages} discovered=${discoveredCount} queued=${queue.length}`);
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
      await reportProgress(38, 'Checking one useful interaction state', 15);
      const interactionPages = await captureInteractionStates(browser, jobId, sourceUrl, pages, deadlineAt);
      if (interactionPages.length) {
        console.info(`[capture] interaction states captured=${interactionPages.length}`);
        pages.push(...interactionPages);
      }
    }

    const finalCapture: SiteCapture = {
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
    // Persist the complete metadata before browser shutdown. If Chromium cleanup
    // is slow, the frontend can already continue from this exact final capture.
    await reportProgress(40, `Website read complete — ${pageCount} distinct page${pageCount === 1 ? '' : 's'} selected`, 0, finalCapture);
    console.info(`[capture] metadata complete job=${jobId} pages=${pageCount}`);
    return finalCapture;
  } catch (err) {
    const message = (err as Error).message;
    if (/timeout/i.test(message) || Date.now() >= deadlineAt) throw new Error('CAPTURE_TIMEOUT');
    throw err;
  } finally {
    console.info(`[capture] closing browser job=${jobId}`);
    await withTimeout(browser.close(), 5_000, 'BROWSER_CLOSE').catch((error) => {
      console.warn(`[capture] browser close timed out; releasing job anyway: ${(error as Error).message}`);
    });
    await withTimeout(fs.rm(videoDir, { recursive: true, force: true }), 5_000, 'VIDEO_TMP_CLEANUP').catch(() => {});
    console.info(`[capture] browser cleanup finished job=${jobId}`);
  }
}

export async function captureSite(jobId: string, sourceUrl: string, onProgress?: CaptureProgress): Promise<SiteCapture> {
  await onProgress?.(
    5,
    activeCaptures >= CAPTURE_CONCURRENCY ? 'Waiting for an available capture slot' : 'Preparing website capture',
    activeCaptures >= CAPTURE_CONCURRENCY ? 120 : 70,
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
