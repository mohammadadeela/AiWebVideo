import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { BrowserContext, Page } from 'playwright';
import { ASSETS_DIR, saveImageFile } from './capture.js';
import { ensureLocalAsset } from './r2-storage.js';
import { validateUrl } from './ssrf.js';

const execFileAsync = promisify(execFile);

/**
 * Branded ending
 * --------------
 * Customers asked for the real website logo at the end of every website film,
 * at high quality and "the way a real studio would do it". Generative video
 * models cannot be trusted with logos (they respell, warp and recolour them),
 * so the ending is produced in two deterministic steps:
 *
 *  1. At capture time the real logo is found in the page header (wordmark,
 *     combination mark, SVG, CSS background or, as a last resort, the favicon)
 *     and rendered by the browser into one transparent high-resolution end
 *     plate: logo + domain, on a soft plate when the logo needs one. The
 *     browser does the typography, so Arabic and other scripts shape correctly.
 *  2. In finishing, ffmpeg dims the last seconds of the film with a radial
 *     gradient and fades the plate in with an eased rise. No logo pixels are
 *     ever generated or re-drawn by AI.
 */

export const BRAND_LOCKUP_FILE = 'website-brand-lockup.png';
export const BRAND_LOCKUP_META_FILE = 'website-brand-lockup.json';
export const BRAND_ENDING_FILES = [BRAND_LOCKUP_FILE, BRAND_LOCKUP_META_FILE] as const;

export interface BrandLockupMeta {
  /** Where the artwork came from. */
  source: 'img' | 'svg' | 'css' | 'favicon';
  /** Natural pixel size of the rendered lockup PNG. */
  width: number;
  height: number;
  /** The real header background behind the logo on the website (CSS colour). */
  headerBackground: string;
  /** True when the website shows the logo on a light header (the lockup then carries a plate). */
  lightHeader: boolean;
  brandName: string;
  domain: string;
}

interface LogoCandidate {
  kind: 'img' | 'svg' | 'css';
  /** Image URL for img / css candidates. */
  src?: string;
  /** Serialized inline SVG with computed fill/stroke/colour baked in. */
  svg?: string;
  width: number;
  height: number;
  headerBackground: string;
  lightHeader: boolean;
  siteName: string | null;
}

const GENERIC_TITLE_WORDS = /^(?:home|homepage|welcome|index|main|start|shop|store|online shop|online store|official site|official website|website|site|الرئيسية|الصفحة الرئيسية|متجر|الموقع الرسمي)$/i;

/** Best human-readable brand name from the page title, og:site_name and the domain. */
export function deriveBrandName(siteTitle: string, siteName: string | null | undefined, domain: string): string {
  const clean = (value: string) => value.replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
  const fromSiteName = clean(siteName ?? '');
  if (fromSiteName && fromSiteName.length <= 48) return fromSiteName;
  const label = domain.split('.')[0]?.toLowerCase() ?? '';
  const segments = clean(siteTitle)
    .split(/\s*[|\-–—:·•]\s*/)
    .map(clean)
    .filter((segment) => segment && !GENERIC_TITLE_WORDS.test(segment));
  if (!segments.length) return label ? label.charAt(0).toUpperCase() + label.slice(1) : clean(siteTitle).slice(0, 48);
  const compact = (value: string) => value.toLowerCase().replace(/[^a-z0-9\u0600-\u06FF]/g, '');
  const matchingDomain = segments.find((segment) => label && compact(segment) && (compact(segment).includes(label) || label.includes(compact(segment))));
  const chosen = matchingDomain ?? segments.reduce((best, segment) => (segment.length < best.length ? segment : best), segments[0]);
  return chosen.slice(0, 48);
}

