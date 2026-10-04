import { test, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/lib/errors.js';
import { readPublicUrl } from '../src/lib/external-reference.js';
import { dedupeBestImages, imageQuality, inlineScriptImages, isDirectImageUrl, parseProductPage, productHintsFromUrl, upgradeImageUrl } from '../src/lib/product-html.js';
import { normalizeProductUrl, TtlCache } from '../src/lib/product-reference-cache.js';
import { clearProductReferenceCache, readProductReference, readProductReferenceCached, type ProductReadDeps } from '../src/lib/product-reference-service.js';
import { validateUrl } from '../src/lib/ssrf.js';

const allowAll = async (url: string) => url;
const shell = '<html><head><title>Loading…</title></head><body><div id="root"></div></body></html>';
const deps = (over: Partial<ProductReadDeps> = {}): ProductReadDeps => ({
  readHtml: async (url) => ({ url, html: shell }),
  readJson: async () => { throw new Error('no json'); },
  render: async () => null,
  allowImage: allowAll,
  ...over,
});
const ld = (data: unknown) => `<script type="application/ld+json">${JSON.stringify(data)}</script>`;

// ---------------------------------------------------------------- structured data

test('JSON-LD: a single Product object, with the photo as a plain string', () => {
  const page = parseProductPage(`<html><head>${ld({ '@type': 'Product', name: 'Mini Wallet', image: 'https://cdn.shop.test/a.jpg' })}</head></html>`, 'https://shop.test/p/1');
  assert.deepEqual(page.images, ['https://cdn.shop.test/a.jpg']);
  assert.equal(page.signals.productJsonLd, true);
  assert.equal(page.signals.jsonLdImages, 1);
});

test('JSON-LD: a Product inside @graph, with photos as ImageObjects and an array', () => {
  const html = `<html><head>${ld({ '@context': 'https://schema.org', '@graph': [
    { '@type': 'Organization', name: 'Shop', logo: 'https://cdn.shop.test/logo.png' },
    { '@type': ['Product'], name: 'Wallet', image: [{ '@type': 'ImageObject', url: 'https://cdn.shop.test/1.jpg' }, { '@type': 'ImageObject', contentUrl: 'https://cdn.shop.test/2.jpg' }, 'https://cdn.shop.test/3.jpg'] },
  ] })}</head></html>`;
  const page = parseProductPage(html, 'https://shop.test/p/1');
  assert.deepEqual(page.images, ['https://cdn.shop.test/1.jpg', 'https://cdn.shop.test/2.jpg', 'https://cdn.shop.test/3.jpg']);   // several photos, never the organisation's logo
  assert.equal(page.title, 'Wallet');
});

test('JSON-LD: a ProductGroup picks the variant that matches the code in the link', () => {
  const html = `<html><head>${ld({ '@type': 'ProductGroup', name: 'Laurel Wallet', hasVariant: [
    { '@type': 'Product', sku: 'SG7459186-BLK', name: 'Laurel Wallet Black', image: ['https://cdn.shop.test/SG7459186-BLK_1.jpg'] },
    { '@type': 'Product', sku: 'SG7459186-BNN', name: 'Laurel Wallet Off White', image: ['https://cdn.shop.test/SG7459186-BNN_1.jpg', 'https://cdn.shop.test/SG7459186-BNN_2.jpg'] },
  ] })}</head></html>`;
  const page = parseProductPage(html, 'https://shop.test/en-us/wallets/laurel-mini-wallet-off-white/SG7459186-BNN.html');
  assert.equal(page.title, 'Laurel Wallet Off White');
  assert.deepEqual(page.images, ['https://cdn.shop.test/SG7459186-BNN_1.jpg', 'https://cdn.shop.test/SG7459186-BNN_2.jpg']);
});

test('og:image and twitter:image are the fallback when there is no structured data', () => {
  const html = '<html><head><meta property="og:title" content="Clay Mug"><meta property="og:image" content="/img/mug.jpg"><meta name="twitter:image" content="https://cdn.shop.test/mug-large.jpg"></head></html>';
  const page = parseProductPage(html, 'https://shop.test/mug');
  assert.deepEqual(page.images, ['https://shop.test/img/mug.jpg', 'https://cdn.shop.test/mug-large.jpg']);
  assert.equal(page.signals.ogImage, true);
  assert.equal(page.signals.titleFrom, 'social');
});

// ---------------------------------------------------------------- images

test('srcset: the largest candidate of a gallery image is used, and lazy-load attributes win over a placeholder src', () => {
  const html = `<html><body><h1>Wallet</h1>
    <img class="product-gallery" width="800" height="800" src="/ph.gif" srcset="https://cdn.shop.test/w_200.jpg 200w, https://cdn.shop.test/w_1200.jpg 1200w, https://cdn.shop.test/w_600.jpg 600w">
    <img class="product-gallery" src="data:image/gif;base64,AAAA" data-src="https://cdn.shop.test/second.jpg">
    <img src="https://cdn.shop.test/logo.png" class="site-logo"></body></html>`;
  const page = parseProductPage(html, 'https://shop.test/p/1');
  assert.deepEqual(page.images.slice(0, 2), ['https://cdn.shop.test/w_1200.jpg', 'https://cdn.shop.test/second.jpg']);
  assert.ok(!page.images.some((image) => /logo/.test(image)));
});

test('one photo served at several sizes is kept once, in its sharpest version', () => {
  const urls = [
    'https://cdn.shop.test/img/SG745918-BNN_1.jpg?sw=120',
    'https://cdn.shop.test/img/SG745918-BNN_2.jpg?sw=800',
    'https://cdn.shop.test/img/SG745918-BNN_1.jpg?sw=1600',
    'https://cdn.shop.test/img/SG745918-BNN_1.jpg?sw=400',
  ];
  assert.deepEqual(dedupeBestImages(urls), ['https://cdn.shop.test/img/SG745918-BNN_1.jpg?sw=1600', 'https://cdn.shop.test/img/SG745918-BNN_2.jpg?sw=800']);
  assert.ok(imageQuality('https://x.test/a.jpg') > imageQuality('https://x.test/a.jpg?w=300'));
});

test('known image CDNs are asked for a sharp size, unknown ones are left alone', () => {
  assert.equal(upgradeImageUrl('https://www.shop.test/dw/image/v2/ABC_PRD/on/demandware.static/-/Sites/default/x/SG-1.jpg?sw=200&sh=200'), 'https://www.shop.test/dw/image/v2/ABC_PRD/on/demandware.static/-/Sites/default/x/SG-1.jpg?sw=1200');
  assert.equal(upgradeImageUrl('https://unknown.test/a.jpg?w=200'), 'https://unknown.test/a.jpg?w=200');
});

test('page-script state: escaped gallery URLs for THIS product are found, banners and other products are not', () => {
  const html = `<html><head></head><body><script>window.__PRELOADED_STATE__={"product":{"id":"SG7459186-BNN","images":[
      "https:\\/\\/img.shop.test\\/dw\\/image\\/v2\\/X\\/SG7459186-BNN_1.jpg?sw=400",
      "https:\\u002F\\u002Fimg.shop.test\\u002Fdw\\u002Fimage\\u002Fv2\\u002FX\\u002FSG7459186-BNN_2.jpg"]},
    "banner":"https:\\/\\/img.shop.test\\/promo\\/summer-sale-banner.jpg","other":"https:\\/\\/img.shop.test\\/dw\\/image\\/v2\\/X\\/AB123456-BLK_1.jpg"};</script></body></html>`;
  const hints = productHintsFromUrl('https://shop.test/en-us/wallets/laurel-mini-wallet-off-white/SG7459186-BNN.html');
  assert.ok(hints.codes.includes('sg7459186bnn'));
  assert.deepEqual(inlineScriptImages(html, hints).sort(), [
    'https://img.shop.test/dw/image/v2/X/SG7459186-BNN_1.jpg?sw=400',
    'https://img.shop.test/dw/image/v2/X/SG7459186-BNN_2.jpg',
  ]);
  // and a page with nothing but that script state still yields photos
  const page = parseProductPage(html, 'https://shop.test/en-us/wallets/laurel-mini-wallet-off-white/SG7459186-BNN.html');
  assert.equal(page.images.length, 2);
  assert.ok(page.images.every((image) => /SG7459186-BNN/.test(image)));
  assert.equal(page.signals.embeddedState, true);
});

// ---------------------------------------------------------------- direct images

test('a direct image link is recognised by its extension (including avif) and by its content type', async () => {
  assert.equal(isDirectImageUrl('https://cdn.shop.test/a/b.avif'), true);
  assert.equal(isDirectImageUrl('https://shop.test/p/1'), false);
  const byExtension = await readProductReference('https://cdn.shop.test/a.webp', deps({ readHtml: async () => { throw new Error('must not read a picture as a page'); } }));
  assert.equal(byExtension.status, 'DIRECT_IMAGE');
  assert.deepEqual(byExtension.images, ['https://cdn.shop.test/a.webp']);
  // "Copy image address" on a CDN link that has no file extension: the answer's content type says it is a picture
  const byType = await readProductReference('https://cdn.shop.test/is/image/Brand/SG745918', deps({ readHtml: async (url) => ({ url, html: '', contentType: 'image/jpeg' }) }));
  assert.equal(byType.status, 'DIRECT_IMAGE');
  assert.deepEqual(byType.images, ['https://cdn.shop.test/is/image/Brand/SG745918']);
});

// ---------------------------------------------------------------- statuses, partial success, fallbacks

test('statuses say how the photos were found', async () => {
  const withLd = ld({ '@type': 'Product', name: 'Mug', image: ['https://cdn.shop.test/mug.jpg'] });
  assert.equal((await readProductReference('https://shop.test/a', deps({ readHtml: async (url) => ({ url, html: `<html><head>${withLd}</head></html>` }) }))).status, 'SUCCESS_JSONLD');
  assert.equal((await readProductReference('https://shop.test/b', deps({ readHtml: async (url) => ({ url, html: '<html><head><meta property="og:title" content="Mug"><meta property="og:image" content="https://cdn.shop.test/m.jpg"></head></html>' }) }))).status, 'SUCCESS_HTTP');
  assert.equal((await readProductReference('https://shop.test/c', deps({ readHtml: async (url) => ({ url, html: '<html><head><meta property="og:image" content="https://cdn.shop.test/m.jpg"></head></html>' }) }))).status, 'PARTIAL_SUCCESS');   // photos, but no name
  const rendered = await readProductReference('https://spa.test/i/1', deps({ render: async () => ({ url: 'https://spa.test/i/1', html: `<html><head>${withLd}</head></html>`, images: ['https://cdn.shop.test/painted.jpg'], status: 200 }) }));
  assert.equal(rendered.status, 'SUCCESS_PLAYWRIGHT');
});

test('browser fallback: the browser runs only when the plain page found no photos, and page state it captured is used', async () => {
  let renders = 0;
  const plain = await readProductReference('https://shop.test/ok', deps({
    readHtml: async (url) => ({ url, html: `<html><head>${ld({ '@type': 'Product', name: 'Mug', image: ['https://cdn.shop.test/mug.jpg'] })}</head></html>` }),
    render: async () => { renders += 1; return null; },
  }));
  assert.equal(plain.status, 'SUCCESS_JSONLD');
  assert.equal(renders, 0);   // never launched when the plain page was enough

  const spa = await readProductReference('https://spa.test/laurel/SG7459186-BNN.html', deps({
    render: async () => { renders += 1; return { url: 'https://spa.test/laurel/SG7459186-BNN.html', html: '<html><head><meta property="og:title" content="Laurel Wallet"></head></html>', images: [], status: 200, stateImages: ['https://img.spa.test/SG7459186-BNN_1.jpg'] }; },
  }));
  assert.equal(renders, 1);
  assert.equal(spa.status, 'SUCCESS_PLAYWRIGHT');
  assert.deepEqual(spa.images, ['https://img.spa.test/SG7459186-BNN_1.jpg']);
  assert.equal(spa.title, 'Laurel Wallet');
});

test('a page with a product but no usable photo keeps the name, description and facts it did find', async () => {
  const html = `<html><head>${ld({ '@type': 'Product', name: 'Laurel Mini Wallet', description: 'Faux-leather mini wallet.', brand: { name: 'Brand' }, offers: { price: '45.00', priceCurrency: 'USD' } })}</head></html>`;
  await assert.rejects(readProductReference('https://shop.test/p/1', deps({ readHtml: async (url) => ({ url, html }) })), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, 'PRODUCT_IMAGES_MISSING');
    assert.equal(error.details?.extractionStatus, 'NO_IMAGE_FOUND');
    assert.equal(error.details?.productName, 'Laurel Mini Wallet');
    assert.equal(error.details?.productDescription, 'Faux-leather mini wallet.');
    assert.deepEqual(JSON.parse(error.details?.productFacts ?? '{}'), { brand: 'Brand', price: '45.00', currency: 'USD' });
    return true;
  });
});

