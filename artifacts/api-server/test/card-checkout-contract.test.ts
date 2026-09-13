import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('embedded card checkout is authenticated and restricted to server-owned one-time products', async () => {
  const text = await source('src/routes/paypal-card.ts');
  assert.match(text, /router\.get\('\/config', requireAuth/);
  assert.match(text, /router\.get\('\/methods', requireAuth/);
  assert.match(text, /router\.post\('\/orders', requireAuth/);
  assert.match(text, /router\.post\('\/orders\/:orderId\/capture', requireAuth/);
  assert.match(text, /router\.get\('\/return\/:sessionId', requireAuth/);
  assert.match(text, /ONE_TIME_PRODUCT_IDS/);
  assert.match(text, /z\.enum\(ONE_TIME_PRODUCT_IDS\)/);
  assert.match(text, /const product = PRODUCTS\[input\.plan\]/);
  assert.match(text, /expectedAmountUsd/);
  assert.match(text, /PRICE_CHANGED/);
  assert.match(text, /allowCheckout/);
  assert.match(text, /RATE_LIMITED/);
});

test('card checkout never trusts browser credit grants or payment amounts', async () => {
  const text = await source('src/routes/paypal-card.ts');
  assert.match(text, /currentCheckoutAmount\(req\.user!\.id, input\.plan\)/);
  assert.match(text, /product\.credits/);
  assert.match(text, /amount: \{ currency_code: 'USD', value: pricing\.amountUsd\.toFixed\(2\) \}/);
  assert.match(text, /validateCompletedOrder/);
  assert.match(text, /grantCreditsOnce/);
  assert.match(text, /paypal:order:\$\{orderId\}/);
  assert.doesNotMatch(text, /req\.body\.credits/);
});

test('new card checkout delegates PCI data and required authentication to PayPal', async () => {
  const server = await source('src/routes/paypal-card.ts');
  const client = await source('../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx');
  assert.match(server, /SCA_WHEN_REQUIRED/);
  assert.match(server, /store_in_vault: 'ON_SUCCESS'/);
  assert.match(client, /paypal\.CardFields/);
  assert.match(client, /NumberField/);
  assert.match(client, /ExpiryField/);
  assert.match(client, /CVVField/);
  assert.doesNotMatch(client, /useState\([^\n]*(?:cardNumber|cvv|cvc|expiry)/i);
  assert.doesNotMatch(client, /document\.cookie/i);
});

test('saved cards expose only opaque local aliases and masked metadata to the browser', async () => {
  const text = await source('src/routes/paypal-card.ts');
  assert.match(text, /paypal_saved_payment_methods/);
  assert.match(text, /provider_token_ref/);
  assert.match(text, /id: row\.id/);
  assert.match(text, /lastDigits: row\.last_digits/);
  assert.doesNotMatch(text, /methods: rows\.map[\s\S]{0,500}provider_token_ref/);
  assert.match(text, /WHERE id=\$1 AND user_id=\$2 AND provider='paypal'/);
  assert.match(text, /PAYMENT_METHOD_OWNERSHIP_MISMATCH/);
  assert.match(text, /paypal_saved_payment_methods\.user_id=EXCLUDED\.user_id/);
});

test('saved-card and Google Pay verification contingencies are handled instead of blindly capturing', async () => {
  const server = await source('src/routes/paypal-card.ts');
  const client = await source('../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx');
  assert.match(server, /google_pay/);
  assert.match(server, /payerActionRequired/);
  assert.match(server, /payerActionUrl/);
  assert.match(server, /paypal_card_checkout_sessions/);
  assert.match(client, /initiatePayerAction/);
  assert.match(client, /PAYER_ACTION_REQUIRED/);
  assert.match(client, /order\.payerActionRequired/);
  assert.match(client, /window\.location\.href = order\.payerActionUrl/);
});

test('only a non-sensitive preferred alias may be remembered locally', async () => {
  const client = await source('../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx');
  assert.match(client, /PREFERRED_METHOD_KEY/);
  assert.match(client, /preferred-payment-method/);
  const localWrites = [...client.matchAll(/localStorage\.setItem\(([^\n]+)\)/g)].map((match) => match[1]);
  assert.ok(localWrites.length > 0);
  for (const write of localWrites) {
    assert.match(write, /PREFERRED_METHOD_KEY/);
    assert.doesNotMatch(write, /(?:cvv|cvc|expiry|cardNumber|vaultId|provider_token_ref)/i);
  }
});

test('one-time pricing and generation paywall use the in-app secure checkout modal', async () => {
  const pricing = await source('../aiwebvideo/src/components/landing/PricingTable.tsx');
  const paywall = await source('../aiwebvideo/src/components/chat/PaywallModal.tsx');
  assert.match(pricing, /SecureCheckoutModal/);
  assert.match(pricing, /setDirectCheckout/);
  assert.match(paywall, /SecureCheckoutModal/);
  assert.match(paywall, /setDirectCheckout/);
  assert.match(paywall, /chooseSubscription/);
});

test('PayPal remains an explicit fallback while card details stay off AiWebVideo storage', async () => {
  const client = await source('../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx');
  assert.match(client, /Continue with PayPal instead/);
  assert.match(client, /startCheckout\(plan, jobId\)/);
  assert.match(client, /No card details stored by AiWebVideo/);
  assert.match(client, /Card number and CVV never touch AiWebVideo servers/);
});
