import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { MAX_LANDING_EXAMPLES, normalizeMarketingSettings } from '../src/lib/marketing.js';

const src = (file: string) => readFile(path.resolve(process.cwd(), 'src', file), 'utf8');
const item = (id: string, extra: object = {}) => ({ id, url: `/api/assets/marketing/${id}.jpg`, posterUrl: null, caption: null, overlayText: null, eyebrow: null, kind: 'image', feature: 'photo', ...extra });

test('settings saved before landing examples existed still load, with an empty set of examples', () => {
  const settings = normalizeMarketingSettings({ heading: 'H', description: 'D', videos: { showcase: [item('a'), item('b')] } });
  assert.deepEqual(settings.videos.examples, []);
  assert.equal(settings.videos.showcase.length, 2);
  assert.deepEqual(normalizeMarketingSettings(null).videos.examples, []);
  assert.deepEqual(normalizeMarketingSettings('garbage').videos.examples, []);
  assert.deepEqual(normalizeMarketingSettings({ videos: { examples: 'nope' } }).videos.examples, []);
});

test('landing examples keep their media, feature and kind, get ids when missing, and stop at the maximum', () => {
  const many = Array.from({ length: 12 }, (_, i) => item(`e${i}`, i === 0 ? { feature: 'interior', kind: 'video', posterUrl: '/p.jpg' } : {}));
  const { videos } = normalizeMarketingSettings({ videos: { showcase: [item('g1')], examples: many } });
  assert.equal(videos.examples.length, MAX_LANDING_EXAMPLES);
  assert.equal(MAX_LANDING_EXAMPLES, 6);
  assert.deepEqual([videos.examples[0].feature, videos.examples[0].kind, videos.examples[0].posterUrl], ['interior', 'video', '/p.jpg']);
  const noId = normalizeMarketingSettings({ videos: { showcase: [], examples: [{ url: '/x.jpg', feature: 'photo' }, null, 5] } }).videos.examples;
  assert.deepEqual(noId.map((entry) => entry.id), ['landing-1']);
});

test('the gallery and the landing examples are separate lists: the examples never come from the gallery', () => {
  const { videos } = normalizeMarketingSettings({ videos: { showcase: [item('gallery-1'), item('gallery-2')], examples: [item('landing-a')] } });
  assert.deepEqual(videos.examples.map((entry) => entry.id), ['landing-a']);
  assert.deepEqual(videos.showcase.map((entry) => entry.id), ['gallery-1', 'gallery-2']);
});

test('an admin can save, validate and look up landing examples, and a tapped example resolves to its feature', async () => {
  const admin = await src('routes/admin.ts');
  assert.match(admin, /examples: z\.array\(video\)\.max\(MAX_LANDING_EXAMPLES\)\.default\(\[\]\)/);
  assert.match(admin, /\[\.\.\.body\.videos\.showcase, \.\.\.body\.videos\.examples\]\.filter\(\(item\) => item\.url && !item\.feature\)/);   // a feature is required for each
  assert.match(admin, /EXAMPLE_REUSES_GALLERY/);
  const marketing = await src('lib/marketing.ts');
  assert.match(marketing, /\[\.\.\.settings\.videos\.showcase, \.\.\.settings\.videos\.examples\]\.find\(/);                       // taps resolve in both lists
  assert.match(await src('routes/index.ts'), /videos: \{ showcase: \[\], examples: \[\] \}/);
});
