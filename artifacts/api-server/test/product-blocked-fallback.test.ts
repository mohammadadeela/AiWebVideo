import { test } from 'node:test';
import assert from 'node:assert/strict';
import { AppError } from '../src/lib/errors.js';
import { isDirectImageUrl, productNameFromUrl } from '../src/lib/product-html.js';
import { readProductReference, type ProductReadDeps } from '../src/lib/product-reference-service.js';

const AMAZON = 'https://www.amazon.com/Biodance-Bio-Collagen-Tightening-Hydrating-Molecular/dp/B0B2RM68G2/ref=sr_1_1?_encoding=UTF8&content-id=amzn1.sym.56d10b';
const wall = '<html><head><title>Robot Check</title></head><body>Enter the characters you see below</body></html>';
const deps = (over: Partial<ProductReadDeps> = {}): ProductReadDeps => ({
  readHtml: async (url) => ({ url, html: wall }),
  readJson: async () => { throw new Error('no json'); },
  render: async () => null,
  allowImage: async (url) => (/^https:\/\//.test(url) ? url : null),
  ...over,
});

test('the product name is read from the link, the way shops write it into it', () => {
  assert.equal(productNameFromUrl(AMAZON), 'Biodance Bio Collagen Tightening Hydrating Molecular');
  assert.equal(productNameFromUrl('https://shop.test/products/linen-shirt-navy'), 'Linen shirt navy');
  assert.equal(productNameFromUrl('https://shop.test/collections/summer/products/Clay_Mug_Blue.html'), 'Clay Mug Blue');
  assert.equal(productNameFromUrl('https://www.ebay.com/itm/1234567890'), '');                   // a bare id carries no name
  assert.equal(productNameFromUrl('https://shop.test/dp/B0B2RM68G2'), '');
  assert.equal(productNameFromUrl('not a url'), '');
  assert.ok(productNameFromUrl(`https://shop.test/${'a-'.repeat(200)}x/dp/1`).length <= 120);
  assert.doesNotMatch(productNameFromUrl('https://shop.test/<script>alert-1</script>-mug'), /[<>]/);
});

test('"Copy image address" links are recognised as pictures, ordinary pages are not', () => {
  assert.equal(isDirectImageUrl('https://m.media-amazon.com/images/I/71abcDEF._AC_SL1500_.jpg'), true);
  assert.equal(isDirectImageUrl('https://m.media-amazon.com/images/I/71abcDEF'), true);
  assert.equal(isDirectImageUrl('https://cdn.shop.test/mug.PNG'), true);
  assert.equal(isDirectImageUrl(AMAZON), false);
  assert.equal(isDirectImageUrl('https://www.amazon.com/images/'), false);
  assert.equal(isDirectImageUrl('ftp://cdn.shop.test/mug.jpg'), false);
  assert.equal(isDirectImageUrl('javascript:alert(1)'), false);
});

test('a pasted image address is used as the photo, without trying to read a page', async () => {
  let pagesRead = 0;
  const image = 'https://m.media-amazon.com/images/I/71abcDEF._AC_SL1500_.jpg';
  const result = await readProductReference(image, deps({ readHtml: async (url) => { pagesRead += 1; return { url, html: wall }; } }));
  assert.deepEqual(result.images, [image]);
  assert.equal(pagesRead, 0);
});

test('a shop that blocks reading still gives back the product name for the page to keep, with the same clear message', async () => {
  await assert.rejects(readProductReference(AMAZON, deps()), (error: unknown) => {
    assert.ok(error instanceof AppError);
    assert.equal(error.code, 'PRODUCT_BLOCKED');
    assert.match(error.message, /doesn't allow automatic reading/);
    assert.equal(error.details?.productName, 'Biodance Bio Collagen Tightening Hydrating Molecular');
    return true;
  });
  // a link with no name in it carries no name
  await assert.rejects(readProductReference('https://shop.test/itm/123456', deps()), (error: unknown) => error instanceof AppError && error.code === 'PRODUCT_BLOCKED' && error.details?.productName === undefined && error.details?.extractionStatus === 'BLOCKED');
});

test('error details reach the page, and cannot override the error or its code', async () => {
  const { sendError } = await import('../src/lib/errors.js');
  const captured: { status?: number; body?: Record<string, unknown> } = {};
  const res = { locals: {}, status(code: number) { captured.status = code; return this; }, json(body: Record<string, unknown>) { captured.body = body; return this; } };
  sendError(res as never, new AppError('Blocked.', 422, 'PRODUCT_BLOCKED', { productName: 'Clay Mug', error: 'hijack', code: 'HIJACK' }));
  assert.equal(captured.status, 422);
  assert.equal(captured.body?.productName, 'Clay Mug');
  assert.equal(captured.body?.error, 'Blocked.');
  assert.equal(captured.body?.code, 'PRODUCT_BLOCKED');
});
