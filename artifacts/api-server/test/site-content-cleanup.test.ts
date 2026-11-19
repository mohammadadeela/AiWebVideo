import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('the pricing blocks keep their text exactly; only the page around them was cleaned', async () => {
  const table = await fe('components/landing/PricingTable.tsx');
  const packs = await fe('lib/pricing.ts');
  for (const text of ['Pay once, no subscription. Credits stay in your account until you use them and work for every feature.', 'Videos need more credits.', 'Buy credits']) assert.ok(table.includes(text), `pricing text kept: ${text}`);
  for (const name of ['Starter', 'Creator', 'Studio']) assert.ok(packs.includes(name), `pack name kept: ${name}`);
  const page = await fe('pages/PricingPage.tsx');
  assert.match(page, /Simple credits\. See the price before you generate\./);
  assert.match(page, /<PricingTable \/>/);
  for (const gone of ['Production pricing', 'Choose your balance', 'See the quote first', 'Failure handling', 'Credits without the guesswork']) assert.ok(!page.includes(gone), `"${gone}" must stay removed`);
});

test('the gallery starts right under the hero: no big heading above the photos, the first eight load immediately', async () => {
  const gallery = await fe('components/landing/VideoShowcase.tsx');
  assert.match(gallery, /<h2 className="sr-only">See what it creates<\/h2>/);                // kept for screen readers and search only
  assert.doesNotMatch(gallery, /text-\[clamp\(2rem,8vw,3\.2rem\)\]/);                       // the large visible heading is gone
  assert.match(gallery, /pb-10 pt-4 sm:px-5 sm:pb-14 sm:pt-5/);                                // a thin top edge
  assert.match(gallery, /<Media sample=\{sample\} eager=\{index < 8\} \/>/);
});