test('a page that is not a product page is NO_PRODUCT_FOUND, and a junk <title> is never kept as the product name', async () => {
  await assert.rejects(readProductReference('https://shop.test/blog', deps()), (error: unknown) =>
    error instanceof AppError && error.details?.extractionStatus === 'NO_PRODUCT_FOUND' && error.details?.productName === undefined);
});

test('the shop refusing is BLOCKED only after the browser also had its chance', async () => {
  let renders = 0;
  await assert.rejects(readProductReference('https://blocked.test/p/1', deps({
    readHtml: async () => { throw new AppError('x', 422, 'PRODUCT_BLOCKED'); },
    render: async () => { renders += 1; return { url: 'https://blocked.test/p/1', html: '<html><head><title>Access Denied</title></head></html>', images: [], status: 403 }; },
  })), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_BLOCKED' && error.details?.extractionStatus === 'BLOCKED');
  assert.equal(renders, 1);
});

test('timeout: a shop that never answers ends in TIMEOUT, keeping what was already found', async () => {
  const slow = ld({ '@type': 'Product', name: 'Slow Mug' });
  await assert.rejects(readProductReference('https://slow.test/p/1', deps({
    timeoutMs: 60,
    readHtml: async (url) => ({ url, html: `<html><head>${slow}</head></html>` }),
    render: () => new Promise(() => { /* never settles */ }),
  })), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_TIMEOUT' && error.details?.extractionStatus === 'TIMEOUT' && error.details?.productName === 'Slow Mug');
});

test('a link that is not a public web address is INVALID_URL, with no network and no browser used', async () => {
  let touched = false;
  const guarded = deps({ validateLink: validateUrl, readHtml: async () => { touched = true; return { url: '', html: '' }; }, render: async () => { touched = true; return null; } });
  for (const link of ['http://127.0.0.1/admin', 'http://169.254.169.254/latest/meta-data/', 'ftp://shop.test/a', 'javascript:alert(1)', 'data:text/html,hi']) {
    await assert.rejects(readProductReference(link, guarded), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_INVALID_URL' && error.status === 400, link);
  }
  assert.equal(touched, false);
});

// ---------------------------------------------------------------- SSRF and redirects

test('SSRF: private, loopback, link-local, metadata and non-web addresses are all refused', async () => {
  for (const link of [
    'http://localhost/', 'http://127.0.0.1/', 'http://127.1.2.3:8080/', 'http://[::1]/', 'http://10.0.0.5/', 'http://172.16.4.4/', 'http://192.168.1.1/',
    'http://169.254.169.254/latest/meta-data/', 'http://0.0.0.0/', 'http://[::ffff:10.0.0.1]/',
    'file:///etc/passwd', 'ftp://example.com/a', 'data:text/plain,hello', 'javascript:alert(1)',
  ]) {
    await assert.rejects(validateUrl(link), (error: unknown) => error instanceof Error && error.name === 'SsrfError', link);
  }
  assert.equal(await validateUrl('https://93.184.216.34/product'), 'https://93.184.216.34/product');
});

type FakeInit = { headers?: Record<string, string> };
function fakeResponse(status: number, headers: Record<string, string>, body = '', cookies: string[] = []) {
  const lower = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]));
  return {
    status, ok: status >= 200 && status < 300,
    headers: { get: (name: string) => lower[name.toLowerCase()] ?? null, getSetCookie: () => cookies },
    body: body ? new Response(body).body : { cancel: async () => {}, getReader: () => ({ read: async () => ({ done: true, value: undefined }), cancel: async () => {} }) },
  } as unknown as Response;
}
const realFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = realFetch; clearProductReferenceCache(); });

