import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseProductPage } from '../src/lib/product-html.js';
import { hasFastStart } from '../src/lib/media-optimize.js';

const BASE = 'https://shop.example.com/products/runner';

test('reads a schema.org Product with an image array', () => {
  const html = `<html><head><script type="application/ld+json">{"@context":"https://schema.org","@type":"Product","name":"Runner Shoe","description":"Light and fast","image":["https://cdn.example.com/a.jpg","/b.jpg"]}</script></head></html>`;
  const page = parseProductPage(html, BASE);
  assert.equal(page.title, 'Runner Shoe');
  assert.equal(page.description, 'Light and fast');
  assert.deepEqual(page.images.slice(0, 2), ['https://cdn.example.com/a.jpg', 'https://shop.example.com/b.jpg']);
});

test('understands ProductGroup, array @type and @graph (Shopify and WooCommerce style)', () => {
  const html = `<script type="application/ld+json">{"@graph":[{"@type":"WebSite"},{"@type":["ProductGroup"],"name":"Tee","image":{"@type":"ImageObject","url":"https://cdn.example.com/tee.png"}}]}</script>`;
  const page = parseProductPage(html, BASE);
  assert.equal(page.title, 'Tee');
  assert.equal(page.images[0], 'https://cdn.example.com/tee.png');
});

test('falls back to social images with attributes in any order', () => {
  const html = `<head><meta content="https://cdn.example.com/social.jpg" property="og:image"><meta content='Mug' property='og:title'><link rel="image_src" href="/legacy.jpg"></head>`;
  const page = parseProductPage(html, BASE);
  assert.equal(page.title, 'Mug');
  assert.ok(page.images.includes('https://cdn.example.com/social.jpg'));
  assert.ok(page.images.includes('https://shop.example.com/legacy.jpg'));
});

test('with no structured data, picks the product photo from the page and skips logos and icons', () => {
  const html = `<body>
    <img src="/assets/logo.png" alt="Shop logo" width="200" height="60">
    <img src="/img/sprite.png">
    <img class="payment-visa" src="/img/visa.png">
    <img src="/img/tiny.jpg" width="40" height="40">
    <img class="product-gallery__image" src="/img/bag-small.jpg" srcset="/img/bag-800.jpg 800w, /img/bag-1600.jpg 1600w" alt="Leather bag">
    <img src="data:image/gif;base64,AAAA">
  </body>`;
  const page = parseProductPage(html, BASE);
  assert.equal(page.images[0], 'https://shop.example.com/img/bag-1600.jpg');
  assert.ok(!page.images.some((url) => /logo|sprite|visa|tiny/.test(url)));
});

test('returns no images for a page without any, and never throws on broken JSON-LD', () => {
  assert.deepEqual(parseProductPage('<script type="application/ld+json">{not json</script><p>hi</p>', BASE).images, []);
});

test('detects whether an MP4 can start playing before it has fully downloaded', () => {
  const faststart = Buffer.concat([Buffer.from('....ftypisom'), Buffer.from('moov'), Buffer.alloc(32), Buffer.from('mdat')]);
  const slow = Buffer.concat([Buffer.from('....ftypisom'), Buffer.from('mdat'), Buffer.alloc(32), Buffer.from('moov')]);
  assert.equal(hasFastStart(faststart), true);
  assert.equal(hasFastStart(slow), false);
});
