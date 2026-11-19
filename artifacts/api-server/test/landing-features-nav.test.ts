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

test('the admin uploads and chooses the landing photos in their own section, and the gallery can never wipe them', async () => {
  const manager = await fe('components/admin/LandingExamplesManager.tsx');
  assert.match(manager, /MAX_LANDING_EXAMPLES = 4/);
  assert.match(manager, /Landing photos/);
  assert.match(manager, /uploadMarketingAsset\(accepted\[index\]\)/);
  assert.match(manager, /aria-label="Feature"/);                                           // a feature is required for each
  const admin = await fe('pages/AdminPage.tsx');
  assert.match(admin, /<LandingExamplesManager/);
  assert.equal((admin.match(/videos: \{ showcase:/g) ?? []).length, 0, 'every gallery change must keep the examples (spread marketing.videos)');
  assert.doesNotMatch(admin, /Show on the hero|HERO_FEATURES/);
});
