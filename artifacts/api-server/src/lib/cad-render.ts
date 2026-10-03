import { chromium } from 'playwright';

/**
 * Turns the to-scale SVG of a drawing into a JPEG the image/video model can use as a reference.
 *
 * The page is rendered with JavaScript switched off and every network request refused, so nothing inside a
 * customer's file can run or fetch anything. One render at a time (they are short; the upload route is rate limited).
 * When no browser can be started the caller carries on without a picture: the measured figures still go to the model.
 */
const MAX_SIDE = 2600;
let queue: Promise<unknown> = Promise.resolve();

function svgSize(svg: string): { width: number; height: number } {
  const width = Number(/<svg[^>]*\swidth="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0);
  const height = Number(/<svg[^>]*\sheight="(\d+(?:\.\d+)?)"/.exec(svg)?.[1] ?? 0);
  return { width: Math.min(MAX_SIDE, Math.max(200, Math.round(width || 1600))), height: Math.min(MAX_SIDE, Math.max(200, Math.round(height || 1200))) };
}

async function render(svg: string): Promise<Buffer | null> {
  const { width, height } = svgSize(svg);
  const executablePath = process.env.CAD_RENDER_CHROMIUM || undefined;
  const browser = await chromium.launch({ headless: true, timeout: 15_000, executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  try {
    const context = await browser.newContext({ viewport: { width, height }, javaScriptEnabled: false, deviceScaleFactor: 1 });
    await context.route('**/*', (route) => {
      const url = route.request().url();
      return url.startsWith('data:') || url.startsWith('about:') ? route.continue() : route.abort('blockedbyclient');
    });
    const page = await context.newPage();
    await page.setContent(`<!doctype html><html><body style="margin:0;background:#fff">${svg}</body></html>`, { timeout: 20_000 });
    return await page.screenshot({ type: 'jpeg', quality: 88, clip: { x: 0, y: 0, width, height }, timeout: 20_000 });
  } finally {
    await browser.close().catch(() => {});
  }
}

export function renderDrawingJpeg(svg: string): Promise<Buffer | null> {
  const run = queue.then(() => render(svg)).catch((error) => {
    console.warn('[cad] plan picture could not be rendered:', error instanceof Error ? error.message : error);
    return null;
  });
  queue = run.catch(() => null);
  return run;
}
