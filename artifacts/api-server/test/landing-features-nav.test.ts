import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CREATION_FEATURES, featureById, isCreationIntent } from '../../aiwebvideo/src/lib/creationFeatures.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('there are exactly seven features, each with a name, a one-line description and an icon', () => {
  assert.deepEqual(CREATION_FEATURES.map((feature) => feature.id), ['website', 'video', 'photo', 'product-video', 'scenario', 'interior', 'architecture']);
  for (const feature of CREATION_FEATURES) {
    assert.ok(feature.label.length > 3 && feature.short.length > 2 && feature.description.length > 15, feature.id);
    assert.ok(feature.icon, `${feature.id} has an icon`);
  }
  assert.equal(new Set(CREATION_FEATURES.map((feature) => feature.label)).size, 7);
  assert.equal(featureById('interior').label, 'Interior Design');
  assert.equal(isCreationIntent('photo'), true);
  assert.equal(isCreationIntent('nonsense'), false);
});

test('opening a feature never needs an account; signing in happens at Generate', async () => {
  const widget = await fe('components/chat/ChatWidgetBase.tsx');
  assert.doesNotMatch(widget, /function handlePublicIntentRequest/);
  assert.doesNotMatch(widget, /onIntentRequest=/);
  assert.match(widget, /Choosing a feature never needs an account/);
  // Generate on a public page still saves the request and asks the visitor to sign in or up
  assert.match(widget, /void saveStudioHandoff\(request\);\s*pendingActionRef\.current = \(\) => redirectStudioSubmitToWorkspace\(request\)/);
});

test('the navbar menu switches the chat box on the home page and takes you there from every other page', async () => {
  const nav = await fe('components/landing/Nav.tsx');
  assert.match(nav, /requestCreationMode\(intent\);/);
  assert.match(nav, /navigate\(`\/\?create=\$\{intent\}#generate`\)/);
  const menu = await fe('components/landing/FeatureMenu.tsx');
  assert.match(menu, /aria-label="Choose a feature"/);
  assert.match(menu, /Sign in or create a free account when you press Generate\./);
  assert.match(menu, /OPEN_FEATURE_MENU_EVENT/);
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /useEffect\(\(\) => \{ publishCreationMode\(activeMode\); \}, \[activeMode\]\);/);
});


test('the examples under the chat box are only what an admin uploaded for them; nothing is borrowed from the gallery; no floating cards', async () => {
  const examples = await fe('components/landing/HeroExamples.tsx');
  assert.match(examples, /useLandingExamples\(\)/);
  assert.doesNotMatch(examples, /useGalleryItems|useSamples|pickVariety/);
  assert.match(examples, /if \(!examples\.length\) return null;/);                      // nothing uploaded, nothing shown
  const code = examples.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /<Play\b|controls[=\s{]/);
  assert.match(examples, /aria-label="Make one like this"/);
  const hero = await fe('components/landing/Hero.tsx');
  assert.doesNotMatch(hero, /HeroSideCards|HeroMediaOrbit/);
  const store = await fe('lib/showcase.ts');
  assert.match(store, /export function useLandingExamples\(\)/);
  assert.match(store, /\[\.\.\.media\.gallery, \.\.\.media\.examples\]\.filter\(isSample\)/);       // a tapped example still resolves later (workspace restore)
});

test('the admin uploads the landing examples in their own section, and the gallery can never wipe them', async () => {
  const manager = await fe('components/admin/LandingExamplesManager.tsx');
  assert.match(manager, /MAX_LANDING_EXAMPLES = 6/);
  assert.match(manager, /Landing examples/);
  assert.match(manager, /uploadMarketingAsset\(accepted\[index\]\)/);
  assert.match(manager, /aria-label="Feature"/);                                           // a feature is required for each
  const admin = await fe('pages/AdminPage.tsx');
  assert.match(admin, /<LandingExamplesManager/);
  assert.equal((admin.match(/videos: \{ showcase:/g) ?? []).length, 0, 'every gallery change must keep the examples (spread marketing.videos)');
  assert.doesNotMatch(admin, /Show on the hero|HERO_FEATURES/);
});
