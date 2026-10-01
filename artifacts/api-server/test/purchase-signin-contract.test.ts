import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { PENDING_PURCHASE_MAX_AGE_MS, parsePendingPurchase } from '../../aiwebvideo/src/lib/pendingPurchase.js';

const fe = (file: string) => readFile(path.resolve(process.cwd(), '../aiwebvideo/src', file), 'utf8');

test('a waiting purchase is only accepted when it is a real product, fresh, and well formed', () => {
  const now = 1_000_000_000_000;
  const saved = (value: object) => JSON.stringify(value);
  assert.deepEqual(parsePendingPurchase(saved({ kind: 'pack', id: 'topup100', savedAt: now - 1000 }), now), { kind: 'pack', id: 'topup100' });
  assert.deepEqual(parsePendingPurchase(saved({ kind: 'plan', id: 'pro', savedAt: now - 1000 }), now), { kind: 'plan', id: 'pro' });
  assert.equal(parsePendingPurchase(saved({ kind: 'pack', id: 'topup100', savedAt: now - PENDING_PURCHASE_MAX_AGE_MS - 1 }), now), null, 'stale');
  assert.equal(parsePendingPurchase(saved({ kind: 'pack', id: 'free-money', savedAt: now }), now), null, 'unknown product');
  assert.equal(parsePendingPurchase(saved({ kind: 'plan', id: 'topup50', savedAt: now }), now), null, 'plan id must be a plan');
  assert.equal(parsePendingPurchase(saved({ kind: 'pack', id: 'topup50' }), now), null, 'no timestamp');
  assert.equal(parsePendingPurchase('{not json', now), null);
  assert.equal(parsePendingPurchase(null, now), null);
});

test('Buy and Subscribe on the pricing page ask a signed-out visitor to sign in first, then open that same purchase', async () => {
  const table = await fe('components/landing/PricingTable.tsx');
  assert.match(table, /async function requestPurchase\(choice: PendingPurchase\)/);
  assert.match(table, /fetchMe\(\)\.then\(\(\) => true\)\.catch\(\(\) => false\)/);   // server-checked at click time
  assert.match(table, /savePendingPurchase\(choice\);\s*setShowAuth\(true\);/);
  assert.match(table, /takePendingPurchase\(\)/);                                        // resumed after sign-in or a reload
  assert.match(table, /clearPendingPurchase\(\); setShowAuth\(false\)/);                // closing the window cancels it
  assert.equal((table.match(/void requestPurchase\(/g) ?? []).length, 3);               // credit packs, one-video packs, plans
  assert.doesNotMatch(table, /onClick=\{\(\) => setDirectCheckout\(/);
  assert.doesNotMatch(table, /onClick=\{\(\) => setSubscriptionCheckout\(/);
});

test('a signed-in visitor is never sent to the sign-in window by a feature card or a gallery example', async () => {
  const form = await fe('components/chat/WebsiteBriefForm.tsx');
  // The listeners are registered once, so they must call the LATEST handler through a ref, not the first render's.
  assert.match(form, /const applyIntentRef = useRef\(applyIntent\);\s*applyIntentRef\.current = applyIntent;/);
  assert.match(form, /if \(intent\) applyIntentRef\.current\(intent, true\);/);
  assert.match(form, /applyIntentRef\.current\(sample\.feature, true\);/);
  assert.doesNotMatch(form, /if \(intent\) applyIntent\(intent, true\);/);
});

test('a malformed saved-cards reply cannot crash checkout', async () => {
  assert.match(await fe('components/billing/SecureCheckoutModal.tsx'), /Array\.isArray\(methodsResponse\.methods\) \? methodsResponse\.methods : \[\]/);
});