test('redirects are followed with browser-like headers, and the cookie a shop sets on the first hop is sent on the next', async () => {
  const seen: Array<{ url: string; headers: Record<string, string> }> = [];
  globalThis.fetch = (async (url: string, init: FakeInit) => {
    seen.push({ url: String(url), headers: init.headers ?? {} });
    if (seen.length === 1) return fakeResponse(302, { location: '/en-us/p/1' }, '', ['region=us; Path=/; Secure', 'sid=abc123; HttpOnly']);
    return fakeResponse(200, { 'content-type': 'text/html; charset=utf-8' }, '<html>ok</html>');
  }) as unknown as typeof fetch;
  const result = await readPublicUrl('https://93.184.216.34/p/1', 1_000_000, /^text\/html$/);
  assert.equal(result.buffer.toString(), '<html>ok</html>');
  assert.deepEqual(result.hops, ['93.184.216.34/p/1', '93.184.216.34/en-us/p/1']);
  assert.equal(seen[0].headers.Cookie, undefined);
  assert.equal(seen[1].headers.Cookie, 'region=us; sid=abc123');
  assert.match(seen[0].headers['User-Agent'], /Chrome\/\d+/);
  assert.doesNotMatch(seen[0].headers['User-Agent'], /AiWebVideo/);
  assert.equal(seen[0].headers['Sec-Fetch-Dest'], 'document');
  assert.match(seen[0].headers['Accept-Language'], /en-US/);
});

