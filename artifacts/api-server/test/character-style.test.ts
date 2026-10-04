import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { buildFallbackStoryboard, buildStoryboardPrompt, characterBeatDirections, isGenerativeVideoMode, type StoryboardInput } from '../src/lib/gemini.js';
import { VIDEO_MASTER_PROMPTS, buildContinuousVideoPrompt } from '../src/lib/video-prompts.js';

// The reference this style was built from: an Instagram Story ad. A woman in a bright, brand-coloured apartment reacts to the
// news, sits down and browses the brand's REAL website on a laptop, the camera pushes into the screen, and the film ends on the
// real site with the logo. Everything on the screen is the real site; the platform's own buttons are not part of the video.
const input = (over: Partial<StoryboardInput> = {}): StoryboardInput => ({
  siteUrl: 'https://julia.ps',
  pageTitle: 'Julia | جوليا',
  description: 'An online clothing store',
  screenshotBase64: null,
  fullPageScreenshotBase64: null,
  referenceCaptures: [
    { label: 'Homepage', base64: 'aGVsbG8=' },
    { label: 'Product collection', base64: 'd29ybGQ=' },
    { label: 'Logo', base64: 'bG9nbw==' },
  ],
  mode: 'character',
  vibeBrief: 'Warm lifestyle',
  targetDurationSeconds: 16,
  featuresText: null,
  creativeBrief: null,
  aspectRatio: '9:16',
  outputQuality: '1080p',
  frameRate: 24,
  ...over,
});

test('Character story is a real video style, planned as one continuous AI film', () => {
  assert.equal(isGenerativeVideoMode('character'), true);
  const { prompt } = buildStoryboardPrompt(input());
  assert.ok(prompt.includes('MODE: character'));
  assert.ok(prompt.includes('CHARACTER STORY — a believable person discovers and uses this exact website.'));
  assert.ok(prompt.includes('final deliverable is ONE continuous AI-generated film'));
});

test('the planner is told exactly what makes this style: one consistent character, an on-brand world, the real screen as the proof', () => {
  const { prompt } = buildStoryboardPrompt(input());
  for (const rule of [
    'CHARACTER STORY MODE — A PERSON DISCOVERS AND USES THE REAL WEBSITE',
    'Keep the same face, hair, age, build and wardrobe in every beat',
    'Never a real, famous or recognizable person',
    'taken from the brand\'s palette and products in the captures',
    'a banner towed past the window',                                    // the reference's hook, as an example of an in-world device
    'THE SCREEN IS THE PROOF',
    'it MUST show the real captured page',
    'Never invent pages, products, prices, states or text on the screen',
    'Do not generate random spoken dialogue',
    'Never draw platform interface: no story progress bars, "See details" buttons',
    'For vertical 9:16 keep the character and the screen centered',
    'With fewer than four timeline beats, combine the beats in order',
    'voiceoverScript MUST be null',
  ]) assert.ok(prompt.includes(rule), `planner prompt is missing: ${rule}`);
  // it keeps the site's real-text protection that every website style has
  assert.ok(prompt.includes('Treat existing text inside a capture as protected source pixels'));
  assert.ok(prompt.includes('Never direct the visual model to synthesize Arabic'));
  // and it is not the Cinematic brand film
  assert.ok(!prompt.includes('DEMO MODE — FULL AI CINEMATIC BRAND FILM'));
});

test('on-screen text only when the customer asks for it, and then short English only', () => {
  const { prompt } = buildStoryboardPrompt(input({ creativeBrief: 'Announce that Julia is now available' }));
  assert.ok(prompt.includes('onScreenCopy MUST be "" unless the customer\'s notes ask for visible text'));
  assert.ok(prompt.includes('short, correctly spelled ENGLISH copy'));
  assert.ok(prompt.includes('Announce that Julia is now available'));       // the customer's own words reach the planner
});

