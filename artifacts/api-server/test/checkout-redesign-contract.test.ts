import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const modal = () => readFile(path.resolve(process.cwd(), '../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx'), 'utf8');

test('checkout keeps the hosted card fields the payment provider mounts into', async () => {
  const source = await modal();
  for (const id of ['aiwebvideo-card-name', 'aiwebvideo-card-number', 'aiwebvideo-card-expiry', 'aiwebvideo-card-cvv']) {
    assert.match(source, new RegExp(`id="${id}"`), `${id} container`);
  }
  assert.match(source, /waitForCardFieldContainers/);
});

test('checkout is one compact column with a clear total and a Buy action', async () => {
  const source = await modal();
  assert.match(source, /sm:max-w-\[460px\]/);
  assert.match(source, /Buy \{money\(checkoutTotal\)\}/);
  assert.match(source, /processing fee/);
  assert.match(source, /Payment complete/);
  assert.match(source, /Subscription active/);
});

test('saved cards are drawn in their network colours with the pay action on the card', async () => {
  const source = await modal();
  assert.match(source, /BRAND_STYLE/);
  assert.match(source, /visa: 'from-/);
  assert.match(source, /mastercard: 'from-/);
  assert.match(source, /function SavedCardTile/);
  assert.match(source, /Pay \{total\}/);
  assert.match(source, /Remove \$\{method\.brand\} ending in/);
});

test('save-card uses a switch (not a native checkbox) and only an opaque saved-card id is kept in the browser', async () => {
  const source = await modal();
  assert.match(source, /role="switch"/);
  assert.match(source, /Save this card/);
  assert.doesNotMatch(source, /type="checkbox"/);
  // The only thing ever kept in the browser is the opaque id of the preferred saved card.
  assert.doesNotMatch(source, /sessionStorage/);
  assert.doesNotMatch(source, /localStorage\.setItem\((?!PREFERRED_METHOD_KEY)/);
  assert.match(source, /We never see or store them/);
});
