import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { linkStatusMessage, looksLikeLink, withScheme } from '../../aiwebvideo/src/lib/linkStatus.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');
const messages = ['reading', 'still working', 'deeper read'] as const;

test('the "we are working" message changes as a slow page takes longer, so it never looks frozen', () => {
  assert.equal(linkStatusMessage(0, messages), 'reading');
  assert.equal(linkStatusMessage(2.9, messages), 'reading');
  assert.equal(linkStatusMessage(3, messages), 'still working');
  assert.equal(linkStatusMessage(8.9, messages), 'still working');
  assert.equal(linkStatusMessage(9, messages), 'deeper read');
});

test('anything that looks like a web address is read straight away; plain words and addresses are not', () => {
  for (const link of ['https://shop.com/item/1', 'http://a.co/x', 'shop.com/products/mug', 'www.example.co.uk/p?id=3', 'https://maps.app.goo.gl/abc123']) assert.equal(looksLikeLink(link), true, link);
  for (const text of ['', '   ', 'a nice mug', '12 Main Street, Hebron', 'https://', 'hello.', 'shop com']) assert.equal(looksLikeLink(text), false, JSON.stringify(text));
  assert.equal(withScheme('shop.com/x'), 'https://shop.com/x');
  assert.equal(withScheme('http://a.co'), 'http://a.co');
});

test('links are read automatically, show a working state, ignore stale answers, and Generate waits for them', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /const timer = window\.setTimeout\(\(\) => \{ void loadProductLink\(typed\); \}, 700\);/);
  assert.match(form, /const timer = window\.setTimeout\(\(\) => \{ void resolveSite\(typed\); \}, 500\);/);
  assert.match(form, /const readId = \+\+productReadId\.current;/);
  assert.match(form, /if \(readId !== productReadId\.current\) return null;/);
  assert.match(form, /const linkBusy = readingProduct \|\| resolvingSite;/);
  assert.match(form, /const submitDisabled = disabled \|\| linkBusy \|\|/);
  assert.match(form, /Reading your link…/);
  assert.match(form, /<LinkStatus active=\{readingProduct\} skeleton/);
  assert.match(form, /<LinkStatus active=\{resolvingSite\}/);
  assert.match(form, /\{linkBusy && <i className=/);                      // an <i>: a <span> would be styled as the credits badge
  assert.match(form, /Photos read from the previous link must never be used with a different one/);
});

test('the Generate button keeps the size it always had', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /<div className=\{`mt-4 flex flex-col gap-2 sm:flex-row sm:items-center \$\{compactLayout \? "generation-row-inline" : ""\}`\}>/);
  assert.doesNotMatch(form, /mt-3 flex flex-col gap-2 sm:flex-row sm:items-center/);   // "mt-4" is what switches the sizing rule on
  const original = await fe('creator-cta-position.css');
  assert.match(original, /min-height: 52px !important;/);
  assert.match(original, /border-radius: 16px !important;/);
  const css = await fe('index.css');
  assert.match(css, /\.creator-composer > \.relative > \.mt-4\.generation-row-inline:has\(> \.creator-primary-button\) \{ display: none !important; \}/);
  assert.match(css, /\.generation-submit-slot \.creator-primary-button \{\s*min-height: 52px;\s*border-radius: 16px;/);
});

test('mouse dragging is opt-in: only the chat\'s feature tabs and examples strip', async () => {
  assert.match(await fe('lib/dragScroll.ts'), /const SLIDER = "\[data-drag-scroll\]";/);
  assert.match(await fe('components/ui/scroll-row.tsx'), /data-drag-scroll=\{drag \? "" : undefined\}/);
  assert.match(await fe('components/chat/SampleStrip.tsx'), /<ScrollRow className="gap-2\.5 pb-1\.5" nudge=\{false\} drag>/);
  assert.match(await fe('components/chat/WebsiteBriefForm.tsx'), /<ScrollRow drag className="gap-1 pb-0\.5 max-sm:grid/);
  for (const file of ['pages/ContentPages.tsx', 'pages/StudioEditorPage.tsx', 'components/landing/VideoShowcase.tsx']) assert.doesNotMatch(await fe(file), /data-drag-scroll/, file);
});

test('on a phone all seven features are visible at once as a grid, with an icon above each label', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /max-sm:grid max-sm:grid-cols-4 max-sm:gap-1\.5 max-sm:overflow-visible/);
  assert.match(form, /max-sm:min-h-\[60px\] max-sm:flex-col/);
});
