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

test('checkout resets stale hosted-field state and shows a customer-safe load error', async () => {
  const checkout = await frontendSource('src/components/billing/SecureCheckoutModal.tsx');

  assert.match(checkout, /setCardEligible\(false\)/);
  assert.match(checkout, /cardFieldsRef\.current = null/);
  assert.match(checkout, /Secure card fields could not load\. Please try again or continue with PayPal\./);
  assert.doesNotMatch(checkout, /setError\(errorMessage\(bootstrapError\)\)/);
});
