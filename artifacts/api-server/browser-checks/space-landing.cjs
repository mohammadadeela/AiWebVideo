/**
 * Real-browser checks for the space landing page: the backdrop moves, the floating media is decorative and silent,
 * the navbar and creator are laid out as designed, and phones get a clean layout.
 * Build the frontend first; run with CHROMIUM_PATH=/path/to/chromium node browser-checks/space-landing.cjs
 * Uses local fixtures (including a one-second ffmpeg clip). No live service is contacted.
 */
const fs = require("fs"), http = require("http"), path = require("path"), assert = require("assert/strict");
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");

const OUT = fs.mkdtempSync(path.join(require("node:os").tmpdir(), "aiwebvideo-space-"));
const CLIP = path.join(OUT, "loop.mp4");
execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-f", "lavfi", "-i", "testsrc2=size=320x200:rate=12", "-t", "1", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-movflags", "+faststart", "-y", CLIP]);
const ROOT = path.resolve(__dirname, "../../aiwebvideo/dist/public");
const types = { ".js": "text/javascript", ".html": "text/html", ".css": "text/css", ".svg": "image/svg+xml", ".webp": "image/webp", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const pathname = new URL(req.url, "http://localhost").pathname;
  if (pathname === "/clip.mp4") { res.setHeader("content-type", "video/mp4"); return fs.createReadStream(CLIP).pipe(res); }
  let file = path.join(ROOT, pathname);
  if (!file.startsWith(ROOT + path.sep) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, "index.html");
  res.setHeader("content-type", types[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
});

const FEATURES = ["website", "product-video", "interior", "scenario", "architecture", "photo", "video"];
const marketing = { heading: "", description: "", videos: { showcase: FEATURES.map((feature, i) => ({ id: "m" + i, url: "/clip.mp4", kind: "video", posterUrl: null, feature, caption: null, eyebrow: null, overlayText: null })) } };

async function open(browser, viewport) {
  const page = await browser.newPage({ viewport });
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/api/marketing")) return route.fulfill({ json: marketing });
    return route.fulfill({ status: 401, json: { error: "Sign in required" } });
  });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://localhost:${server.address().port}/`, { waitUntil: "domcontentloaded" });
  await page.locator(".hero-orbit-card").first().waitFor({ timeout: 20000 }).catch(() => {});
  await page.waitForTimeout(1500);
  return { page, errors };
}

(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  try {
    // ---- desktop
    const { page, errors } = await open(browser, { width: 1672, height: 941 });
    const orbit = await page.evaluate(() => {
      const root = document.querySelector(".hero-media-orbit");
      const videos = Array.from(root.querySelectorAll("video"));
      return {
        titles: Array.from(root.querySelectorAll(".hero-orbit-caption-title")).map((n) => n.textContent),
        videos: videos.length, loop: videos.every((v) => v.loop), muted: videos.every((v) => v.muted), controls: videos.some((v) => v.controls),
        ariaHidden: root.getAttribute("aria-hidden"), pointer: getComputedStyle(root).pointerEvents, buttons: root.querySelectorAll("button").length,
      };
    });
    assert.deepEqual(orbit.titles, ["Website to Video", "Product Video", "Interior Design", "Talking Scene", "Architecture"], "one labelled card per feature");
    assert.ok(orbit.videos >= 1 && orbit.loop && orbit.muted && !orbit.controls, "floating videos loop silently without controls");
    assert.equal(orbit.ariaHidden, "true"); assert.equal(orbit.pointer, "none"); assert.equal(orbit.buttons, 0, "no play buttons or media icons");
    console.log("ok  floating media: 5 labelled cards, silent looping video, decorative only");

    const frames = [];
    for (let i = 0; i < 2; i += 1) {
      frames.push(await page.evaluate(() => { const c = document.querySelector(".space-backdrop-warp"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let sum = 0; for (let k = 3; k < d.length; k += 40) sum += d[k]; return sum; }));
      await page.waitForTimeout(700);
    }
    assert.ok(frames[0] > 0 && frames[0] !== frames[1], "star streaks are drawn and move");
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector(".space-backdrop")).pointerEvents), "none");
    console.log("ok  backdrop: star streaks move and never take a click");

    const layout = await page.evaluate(() => {
      const slot = document.querySelector(".generation-submit-slot button"); const bar = document.querySelector(".generation-toolbar");
      const a = slot.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const top = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
      return { sameRow: Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < 40, reachable: slot.contains(top), tabsInHeader: document.querySelectorAll("header [role=tab]").length, tabsInCreator: document.querySelectorAll(".creator-composer [role=tab]").length, nav: document.querySelector("header").innerText, h1: document.querySelector("h1").innerText.replace(/\s+/g, " ") };
    });
    assert.ok(layout.sameRow && layout.reachable, "Generate sits in the settings row and is clickable");
    assert.equal(layout.tabsInHeader, 0); assert.equal(layout.tabsInCreator, 7, "features live inside the creator");
    assert.match(layout.nav, /Pricing/); assert.match(layout.nav, /Log in/); assert.match(layout.nav, /Start creating/); assert.doesNotMatch(layout.nav, /Features|How it works/);
    assert.equal(layout.h1, "Turn Anything Into a Video");
    console.log("ok  layout: features inside the creator, minimal navbar, Generate inline");
    assert.deepEqual(errors, [], "no page errors");
    await page.close();

    // ---- phone
    const phone = await open(browser, { width: 390, height: 844 });
    const mobile = await phone.page.evaluate(() => ({ overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth, orbit: getComputedStyle(document.querySelector(".hero-media-orbit")).display, generate: Array.from(document.querySelectorAll("button")).filter((b) => /Continue to video/.test(b.textContent) && b.offsetParent).length }));
    assert.equal(mobile.overflow, 0, "no horizontal overflow on a phone");
    assert.equal(mobile.orbit, "none", "floating cards are hidden on phones");
    assert.equal(mobile.generate, 1, "exactly one visible Generate button");
    console.log("ok  phone: no overflow, cards hidden, one Generate button");
    console.log("\nall space landing checks passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
