import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildStoryboardPrompt,
  buildFallbackStoryboard,
  stableVariantSeed,
  type StoryboardInput,
} from '../src/lib/gemini.js';
import { supportedTransition } from '../src/lib/veo.js';

function plannerInput(overrides: Partial<StoryboardInput> = {}): StoryboardInput {
  return {
    siteUrl: 'https://example-store.com',
    pageTitle: 'Example Store | أصنافنا',
    description: 'A real storefront',
    screenshotBase64: null,
    fullPageScreenshotBase64: null,
    referenceCaptures: [
      { label: 'Real desktop homepage viewport', base64: 'aGVsbG8=' },
      { label: 'Real desktop homepage full page', base64: 'd29ybGQ=' },
      { label: 'Real captured Products', base64: 'cGFnZQ==' },
    ],
    mode: 'video',
    vibeBrief: 'Premium editorial',
    targetDurationSeconds: 24,
    featuresText: null,
    creativeBrief: null,
    aspectRatio: '16:9',
    outputQuality: '1080p',
    frameRate: 30,
    variationKey: 'job-a:1:seed-a',
    ...overrides,
  };
}

/**
 * Every feature button maps to a mode; each mode must deliver its own master
 * direction to the planner. A distinctive phrase from each master prompt is
 * asserted so a wiring regression (mode ignored, prompt replaced by the user
 * message, etc.) fails these tests immediately.
 */
const MODE_SIGNATURES: Array<[StoryboardInput['mode'], string]> = [
  ['video', 'PROMO VIDEO — premium editorial website commercial'],
  ['tutorial', 'HOW TO USE — clear first-time-user walkthrough'],
  ['buy', 'HOW TO BUY — conversion-focused shopping journey'],
  ['tour', 'FEATURE TOUR — feature-by-feature tour'],
  ['demo', 'SAAS/BRAND DEMO — generative cinematic product film'],
  ['photos', 'PHOTOS — premium marketing image creation'],
  ['both', 'VIDEO + PHOTOS — exact website video plus creative marketing stills'],
];

for (const [mode, signature] of MODE_SIGNATURES) {
  test(`${mode} mode sends its own master prompt`, () => {
    const { prompt } = buildStoryboardPrompt(plannerInput({ mode }));
    assert.ok(prompt.includes(signature), `expected ${mode} prompt to include "${signature}"`);
    assert.ok(prompt.includes(`MODE: ${mode}`));
  });
}

test('exact-capture video modes carry the exact-capture lock and exclude the scroll recording', () => {
  for (const mode of ['video', 'tutorial', 'buy', 'tour'] as const) {
    const { prompt } = buildStoryboardPrompt(plannerInput({ mode }));
    assert.ok(prompt.includes('NON-NEGOTIABLE EXACT-CAPTURE LOCK'), `${mode} must include the exact-capture lock`);
    assert.ok(prompt.includes('NEVER use it as footage inside the generated marketing video'), `${mode} must exclude the scroll recording`);
    assert.ok(prompt.includes('Preserve Arabic and English exactly as rasterized'), `${mode} must lock Arabic/English pixels`);
    assert.ok(prompt.includes('PROFESSIONAL EDITING SYSTEM'), `${mode} must include the editorial system`);
  }
});

test('photos mode uses the creative photo policy instead of the video pixel lock', () => {
  const { prompt, isPhotos } = buildStoryboardPrompt(plannerInput({ mode: 'photos' }));
  assert.equal(isPhotos, true);
  assert.ok(prompt.includes('PHOTO MODE — CAPTURE-BASED CREATIVE EDITING'));
  assert.ok(!prompt.includes('NON-NEGOTIABLE EXACT-CAPTURE LOCK'), 'photos must not be pixel-locked like video');
  assert.ok(prompt.includes('never translate, correct, replace, or redraw that UI text'), 'photos must still protect real UI text');
});

test('demo mode uses the generative cinematic policy instead of the exact-capture lock', () => {
  const { prompt, isDemo } = buildStoryboardPrompt(plannerInput({ mode: 'demo' }));
  assert.equal(isDemo, true);
  assert.ok(prompt.includes('DEMO MODE — GENERATIVE CINEMATIC BRAND FILM'));
  assert.ok(!prompt.includes('NON-NEGOTIABLE EXACT-CAPTURE LOCK'), 'demo must not be pixel-locked like exact-capture video');
  assert.ok(!prompt.includes('PROFESSIONAL EDITING SYSTEM'), 'demo must not use the multi-beat exact-capture editing system');
  assert.ok(prompt.includes('GENERATIVE CINEMATIC SYSTEM'), 'demo must use the one-frame-one-move cinematic system');
  assert.ok(prompt.includes('Do NOT invent product names, prices, discount claims'), 'demo must still forbid fabricated marketing claims');
  assert.ok(prompt.includes('composition MUST be "single"'), 'demo scenes must be single generated frames, never a collage');
});

test('video + photos mode delivers both preservation rules separately', () => {
  const { prompt } = buildStoryboardPrompt(plannerInput({ mode: 'both' }));
  assert.ok(prompt.includes('VIDEO + PHOTOS — TWO DIFFERENT PRESERVATION RULES'));
  assert.ok(prompt.includes('VIDEO OUTPUT is exact-capture only'));
  assert.ok(prompt.includes('PHOTO OUTPUT may be creatively edited'));
});

