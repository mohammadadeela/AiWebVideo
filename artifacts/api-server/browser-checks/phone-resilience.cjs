/**
 * Real-browser checks for phones and in-app browsers (the Google, Instagram, Facebook apps...): the situations where
 * sign-up/sign-in looked broken, the site looked crashed, or the workspace looked open without an account.
 * Build the frontend first; run with CHROMIUM_PATH=/path/to/chromium node browser-checks/phone-resilience.cjs
 * Uses local fixtures only; no live service is contacted.
 */
const fs = require("fs"), http = require("http"), path = require("path"), assert = require("assert/strict");
const { chromium } = require("playwright");

const ROOT = path.resolve(__dirname, "../../aiwebvideo/dist/public");
const types = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp" };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  let file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
  res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});

const IOS_GOOGLE = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) GSA/300.0.598994205 Mobile/15E148 Safari/604.1";
const IOS_INSTAGRAM = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Instagram 300.0.0.0";
const BLOCK_STORAGE = () => { for (const k of ["localStorage", "sessionStorage"]) Object.defineProperty(window, k, { get() { throw new DOMException("The operation is insecure.", "SecurityError"); }, configurable: true }); };

async function open(browser, route, { userAgent, init, mock } = {}) {
  const context = await browser.newContext({ viewport: { width: 390, height: 780 }, isMobile: true, hasTouch: true, ...(userAgent ? { userAgent } : {}) });
  if (init) await context.addInitScript(init);
  const page = await context.newPage();
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (mock) { const answer = mock(url, route.request().method()); if (answer) return route.fulfill(answer); }
    if (url.endsWith("/api/marketing")) return route.fulfill({ json: { heading: "", description: "", videos: { showcase: [] } } });
    return route.fulfill({ status: 401, json: { error: "Sign in required" } });
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://localhost:${server.address().port}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2800);
  return { page, errors };
}
const text = (page) => page.evaluate(() => document.body.innerText.replace(/\s+/g, " "));

(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
  try {
    // 1. a phone can reach sign up with one tap
    let { page, errors } = await open(browser, "/");
    let t = await text(page);
    assert.match(t, /Log in/); assert.match(t, /Sign up/);
    await page.locator("header button", { hasText: "Sign up" }).click();
    await page.waitForTimeout(500);
    assert.equal(await page.locator("[role=dialog] h2").textContent(), "Create your account");
    assert.deepEqual(await page.locator("[role=dialog] [role=tab]").allTextContents(), ["Sign in", "Create account"]);
    assert.deepEqual(errors, []);
    console.log("ok  phone: Log in and Sign up are visible; Sign up opens Create account (with both tabs)");
    await page.context().close();

    // 2. blocked storage never crashes a page
    for (const route of ["/", "/pricing", "/dashboard", "/profile"]) {
      ({ page, errors } = await open(browser, route, { init: BLOCK_STORAGE }));
      t = await text(page);
      assert.doesNotMatch(t, /needs a quick reset|new version is ready/i, `${route} must not show the crash screen`);
      assert.ok(t.length > 60, `${route} must not be blank`);
      assert.deepEqual(errors, [], `${route} must not throw`);
      await page.context().close();
    }
    console.log("ok  storage that throws on read: no crash on /, /pricing, /dashboard, /profile");

    // 3. the workspace is closed to a signed-out visitor
    ({ page } = await open(browser, "/dashboard"));
    t = await text(page);
    assert.match(t, /Sign in to open your workspace/); assert.doesNotMatch(t, /Recent projects|New creation/);
    console.log("ok  signed out: /dashboard shows the sign-in gate, not the workspace");
    await page.context().close();

    // 4. a browser that DROPS the login cookie: no pretending to be signed in
    ({ page } = await open(browser, "/", { mock: (url) => (url.endsWith("/api/auth/login") ? { json: { user: { id: "u1", email: "a@b.c", plan: "free", creditsBalance: 25, isAdmin: false } } } : null) }));
    await page.locator("header button", { hasText: "Log in" }).click();
    await page.waitForTimeout(400);
    await page.fill("input[type=email]", "a@b.c"); await page.fill("input[type=password]", "correct-horse-1");
    await page.locator("[role=dialog] form button[type=submit]").click();
    await page.waitForTimeout(2200);
    assert.equal(new URL(page.url()).pathname, "/", "must NOT be sent to the workspace");
    assert.match(await text(page), /blocked the login cookie/);
    console.log("ok  login cookie dropped by the browser: explained, and not sent to the workspace");
    await page.context().close();

    // 5. in-app browsers get a clear explanation; normal browsers get none
    for (const [name, userAgent, pattern] of [["Google app", IOS_GOOGLE, /unreliable/], ["Instagram", IOS_INSTAGRAM, /usually refuse/]]) {
      ({ page } = await open(browser, "/", { userAgent }));
      await page.locator("header button", { hasText: "Log in" }).click();
      await page.waitForTimeout(400);
      const note = await page.locator("[role=note]").innerText();
      assert.match(note, pattern); assert.match(note, /Copy link/);
      await page.context().close();
    }
    ({ page } = await open(browser, "/"));
    await page.locator("header button", { hasText: "Log in" }).click();
    await page.waitForTimeout(400);
    assert.equal(await page.locator("[role=note]").count(), 0);
    console.log("ok  in-app browsers (Google app, Instagram) are explained; normal browsers see no notice");
    await page.context().close();

    // 6. a page restored from the back/forward cache looks again
    ({ page } = await open(browser, "/", { mock: () => null }));
    assert.match(await text(page), /Log in/);
    await page.route("**/api/auth/me", (route) => route.fulfill({ json: { id: "u1", email: "a@b.c", plan: "free", creditsBalance: 25, isAdmin: false } }));
    await page.evaluate(() => window.dispatchEvent(new PageTransitionEvent("pageshow", { persisted: true })));
    await page.waitForTimeout(2200);
    assert.doesNotMatch(await text(page), /Log in/);
    console.log("ok  page restored from the browser's cache: re-checks and shows the signed-in state");
    await page.context().close();

    console.log("\nall phone resilience checks passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