export function brandDomain(sourceUrl: string): string {
  try {
    return new URL(sourceUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

/**
 * Find the real logo on the page. Runs inside the page: scores header/nav
 * images, inline SVGs and CSS background logos, and reads the real header
 * background so the end plate can match the website.
 */
async function findLogoCandidate(page: Page): Promise<LogoCandidate | null> {
  return page.evaluate(() => {
    const NEGATIVE = /(?:payment|visa|master|paypal|badge|flag|cart|basket|search|menu|hamburger|user|avatar|account|whatsapp|app-?store|google-?play|facebook|instagram|twitter|tiktok|youtube|linkedin|arrow|chevron|close|phone|mail|star|rating|trust|secure|ssl|cookie|banner|hero|slide|product|ads?)/i;
    const POSITIVE = /logo|brand|wordmark|site-?title|site-?name/i;

    const parseRgb = (value: string): { r: number; g: number; b: number; a: number } | null => {
      const match = value.match(/rgba?\(([^)]+)\)/i);
      if (!match) return null;
      const parts = match[1].split(/[\s,/]+/).filter(Boolean).map(Number);
      if (parts.length < 3 || parts.slice(0, 3).some((n) => !Number.isFinite(n))) return null;
      return { r: parts[0], g: parts[1], b: parts[2], a: parts.length > 3 && Number.isFinite(parts[3]) ? parts[3] : 1 };
    };
    const luminance = (c: { r: number; g: number; b: number }) => (0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b) / 255;
    const backgroundBehind = (element: Element): { css: string; light: boolean } => {
      let node: Element | null = element;
      while (node) {
        const style = getComputedStyle(node);
        const rgb = parseRgb(style.backgroundColor);
        if (rgb && rgb.a > 0.35) return { css: `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`, light: luminance(rgb) > 0.62 };
        if (style.backgroundImage && style.backgroundImage !== 'none' && !/url\(/i.test(style.backgroundImage)) {
          // A gradient header: sample its stops.
          const stops = Array.from(style.backgroundImage.matchAll(/rgba?\([^)]+\)/gi)).map((m) => parseRgb(m[0])).filter(Boolean) as Array<{ r: number; g: number; b: number }>;
          if (stops.length) {
            const avg = stops.reduce((sum, c) => sum + luminance(c), 0) / stops.length;
            return { css: `rgb(${stops[0].r}, ${stops[0].g}, ${stops[0].b})`, light: avg > 0.62 };
          }
        }
        node = node.parentElement;
      }
      return { css: 'rgb(255, 255, 255)', light: true };
    };

    const inHeader = (element: Element) => Boolean(element.closest('header, nav, [role="banner"], [class*="header" i], [class*="navbar" i], [class*="topbar" i], [id*="header" i], [class*="site-logo" i]'));
    const inHomeLink = (element: Element) => {
      const link = element.closest('a[href]');
      if (!link) return false;
      try {
        const href = new URL(link.getAttribute('href') ?? '', location.href);
        return href.origin === location.origin && (href.pathname === '/' || href.pathname === '' || /^\/(?:index\.\w+|home\/?)$/i.test(href.pathname));
      } catch {
        return false;
      }
    };
    const identity = (element: Element) => {
      const bits = [element.getAttribute('alt'), element.getAttribute('title'), element.getAttribute('aria-label'), element.getAttribute('class'), element.getAttribute('id'), element.getAttribute('src'), element.getAttribute('data-src'), element.parentElement?.getAttribute('class'), element.parentElement?.getAttribute('id'), element.parentElement?.getAttribute('aria-label')];
      return bits.filter(Boolean).join(' ');
    };
    const visible = (element: Element) => {
      const rect = element.getBoundingClientRect();
      const style = getComputedStyle(element);
      return rect.width >= 36 && rect.height >= 14 && rect.width <= 900 && rect.height <= 320 && style.visibility !== 'hidden' && style.display !== 'none' && Number(style.opacity) > 0.2 && rect.bottom > 0 && rect.top < 900;
    };
    const score = (element: Element, kind: 'img' | 'svg' | 'css') => {
      const id = identity(element);
      const rect = element.getBoundingClientRect();
      let value = 0;
      if (POSITIVE.test(id)) value += 45;
      if (NEGATIVE.test(id)) value -= 60;
      if (inHeader(element)) value += 30;
      if (inHomeLink(element)) value += 25;
      if (rect.top < 160) value += 12;
      else if (rect.top > 500) value -= 20;
      const ratio = rect.width / Math.max(1, rect.height);
      if (ratio > 12 || ratio < 0.25) value -= 25;
      if (kind === 'svg') value += 8;
      if (kind === 'css') value -= 5;
      // Larger marks are usually the primary logo; cap so a hero image never wins on size alone.
      value += Math.min(14, Math.round(rect.width / 30));
      return value;
    };

    type Scored = { element: Element; kind: 'img' | 'svg' | 'css'; value: number };
    const scored: Scored[] = [];
    const seen = new Set<Element>();
    const consider = (element: Element, kind: 'img' | 'svg' | 'css') => {
      if (seen.has(element) || !visible(element)) return;
      seen.add(element);
      const value = score(element, kind);
      if (value >= 30) scored.push({ element, kind, value });
    };

    document.querySelectorAll<HTMLImageElement>('header img, nav img, [role="banner"] img, [class*="header" i] img, [class*="navbar" i] img, [class*="logo" i] img, img[class*="logo" i], img[alt*="logo" i], img[src*="logo" i], img[id*="logo" i], a[href="/"] img').forEach((img) => consider(img, 'img'));
    document.querySelectorAll<SVGSVGElement>('header svg, nav svg, [role="banner"] svg, [class*="header" i] svg, [class*="navbar" i] svg, [class*="logo" i] svg, svg[class*="logo" i], a[href="/"] svg').forEach((svg) => {
      // Skip icon-sized glyphs (menu, search, cart) that happen to live in the header.
      const rect = svg.getBoundingClientRect();
      if (rect.width >= 48 && rect.width / Math.max(1, rect.height) >= 1.15) consider(svg, 'svg');
      else if (rect.width >= 40 && POSITIVE.test(identity(svg))) consider(svg, 'svg');
    });
    document.querySelectorAll<HTMLElement>('header [class*="logo" i], nav [class*="logo" i], [class*="logo" i], a[href="/"]').forEach((element) => {
      if (element.querySelector('img, svg')) return;
      const background = getComputedStyle(element).backgroundImage;
      if (/url\(/i.test(background)) consider(element, 'css');
    });

    scored.sort((a, b) => b.value - a.value);
    const best = scored[0];
    if (!best) return null;
    const rect = best.element.getBoundingClientRect();
    const background = backgroundBehind(best.element);
    const siteName = document.querySelector<HTMLMetaElement>('meta[property="og:site_name"]')?.content?.trim() || document.querySelector<HTMLMetaElement>('meta[name="application-name"]')?.content?.trim() || null;
    const base = { width: Math.round(rect.width), height: Math.round(rect.height), headerBackground: background.css, lightHeader: background.light, siteName };

    if (best.kind === 'img') {
      const img = best.element as HTMLImageElement;
      const src = img.currentSrc || img.src || img.getAttribute('data-src') || '';
      if (!src || !img.complete || img.naturalWidth < 8) return null;
      return { kind: 'img' as const, src: new URL(src, location.href).href, ...base };
    }
    if (best.kind === 'css') {
      const match = getComputedStyle(best.element).backgroundImage.match(/url\((['"]?)(.*?)\1\)/i);
      if (!match?.[2]) return null;
      return { kind: 'css' as const, src: new URL(match[2], location.href).href, ...base };
    }
    // Inline SVG: clone it and bake computed paint into inline styles so it renders identically off-page.
    const original = best.element as SVGSVGElement;
    const clone = original.cloneNode(true) as SVGSVGElement;
    const originalNodes = [original, ...Array.from(original.querySelectorAll('*'))];
    const cloneNodes = [clone, ...Array.from(clone.querySelectorAll('*'))];
    if (originalNodes.length === cloneNodes.length) {
      originalNodes.forEach((node, index) => {
        const style = getComputedStyle(node);
        const target = cloneNodes[index] as HTMLElement | SVGElement;
        ['fill', 'stroke', 'color', 'opacity', 'fillOpacity', 'strokeOpacity', 'strokeWidth'].forEach((property) => {
          const value = (style as unknown as Record<string, string>)[property];
          if (value) (target.style as unknown as Record<string, string>)[property] = value;
        });
      });
    }
    // Resolve in-document <use href="#id"> sprites so the clone is self-contained.
    clone.querySelectorAll('use').forEach((use) => {
      const ref = use.getAttribute('href') || use.getAttribute('xlink:href') || '';
      if (!ref.startsWith('#')) return;
      const symbol = document.querySelector(ref);
      if (!symbol) return;
      const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      group.innerHTML = symbol.innerHTML;
      const viewBox = symbol.getAttribute('viewBox');
      if (viewBox && !clone.getAttribute('viewBox')) clone.setAttribute('viewBox', viewBox);
      use.replaceWith(group);
    });
    if (!clone.getAttribute('viewBox')) clone.setAttribute('viewBox', `0 0 ${Math.max(1, rect.width)} ${Math.max(1, rect.height)}`);
    clone.removeAttribute('width');
    clone.removeAttribute('height');
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    if (!clone.querySelector('path, circle, rect, polygon, text, image, ellipse, line, polyline')) return null;
    return { kind: 'svg' as const, svg: clone.outerHTML, ...base };
  }).catch(() => null);
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char);
}

/**
 * Render the end plate in a blank page of the same browser context. Output is
 * a transparent PNG about 1800 px wide, so even a 4K master receives the logo
 * at full fidelity after a mild lanczos downscale.
 */
async function renderLockup(
  context: BrowserContext,
  input: { candidate: LogoCandidate | null; faviconPath: string | null; brandName: string; domain: string },
): Promise<{ buffer: Buffer; meta: Omit<BrandLockupMeta, 'width' | 'height'> } | null> {
  const { candidate, faviconPath, brandName, domain } = input;
  const page = await context.newPage();
  try {
    page.setDefaultTimeout(10_000);
    let logoHtml = '';
    let source: BrandLockupMeta['source'] = 'favicon';
    let lightHeader = candidate?.lightHeader ?? true;
    let headerBackground = candidate?.headerBackground ?? 'rgb(255, 255, 255)';

    if (candidate?.kind === 'svg' && candidate.svg) {
      source = 'svg';
      logoHtml = `<div class="logo svg">${candidate.svg}</div>`;
    } else if (candidate?.src) {
      await validateUrl(candidate.src);
      source = candidate.kind === 'css' ? 'css' : 'img';
      logoHtml = `<img class="logo" alt="" src="${escapeHtml(candidate.src)}">`;
    } else if (faviconPath) {
      const buffer = await fs.readFile(faviconPath);
      logoHtml = `<img class="logo favicon" alt="" src="data:image/jpeg;base64,${buffer.toString('base64')}">`;
      lightHeader = true;
      headerBackground = 'rgb(255, 255, 255)';
    } else {
      return null;
    }

    const ratio = candidate ? candidate.width / Math.max(1, candidate.height) : 1;
    // A wordmark reads wide and short; an emblem or favicon needs the brand name beside or below it.
    const emblem = source === 'favicon' || ratio < 1.6;
    const showName = emblem && brandName && brandName.toLowerCase() !== domain.toLowerCase();
    const plate = lightHeader && source !== 'favicon';
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>
      html, body { margin: 0; padding: 0; background: transparent !important; }
      body { width: 2200px; height: 1400px; display: flex; align-items: center; justify-content: center; font-family: "Inter", "Poppins", "SF Pro Display", "Segoe UI", "Helvetica Neue", Arial, "Noto Sans", "Noto Sans Arabic", "Noto Naskh Arabic", "DejaVu Sans", sans-serif; }
      .lockup { display: flex; flex-direction: column; align-items: center; gap: 44px; padding: 20px; }
      .mark { display: flex; align-items: center; justify-content: center; gap: 54px; }
      .plate { background: ${headerBackground}; border-radius: 48px; padding: 74px 104px; box-shadow: 0 30px 80px rgba(0,0,0,.35), 0 2px 0 rgba(255,255,255,.08) inset; }
      .logo { display: block; max-width: ${emblem ? 420 : 1500}px; max-height: ${emblem ? 420 : 400}px; width: auto; height: auto; object-fit: contain; filter: drop-shadow(0 10px 30px rgba(0,0,0,.28)); }
      .logo.favicon { width: 360px; height: 360px; border-radius: 80px; box-shadow: 0 30px 80px rgba(0,0,0,.35); filter: none; }
      .logo.svg { width: ${emblem ? 420 : 1500}px; height: ${emblem ? 420 : 400}px; }
      .logo.svg svg { width: 100%; height: 100%; display: block; filter: drop-shadow(0 10px 30px rgba(0,0,0,.28)); }
      .name { color: #fff; font-weight: 700; font-size: 150px; line-height: 1.05; letter-spacing: -0.01em; text-shadow: 0 6px 30px rgba(0,0,0,.45); max-width: 1300px; }
      .domain { color: rgba(255,255,255,.88); font-weight: 500; font-size: 58px; letter-spacing: .14em; text-transform: lowercase; text-shadow: 0 4px 22px rgba(0,0,0,.5); }
      .rule { width: 160px; height: 3px; border-radius: 3px; background: rgba(255,255,255,.55); }
    </style></head><body>
      <div class="lockup" id="lockup">
        <div class="mark">
          ${plate ? `<div class="plate">${logoHtml}</div>` : logoHtml}
          ${showName ? `<div class="name">${escapeHtml(brandName)}</div>` : ''}
        </div>
        ${domain ? `<div class="rule"></div><div class="domain">${escapeHtml(domain)}</div>` : ''}
      </div>
    </body></html>`;
    await page.setViewportSize({ width: 2200, height: 1400 });
    await page.setContent(html, { waitUntil: 'load' });
    const image = page.locator('img.logo');
    if (await image.count()) {
      await page.waitForFunction(() => {
        const img = document.querySelector<HTMLImageElement>('img.logo');
        return Boolean(img?.complete && img.naturalWidth >= 8);
      }, undefined, { timeout: 8_000 });
    }
    await page.evaluate(() => document.fonts?.ready).catch(() => {});
    await page.waitForTimeout(120);
    const buffer = await page.locator('#lockup').screenshot({ type: 'png', omitBackground: true, animations: 'disabled' });
    return { buffer, meta: { source, headerBackground, lightHeader, brandName, domain } };
  } finally {
    await page.close().catch(() => {});
  }
}

async function pngDimensions(file: string): Promise<{ width: number; height: number }> {
  const { stdout } = await execFileAsync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', file]);
  const [width, height] = stdout.trim().split('x').map(Number);
  if (!width || !height) throw new Error('Could not read the brand lockup dimensions.');
  return { width, height };
}

/**
 * Capture-time entry point: find the real logo on the loaded homepage and save
 * the finished end plate (PNG + metadata) next to the other captures.
 */
export async function captureBrandLockup(
  page: Page,
  context: BrowserContext,
  jobId: string,
  sourceUrl: string,
  siteTitle: string,
): Promise<string | null> {
  try {
    await page.evaluate(() => window.scrollTo(0, 0)).catch(() => {});
    await page.waitForTimeout(150);
    const candidate = await findLogoCandidate(page);
    const domain = brandDomain(sourceUrl);
    const brandName = deriveBrandName(siteTitle, candidate?.siteName, domain);
    const faviconPath = await ensureLocalAsset(jobId, 'website-icon.jpg').catch(() => null);
    const rendered = await renderLockup(context, { candidate, faviconPath, brandName, domain });
    if (!rendered) {
      console.warn(`[brand-ending] job=${jobId} no logo or favicon found; the film will end without a composited brand plate`);
      return null;
    }
    const url = await saveImageFile(jobId, BRAND_LOCKUP_FILE, rendered.buffer);
    const { width, height } = await pngDimensions(path.join(ASSETS_DIR, jobId, BRAND_LOCKUP_FILE));
    const meta: BrandLockupMeta = { ...rendered.meta, width, height };
    await saveImageFile(jobId, BRAND_LOCKUP_META_FILE, Buffer.from(JSON.stringify(meta), 'utf8'));
    console.info(`[brand-ending] job=${jobId} lockup=${width}x${height} source=${meta.source} plate=${meta.lightHeader && meta.source !== 'favicon'} name="${meta.brandName}" domain=${meta.domain}`);
    return url;
  } catch (error) {
    console.warn(`[brand-ending] job=${jobId} brand lockup skipped: ${(error as Error).message}`);
    return null;
  }
}

async function probeVideo(file: string) {
  const { stdout } = await execFileAsync('ffprobe', [
    '-v', 'error', '-select_streams', 'v:0',
    '-show_entries', 'stream=width,height,r_frame_rate:format=duration',
    '-of', 'json', file,
  ]);
  const parsed = JSON.parse(stdout) as { streams?: Array<{ width?: number; height?: number; r_frame_rate?: string }>; format?: { duration?: string } };
  const stream = parsed.streams?.[0];
  const seconds = Number(parsed.format?.duration);
  const [num, den] = (stream?.r_frame_rate ?? '30/1').split('/').map(Number);
  const fps = den ? num / den : 30;
  if (!stream?.width || !stream.height || !Number.isFinite(seconds) || seconds <= 0) throw new Error('Could not probe the finished film for the branded ending.');
  return { width: stream.width, height: stream.height, seconds, fps: Number.isFinite(fps) && fps > 0 ? fps : 30 };
}

/** How long the brand plate holds at the end: 2.4 s for an 8 s spot, up to 3.2 s for longer films. */
export function brandEndingHoldSeconds(totalSeconds: number) {
  return Math.min(3.2, Math.max(2.4, totalSeconds * 0.22));
}

/**
 * Whether this job has the deterministic brand plate available. Reads from the
 * local cache or durable storage; never fabricates one.
 */
export async function hasBrandLockup(jobId: string): Promise<boolean> {
  const file = await ensureLocalAsset(jobId, BRAND_LOCKUP_FILE).catch(() => null);
  return Boolean(file);
}

/**
 * Finishing pass: dim the final seconds with a soft radial gradient and fade
 * the real brand plate in with an eased rise. Audio is copied untouched so the
 * verified soundtrack never changes.
 */
export async function addBrandEnding(source: string, output: string, jobId: string): Promise<boolean> {
  const lockupPath = await ensureLocalAsset(jobId, BRAND_LOCKUP_FILE).catch(() => null);
  if (!lockupPath) return false;
  const { width: W, height: H, seconds, fps } = await probeVideo(source);
  if (seconds < 6) return false;
  const lockup = await pngDimensions(lockupPath);

  const hold = brandEndingHoldSeconds(seconds);
  const start = Math.max(0, seconds - hold);
  const fade = 0.8;
  const portrait = H > W;
  const square = Math.abs(W - H) < 4;
  // Safe lockup footprint for each delivery format.
  const maxW = Math.round(W * (portrait ? 0.78 : square ? 0.66 : 0.56));
  const maxH = Math.round(H * (portrait ? 0.30 : square ? 0.36 : 0.44));
  const scale = Math.min(maxW / lockup.width, maxH / lockup.height, 1);
  const lw = Math.max(2, Math.round(lockup.width * scale / 2) * 2);
  const lh = Math.max(2, Math.round(lockup.height * scale / 2) * 2);
  const centerY = portrait ? 0.46 : 0.5;
  const s = start.toFixed(3);
  const d = seconds.toFixed(3);
  const rise = Math.round(H * 0.02);

  const dir = path.join(ASSETS_DIR, jobId);
  await fs.mkdir(dir, { recursive: true });
  // One radial-gradient frame (alpha 0.42 at the centre, 0.80 at the corners) rendered once, then looped.
  const gradient = path.join(dir, `brand-ending-gradient-${W}x${H}.png`);
  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'lavfi', '-i', `color=c=black:s=${W}x${H}:d=1`,
    '-vf', `format=rgba,geq=r=0:g=0:b=0:a='clip(255*(0.42+0.38*hypot((X-W/2)/(W/2),(Y-H/2)/(H/2))),0,255)'`,
    '-frames:v', '1', gradient,
  ], { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });

  const filter = [
    `[1:v]format=rgba,fade=t=in:st=${s}:d=${fade}:alpha=1[dim]`,
    `[0:v][dim]overlay=0:0:format=auto:eof_action=pass[dimmed]`,
    `[2:v]scale=${lw}:${lh}:flags=lanczos,format=rgba,fade=t=in:st=${s}:d=${fade}:alpha=1[plate]`,
    `[dimmed][plate]overlay=x=(W-w)/2:y=${centerY}*H-h/2+${rise}*pow(1-min(1\\,max(0\\,(t-${s})/${(fade + 0.25).toFixed(2)}))\\,2):format=auto:eof_action=pass,format=yuv420p[v]`,
  ].join(';');

  await execFileAsync('ffmpeg', [
    '-y', '-hide_banner', '-loglevel', 'error',
    '-i', source,
    '-loop', '1', '-framerate', String(Math.max(1, Math.round(fps))), '-t', d, '-i', gradient,
    '-loop', '1', '-framerate', String(Math.max(1, Math.round(fps))), '-t', d, '-i', lockupPath,
    '-filter_complex', filter,
    '-map', '[v]', '-map', '0:a?',
    '-t', d,
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-pix_fmt', 'yuv420p',
    '-c:a', 'copy', '-movflags', '+faststart', output,
  ], { timeout: 20 * 60_000, maxBuffer: 12 * 1024 * 1024 });
  await fs.rm(gradient, { force: true }).catch(() => {});
  const finished = await probeVideo(output);
  if (Math.abs(finished.seconds - seconds) > 0.3) throw new Error(`Branded ending changed the film duration (${seconds.toFixed(2)}s → ${finished.seconds.toFixed(2)}s).`);
  return true;
}
