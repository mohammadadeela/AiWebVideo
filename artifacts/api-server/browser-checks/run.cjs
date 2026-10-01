/**
 * Real-browser checks (Chromium via Playwright) for things a simulated DOM cannot prove:
 *   - sliders show the custom drag cursor on hover and while dragging, and a drag moves the row
 *   - the "+" menu's Recent files: hidden when signed out, kept per account on one computer
 *
 * Run after building the frontend:   pnpm --filter @workspace/aiwebvideo run build && pnpm --filter @workspace/api-server run check:browser
 * Set CHROMIUM_PATH to use a specific browser. If no browser can be launched the checks are skipped.
 */
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');

const ROOT = path.resolve(__dirname, '../../aiwebvideo/dist/public');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==', 'base64');
const FEATURES = ['photo', 'interior', 'architecture', 'video', 'scenario', 'product-video', 'website'];
const SAMPLES = Array.from({ length: 98 }, (_, i) => ({ id: `s${i}`, url: `/api/assets/marketing/s${i}.png`, posterUrl: null, kind: 'image', feature: FEATURES[i % 7], caption: null, overlayText: null, eyebrow: null }));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json', '.woff2': 'font/woff2' };

function serve() {
  const server = http.createServer((req, res) => {
    let file = path.join(ROOT, req.url.split('?')[0] === '/' ? 'index.html' : req.url.split('?')[0]);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, () => resolve(server)));
}

