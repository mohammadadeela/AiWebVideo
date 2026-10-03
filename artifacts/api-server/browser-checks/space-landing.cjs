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
    const cards = await page.evaluate(() => {
      const sides = Array.from(document.querySelectorAll(".hero-side"));
      const videos = sides.flatMap((side) => Array.from(side.querySelectorAll("video")));
      return {
        titles: sides.flatMap((side) => Array.from(side.querySelectorAll(".hero-orbit-caption-title")).map((n) => n.textContent)),
        videos: videos.length, loop: videos.every((v) => v.loop), muted: videos.every((v) => v.muted), controls: videos.some((v) => v.controls),
        ariaHidden: sides.every((side) => side.getAttribute("aria-hidden") === "true"), pointer: sides.every((side) => getComputedStyle(side).pointerEvents === "none"),
        buttons: sides.reduce((sum, side) => sum + side.querySelectorAll("button").length, 0),
      };
    });
    assert.deepEqual(cards.titles, ["Website to Video", "Interior Design", "Architecture", "Product Photos", "Product Video", "Talking Scene", "AI Video"], "seven labelled cards, four left and three right");
    assert.ok(cards.videos >= 1 && cards.loop && cards.muted && !cards.controls, "floating videos loop silently without controls");
    assert.ok(cards.ariaHidden && cards.pointer && cards.buttons === 0, "cards are decorative: no clicks, no buttons or play icons");
    console.log("ok  floating media: 7 labelled cards, silent looping video, decorative only");

    const covered = await page.evaluate(() => {
      const center = document.querySelector(".hero-center").getBoundingClientRect();
      const overlap = (a, b) => a.left < b.right - 6 && a.right > b.left + 6 && a.top < b.bottom && a.bottom > b.top;
      return Array.from(document.querySelectorAll(".hero-orbit-card")).filter((card) => overlap(card.getBoundingClientRect(), center)).length;
    });
    assert.equal(covered, 0, "no floating card covers the headline, the chat box or the examples");
    console.log("ok  no floating card covers anything (they live in their own side columns)");

    const frames = [];
    for (let i = 0; i < 2; i += 1) {
      frames.push(await page.evaluate(() => { const c = document.querySelector(".space-backdrop-warp"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let sum = 0; for (let k = 3; k < d.length; k += 40) sum += d[k]; return sum; }));
      await page.waitForTimeout(700);
    }
    assert.ok(frames[0] > 0 && frames[0] !== frames[1], "star streaks are drawn and move");
    console.log("ok  backdrop: star streaks move");

    const layout = await page.evaluate(() => {
      const slot = document.querySelector(".generation-submit-slot button"); const bar = document.querySelector(".generation-toolbar");
      const a = slot.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const examples = document.querySelector(".hero-examples").getBoundingClientRect();
      const h1 = document.querySelector("h1");
      return {
        sameRow: Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < 40,
        reachable: slot.contains(document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2)),
        pills: Array.from(document.querySelectorAll("header [role=group][aria-label=Features] button")).map((n) => n.textContent.trim()),
        tabsInBox: document.querySelectorAll(".creator-composer [role=tab]").length,
        nav: document.querySelector("header").innerText,
        h1: h1.innerText.replace(/\s+/g, " "), h1Lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
        examplesVisible: Array.from(document.querySelectorAll(".hero-example-tile")).filter((n) => n.offsetParent).length,
        examplesBottom: examples.bottom, viewport: innerHeight,
        badge: /Powered by advanced AI|Transform websites/i.test(document.body.innerText),
        order: [document.querySelector("h1").getBoundingClientRect().top, document.querySelector(".creator-composer").getBoundingClientRect().top, examples.top],
      };
    });
    assert.ok(layout.sameRow && layout.reachable, "Generate sits in the settings row and is clickable");
    assert.deepEqual(layout.pills, ["Website", "AI Video", "Photos", "Product", "Talking", "Interior", "Architect"], "the features are in the navbar");
    assert.equal(layout.tabsInBox, 0, "no feature tabs inside the landing box");
    assert.match(layout.nav, /Pricing/); assert.match(layout.nav, /Log in/); assert.match(layout.nav, /Start creating/);
    assert.equal(layout.h1, "Turn Anything Into a Video"); assert.equal(layout.h1Lines, 1, "the headline is one horizontal line");
    assert.equal(layout.badge, false, "the badge and the subtitle are gone");
    assert.ok(layout.order[0] < layout.order[1] && layout.order[1] < layout.order[2], "headline, then box, then examples");
    assert.ok(layout.examplesVisible >= 5, "a row of examples");
    assert.ok(layout.examplesBottom <= layout.viewport, `everything fits the first screen (examples end at ${Math.round(layout.examplesBottom)} of ${layout.viewport})`);
    console.log("ok  layout: features in the navbar, one-line headline, box, then examples, all on the first screen, Generate inline");
    assert.deepEqual(errors, [], "no page errors");
    await page.close();

    // ---- phone
    const phone = await open(browser, { width: 390, height: 844 });
    const mobile = await phone.page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      sides: Array.from(document.querySelectorAll(".hero-side")).every((side) => getComputedStyle(side).display === "none"),
      menu: !!document.querySelector("header button[aria-label^='Features']"),
      generate: Array.from(document.querySelectorAll("button")).filter((b) => /Continue to video/.test(b.textContent) && b.offsetParent).length,
      examplesTop: document.querySelector(".hero-examples").getBoundingClientRect().top, viewport: innerHeight,
    }));
    assert.equal(mobile.overflow, 0, "no horizontal overflow on a phone");
    assert.ok(mobile.sides, "floating cards are hidden on phones");
    assert.ok(mobile.menu, "phones get a Features menu button");
    assert.equal(mobile.generate, 1, "exactly one visible Generate button");
    assert.ok(mobile.examplesTop < mobile.viewport, "the examples start on the first phone screen");
    console.log("ok  phone: no overflow, Features menu, one Generate button, examples peek in on the first screen");
    console.log("\nall space landing checks passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