test('every redirect target is validated again: a shop cannot bounce the server to an internal address', async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return fakeResponse(302, { location: 'http://169.254.169.254/latest/meta-data/' }); }) as unknown as typeof fetch;
  await assert.rejects(readPublicUrl('https://93.184.216.34/p/1', 1_000_000, /^text\/html$/), (error: unknown) => error instanceof Error && error.name === 'SsrfError');
  assert.equal(calls, 1);   // the internal address was never requested
});

test('redirect loops stop at the limit, and an oversized or non-page answer is refused', async () => {
  let calls = 0;
  globalThis.fetch = (async () => { calls += 1; return fakeResponse(301, { location: '/again' }); }) as unknown as typeof fetch;
  await assert.rejects(readPublicUrl('https://93.184.216.34/p', 1_000_000, /^text\/html$/), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_READ_FAILED');
  assert.ok(calls <= 6);

  globalThis.fetch = (async () => fakeResponse(200, { 'content-type': 'application/pdf' }, '%PDF')) as unknown as typeof fetch;
  await assert.rejects(readPublicUrl('https://93.184.216.34/p', 1_000_000, /^text\/html$/), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_UNSUPPORTED_RESPONSE');

  globalThis.fetch = (async () => fakeResponse(200, { 'content-type': 'text/html', 'content-length': '99999999' }, 'x')) as unknown as typeof fetch;
  await assert.rejects(readPublicUrl('https://93.184.216.34/p', 1_000, /^text\/html$/), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_READ_FAILED');
});

test('a link whose answer is a picture is recognised without downloading it', async () => {
  globalThis.fetch = (async () => fakeResponse(200, { 'content-type': 'image/avif' })) as unknown as typeof fetch;
  const result = await readPublicUrl('https://93.184.216.34/img/42', 1_000, /^(?:text\/html|image\/(?:avif|webp))$/, { stopAtImage: true });
  assert.equal(result.mime, 'image/avif');
  assert.equal(result.buffer.length, 0);
});

// ---------------------------------------------------------------- cache

test('normalizeProductUrl: tracking tags, fragments, trailing slashes and host case do not make a new product', () => {
  const key = normalizeProductUrl('https://Shop.Test/p/mug?color=red&utm_source=mail&gclid=1#reviews');
  assert.equal(key, normalizeProductUrl('https://shop.test/p/mug/?utm_campaign=x&color=red'));
  assert.notEqual(key, normalizeProductUrl('https://shop.test/p/mug?color=blue'));
});

test('TtlCache: entries expire, and the oldest leave when it is full', () => {
  let now = 1_000;
  const cache = new TtlCache<string>(100, 2, () => now);
  cache.set('a', '1'); cache.set('b', '2'); cache.set('c', '3');
  assert.equal(cache.get('a'), undefined);   // pushed out by size
  assert.equal(cache.get('b'), '2');
  now += 101;
  assert.equal(cache.get('b'), undefined);   // expired
});

test('cache: a product read once is not read again (no second request, no second browser), whatever tags the link carries', async () => {
  clearProductReferenceCache();
  let reads = 0;
  const counting = deps({ readHtml: async (url) => { reads += 1; return { url, html: `<html><head>${ld({ '@type': 'Product', name: 'Mug', image: ['https://cdn.shop.test/mug.jpg'] })}</head></html>` }; } });
  const first = await readProductReferenceCached('https://shop.test/p/mug', counting);
  const second = await readProductReferenceCached('https://shop.test/p/mug/?utm_source=ad#top', counting);
  assert.equal(first.cached, false);
  assert.equal(second.cached, true);
  assert.equal(reads, 1);
  assert.deepEqual(second.images, first.images);
  assert.equal(second.extractedAt, first.extractedAt);
});

test('cache: simultaneous requests for one link share a single read', async () => {
  clearProductReferenceCache();
  let reads = 0;
  const slowOnce = deps({ readHtml: async (url) => { reads += 1; await new Promise((resolve) => setTimeout(resolve, 20)); return { url, html: `<html><head>${ld({ '@type': 'Product', name: 'Mug', image: ['https://cdn.shop.test/mug.jpg'] })}</head></html>` }; } });
  const results = await Promise.all([1, 2, 3].map(() => readProductReferenceCached('https://shop.test/p/shared', slowOnce)));
  assert.equal(reads, 1);
  assert.ok(results.every((result) => result.images.length === 1));
});

test('cache: a refused shop is remembered briefly so the browser is not started on every paste, but failures to reach it are not', async () => {
  clearProductReferenceCache();
  let renders = 0;
  const refused = deps({ readHtml: async () => { throw new AppError('x', 422, 'PRODUCT_BLOCKED'); }, render: async () => { renders += 1; return null; } });
  await assert.rejects(readProductReferenceCached('https://blocked.test/p/9', refused), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_BLOCKED');
  await assert.rejects(readProductReferenceCached('https://blocked.test/p/9', refused), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_BLOCKED');
  assert.equal(renders, 1);

  let tries = 0;
  const flaky = deps({ timeoutMs: 40, readHtml: async () => { tries += 1; throw new AppError('x', 422, 'PRODUCT_TIMEOUT'); } });
  await assert.rejects(readProductReferenceCached('https://flaky.test/p/1', flaky));
  await assert.rejects(readProductReferenceCached('https://flaky.test/p/1', flaky));
  assert.equal(tries, 2);   // a timeout is not remembered: the next paste tries again
});
