import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function source(relativePath: string) {
  return readFile(path.resolve(process.cwd(), relativePath), 'utf8');
}

test('embedded subscriptions require vault-backed stored credentials and keep prices server-owned', async () => {
  const server = await source('src/routes/paypal-card-subscriptions.ts');
  assert.match(server, /PAYPAL_VAULT_ENABLED/);
  assert.match(server, /PAYPAL_ADVANCED_CARDS_ENABLED/);
  assert.match(server, /store_in_vault: 'ON_SUCCESS'/);
  assert.match(server, /stored_credential/);
  assert.match(server, /payment_initiator: 'CUSTOMER'/);
  assert.match(server, /payment_initiator: 'MERCHANT'/);
  assert.match(server, /usage: 'FIRST'/);
  assert.match(server, /usage: 'SUBSEQUENT'/);
  assert.match(server, /const product = PRODUCTS\[input\.plan\]/);
  assert.doesNotMatch(server, /req\.body\.credits/);
});

test('managed recurring billing is authenticated, idempotent and database locked', async () => {
  const server = await source('src/routes/paypal-card-subscriptions.ts');
  const routes = await source('src/routes/index.ts');
  assert.match(server, /requireAuth/);
  assert.match(server, /subscription-return\/:sessionId/);
  assert.match(server, /pg_try_advisory_lock/);
  assert.match(server, /pg_advisory_lock/);
  assert.match(server, /paypal_managed_subscription_renewals/);
  assert.match(server, /paypal:managed-renewal:/);
  assert.match(server, /billing_source='paypal_card'/);
  assert.match(routes, /paypalManagedSubscriptionRouter/);
  assert.match(routes, /paypalCardSubscriptionRouter/);
});

test('deploy migration provisions recurring subscription schema before restart', async () => {
  const migration = await source('db/managed-subscriptions.sql');
  const runner = await source('db/migrate.mjs');
  for (const required of [
    'billing_source',
    'payment_method_id',
    'renewal_amount_usd',
    'last_provider_order_id',
    'paypal_managed_subscription_intents',
    'paypal_managed_subscription_returns',
    'paypal_managed_subscription_renewals',
  ]) assert.match(migration, new RegExp(required));
  assert.match(runner, /managed-subscriptions\.sql/);
  assert.match(runner, /await client\.query\(managedSubscriptionsSql\)/);
});

test('paid managed subscriptions are reconciled if the process dies before granting credits', async () => {
  const repair = await source('src/lib/managed-subscription-reconciliation.ts');
  const index = await source('src/index.ts');
  assert.match(repair, /paypal:order:/);
  assert.match(repair, /paypal:managed-renewal:/);
  assert.match(repair, /credit_grants/);
  assert.match(repair, /grantCreditsOnce/);
  assert.match(repair, /5 \* 60_000/);
  assert.match(index, /startManagedSubscriptionReconciliation\(\)/);
});

test('generic capture webhook cannot double-grant managed renewal credits', async () => {
  const guard = await source('src/lib/subscription-billing-guards.ts');
  const index = await source('src/index.ts');
  assert.match(guard, /aiwebvideo_guard_managed_renewal_credit/);
  assert.match(guard, /NEW\.grant_key LIKE 'paypal:order:%'/);
  assert.match(guard, /p\.kind='subscription_renewal'/);
  assert.match(guard, /RETURN NULL/);
  assert.match(guard, /BEFORE INSERT ON credit_grants/);
  assert.match(index, /ensureSubscriptionReceiptGuard\(\)/);
});

test('temporary Quick Video payment test price is one dollar on server and both purchase UIs', async () => {
  const pricing = await source('../aiwebvideo/src/components/landing/PricingTable.tsx');
  const paywall = await source('../aiwebvideo/src/components/chat/PaywallModal.tsx');
  const override = await source('src/lib/payment-test-pricing.ts');
  const index = await source('src/index.ts');
  assert.match(override, /QUICK_VIDEO_TEST_PRICE_USD = 1/);
  assert.match(override, /PRODUCTS\.single8/);
  assert.match(index, /applyTemporaryPaymentTestPricing\(\)/);
  assert.match(pricing, /price: "\$1\.00"/);
  assert.match(pricing, /amountUsd: 1/);
  assert.match(paywall, /single8[^\n]*amountUsd: 1/);
});

test('checkout UX prewarms payment SDK and uses customer-friendly security copy', async () => {
  const checkout = await source('../aiwebvideo/src/components/billing/SecureCheckoutModal.tsx');
  assert.match(checkout, /prewarm/);
  assert.match(checkout, /font-size': '18px'/);
  assert.match(checkout, /buttonColor: 'white'/);
  assert.match(checkout, /Your payment details are encrypted in transit and securely processed/);
  assert.doesNotMatch(checkout, /Card data is entered in PayPal-hosted fields/);
});
