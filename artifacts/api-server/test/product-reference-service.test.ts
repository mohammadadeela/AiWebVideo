import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/lib/errors.js';
import { imageKey, parseProductPage, productSectionOf, upgradeImageUrl } from '../src/lib/product-html.js';
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
  // what the browser actually painted leads (it is the most precise view of the gallery)
  assert.deepEqual(result.images, ['https://img.spa.test/hero.jpg', 'https://cdn.shop.test/mug-front.jpg']);
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

const shopPage = `<html><head>
<meta property="og:image" content="https://cdn.shop.test/p/mug-front_1200x.jpg">
<script type="application/ld+json">{"@graph":[
 {"@type":"Organization","name":"Shop","logo":"https://cdn.shop.test/brand/logo-white.png","image":"https://cdn.shop.test/brand/store-front.jpg"},
 {"@type":"Product","name":"Clay Mug","image":["https://cdn.shop.test/p/mug-front_1200x.jpg","https://cdn.shop.test/p/mug-side_1200x.jpg"],"offers":{"price":"24","priceCurrency":"USD"}},
 {"@type":"ItemList","itemListElement":[{"@type":"Product","name":"Other Bowl","image":"https://cdn.shop.test/p/bowl_1200x.jpg"}]}
]}</script></head><body>
<header><img src="https://cdn.shop.test/brand/logo-white.png" width="300" height="80"></header>
<div class="product-gallery"><img src="https://cdn.shop.test/p/mug-front_600x.jpg" width="600" height="600"><img src="https://cdn.shop.test/p/mug-back_600x.jpg" width="600" height="600"><img src="https://cdn.shop.test/p/mug-top_600x.jpg" width="600" height="600"></div>
<h1>Clay Mug</h1><p>Hand thrown.</p>
<section class="related-products"><h2>You may also like</h2>
 <img src="https://cdn.shop.test/p/plate_600x.jpg" width="400" height="400"><img src="https://cdn.shop.test/p/cup_600x.jpg" width="400" height="400"></section>
<footer><img src="https://cdn.shop.test/brand/payments.jpg" width="500" height="200"></footer></body></html>`;

test('a product page offers the product\'s own photos, not related products, other products\' data, logos or the footer', () => {
  const parsed = parseProductPage(shopPage, 'https://shop.test/mug');
  const names = parsed.images.map((image) => image.split('/').pop()!.replace(/_\d+x\.jpg$/, ''));
  assert.deepEqual(names.sort(), ['mug-back', 'mug-front', 'mug-side', 'mug-top']);
  for (const wrong of ['bowl', 'plate', 'cup', 'logo-white', 'store-front', 'payments']) assert.ok(!parsed.images.some((image) => image.includes(wrong)), `${wrong} must not be offered`);
  assert.equal(parsed.title, 'Clay Mug');
});

test('one photo served at several sizes is offered once', () => {
  const parsed = parseProductPage(shopPage, 'https://shop.test/mug');
  assert.equal(parsed.images.filter((image) => image.includes('mug-front')).length, 1);
  assert.ok(parsed.images.length <= 8);
  assert.equal(imageKey('https://cdn.shop.test/p/mug-front_600x.jpg'), imageKey('https://cdn.shop.test/p/mug-front_1200x.jpg'));
  assert.notEqual(imageKey('https://cdn.shop.test/p/mug-front_600x.jpg'), imageKey('https://cdn.shop.test/p/mug-back_600x.jpg'));
});

test('the product section ends at the related-products block, but a class name near the top never cuts the gallery off', () => {
  const html = '<body class="template-product related-theme"><div class="gallery"><img src="a.jpg"></div><h1>Name</h1><p>text</p><div class="you-may-also-like"><img src="b.jpg"></div></body>';
  const section = productSectionOf(html);
  assert.ok(section.includes('a.jpg'));
  assert.ok(!section.includes('b.jpg'));
  assert.equal(productSectionOf('<h1>x</h1><p>only product</p>'), '<h1>x</h1><p>only product</p>');
});

test('a page whose declared photos are few is completed by its own gallery only', () => {
  const html = `<html><head><meta property="og:image" content="https://cdn.s.test/a-hero.jpg"></head><body><div class="product-media"><img src="https://cdn.s.test/a-2.jpg" width="500" height="500"><img src="https://cdn.s.test/a-3.jpg" width="500" height="500"></div><h1>A</h1><div class="recommended"><img src="https://cdn.s.test/zzz.jpg" width="500" height="500"></div></body></html>`;
  const images = parseProductPage(html, 'https://s.test/a').images;
  assert.ok(images.includes('https://cdn.s.test/a-hero.jpg') && images.includes('https://cdn.s.test/a-2.jpg') && images.includes('https://cdn.s.test/a-3.jpg'));
  assert.ok(!images.some((image) => image.includes('zzz')));
});
