import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { classifyLink, findLinkInText, linkHost } from '../../aiwebvideo/src/lib/smartLink.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('a link typed into the message is found once it is finished, and taken out of the text', () => {
  assert.deepEqual(findLinkInText('mystore.com make a promo', false), { link: 'mystore.com', rest: 'make a promo' });
  assert.deepEqual(findLinkInText('promo for https://shop.example.com/sale, please', false), { link: 'https://shop.example.com/sale', rest: 'promo for please' });
  // still being typed: nothing is taken until a space follows (or the person sends)
  assert.equal(findLinkInText('mystore.com', false), null);
  assert.deepEqual(findLinkInText('mystore.com', true), { link: 'mystore.com', rest: '' });
});

test('ordinary words with dots, file names and email addresses are never mistaken for links', () => {
  for (const text of ['make v2.final of logo.png please', 'email me@example.com when done', 'use 1.5x speed', 'e.g. a short ad']) {
    assert.equal(findLinkInText(text, true), null, text);
  }
});

test('a link is filed as a map location, a product page or a website', () => {
  assert.equal(classifyLink('https://maps.app.goo.gl/abc123'), 'map');
  assert.equal(classifyLink('https://www.google.com/maps/place/Nablus'), 'map');
  assert.equal(classifyLink('https://www.amazon.com/dp/B0ABCDEFGH'), 'product');
  assert.equal(classifyLink('https://brand.example.com/products/trail-shoe'), 'product');
  assert.equal(classifyLink('https://www.etsy.com/listing/123/mug'), 'product');
  // a shop's home page is a website, not one product
  assert.equal(classifyLink('amazon.com'), 'website');
  assert.equal(classifyLink('https://brand.example.com'), 'website');
  assert.equal(linkHost('https://www.shop.example.com/a/b?c=1'), 'shop.example.com');
});

test('the composer is one box: links are picked up from the message, pasted links never need a second field', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /function routeLink\(link: string, rest: string \| null\): boolean/);
  assert.match(form, /onChange=\{\(event\) => onMessageChange\(event\.currentTarget\.value\)\}/);
  // a pasted link goes straight to its place instead of into the text
  assert.match(form, /if \(!pasted \|\| !looksLikeLink\(pasted\) \|\| !linkSlotOpen\(\)/);
  // a map link opens Architecture and a product page opens Product Video, without the person choosing first
  assert.match(form, /if \(mode !== "architecture"\) applyIntent\("architecture", true\);/);
  assert.match(form, /if \(!productMode\) applyIntent\("product-video", true\);/);
  // the separate "Website URL" field and its label are gone
  assert.doesNotMatch(form, />Website URL</);
  assert.doesNotMatch(form, /What should the video highlight\?/);
});

test('a link or a photo on its own is enough to send: an empty message gets a sensible default', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /withHiddenDirection\(text\.trim\(\) \|\| DEFAULT_WEBSITE_BRIEF, selectedIdea\?\.guardrail\)/);
  assert.match(form, /\|\| \(hasSource \? \(DEFAULT_PROMPTS\[activeMode\] \?\? ""\) : ""\)/);
  // AI video and talking scenes still need the person's own words
  assert.match(form, /const DEFAULT_PROMPTS: Partial<Record<CreationIntent, string>> = \{\s*photo:[^}]*"product-video":[^}]*interior:[^}]*architecture:[^}]*\};/);
  // the website photos of the person's own site still work without a link
  assert.match(form, /websiteUrl\.trim\(\) \? normalizeWebsiteUrl\(websiteUrl\) : ""/);
});

test('links are still read automatically, stale answers are ignored, and sending waits for the read', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /const readId = \+\+productReadId\.current;/);
  assert.match(form, /if \(readId !== productReadId\.current\) return null;/);
  assert.match(form, /const linkBusy = readingProduct \|\| resolvingSite;/);
  assert.match(form, /const submitDisabled = disabled \|\| linkBusy \|\|/);
  assert.match(form, /data-testid="product-blocked"/);          // a shop that blocks reading asks for one photo instead of failing
  assert.match(form, /Add one photo of the product to continue\./);
  assert.match(form, /site\?\.precision === "view"/);            // an imprecise map link is still called out
});

test('Enter sends with a keyboard and stays a new line on touch screens', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  assert.match(form, /if \(event\.key !== "Enter" \|\| event\.shiftKey \|\| event\.nativeEvent\.isComposing\) return;/);
  assert.match(form, /if \(window\.matchMedia\?\.\("\(pointer: coarse\)"\)\.matches\) return;/);
});

test('the balance is always visible and turns warm below the price of the cheapest creation', async () => {
  const pill = await fe('components/account/CreditPill.tsx');
  assert.match(pill, /export const LOW_CREDIT_THRESHOLD = estimateRenderCredits\("photos", true, 8, "1080p", "graphic-1"\);/);
  assert.match(pill, /href="\/pricing#buy-credits"/);
  const workspace = await fe('components/dashboard/DashboardClient.tsx');
  assert.match(workspace, /data-testid="credit-card"/);
  assert.match(workspace, /me\.creditsBalance <= 0 && \(/);       // out of credits: the notice sits under the composer
  const notice = await fe('components/account/CreditUpgradeNotice.tsx');
  assert.match(notice, /Everything you made is saved\./);
});

test('the public header always offers a way in, on every screen size', async () => {
  const nav = await fe('components/landing/Nav.tsx');
  assert.match(nav, /onClick=\{\(\) => openAuth\("signin"\)\}/);
  assert.match(nav, /onClick=\{\(\) => openAuth\("signup"\)\}/);
  assert.match(nav, /!authChecked && !waited \?/);              // a slow sign-in check never leaves only placeholders
  assert.doesNotMatch(nav, /max-sm:hidden[^>]*>\s*Start free/);
});