test('user custom instructions supplement the mode prompt instead of replacing it', () => {
  const { prompt } = buildStoryboardPrompt(plannerInput({
    mode: 'video',
    creativeBrief: 'Focus on dresses and use more split screens',
  }));
  assert.ok(prompt.includes('Focus on dresses and use more split screens'));
  assert.ok(prompt.includes('PROMO VIDEO — premium editorial website commercial'), 'mode master prompt must remain present');
  assert.ok(prompt.includes('NON-NEGOTIABLE EXACT-CAPTURE LOCK'), 'global rules must remain present');
});

test('prompt includes capture context, delivery format and duration structure', () => {
  const { prompt, captureCount, sceneCount } = buildStoryboardPrompt(plannerInput({ targetDurationSeconds: 24 }));
  assert.equal(captureCount, 3);
  assert.equal(sceneCount, 3);
  assert.ok(prompt.includes('Attached are 3 labeled real website screenshots'));
  assert.ok(prompt.includes('DELIVERY: 16:9, 1080p, 30 FPS'));
  assert.ok(prompt.includes('Create exactly 3 scenes'));
});

test('variation key changes the seed and the prompt; the same key is deterministic', () => {
  const a = buildStoryboardPrompt(plannerInput({ variationKey: 'job:1:version-a' }));
  const b = buildStoryboardPrompt(plannerInput({ variationKey: 'job:2:version-b' }));
  const a2 = buildStoryboardPrompt(plannerInput({ variationKey: 'job:1:version-a' }));
  assert.notEqual(a.variantSeed, b.variantSeed);
  assert.notEqual(a.prompt, b.prompt);
  assert.equal(a.variantSeed, a2.variantSeed);
  assert.ok(a.prompt.includes(`CREATIVE VARIATION ID: ${a.variantSeed}`));
  assert.equal(stableVariantSeed('job:1:version-a'), a.variantSeed);
});

test('fallback storyboard is executable: valid indexes, no invented copy, no narration', () => {
  const storyboard = buildFallbackStoryboard(plannerInput({ targetDurationSeconds: 24 }));
  assert.equal(storyboard.scenes.length, 3);
  assert.equal(storyboard.voiceoverScript, null);
  for (const scene of storyboard.scenes) {
    assert.equal(scene.onScreenCopy, '');
    assert.ok((scene.sourceIndices ?? []).every((index) => index >= 0 && index < 3), 'sourceIndices must map to real captures');
    assert.ok(['single', 'sequence', 'split', 'triple'].includes(scene.composition ?? ''));
    assert.ok((scene.focusX ?? 0) >= 0 && (scene.focusX ?? 0) <= 1);
    assert.ok((scene.focusY ?? 0) >= 0 && (scene.focusY ?? 0) <= 1);
  }
});

test('fallback photo storyboard plans 4 creative images with no capture indexes', () => {
  const storyboard = buildFallbackStoryboard(plannerInput({ mode: 'photos' }));
  assert.equal(storyboard.scenes.length, 4);
  for (const scene of storyboard.scenes) {
    assert.deepEqual(scene.sourceIndices, []);
    assert.equal(scene.motion, 'static');
  }
});

test('fallback demo storyboard keeps 8s scenes but forces single-frame composition', () => {
  const storyboard = buildFallbackStoryboard(plannerInput({ mode: 'demo', targetDurationSeconds: 24 }));
  assert.equal(storyboard.scenes.length, 3);
  for (const scene of storyboard.scenes) {
    assert.equal(scene.durationSeconds, 8, 'demo scenes stay 8s like exact-capture video, unlike photo scenes');
    assert.equal(scene.composition, 'single', 'demo never collages independently generated frames');
    assert.equal(scene.onScreenCopy, '');
  }
});

test('two variation seeds produce different fallback edits', () => {
  const a = buildFallbackStoryboard(plannerInput({ variationKey: 'seed-one' }));
  const b = buildFallbackStoryboard(plannerInput({ variationKey: 'seed-two' }));
  assert.notEqual(a.variantSeed, b.variantSeed);
  assert.notDeepEqual(
    a.scenes.map((scene) => [scene.sourceIndices, scene.motion, scene.focusX, scene.focusY]),
    b.scenes.map((scene) => [scene.sourceIndices, scene.motion, scene.focusX, scene.focusY]),
  );
});

test('storyboard transitions map only to safe non-generative xfade transitions', () => {
  assert.equal(supportedTransition('clean dissolve between pages'), 'fade');
  assert.equal(supportedTransition('smooth directional slide right'), 'slideright');
  assert.equal(supportedTransition('masked wipe up'), 'wipeup');
  assert.equal(supportedTransition('match cut between product grids'), 'fadefast');
  assert.equal(supportedTransition('hard cut'), 'fadefast');
  const fallback = supportedTransition(undefined, 1);
  assert.ok(['fadefast', 'smoothleft', 'wipeleft', 'slideleft', 'smoothup'].includes(fallback));
});
