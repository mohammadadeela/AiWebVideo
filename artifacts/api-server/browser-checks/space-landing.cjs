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


// A "block" is a rounded, bordered or shadowed box (a card, panel, table or footer). It must never be see-through.
const FIND_TRANSLUCENT_BLOCKS = () => {
  const alpha = (c) => { const m = c.match(/(?:rgba?|oklab|oklch|color)\(([^)]+)\)/); if (!m) return 1; const t = m[1]; const sl = t.split("/"); if (sl.length > 1) return parseFloat(sl[1]); const p = t.split(","); return p.length === 4 ? parseFloat(p[3]) : 1; };
  const out = [];
  for (const el of document.querySelectorAll("main *, aside *, footer, footer *, article")) {
    if (el.closest(".creator-composer, .hero-creator-shell, .cinematic-hero, .space-backdrop, .page-backdrop, [role=dialog], header")) continue;
    const r = el.getBoundingClientRect(); if (r.width < 150 || r.height < 52) continue;
    const cs = getComputedStyle(el);
    if ((parseFloat(cs.borderTopLeftRadius) || 0) < 12) continue;
    const border = parseFloat(cs.borderTopWidth) > 0 && alpha(cs.borderTopColor) > 0;
    const shadow = cs.boxShadow && cs.boxShadow !== "none";
    if (!border && !shadow) continue;
    if (alpha(cs.backgroundColor) < 1) out.push(String(el.className).slice(0, 90));
  }
  return out;
};

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
      const heroEl = document.querySelector(".cinematic-hero");
      const bd = document.querySelector(".space-backdrop").getBoundingClientRect();
      const title = document.querySelector("h1").getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll(".hero-floater"));
      const rects = cards.map((c) => c.getBoundingClientRect());
      const hits = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
      const slot = document.querySelector(".generation-submit-slot button"); const bar = document.querySelector(".generation-toolbar");
      const a2 = slot.getBoundingClientRect(), b2 = bar.getBoundingClientRect();
      const h1 = document.querySelector("h1");
      const wrap = document.querySelector(".hero-floaters");
      return {
        cards: cards.length,
        titles: cards.map((c) => c.querySelector(".hero-floater-title").textContent),
        sources: cards.map((c) => (c.querySelector("img") || c.querySelector("video") || {}).src || ""),
        interactive: wrap.querySelectorAll("button, a, input, select, [onclick], video[controls]").length,
        pointer: getComputedStyle(wrap).pointerEvents, ariaHidden: wrap.getAttribute("aria-hidden"),
        animated: cards.every((c) => /floater-drift/.test(getComputedStyle(c).animationName)),
        tilts: new Set(cards.map((c) => getComputedStyle(c).rotate)).size,
        widths: new Set(cards.map((c) => Math.round(c.getBoundingClientRect().width / 10))).size,
        coversBox: rects.filter((r) => hits(r, box)).length, coversTitle: rects.filter((r) => hits(r, title)).length,
        offscreen: rects.filter((r) => r.left < 0 || r.right > innerWidth).length,
        tabsInBox: document.querySelectorAll(".creator-composer [role=tab]").length,
        pills: Array.from(document.querySelectorAll("header [role=group][aria-label=Features] button")).map((n) => n.textContent.trim()),
        tileRow: document.querySelectorAll(".hero-examples, .hero-example-tile").length,
        boxTop: box.top, boxBottom: box.bottom, heroBottom: heroEl.getBoundingClientRect().bottom + scrollY,
        backdrops: document.querySelectorAll(".space-backdrop").length, backdropInHero: !!document.querySelector(".cinematic-hero > .space-backdrop"),
        backdropBottom: bd.bottom + scrollY, planetUnderBox: bd.bottom - box.bottom,
        sameRow: Math.abs(a2.y + a2.height / 2 - (b2.y + b2.height / 2)) < 40, reachable: slot.contains(document.elementFromPoint(a2.x + a2.width / 2, a2.y + a2.height / 2)),
        nav: document.querySelector("header").innerText,
        h1: h1.innerText.replace(/\s+/g, " "), h1Lines: Math.round(h1.getBoundingClientRect().height / parseFloat(getComputedStyle(h1).lineHeight)),
        leftovers: /Powered by advanced AI|Transform websites|Your campaign belongs here/i.test(document.body.innerText),
        viewport: innerHeight,
      };
    });
    assert.deepEqual(hero.pills, ["Website", "AI Video", "Photos", "Product", "Talking", "Interior", "Architect"], "the features are in the navbar");
    assert.equal(hero.tabsInBox, 0, "no feature tabs inside the landing box");
    assert.equal(hero.tileRow, 0, "no tile row under the box any more");
    assert.equal(hero.cards, 4, "a few photos, never many: 5 uploaded, 4 shown");
    assert.ok(hero.sources.every((src) => /landing-example-\d\.svg/.test(src)), "only the admin's own landing photos, never the gallery: " + hero.sources.join(","));
    assert.deepEqual(hero.titles, ["Website Video", "Product Video", "Interior Design", "Product Photos"], "each card is labelled from the feature the admin chose");
    assert.equal(hero.interactive, 0, "no buttons, links or controls inside them");
    assert.equal(hero.pointer, "none", "clicks pass straight through them"); assert.equal(hero.ariaHidden, "true");
    assert.ok(hero.animated, "they drift (animated)");
    assert.ok(hero.tilts >= 3 && hero.widths >= 2, "scattered: different tilts and sizes");
    assert.equal(hero.coversBox, 0, "no photo covers the chat box"); assert.equal(hero.coversTitle, 0, "none covers the headline"); assert.equal(hero.offscreen, 0, "all fully on screen");
    assert.ok(hero.boxTop < 200, `the chat box stays up near the headline (top at ${Math.round(hero.boxTop)}px)`);
    assert.equal(hero.backdrops, 1); assert.ok(hero.backdropInHero, "the space picture lives inside the hero only");
    assert.ok(Math.abs(hero.backdropBottom - hero.heroBottom) < 2, "and ends exactly where the hero ends");
    assert.ok(hero.planetUnderBox > 70 && hero.planetUnderBox < 200, `the box stands on top of the planet: ${Math.round(hero.planetUnderBox)}px of picture under it`);
    assert.ok(hero.heroBottom <= hero.viewport, `the whole first screen (box and planet) fits at ${hero.viewport}px (ends at ${Math.round(hero.heroBottom)})`);
    assert.ok(hero.sameRow && hero.reachable, "Generate sits in the settings row and is clickable");
    assert.match(hero.nav, /Pricing/); assert.match(hero.nav, /Log in/); assert.match(hero.nav, /Start creating/);
    assert.equal(hero.h1, "Turn Anything Into a Video"); assert.equal(hero.h1Lines, 1, "the headline is one horizontal line");
    assert.equal(hero.leftovers, false, "no badge, subtitle or placeholder text");
    console.log("ok  landing: headline, box (no tabs) standing on the planet, 4 floating admin photos (animated, scattered, covering nothing)");

    // the gallery's photos start right under the hero (no big heading first)
    const gallery = await page.evaluate(() => { const heroBottom = document.querySelector(".cinematic-hero").getBoundingClientRect().bottom; const tile = document.querySelector("#campaign-films button[aria-label]"); const h2 = document.querySelector("#campaign-films h2"); return { gap: tile.getBoundingClientRect().top - heroBottom, headingVisible: h2 ? h2.getBoundingClientRect().height > 2 : false }; });
    assert.ok(gallery.gap < 110, `the first photos begin right under the hero (${Math.round(gallery.gap)}px below it)`);
    assert.equal(gallery.headingVisible, false, "no large heading above the photos");
    assert.deepEqual(await page.evaluate(FIND_TRANSLUCENT_BLOCKS), [], "no block on the landing page shows the background through it");
    console.log("ok  gallery: the photos start immediately under the hero; no block on the page is see-through");

    // the floating photos cannot be clicked: a click on one lands on what is behind it and nothing happens
    const spot = await page.evaluate(() => { const r = document.querySelector(".hero-floater").getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    const under = await page.evaluate(({ x, y }) => { const el = document.elementFromPoint(x, y); return { inCard: !!el.closest(".hero-floater, .hero-floaters"), tag: el.tagName }; }, spot);
    assert.equal(under.inCard, false, "a click on a floating photo reaches the page behind it, never the photo");
    await page.mouse.click(spot.x, spot.y);
    await page.waitForTimeout(500);
    assert.equal(await page.locator("button[aria-label='Remove the attached example']").count(), 0, "clicking changed nothing");
    assert.equal(await page.getByText("Sign in to unlock").count(), 0);
    console.log("ok  clicking a floating photo does nothing (it is decoration)");

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
    assert.equal(await empty.page.locator(".hero-floaters, .hero-floater").count(), 0, "no uploaded photos, nothing floating");
    console.log("ok  with no uploaded photos nothing floats (nothing is taken from the gallery)");
    await empty.page.close();

    // ---- every other page: solid panels on the shared background, no space picture
    for (const route of ["/pricing", "/features", "/faq"]) {
      const other = await open(browser, { width: 1672, height: 941 }, route);
      const solid = await other.page.evaluate(() => {
        const alphaOf = (color) => { const m = color.match(/(?:rgba?|oklab|oklch|color)\(([^)]+)\)/); if (!m) return 1; const slash = m[1].split("/"); if (slash.length > 1) return parseFloat(slash[1]); const parts = m[1].split(","); return parts.length === 4 ? parseFloat(parts[3]) : 1; };
        const faint = Array.from(document.querySelectorAll('[class*="bg-white/[.0"]')).filter((el) => /(^|\s)bg-white\/\[(?:\.)0\d+\]/.test(el.getAttribute('class') || '') && !el.closest('.creator-composer, [role=dialog]')).filter((el) => alphaOf(getComputedStyle(el).backgroundColor) < 1).length;
        return { seeThrough: faint, pageBackdrop: (() => { const el = document.querySelector(".page-backdrop"); const cs = el && getComputedStyle(el); return !!el && cs.position === "fixed" && /space-bg/.test(cs.backgroundImage); })(), backdrops: document.querySelectorAll(".space-backdrop, .space-backdrop-photo").length, bodyAlpha: alphaOf(getComputedStyle(document.body).backgroundColor), bodyImage: getComputedStyle(document.body).backgroundImage.includes("radial-gradient"), fixedLayers: Array.from(document.querySelectorAll("body *")).filter((el) => getComputedStyle(el).position === "fixed" && el.getBoundingClientRect().width >= innerWidth - 2 && el.getBoundingClientRect().height >= innerHeight - 2 && !el.closest("[role=dialog]") && !el.classList.contains("page-backdrop")).length, labels: Array.from(document.querySelectorAll("main *")).filter((el) => getComputedStyle(el).textTransform === "uppercase" && getComputedStyle(el).fontFamily.includes("mono") && el.children.length === 0 && el.textContent.trim().length > 2).map((el) => el.textContent.trim()) };
      });
      assert.equal(solid.seeThrough, 0, `${route}: every card and chip fill is opaque`);
      const translucent = await other.page.evaluate(FIND_TRANSLUCENT_BLOCKS);
      assert.deepEqual(translucent, [], `${route}: no block shows the background through it`);
      assert.equal(solid.backdrops, 0, `${route} has no hero picture (that is only on the first screen of the home page)`);
      assert.equal(solid.bodyAlpha, 1, `${route} has an opaque page colour`);
      assert.ok(solid.pageBackdrop, `${route} sits on the space picture (the page background)`);
      assert.equal(solid.fixedLayers, 0, `${route} has no full-screen layer behind its content`);
      assert.deepEqual(solid.labels, [], `${route} has no uppercase mono label`);
      await other.page.close();
    }
    console.log("ok  other pages (pricing, features, FAQ): on the space picture, solid blocks, no uppercase mono labels");

    // ---- phone
    const phone = await open(browser, { width: 390, height: 844 });
    const mobile = await phone.page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth - document.documentElement.clientWidth,
      floating: document.querySelectorAll(".hero-orbit-card, .hero-side").length,
      trigger: (document.querySelector("header button[aria-label^='Features']") || {}).innerText || "",
      tabsInBox: document.querySelectorAll(".creator-composer [role=tab]").length,
      generate: Array.from(document.querySelectorAll("button")).filter((b) => /Continue to video/.test(b.textContent) && b.offsetParent).length,
      floaters: getComputedStyle(document.querySelector(".hero-floaters")).display,
      boxBottom: document.querySelector(".creator-composer").getBoundingClientRect().bottom, viewport: innerHeight,
    }));
    assert.equal(mobile.overflow, 0, "no horizontal overflow on a phone");
    assert.equal(mobile.floating, 0);
    assert.match(mobile.trigger, /Website/, "the navbar button names the open feature");
    assert.equal(mobile.tabsInBox, 0);
    assert.equal(mobile.generate, 1, "exactly one visible Generate button");
    assert.equal(mobile.floaters, "none", "the floating photos stay off phones");
    assert.ok(mobile.boxBottom <= mobile.viewport, "the whole box is on the first phone screen");
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
    console.log("ok  phone: no overflow, the navbar button names the open feature, one Generate button, the whole box on the first screen, no floating photos");
    console.log("\nall space landing checks passed");
  } finally {
    await browser.close();
    server.close();
  }
})().catch((error) => { console.error(error); process.exit(1); });
