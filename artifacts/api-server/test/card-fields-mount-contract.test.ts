import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function frontendSource(relativePath: string) {
  return readFile(path.resolve(process.cwd(), '../aiwebvideo', relativePath), 'utf8');
}

test('PayPal hosted card fields wait for React containers before rendering', async () => {
  const checkout = await frontendSource('src/components/billing/SecureCheckoutModal.tsx');

  assert.match(checkout, /CARD_FIELD_SELECTORS/);
  assert.match(checkout, /waitForCardFieldContainers/);
  assert.match(checkout, /setCardEligible\(true\);[\s\S]{0,500}setLoading\(false\);[\s\S]{0,500}await waitForCardFieldContainers\(\);/);
  assert.match(checkout, /NameField[\s\S]{0,300}#aiwebvideo-card-name/);
  assert.match(checkout, /NumberField[\s\S]{0,300}#aiwebvideo-card-number/);
  assert.match(checkout, /ExpiryField[\s\S]{0,300}#aiwebvideo-card-expiry/);
  assert.match(checkout, /CVVField[\s\S]{0,300}#aiwebvideo-card-cvv/);
});

test('checkout resets stale hosted-field state and hides raw DOM/provider bootstrap errors', async () => {
  const checkout = await frontendSource('src/components/billing/SecureCheckoutModal.tsx');

  assert.match(checkout, /setCardEligible\(false\)/);
  assert.match(checkout, /cardFieldsRef\.current = null/);
  assert.match(checkout, /Card fields could not load\. Try again or use PayPal\./);
  assert.doesNotMatch(checkout, /setError\(errorMessage\(bootstrapError\)\)/);
  assert.doesNotMatch(checkout, /Document is ready and element/);
});

test('checkout keeps the customer copy concise and uses Buy actions', async () => {
  const checkout = await frontendSource('src/components/billing/SecureCheckoutModal.tsx');

  assert.match(checkout, />Checkout</);
  assert.match(checkout, /Buy \$\{money\(amountUsd\)\}/);
  assert.match(checkout, /Buy with PayPal/);
  assert.doesNotMatch(checkout, /Pay without leaving AiWebVideo/);
  assert.doesNotMatch(checkout, /Secure hosted card fields can use/);
  assert.doesNotMatch(checkout, /Card number and CVV never touch AiWebVideo servers/);
});
