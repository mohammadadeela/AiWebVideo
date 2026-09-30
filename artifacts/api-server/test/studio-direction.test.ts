import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import {
  ARCHITECTURE_VIEW_ROLES,
  USER_BRIEF_HEADER,
  architectureContext,
  composeStudioBrief,
  extractUserBrief,
} from '../src/lib/studio-direction.js';
import { buildArchitecturalImagePrompt } from '../src/lib/imagen-legacy.js';
import { parseProductPage } from '../src/lib/product-html.js';
import { hasFastStart, optimizeShowcaseVideo } from '../src/lib/media-optimize.js';

test('architecture context turns raw form values into unit-labelled engineering instructions', () => {
  const text = architectureContext({ location: 'Hebron', latitude: 31.5326, longitude: 35.0998, plotWidth: 20, plotDepth: 30, setback: 3, floors: 2 });
  assert.match(text, /Plot: 20 m wide x 30 m deep \(600 m2\) — exact figures/);
  assert.match(text, /maximum building footprint is 14 m x 24 m/);
  assert.match(text, /Floors: exactly 2/);
  assert.doesNotMatch(text, /plotWidth|undefined|NaN/);
  assert.match(architectureContext({ plotWidth: 10, plotDepth: 12, setback: 8 }), /larger than half of the plot/);
  assert.match(architectureContext({ estimatedScale: true }), /infer a plausible plot/);
  assert.match(architectureContext({ plotWidth: 20, plotDepth: 30, estimatedScale: true }), /ESTIMATED/);
});

test('the master direction is added on the server, with the customer words last and highest priority', () => {
  const brief = composeStudioBrief({ studioKind: 'architecture', architecture: { plotWidth: 20, plotDepth: 30, floors: 3 }, userBrief: 'A modern clinic with a glass entrance' });
  assert.match(brief, /ARCHITECTURE ON A REAL SITE/);
  assert.match(brief, /SITE AND ENGINEERING INPUTS/);
  assert.ok(brief.endsWith('A modern clinic with a glass entrance'));
  assert.ok(brief.indexOf('ARCHITECTURE ON A REAL SITE') < brief.indexOf(USER_BRIEF_HEADER));
  assert.equal(extractUserBrief(brief), 'A modern clinic with a glass entrance');
  assert.match(composeStudioBrief({ studioKind: 'interior', userBrief: 'Warm minimal living room' }), /INTERIOR DESIGN/);
});

test('direction is idempotent and never duplicated by an older cached frontend', () => {
  const once = composeStudioBrief({ studioKind: 'interior', userBrief: 'Living room' });
  assert.equal(composeStudioBrief({ studioKind: 'interior', userBrief: once }), once);
  const legacy = 'You are AiWebVideo\'s professional architectural visualization director. USER DESIGN BRIEF: cafe';
  assert.equal(composeStudioBrief({ studioKind: 'interior', userBrief: legacy }), legacy);
});

test('product, idea and scenario briefs are untouched unless a hidden direction was chosen', () => {
  assert.equal(composeStudioBrief({ studioKind: 'product', userBrief: 'Sneaker on wet stone' }), 'Sneaker on wet stone');
  const withIdea = composeStudioBrief({ studioKind: 'idea', userBrief: 'Drone flyover of my hotel', hiddenDirection: 'Create a cinematic drone sequence.' });
  assert.match(withIdea, /ADDITIONAL DIRECTION/);
  assert.ok(withIdea.endsWith('Drone flyover of my hotel'));
});

test('architecture images are four consistent camera views, not marketing frames', () => {
  const prompts = [0, 1, 2, 3].map((sceneIndex) => buildArchitecturalImagePrompt({
    kind: 'architecture', sceneIndex, title: 'Site', concept: 'Modern clinic', sceneDescription: 'notes',
    brief: composeStudioBrief({ studioKind: 'architecture', architecture: { plotWidth: 20, plotDepth: 30 }, userBrief: 'Modern clinic' }),
  }));
  prompts.forEach((prompt, index) => {
    assert.ok(prompt.includes(ARCHITECTURE_VIEW_ROLES[index]));
    assert.match(prompt, /same design|identical design/i);
    assert.doesNotMatch(prompt, /HERO FRAME|WORLD FRAME|campaign|brand identity|typography/i);
    assert.equal(prompt.split('ARCHITECTURE ON A REAL SITE').length - 1, 1, 'master appears exactly once');
  });
  // Even without a directed brief the master is added.
  assert.match(buildArchitecturalImagePrompt({ kind: 'interior-design', sceneIndex: 0, title: 't', concept: 'c', sceneDescription: 'd', brief: 'cafe' }), /INTERIOR DESIGN/);
});