test('the fallback plan tells the whole story at every length: reaction, use, push-in, hero', () => {
  const beats = (seconds: number) => buildFallbackStoryboard(input({ targetDurationSeconds: seconds })).scenes.map((scene) => scene.shotDescription);
  const long = beats(32);
  assert.equal(long.length, 4);
  assert.match(long[0], /character .*reacting with a genuine, specific emotion/);
  assert.match(long[1], /using the real website/);
  assert.match(long[2], /push toward the screen so the real website becomes the hero/);
  assert.match(long[3], /hero view of the device with the real website readable/);
  // a shorter video combines beats in order, and never loses the character USING the site or the hero ending
  for (const seconds of [8, 16, 24]) {
    const short = beats(seconds);
    const all = short.join(' ');
    assert.ok(short.length >= 1 && short.length <= 3, `${seconds}s`);
    assert.match(short[0], /reacting with a genuine, specific emotion/, `${seconds}s opens on the reaction`);
    assert.match(all, /using the real website/, `${seconds}s keeps the character using the site`);
    assert.match(short[short.length - 1], /hero view of the device with the real website readable/, `${seconds}s ends on the hero`);
  }
  assert.equal(beats(16).length, 2);
  assert.match(beats(16)[0], /reacting.*using the real website/);                 // beat 1 = reaction + use
  assert.match(beats(16)[1], /push toward the screen.*hero view/);                // beat 2 = push-in + hero
  const plan = buildFallbackStoryboard(input({ targetDurationSeconds: 32 }));
  assert.match(plan.concept, /character story/i);
  assert.equal(plan.scenes[0].sceneType, 'hook');
  assert.equal(plan.scenes[3].sceneType, 'cta');
  for (const scene of plan.scenes) assert.equal(scene.onScreenCopy, '');          // no invented marketing text
  assert.equal(plan.voiceoverScript, null);
  assert.ok(plan.ideas.length >= 3);
  assert.deepEqual(characterBeatDirections(['a', 'b', 'c', 'd'], 4), ['a', 'b', 'c', 'd']);
  assert.deepEqual(characterBeatDirections(['a', 'b', 'c', 'd'], 3), ['a', 'b c', 'd']);
  assert.deepEqual(characterBeatDirections(['a', 'b', 'c', 'd'], 1), ['a b c d']);
});

test('the video model gets the same rules, and the customer\'s words, in the final prompt', () => {
  assert.ok(VIDEO_MASTER_PROMPTS.character.length > 400);
  const prompt = buildContinuousVideoPrompt({
    mode: 'character',
    siteTitle: 'Julia',
    concept: 'A customer discovers Julia',
    vibe: 'warm',
    scenes: buildFallbackStoryboard(input()).scenes,
    targetDurationSeconds: 16,
    creativeBrief: 'A woman in pink pajamas in a sunny apartment, an airplane banner says Julia is now available',
    referenceLabels: ['Homepage', 'Product collection', 'Logo'],
    aspectRatio: '9:16',
    outputQuality: '1080p',
    nativeAudio: true,
    variantSeed: 3,
  });
  assert.ok(prompt.includes('airplane banner says Julia is now available'));
  assert.ok(prompt.includes('CHARACTER STORY — A PERSON DISCOVERS AND USES THE REAL WEBSITE'));
  assert.ok(prompt.includes('Whenever a screen is visible it shows the real captured page'));
  assert.ok(prompt.includes('No social-media interface of any kind'));
  assert.ok(prompt.includes('warm, intimate ambience'));
  assert.ok(!prompt.includes('CINEMATIC BRAND FILM — FULLY AI-GENERATED'));
});

test('the style is offered everywhere it must be, and accepted everywhere it is validated', async () => {
  const root = path.resolve(process.cwd(), '..');
  const read = (file: string) => readFile(path.join(root, file), 'utf8');
  const types = await read('api-server/src/types.ts');
  assert.match(types, /\| "character"/);
  const jobs = await read('api-server/src/routes/jobs.ts');
  assert.equal((jobs.match(/"character",/g) ?? []).length, 3, 'planning, rendering and saved-workflow validation');
  const gemini = await read('api-server/src/lib/gemini.ts');
  assert.match(gemini, /'linkedin',\n  'character',/);                                            // generative video modes
  const ui = await read('aiwebvideo/src/components/chat/WebsiteBriefForm.tsx');
  assert.match(ui, /"linkedin" \| "demo" \| "character"/);
  assert.match(ui, /\{ mode: "character", label: "Character story", helper: "Someone uses your site", icon: UserRound/);
  const shared = await read('aiwebvideo/src/components/chat/types.ts');
  assert.match(shared, /\| "character"/);
  assert.match(shared, /\{ label: "Character Story", mode: "character" \}/);
  assert.match(await read('aiwebvideo/src/lib/publicCreatorHandoff.ts'), /"demo" \| "character"/);          // survives signing in
  assert.match(await read('aiwebvideo/src/lib/jobWorkflowDraft.ts'), /"linkedin",\n  "character",/);          // survives a reload
  assert.match(await read('aiwebvideo/src/components/chat/ChatWidgetBase.tsx'), /mode === "demo" \|\| mode === "character"/);
  assert.match(await read('aiwebvideo/src/pages/ContentPages.tsx'), /\["Character story", /);
});