async function launch() {
  let chromium;
  try { ({ chromium } = require('playwright')); } catch { return null; }
  for (const executablePath of [process.env.CHROMIUM_PATH, ...safeList(), undefined]) {
    try { return await chromium.launch({ executablePath, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu'] }); } catch { /* try the next one */ }
  }
  return null;
}
function safeList() { try { return fs.readdirSync('/opt/pw-browsers').filter((n) => n.startsWith('chromium-')).map((n) => `/opt/pw-browsers/${n}/chrome-linux/chrome`); } catch { return []; } }

async function mockApi(page, state) {
  await page.route('**/api/**', (route) => {
    const u = route.request().url();
    const json = (body, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) });
    if (u.includes('/api/assets/')) return route.fulfill({ status: 200, contentType: 'image/png', body: PNG });
    if (u.includes('/api/marketing')) return json({ heading: '', description: '', videos: { showcase: SAMPLES } });
    if (u.includes('/api/auth/me') || u.includes('/api/user/me')) return state.who ? json({ id: state.who, email: state.who, plan: 'free', creditsBalance: 25, isAdmin: false, authProvider: 'google', supportsPasswordChange: true }) : json({ error: 'no' }, 401);
    if (u.includes('/api/user/usage')) return json({ balance: 25, plan: 'free', thisMonth: { creditsUsed: 0, creditsAdded: 25, amountPaidUsd: 0, projects: 0, videos: 0, photos: 0, byMode: {} }, recentCredits: [], recentPayments: [] });
    return json({ jobs: [] });
  });
}

async function sliderChecks(browser, base) {
  const state = { who: 'a@b.c' };
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await mockApi(page, state);
  await page.goto(`${base}/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1800);

  async function checkRow(label, rowChild) {
    const el = await page.$(rowChild);
    assert.ok(el, `${label}: row not found`);
    await el.scrollIntoViewIfNeeded();
    const row = await el.evaluateHandle((e) => e.closest('.chat-scroll, [data-drag-scroll]'));
    const box = await el.boundingBox();
    const x = box.x + box.width / 2, y = box.y + box.height / 2;
    await page.mouse.move(x, y);
    await page.waitForTimeout(80);
    const hover = await page.evaluate(({ x, y }) => getComputedStyle(document.elementFromPoint(x, y)).cursor, { x, y });
    assert.match(hover, /^url\("data:image\/svg\+xml/, `${label}: hovering a slider must show the drag cursor, got ${hover.slice(0, 40)}`);
    const before = await row.evaluate((r) => r.scrollLeft);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(x - i * 20, y);
    const during = await row.evaluate((r) => ({ active: r.classList.contains('drag-scroll-active'), cursor: getComputedStyle(r).cursor, left: r.scrollLeft }));
    await page.mouse.up();
    assert.ok(during.active && /grabbing$/.test(during.cursor), `${label}: dragging must show the filled drag cursor`);
    assert.ok(during.left - before >= 100, `${label}: dragging 120px must scroll the row (moved ${during.left - before}px)`);
    console.log(`ok  ${label}: drag cursor on hover and while dragging; row moved ${Math.round(during.left - before)}px`);
  }
  await checkRow('website examples (plain tiles)', '[aria-label="Example"]');
  await (await page.$$('[role=tablist][aria-label="Creation mode"] button'))[2].click();
  await page.waitForTimeout(700);
  await checkRow('product photo examples (buttons)', '[aria-label="Use this example"]');
  // a drag must not select the example it started on, a plain click must
  const tile = await page.$('[aria-label="Use this example"]');
  await tile.scrollIntoViewIfNeeded();
  const b = await tile.boundingBox();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); for (let i = 1; i <= 6; i++) await page.mouse.move(b.x + b.width / 2 - i * 20, b.y + b.height / 2); await page.mouse.up();
  assert.equal(await page.$$eval('[aria-pressed="true"][aria-label="Remove this example"]', (n) => n.length), 0, 'a drag must not select a tile');
  await (await page.$('[aria-label="Use this example"]')).click();
  assert.equal(await page.$$eval('[aria-pressed="true"][aria-label="Remove this example"]', (n) => n.length), 1, 'a plain click must select a tile');
  console.log('ok  a drag does not select a tile, a plain click does');
  await page.close();
}

async function recentFilesChecks(browser, base) {
  const context = await browser.newContext({ viewport: { width: 1280, height: 900 } });
  const state = { who: null };
  const page = await context.newPage();
  await mockApi(page, state);
  const open = async (url) => { await page.goto(base + url, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500); };
  const menu = async () => { await page.click('[aria-label="Add photos, style or recent files"]'); await page.waitForTimeout(400); const text = (await page.textContent('[aria-label="Add to your prompt"]')).replace(/\s+/g, ' '); await page.keyboard.press('Escape'); await page.waitForTimeout(150); return text; };

  state.who = null; await open('/');
  assert.ok(!(await menu()).includes('Recent files'), 'signed out: no Recent files section');
  state.who = 'anna@example.com'; await open('/dashboard');
  assert.ok((await menu()).includes('Recent files'), 'signed in: Recent files section shown');
  await page.setInputFiles('input[type=file]', [{ name: 'anna-mug.png', mimeType: 'image/png', buffer: PNG }]);
  await page.waitForTimeout(500);
  await open('/dashboard');
  assert.ok((await menu()).includes('anna-mug.png'), 'the file is offered again on the next visit');
  state.who = 'ben@example.com'; await open('/dashboard');
  assert.ok(!(await menu()).includes('anna-mug.png'), "another person on the same computer must not see Anna's files");
  state.who = 'anna@example.com'; await open('/dashboard');
  assert.ok((await menu()).includes('anna-mug.png'), 'Anna still has her file');
  console.log('ok  recent files: hidden when signed out, kept per account on one computer');
  await context.close();
}

(async () => {
  if (!fs.existsSync(path.join(ROOT, 'index.html'))) { console.log('skipped: build the frontend first (pnpm --filter @workspace/aiwebvideo run build)'); return; }
  const browser = await launch();
  if (!browser) { console.log('skipped: no Chromium could be launched (set CHROMIUM_PATH)'); return; }
  const server = await serve();
  const base = `http://localhost:${server.address().port}`;
  try {
    await sliderChecks(browser, base);
    await recentFilesChecks(browser, base);
    console.log('\nall browser checks passed');
  } finally { await browser.close(); server.close(); }
})().catch((error) => { console.error('FAILED:', error.message); process.exit(1); });
