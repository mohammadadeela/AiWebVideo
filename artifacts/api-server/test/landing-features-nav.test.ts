import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { CREATION_FEATURES, featureById, isCreationIntent } from '../../aiwebvideo/src/lib/creationFeatures.js';
import { HERO_FEATURE_ORDER, pickVariety } from '../../aiwebvideo/src/lib/heroMedia.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
type Item = { id: string; feature: string | null; url: string | null };
const item = (id: string, feature: string | null, url: string | null = `/${id}.jpg`): Item => ({ id, feature, url });

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

test('the example row shows a varied set: one of each feature before any feature repeats', () => {
  const items = [
    item('w1', 'website'), item('w2', 'website'), item('w3', 'website'),
    item('p1', 'photo'), item('p2', 'photo'),
    item('i1', 'interior'), item('a1', 'architecture'), item('s1', 'scenario'), item('pv1', 'product-video'), item('v1', 'video'),
  ];
  const first7 = pickVariety(items, 7).map((entry) => entry.feature);
  assert.deepEqual([...first7].sort(), [...HERO_FEATURE_ORDER].sort(), 'seven tiles = seven different features');
  const first10 = pickVariety(items, 10);
  assert.equal(first10.length, 10);
  assert.equal(new Set(first10.map((entry) => entry.id)).size, 10, 'no tile twice');
});

test('older uploads with no feature still appear, and items without a file never do', () => {
  const picked = pickVariety([item('a', null), item('b', 'photo'), item('c', 'website', null), item('d', 'interior')], 8);
  assert.deepEqual(picked.map((entry) => entry.id).sort(), ['a', 'b', 'd']);
  assert.deepEqual(pickVariety([], 8), []);
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
  assert.match(menu, /You'll sign in or create a free account when you press Generate/);
  assert.match(menu, /OPEN_FEATURE_MENU_EVENT/);
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /useEffect\(\(\) => \{ publishCreationMode\(activeMode\); \}, \[activeMode\]\);/);
  assert.match(form, /onClick=\{requestOpenFeatureMenu\}/);                                  // the box's own "Change" button
});

test('floating cards: seven, in their own side columns, placeholders when empty, decorative only', async () => {
  const orbit = await fe('components/landing/HeroMediaOrbit.tsx');
  for (const feature of ['website', 'interior', 'architecture', 'photo', 'product-video', 'scenario', 'video']) assert.ok(orbit.includes(`feature: "${feature}"`), feature);
  assert.match(orbit, /Your campaign belongs here\./);
  assert.match(orbit, /aria-hidden="true"/);
  assert.match(orbit, /pointer-events-none/);
  const code = orbit.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
  assert.doesNotMatch(code, /<button\b|<Play\b|controls[=\s{]/);
  const hero = await fe('components/landing/Hero.tsx');
  assert.match(hero, /<HeroSideCards side="left" \/>[\s\S]*<HeroExamples \/>[\s\S]*<HeroSideCards side="right" \/>/);
  const css = await fe('cinematic-theme.css');
  assert.match(css, /grid-template-columns: minmax\(150px, 1fr\) minmax\(0, 1060px\) minmax\(150px, 1fr\);/);
});
