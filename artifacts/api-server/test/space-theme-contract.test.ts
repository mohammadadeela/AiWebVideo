import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { advanceStar, createField, createStar, starSegment, type Star } from '../../aiwebvideo/src/lib/warpField.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const seeded = (seed = 7) => () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

test('stars only ever fly into the upper sky, never over the planet at the bottom', () => {
  const rand = seeded();
  for (let i = 0; i < 500; i += 1) {
    const star = createStar(rand);
    assert.ok(Math.sin(star.angle) < 0, 'pointing up');                  // screen y grows downward, so up means a negative sine
    assert.ok(star.radius > 0 && star.radius <= 1);
  }
});

test('flying forward: a star moves outward and speeds up, and its trail points back toward where it was', () => {
  const star: Star = { angle: Math.PI * 1.5, radius: 0.4, z: 0.9, hue: 0, weight: 1 };
  const rand = seeded();
  const distance = (s: Star, previousZ: number) => { const seg = starSegment(s, previousZ, 1672, 941); return Math.hypot(seg.x2 - 836, seg.y2 - 941 * 0.84); };
  let current = star; let last = distance(current, current.z); let lastStep = 0;
  for (let i = 0; i < 12; i += 1) {
    const moved = advanceStar(current, 0.1, 0.11, rand);
    if (moved.previousZ === 1) break;                                    // reborn after leaving
    const d = distance(moved.star, moved.previousZ);
    assert.ok(d > last, 'moves away from the vanishing point');
    assert.ok(d - last >= lastStep - 1e-6, 'accelerates as it gets closer');
    lastStep = d - last; last = d; current = moved.star;
  }
  const seg = starSegment({ ...star, z: 0.5 }, 0.52, 1672, 941);
  assert.ok(Math.hypot(seg.x1 - 836, seg.y1 - 941 * 0.84) < Math.hypot(seg.x2 - 836, seg.y2 - 941 * 0.84), 'the trail starts nearer the centre than the head');
});

test('a star that leaves the screen is reborn far away, and nothing ever becomes NaN', () => {
  const rand = seeded(11);
  const field = createField(200, rand);
  let stars = field;
  for (let step = 0; step < 600; step += 1) {
    stars = stars.map((s) => advanceStar(s, 0.016, 0.11, rand).star);
    for (const s of stars) { assert.ok(Number.isFinite(s.z) && s.z > 0.03 && s.z <= 1); const seg = starSegment(s, s.z, 1280, 800); assert.ok(Number.isFinite(seg.x2) && Number.isFinite(seg.y2) && seg.alpha >= 0 && seg.alpha <= 1); }
  }
  assert.equal(advanceStar({ angle: 5, radius: 0.5, z: 0.04, hue: 1, weight: 1 }, 1, 0.5, rand).star.z, 1, 'reborn at the far end');
  assert.equal(createField(150, seeded()).length, 150);
});

test('the backdrop is wired in, calmer off the landing page, still for reduced motion, and never takes a click', async () => {
  const app = await fe('App.tsx');
  assert.match(app, /<SpaceBackdrop quiet=\{location !== '\/'\} \/>/);
  const backdrop = await fe('components/landing/SpaceBackdrop.tsx');
  assert.match(backdrop, /prefers-reduced-motion: reduce/);
  assert.match(backdrop, /document\.addEventListener\("visibilitychange"/);        // paused when the tab is hidden
  assert.match(backdrop, /muted\s+loop\s+playsInline/);
  const css = await fe('cinematic-theme.css');
  assert.match(css, /\.space-backdrop \{[^}]*pointer-events: none;/);
  assert.match(css, /\.space-backdrop-quiet \.space-backdrop-image/);
  assert.match(css, /prefers-reduced-motion: reduce\) \{\s*\.space-backdrop-image/);
  assert.match(css, /\.hero-side \{ display: none; \}/);                          // the side cards are hidden below 1366px
  assert.match(css, /@media \(min-width: 1366px\) \{\s*\.hero-grid \{\s*display: grid;/);
});

test('the background photo is a web-sized file, not the 2.7 MB original', async () => {
  for (const [file, max] of [['space-bg.webp', 400_000], ['space-bg-small.webp', 200_000]] as const) {
    const info = await stat(path.resolve(process.cwd(), '../aiwebvideo/public', file));
    assert.ok(info.size > 20_000 && info.size < max, `${file} is ${info.size} bytes`);
  }
});

test('the floating media is decorative and silent, one card per feature from the admin gallery', async () => {
  const orbit = await fe('components/landing/HeroMediaOrbit.tsx');
  assert.match(orbit, /aria-hidden="true"/);
  assert.match(orbit, /pointer-events-none/);
  assert.match(orbit, /showBlockedControl=\{false\}/);
  const code = orbit.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');   // comments may say "no play button"; only real markup counts
  assert.doesNotMatch(code, /<button\b|<Play\b|<PlayCircle\b|controls[=\s{]/);
  for (const feature of ['website', 'product-video', 'interior', 'scenario', 'architecture']) assert.ok(orbit.includes(`feature: "${feature}"`), feature);
  const admin = await fe('pages/AdminPage.tsx');
  assert.match(admin, /Show on the hero/);
  assert.doesNotMatch(admin, /Use in background|First five items/);
});

test('the hero fits one screen: a single-line headline, the creator, then examples; the features live in the navbar', async () => {
  const hero = await fe('components/landing/Hero.tsx');
  assert.match(hero, /Turn Anything <span className="cinematic-title-gradient">Into a Video<\/span>/);
  assert.doesNotMatch(hero, /Powered by advanced AI|Transform websites, products, ideas/);   // both lines were removed on request
  assert.ok(hero.indexOf('<h1') < hero.indexOf('<ChatWidget') && hero.indexOf('<ChatWidget') < hero.indexOf('<HeroExamples'), 'headline, then the box, then the examples');
  const css = await fe('cinematic-theme.css');
  assert.match(css, /@media \(min-width: 640px\) \{ \.cinematic-title \{ white-space: nowrap; \} \}/);   // horizontal from tablet up
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /<div className="generation-submit-slot">\{submitButton\("w-full"\)\}<\/div>/);
  assert.match(form, /\{landingWebsitePreview \? \(/);                                   // no tab row inside the landing box
  const nav = await fe('components/landing/Nav.tsx');
  assert.doesNotMatch(nav, /How it works|Examples/);
  assert.match(nav, /<FeaturePills onPick=\{pickFeature\} \/>/);
  assert.match(nav, /<FeatureDropdown onPick=\{pickFeature\} \/>/);
});
