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
  const responseStart = text.indexOf('methods: rows.map((row) => ({');
  assert.notEqual(responseStart, -1);
  const responseEnd = text.indexOf('})),', responseStart);
  assert.notEqual(responseEnd, -1);
  const responseBlock = text.slice(responseStart, responseEnd + 4);
  assert.match(responseBlock, /id: row\.id/);
  assert.match(responseBlock, /brand: row\.brand/);
  assert.match(responseBlock, /lastDigits: row\.last_digits/);
  assert.match(responseBlock, /expiry: row\.expiry/);
  assert.doesNotMatch(responseBlock, /provider_token_ref|vault_id|providerTokenRef/i);
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

test('one-time pricing and generation paywall use the in-app checkout modal and Buy labels', async () => {
  const pricing = await source('../aiwebvideo/src/components/landing/PricingTable.tsx');
  const paywall = await source('../aiwebvideo/src/components/chat/PaywallModal.tsx');
  assert.match(pricing, /SecureCheckoutModal/);
  assert.match(pricing, /setDirectCheckout/);
  assert.match(paywall, /SecureCheckoutModal/);
  assert.match(paywall, /setDirectCheckout/);
  assert.doesNotMatch(pricing, /Pay securely/);
  assert.doesNotMatch(paywall, /Pay securely/);
  assert.match(pricing, /label = "Buy"/);
  assert.match(paywall, />Buy</);
});

test('subscription checkout reuses the embedded checkout and keeps PayPal only as fallback', async () => {
  const pricing = await source('../aiwebvideo/src/components/landing/PricingTable.tsx');
  const paywall = await source('../aiwebvideo/src/components/chat/PaywallModal.tsx');
  const subscription = await source('../aiwebvideo/src/components/billing/SubscriptionCheckoutModal.tsx');
  const checkout = await source('../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx');
  const server = await source('src/routes/paypal-card-subscriptions.ts');
  assert.match(pricing, /SubscriptionCheckoutModal/);
  assert.match(paywall, /SubscriptionCheckoutModal/);
  assert.match(subscription, /SecureCheckoutModal/);
  assert.match(subscription, /billingMode="subscription"/);
  assert.match(checkout, /\/api\/paypal-card\/subscription-orders/);
  assert.match(checkout, /startCheckout\(plan, jobId\)/);
  assert.match(server, /subscription-return\/:sessionId/);
  assert.doesNotMatch(subscription, /window\.open/);
});

test('PayPal remains a fallback while raw card data stays outside AiWebVideo storage', async () => {
  const client = await source('../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx');
  assert.match(client, /Buy with PayPal/);
  assert.match(client, /startCheckout\(plan, jobId\)/);
  assert.match(client, /paypal\.CardFields/);
  assert.doesNotMatch(client, /Card number and CVV never touch AiWebVideo servers/);
});


test('one-time saved cards are explicitly treated as subsequent customer stored credentials', async () => {
  const server = await source('src/routes/paypal-card.ts');
  assert.match(server, /vault_id: tokenRef/);
  assert.match(server, /payment_initiator: 'CUSTOMER'/);
  assert.match(server, /payment_type: 'ONE_TIME'/);
  assert.match(server, /usage: 'SUBSEQUENT'/);
});

test('delayed PayPal vault creation is subscribed and persisted for the matching customer', async () => {
  const paypal = await source('src/routes/paypal.ts');
  assert.match(paypal, /VAULT\.PAYMENT-TOKEN\.CREATED/);
  assert.match(paypal, /VAULT\.PAYMENT-TOKEN\.DELETED/);
  assert.match(paypal, /merchant_customer_id/);
  assert.match(paypal, /paypal_customer_id/);
  assert.match(paypal, /paypal_saved_payment_methods/);
  assert.match(paypal, /handleVaultPaymentTokenCreated/);
});
