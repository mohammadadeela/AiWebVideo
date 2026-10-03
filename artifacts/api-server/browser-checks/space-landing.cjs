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
const gallery = FEATURES.map((feature, i) => ({ id: "m" + i, url: "/clip.mp4", kind: "video", posterUrl: null, feature, caption: null, eyebrow: null, overlayText: null }));
// the admin's landing examples: their own list, with their own files (never the gallery's)
const examples = ["website", "product-video", "interior", "photo", "architecture"].map((feature, i) => ({ id: "landing-" + i, url: `/landing-example-${i}.svg`, kind: "image", posterUrl: null, feature, caption: null, eyebrow: null, overlayText: null }));
const settings = (withExamples) => ({ heading: "", description: "", videos: { showcase: gallery, examples: withExamples ? examples : [] } });

async function open(browser, viewport, route = "/", { withExamples = true } = {}) {
  const page = await browser.newPage({ viewport });
  await page.route("**/api/**", (route) => {
    const url = route.request().url();
    if (url.endsWith("/api/marketing")) return route.fulfill({ json: settings(withExamples) });
    return route.fulfill({ status: 401, json: { error: "Sign in required" } });
  });
  await page.route("**/landing-example-*.svg", (route) => route.fulfill({ contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300"><rect width="400" height="300" fill="#7c3aed"/></svg>' }));
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`http://localhost:${server.address().port}${route}`, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(2600);
  return { page, errors };
}

(async () => {
  await new Promise((resolve) => server.listen(0, resolve));
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox", "--autoplay-policy=no-user-gesture-required"] });
  try {
    // ---- desktop
    const { page, errors } = await open(browser, { width: 1672, height: 941 });
    const hero = await page.evaluate(() => {
      const box = document.querySelector(".creator-composer").getBoundingClientRect();
      const bd = document.querySelector(".space-backdrop").getBoundingClientRect();
      const row = document.querySelector(".hero-examples");
      const tiles = Array.from(document.querySelectorAll(".hero-example-tile"));
      const slot = document.querySelector(".generation-submit-slot button"); const bar = document.querySelector(".generation-toolbar");
      const a = slot.getBoundingClientRect(), b = bar.getBoundingClientRect();
      const h1 = document.querySelector("h1");
      return {
        floating: document.querySelectorAll(".hero-orbit-card, .hero-side").length,
        tabsInBox: document.querySelectorAll(".creator-composer [role=tab]").length,
        pills: Array.from(document.querySelectorAll("header [role=group][aria-label=Features] button")).map((n) => n.textContent.trim()),
        tiles: tiles.length, tileSources: tiles.map((t) => (t.querySelector("img") || t.querySelector("video") || {}).src || ""),
        tileVideos: tiles.filter((t) => t.querySelector("video")).length,
        tileText: tiles.map((t) => t.innerText.trim()).join(""),
        rowBottom: row.getBoundingClientRect().bottom, viewport: innerHeight,
        order: [h1.getBoundingClientRect().top, box.top, row.getBoundingClientRect().top],
        boxTop: box.top,
        backdrops: document.querySelectorAll(".space-backdrop").length, backdropInHero: !!document.querySelector(".cinematic-hero > .space-backdrop"),
        backdropBottom: bd.bottom + scrollY, heroBottom: document.querySelector(".cinematic-hero").getBoundingClientRect().bottom + scrollY,
        roadUnderBox: bd.bottom - box.bottom,
        sameRow: Math.abs(a.y + a.height / 2 - (b.y + b.height / 2)) < 40, reachable: slot.contains(document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2)),
        nav: document.querySelector("header").innerText,
        h1: h1.innerText.replace(/\s+/g, " "), h1Lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
        leftovers: /Powered by advanced AI|Transform websites|Your campaign belongs here/i.test(document.body.innerText),
      };
    });
    assert.equal(hero.floating, 0, "no floating cards: the first screen is the headline, the box and the examples");
    assert.deepEqual(hero.pills, ["Website", "AI Video", "Photos", "Product", "Talking", "Interior", "Architect"], "the features are in the navbar");
    assert.equal(hero.tabsInBox, 0, "no feature tabs inside the landing box");
    assert.equal(hero.tiles, 5, "exactly the examples the admin uploaded");
    assert.ok(hero.tileSources.every((src) => /landing-example-\d\.svg/.test(src)), "from the admin's own landing examples, never from the gallery: " + hero.tileSources.join(","));
    assert.equal(hero.tileVideos, 0); assert.equal(hero.tileText, "", "tiles carry no text");
    assert.ok(hero.order[0] < hero.order[1] && hero.order[1] < hero.order[2], "headline, then box, then examples");
    assert.ok(hero.rowBottom <= hero.viewport, `everything fits the first screen (examples end at ${Math.round(hero.rowBottom)} of ${hero.viewport})`);
    assert.ok(hero.boxTop < 200, `the chat box stays up near the headline (top at ${Math.round(hero.boxTop)}px)`);
    assert.equal(hero.backdrops, 1); assert.ok(hero.backdropInHero, "the space picture lives inside the hero only");
    assert.ok(Math.abs(hero.backdropBottom - hero.heroBottom) < 2, "and ends exactly where the hero ends");
    assert.ok(hero.roadUnderBox > 60 && hero.roadUnderBox < 320, `the glowing road sits just under the box (${Math.round(hero.roadUnderBox)}px of picture below it)`);
    assert.ok(hero.sameRow && hero.reachable, "Generate sits in the settings row and is clickable");
    assert.match(hero.nav, /Pricing/); assert.match(hero.nav, /Log in/); assert.match(hero.nav, /Start creating/);
    assert.equal(hero.h1, "Turn Anything Into a Video"); assert.equal(hero.h1Lines, 1, "the headline is one horizontal line");
    assert.equal(hero.leftovers, false, "no badge, subtitle or placeholder text");
    console.log("ok  landing: headline, box (no tabs), the admin's 5 examples; all on the first screen; the road under the box; no floating cards");

    // tapping an example opens its feature with the example attached, without signing in
    await page.locator(".hero-example-tile").nth(2).click();
    await page.waitForTimeout(900);
    assert.equal(await page.locator("button[aria-label='Remove the attached example']").count(), 1, "the example is attached");
    assert.equal(await page.locator("header [role=group][aria-label=Features] button[aria-pressed=true]").innerText(), "Interior", "its feature opened");
    assert.equal(await page.getByText("Sign in to unlock").count(), 0, "no sign-in just for looking");
    console.log("ok  tapping an example opens its feature with the example attached (no sign-in)");

    const frames = [];
    for (let i = 0; i < 2; i += 1) {
      frames.push(await page.evaluate(() => { const c = document.querySelector(".space-backdrop-warp"); const d = c.getContext("2d").getImageData(0, 0, c.width, c.height).data; let sum = 0; for (let k = 3; k < d.length; k += 40) sum += d[k]; return sum; }));
      await page.waitForTimeout(700);
    }
    assert.ok(frames[0] > 0 && frames[0] !== frames[1], "star streaks are drawn and move");
    console.log("ok  backdrop: star streaks move");
    assert.deepEqual(errors, [], "no page errors");
    await page.close();

    // ---- nothing uploaded: nothing shown (the gallery is never borrowed)
    const empty = await open(browser, { width: 1672, height: 941 }, "/", { withExamples: false });
    assert.equal(await empty.page.locator(".hero-examples").count(), 0, "no uploaded examples, no row");
    assert.equal(await empty.page.locator(".hero-example-tile").count(), 0);
    console.log("ok  with no uploaded examples the row is simply absent (nothing is taken from the gallery)");
    await empty.page.close();

    // ---- every other page: solid panels on the shared background, no space picture
    for (const route of ["/pricing", "/features", "/faq"]) {
      const other = await open(browser, { width: 1672, height: 941 }, route);
      const solid = await other.page.evaluate(() => {
        const alphaOf = (color) => { const m = color.match(/(?:rgba?|oklab|oklch|color)\(([^)]+)\)/); if (!m) return 1; const slash = m[1].split("/"); if (slash.length > 1) return parseFloat(slash[1]); const parts = m[1].split(","); return parts.length === 4 ? parseFloat(parts[3]) : 1; };
        const faint = Array.from(document.querySelectorAll('[class*="bg-white/[.0"]')).filter((el) => /(^|\s)bg-white\/\[(?:\.)0\d+\]/.test(el.getAttribute('class') || '') && !el.closest('.creator-composer, [role=dialog]')).filter((el) => alphaOf(getComputedStyle(el).backgroundColor) < 1).length;
        return { seeThrough: faint, backdrops: document.querySelectorAll(".space-backdrop, .space-backdrop-photo").length, bodyAlpha: alphaOf(getComputedStyle(document.body).backgroundColor), bodyImage: getComputedStyle(document.body).backgroundImage.includes("radial-gradient"), fixedLayers: Array.from(document.querySelectorAll("body *")).filter((el) => getComputedStyle(el).position === "fixed" && el.getBoundingClientRect().width >= innerWidth - 2 && el.getBoundingClientRect().height >= innerHeight - 2 && !el.closest("[role=dialog]")).length, labels: Array.from(document.querySelectorAll("main *")).filter((el) => getComputedStyle(el).textTransform === "uppercase" && getComputedStyle(el).fontFamily.includes("mono") && el.children.length === 0 && el.textContent.trim().length > 2).map((el) => el.textContent.trim()) };
      });
      assert.equal(solid.seeThrough, 0, `${route}: every card and chip fill is opaque`);
      assert.equal(solid.backdrops, 0, `${route} shows no space picture`);
      assert.equal(solid.bodyAlpha, 1, `${route} has an opaque page colour`);
      assert.ok(solid.bodyImage, `${route} has the shared glow background`);
      assert.equal(solid.fixedLayers, 0, `${route} has no full-screen layer behind its content`);
      assert.deepEqual(solid.labels, [], `${route} has no uppercase mono label`);
      await other.page.close();
    }
    console.log("ok  other pages (pricing, features, FAQ): shared background, solid panels, no space picture, no uppercase mono labels");

    // ---- phone
    const phone = await open(browser, { width: 390, height: 844 });
    const mobile = await phone.page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      floating: document.querySelectorAll(".hero-orbit-card, .hero-side").length,
      trigger: (document.querySelector("header button[aria-label^='Features']") || {}).innerText || "",
      tabsInBox: document.querySelectorAll(".creator-composer [role=tab]").length,
      generate: Array.from(document.querySelectorAll("button")).filter((b) => /Continue to video/.test(b.textContent) && b.offsetParent).length,
      examplesTop: document.querySelector(".hero-examples").getBoundingClientRect().top, viewport: innerHeight,
      swipe: (() => { const row = document.querySelector(".hero-examples"); return row.scrollWidth > row.clientWidth; })(),
    }));
    assert.equal(mobile.overflow, 0, "no horizontal overflow on a phone");
    assert.equal(mobile.floating, 0);
    assert.match(mobile.trigger, /Website/, "the navbar button names the open feature");
    assert.equal(mobile.tabsInBox, 0);
    assert.equal(mobile.generate, 1, "exactly one visible Generate button");
    assert.ok(mobile.examplesTop < mobile.viewport, "the examples start on the first phone screen");
    assert.ok(mobile.swipe, "and the row swipes sideways");
    // every navbar item (not just the big blocks) stays on the screen and none overlap, at the widths phones really have
    for (const width of [320, 360, 390, 430, 480]) {
      const narrow = await open(browser, { width, height: 700 });
      const fit = await narrow.page.evaluate(() => {
        const items = Array.from(document.querySelectorAll("header nav button, header nav a")).map((el) => el.getBoundingClientRect()).filter((b) => b.width > 0).sort((a, b) => a.left - b.left);
        let overlap = false;
        for (let i = 0; i < items.length - 1; i += 1) if (items[i].right > items[i + 1].left + 0.5) overlap = true;
        return { maxRight: Math.max(...items.map((b) => b.right)), minLeft: Math.min(...items.map((b) => b.left)), overlap, vw: innerWidth };
      });
      assert.ok(fit.maxRight <= fit.vw && fit.minLeft >= 0 && !fit.overlap, `navbar fits at ${width}px (right edge ${Math.round(fit.maxRight)}, overlap ${fit.overlap})`);
      await narrow.page.close();
    }
    console.log("ok  navbar: every item fits and none overlap at 320, 360, 390, 430 and 480 px");
    console.log("ok  phone: no overflow, the navbar button names the open feature, one Generate button, examples peek in and swipe");
    console.log("\nall space landing checks passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
