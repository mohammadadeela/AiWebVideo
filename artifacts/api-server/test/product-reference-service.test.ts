import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/lib/errors.js';
import { parseProductPage, upgradeImageUrl } from '../src/lib/product-html.js';
import { parseShopifyProduct, readProductReference, shopifyProductUrl, type ProductReadDeps } from '../src/lib/product-reference-service.js';

const allow = async (url: string) => (/^https:\/\/(cdn|img)\./.test(url) ? url : null);
const shellHtml = '<html><head><title>Loading…</title></head><body><div id="root"></div><script src="/app.js"></script></body></html>';
const productHtml = (extra = '') => `<html><head><script type="application/ld+json">{"@type":"Product","name":"Clay Mug","brand":{"name":"Hand & Kiln"},"image":["https://cdn.shop.test/mug-front.jpg"],"offers":{"price":"24.00","priceCurrency":"USD","availability":"https://schema.org/InStock"}}</script>${extra}</head></html>`;
const deps = (over: Partial<ProductReadDeps> = {}): ProductReadDeps => ({
  readHtml: async (url) => ({ url, html: productHtml() }),
  readJson: async () => { throw new Error('no json'); },
  render: async () => null,
  allowImage: allow,
  ...over,
});

test('a normal product page is read directly, with the facts the page states', async () => {
  const result = await readProductReference('https://shop.test/mug', deps());
  assert.equal(result.source, 'page');
  assert.equal(result.title, 'Clay Mug');
  assert.deepEqual(result.images, ['https://cdn.shop.test/mug-front.jpg']);
  assert.deepEqual(result.facts, { brand: 'Hand & Kiln', price: '24.00', currency: 'USD', availability: 'InStock' });
});

test('a script-only shell falls back to the shop\'s public product data (Shopify)', async () => {
  const result = await readProductReference('https://store.test/products/linen-shirt', deps({
    readHtml: async (url) => ({ url, html: shellHtml }),
    readJson: async (url) => {
      assert.equal(url, 'https://store.test/products/linen-shirt.js');
      return { title: 'Linen Shirt', body_html: '<p>Soft <b>linen</b></p>', vendor: 'North', type: 'Shirts', price: 8900, images: ['//cdn.shopify.com/s/files/a_100x100.jpg', '//cdn.shopify.com/s/files/b_grande.png'] };
    },
    allowImage: async (url) => url,
  }));
  assert.equal(result.source, 'shop-data');
  assert.equal(result.title, 'Linen Shirt');
  assert.equal(result.description, 'Soft linen');
  assert.deepEqual(result.facts, { brand: 'North', category: 'Shirts', price: '89.00' });
  assert.deepEqual(result.images, ['https://cdn.shopify.com/s/files/a.jpg', 'https://cdn.shopify.com/s/files/b.png']);   // full-size, not thumbnails
});

test('a JavaScript-only shop is read through a real browser, merging what was painted', async () => {
  const result = await readProductReference('https://spa.test/item/42', deps({
    readHtml: async (url) => ({ url, html: shellHtml }),
    render: async () => ({ url: 'https://spa.test/item/42', html: productHtml(), images: ['https://img.spa.test/hero.jpg'] }),
  }));
  assert.equal(result.source, 'rendered');
  assert.deepEqual(result.images, ['https://cdn.shop.test/mug-front.jpg', 'https://img.spa.test/hero.jpg']);
});

test('a shop that blocks robots gets a clear message that says what to do instead', async () => {
  await assert.rejects(
    readProductReference('https://blocked.test/p/1', deps({ readHtml: async () => { throw new AppError('x', 422, 'PRODUCT_BLOCKED'); } })),
    (error: AppError) => error.code === 'PRODUCT_BLOCKED' && /Upload a photo or screenshot/.test(error.message),
  );
});

test('a page with no photos anywhere says so, without blaming the shop', async () => {
  await assert.rejects(
    readProductReference('https://empty.test/p/1', deps({ readHtml: async (url) => ({ url, html: shellHtml }) })),
    (error: AppError) => error.code === 'PRODUCT_IMAGES_MISSING' && /product page/.test(error.message),
  );
});

test('a blocked page can still be rescued by the browser fallback', async () => {
  const result = await readProductReference('https://blocked.test/p/1', deps({
    readHtml: async () => { throw new AppError('x', 422, 'PRODUCT_BLOCKED'); },
    render: async () => ({ url: 'https://blocked.test/p/1', html: productHtml(), images: [] }),
  }));
  assert.equal(result.source, 'rendered');
});

test('images on private addresses are never offered', async () => {
  const result = await readProductReference('https://shop.test/mug', deps({
    readHtml: async (url) => ({ url, html: productHtml('<meta property="og:image" content="http://10.0.0.5/internal.jpg">') }),
  }));
  assert.ok(result.images.every((image) => !image.includes('10.0.0.5')));
});

test('shop product urls are recognised in every spelling', () => {
  assert.equal(shopifyProductUrl('https://a.test/products/x'), 'https://a.test/products/x.js');
  assert.equal(shopifyProductUrl('https://a.test/collections/all/products/x?variant=1'), 'https://a.test/collections/all/products/x.js');
  assert.equal(shopifyProductUrl('https://a.test/products/x.js'), 'https://a.test/products/x.js');
  assert.equal(shopifyProductUrl('https://a.test/about'), null);
  assert.equal(parseShopifyProduct({ title: 'x', images: [] }, 'https://a.test'), null);
});

test('thumbnail urls are upgraded to the full-size photo on common image hosts only', () => {
  assert.equal(upgradeImageUrl('https://m.media-amazon.com/images/I/71abc._AC_SL1500_.jpg'), 'https://m.media-amazon.com/images/I/71abc.jpg');
  assert.equal(upgradeImageUrl('https://cdn.shopify.com/s/files/1/a_600x600.jpg?v=1&width=300'), 'https://cdn.shopify.com/s/files/1/a.jpg?v=1');
  assert.equal(upgradeImageUrl('https://ae01.alicdn.com/kf/Hxyz.jpg_640x640q90.jpg'), 'https://ae01.alicdn.com/kf/Hxyz.jpg');
  assert.equal(upgradeImageUrl('https://unknown.test/photo_100x100.jpg'), 'https://unknown.test/photo_100x100.jpg');
});

test('the parser finds photos Amazon, picture tags and embedded page data hide', () => {
  const html = `<img data-a-dynamic-image='{"https://m.media-amazon.com/images/I/s._SX200_.jpg":[200,200],"https://m.media-amazon.com/images/I/b._SX1500_.jpg":[1500,1500]}'>
    <picture><source srcset="https://cdn.t/p-400.webp 400w, https://cdn.t/p-1200.webp 1200w"></picture>
    <script id="__NEXT_DATA__" type="application/json">{"props":{"product":{"gallery":["https://cdn.t/g1.jpg","https://cdn.t/logo-sprite.png"]}}}</script>`;
  const parsed = parseProductPage(html, 'https://t.test/');
  assert.ok(parsed.images.includes('https://m.media-amazon.com/images/I/b.jpg'));
  assert.ok(parsed.images.includes('https://cdn.t/p-1200.webp'));
  assert.ok(parsed.images.includes('https://cdn.t/g1.jpg'));
  assert.ok(!parsed.images.some((image) => image.includes('sprite')));
});