test('product page parsing understands ProductGroup, variants, lazy images and ignores logos', () => {
  const html = `<html><head>
    <title>Trail Shoe</title>
    <meta property="og:description" content="Light &amp; grippy">
    <script type="application/ld+json">{"@context":"https://schema.org","@type":["ProductGroup"],"name":"Trail Shoe","hasVariant":[{"@type":"Product","image":["/img/red.jpg"]}]}</script>
    </head><body>
    <img src="/assets/logo.png" width="300" height="90" alt="Shop logo">
    <img data-src="/media/main-product-photo.jpg" alt="Trail Shoe" class="product-gallery" width="800">
    <img srcset="/media/side-320.jpg 320w, /media/side-1200.jpg 1200w" alt="side">
    <img src="/pixel.gif"><img src="data:image/png;base64,AAAA">
    </body></html>`;
  const parsed = parseProductPage(html, 'https://shop.example/p/trail');
  assert.equal(parsed.title, 'Trail Shoe');
  assert.equal(parsed.description, 'Light & grippy');
  assert.equal(parsed.images[0], 'https://shop.example/img/red.jpg');
  assert.ok(parsed.images.includes('https://shop.example/media/main-product-photo.jpg'));
  assert.ok(parsed.images.includes('https://shop.example/media/side-1200.jpg'));
  assert.ok(!parsed.images.some((url) => /logo|pixel|base64/.test(url)));
});

test('product page with only social tags still yields the image', () => {
  const parsed = parseProductPage('<meta property="og:image" content="https://cdn.example/a.jpg"><meta property="og:title" content="Mug">', 'https://x.example/');
  assert.deepEqual(parsed.images, ['https://cdn.example/a.jpg']);
  assert.equal(parsed.title, 'Mug');
});

function haveFfmpeg() {
  try { execFileSync('ffmpeg', ['-version'], { stdio: 'ignore' }); return true; } catch { return false; }
}

test('showcase videos are re-encoded for phones: index up front, H.264, poster frame', { skip: !haveFfmpeg() }, async () => {
  const source = path.join('/tmp', `slow-${process.pid}.mp4`);
  // Worst case for phones: no faststart, 4:4:4 pixels, an audio track.
  execFileSync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'testsrc2=size=640x360:rate=24:duration=2', '-f', 'lavfi', '-i', 'sine=duration=2', '-c:v', 'libx264', '-pix_fmt', 'yuv444p', '-c:a', 'aac', '-shortest', source], { stdio: 'ignore' });
  const input = await readFile(source);
  assert.equal(hasFastStart(input), false);
  const result = await optimizeShowcaseVideo(input, '.mp4');
  assert.equal(result.optimized, true);
  assert.equal(hasFastStart(result.video), true);
  assert.ok(result.poster && result.poster.length > 500);
});

test('garbage video bytes are returned unchanged instead of failing the upload', { skip: !haveFfmpeg() }, async () => {
  const junk = Buffer.from('this is not a video');
  const result = await optimizeShowcaseVideo(junk, '.mov');
  assert.equal(result.optimized, false);
  assert.equal(result.video, junk);
  assert.equal(result.extension, '.mov');
});

test('the admin cannot save homepage samples until each one is filed under a feature', async () => {
  const admin = await readFile(path.resolve(process.cwd(), 'src/routes/admin.ts'), 'utf8');
  assert.match(admin, /FEATURE_REQUIRED/);
  assert.match(admin, /item\.url && !item\.feature/);
});

import { splitHiddenDirection, extractUserBrief, composeStudioBrief as composeForWebsite } from '../src/lib/studio-direction.js';

test('a hidden idea direction is split off the customer\'s own words', () => {
  const raw = 'Promote my summer sale\n\n[[AIWEBVIDEO_DIRECTION]]\nUse warm golden-hour light and a slow push-in.\n[[/AIWEBVIDEO_DIRECTION]]';
  const { text, direction } = splitHiddenDirection(raw);
  assert.equal(text, 'Promote my summer sale');
  assert.equal(direction, 'Use warm golden-hour light and a slow push-in.');
  assert.equal(extractUserBrief(raw), 'Promote my summer sale');
});

test('text without a marker, empty and missing input pass through unchanged', () => {
  assert.deepEqual(splitHiddenDirection('just my words'), { text: 'just my words', direction: '' });
  assert.deepEqual(splitHiddenDirection(undefined), { text: undefined, direction: '' });
  assert.deepEqual(splitHiddenDirection(null), { text: undefined, direction: '' });
  // an unterminated marker never swallows the customer's text that came before it
  assert.equal(splitHiddenDirection('hello [[AIWEBVIDEO_DIRECTION]] dangling').text, 'hello');
});

test('website jobs get the chosen direction added behind the customer\'s words (no studio master)', () => {
  const brief = composeForWebsite({ studioKind: null, userBrief: 'Promote my summer sale', hiddenDirection: 'Use warm golden-hour light.' });
  assert.match(brief, /Use warm golden-hour light\./);
  assert.ok(brief.indexOf('golden-hour') < brief.indexOf('Promote my summer sale'), 'customer words come last (highest priority)');
  assert.doesNotMatch(brief, /INTERIOR DESIGN|ARCHITECTURE ON A REAL SITE/);
  // no direction chosen: untouched
  assert.equal(composeForWebsite({ studioKind: null, userBrief: 'plain' }), 'plain');
});
