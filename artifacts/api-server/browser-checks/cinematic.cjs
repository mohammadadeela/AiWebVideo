/**
 * Regression checks for the cinematic layout and admin background selection.
 * Build the frontend first; run with CHROMIUM_PATH=/path/to/chromium node browser-checks/cinematic.cjs.
 * Uses local API/media fixtures, including a one-second ffmpeg clip. No live service writes.
 */
const fs = require("fs"),
  http = require("http"),
  path = require("path"),
  assert = require("assert/strict");
const { chromium } = require("playwright");
const { execFileSync } = require("node:child_process");
const OUTPUT = fs.mkdtempSync(
  path.join(require("node:os").tmpdir(), "aiwebvideo-cinematic-"),
);
const VIDEO = path.join(OUTPUT, "loop.mp4");
execFileSync("ffmpeg", [
  "-hide_banner",
  "-loglevel",
  "error",
  "-f",
  "lavfi",
  "-i",
  "testsrc2=size=320x200:rate=12",
  "-t",
  "1",
  "-c:v",
  "libx264",
  "-pix_fmt",
  "yuv420p",
  "-movflags",
  "+faststart",
  "-y",
  VIDEO,
]);
const ROOT = path.resolve(__dirname, "../../aiwebvideo/dist/public");
const types = {
  ".js": "text/javascript",
  ".html": "text/html",
  ".css": "text/css",
  ".svg": "image/svg+xml",
};
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, new URL(req.url, "http://localhost").pathname);
  if (
    !f.startsWith(ROOT + path.sep) ||
    !fs.existsSync(f) ||
    fs.statSync(f).isDirectory()
  )
    f = path.join(ROOT, "index.html");
  res.setHeader(
    "content-type",
    types[path.extname(f)] || "application/octet-stream",
  );
  fs.createReadStream(f).pipe(res);
});
const img = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="400"><defs><linearGradient id="g"><stop stop-color="#355777"/><stop offset="1" stop-color="#150d2f"/></linearGradient></defs><rect width="640" height="400" fill="url(#g)"/><circle cx="410" cy="150" r="90" fill="#a78bfa" opacity=".6"/><path d="M0 400 180 100 400 400M300 400 540 170 640 400" fill="#1c284d"/></svg>`;
let marketing = {
  heading: "See what it creates",
  description: "Local marketing media fixture",
  videos: {
    showcase: Array.from({ length: 7 }, (_, i) => ({
      id: "sample-" + i,
      url: "/api/assets/marketing/sample-" + i + (i === 0 ? ".mp4" : ".svg"),
      kind: i === 0 ? "video" : "image",
      posterUrl: "/api/assets/marketing/poster.svg",
      feature: "video",
      caption: null,
      eyebrow: null,
      overlayText: null,
    })),
  },
};
let signedIn = false,
  saves = 0;
async function mock(page) {
  await page.route("**/api/**", (r) => {
    const u = new URL(r.request().url()).pathname;
    const json = (o, status = 200) =>
      r.fulfill({
        status,
        contentType: "application/json",
        body: JSON.stringify(o),
      });
    if (u.endsWith(".mp4"))
      return r.fulfill({
        contentType: "video/mp4",
        body: fs.readFileSync(VIDEO),
      });
    if (u.startsWith("/api/assets/"))
      return r.fulfill({ contentType: "image/svg+xml", body: img });
    if (u === "/api/marketing") return json(marketing);
    if (u === "/api/admin/marketing") {
      marketing = r.request().postDataJSON();
      saves++;
      return json(marketing);
    }
    if (u === "/api/admin/overview")
      return json({
        marketing,
        operations: {},
        providerStatus: {},
        users: {},
        jobs: {},
        spend: {},
        recentJobs: [],
      });
    if (/\/api\/(auth|user)\/me/.test(u))
      return signedIn
        ? json({
            id: "qa-user",
            email: "qa@example.test",
            isAdmin: true,
            plan: "free",
            creditsBalance: 265,
            authProvider: "password",
            supportsPasswordChange: true,
          })
        : json({ error: "Not signed in" }, 401);
    if (u === "/api/user/usage")
      return json({
        balance: 265,
        plan: "free",
        thisMonth: {
          creditsUsed: 0,
          creditsAdded: 265,
          amountPaidUsd: 0,
          projects: 0,
          videos: 0,
          photos: 0,
          byMode: {},
        },
        recentCredits: [],
        recentPayments: [],
      });
    return json({
      jobs: [],
      projects: [],
      subscriptions: [],
      payments: [],
      events: [],
      users: [],
      total: 0,
    });
  });
}
(async () => {
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  const base = "http://127.0.0.1:" + server.address().port;
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
  });
  try {
    const page = await browser.newPage();
    await mock(page);
    const errors = [];
    page.on("pageerror", (e) => errors.push(e.message));
    for (const w of [320, 390, 768, 1440, 1920]) {
      await page.setViewportSize({ width: w, height: 1000 });
      await page.goto(base);
      await page
        .locator('[role=tablist][aria-label="Creation mode"]')
        .waitFor();
      await page.waitForTimeout(450);
      const dims = await page.evaluate(() => ({
        width: innerWidth,
        scroll: document.documentElement.scrollWidth,
        nav: getComputedStyle(document.querySelector("header")).position,
        hero: document
          .querySelector(".hero-media-orbit")
          .getBoundingClientRect().width,
      }));
      assert(dims.scroll <= w, `Home overflow ${w}: ${JSON.stringify(dims)}`);
      assert.equal(dims.nav, "sticky");
      assert(dims.hero > 0);
      await page.screenshot({ path: `${OUTPUT}/home-${w}.png` });
      await page.evaluate(() => scrollTo({ top: 600, behavior: "instant" }));
      await page.waitForTimeout(100);
      assert(
        Math.abs((await page.locator("header").first().boundingBox()).y) < 1,
        "navbar should stay fixed to viewport",
      );
      await page.evaluate(() => scrollTo({ top: 0, behavior: "instant" }));
      console.log("PASS home", w, dims);
    }
    await page.setViewportSize({ width: 1440, height: 1000 });
    await page.goto(base);
    const video = page.locator(".hero-media-orbit video").first();
    await video.waitFor();
    await page.waitForTimeout(1800);
    const playback = await video.evaluate((v) => ({
      loop: v.loop,
      muted: v.muted,
      controls: v.controls,
      paused: v.paused,
      time: v.currentTime,
      duration: v.duration,
    }));
    assert(
      playback.loop && playback.muted && !playback.controls && !playback.paused,
    );
    assert.equal(await page.locator(".hero-media-orbit button").count(), 0);
    console.log("PASS decorative video", playback);
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.waitForTimeout(600);
    console.log(
      "motion state",
      await page.evaluate(() => ({
        reduce: matchMedia("(prefers-reduced-motion: reduce)").matches,
        paused: document.querySelector(".hero-media-orbit video").paused,
        autoplay: document.querySelector(".hero-media-orbit video").autoplay,
      })),
    );
    assert.equal(await video.evaluate((v) => v.paused), true);
    await page.emulateMedia({ reducedMotion: "no-preference" });
    for (const route of [
      "/pricing",
      "/features",
      "/about",
      "/faq",
      "/privacy",
      "/terms",
      "/how-it-works",
      "/ai-video-generator",
      "/ai-interior-design-generator",
      "/ai-architectural-visualization",
      "/examples",
      "/guides/create-ai-video-from-prompt",
    ]) {
      await page.goto(base + route);
      await page.locator("h1").waitFor();
      assert.equal(await page.locator("h1").count(), 1, route + " heading");
      assert(
        (await page.evaluate(() => document.documentElement.scrollWidth)) <=
          1440,
        route + " overflow",
      );
    }
    console.log("PASS public route smoke");
    signedIn = true;
    for (const route of ["/dashboard", "/profile", "/studio", "/admin/landing"])
      for (const w of [320, 390, 768, 1440]) {
        await page.setViewportSize({ width: w, height: 1000 });
        await page.goto(base + route);
        await page.locator(".cinematic-page").waitFor();
        await page.waitForTimeout(250);
        await page.screenshot({
          path: `${OUTPUT}/${route.replaceAll("/", "-")}-${w}.png`,
        });
        const scroll = await page.evaluate(
          () => document.documentElement.scrollWidth,
        );
        assert(scroll <= w, `${route} overflow at ${w}: ${scroll}`);
        assert.equal(
          await page.locator(".cinematic-page").count(),
          1,
          route + " cinematic shell",
        );
        console.log("PASS app", route, w);
      }
    await page.goto(base);
    await page.locator(".hero-media-orbit").waitFor();
    await page.getByRole("link", { name: "Admin", exact: true }).click();
    await page.getByRole("button", { name: "Homepage", exact: true }).click();
    await page
      .getByRole("button", { name: "Use in background", exact: true })
      .last()
      .click();
    await page.getByRole("button", { name: "Save", exact: true }).click();
    await page.getByText("Homepage media is live.", { exact: true }).waitFor();
    assert.equal(saves, 1);
    assert.equal(marketing.videos.showcase[0].id, "sample-6");
    await page.locator('aside a[href="/"]').click();
    await page.locator(".hero-orbit-card-a img").waitFor();
    assert(
      (
        await page.locator(".hero-orbit-card-a img").first().getAttribute("src")
      ).includes("sample-6"),
      "saved artwork should refresh when returning home",
    );
    console.log("PASS admin ordering, save and same-tab refreshed background");
    assert.deepEqual(errors, [], "page errors");
    console.log("ALL CINEMATIC CHECKS PASSED; screenshots:", OUTPUT);
  } finally {
    await browser.close();
    server.close();
  }
})().catch((e) => {
  console.error(e);
  server.close();
  process.exitCode = 1;
});
