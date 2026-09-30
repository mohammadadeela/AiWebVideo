import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

async function frontend(relativePath: string) {
  return readFile(path.resolve(process.cwd(), '../aiwebvideo', relativePath), 'utf8');
}

test('one-time checkout uses a compact responsive layout with explicit success and error states', async () => {
  const source = await frontend('src/components/billing/SecureCheckoutModal.tsx');
  assert.match(source, /sm:max-w-\[460px\]/);
  assert.match(source, /PaymentState = 'idle' \| 'processing' \| 'success' \| 'error'/);
  assert.match(source, /bg-emerald-500/);
  assert.match(source, /bg-rose-500/);
  assert.match(source, /\{money\(success\.amountUsd\)\} paid/);
  assert.match(source, /Try again · Buy/);
  assert.match(source, /Security code/);
  assert.match(source, /buttonType: 'buy'/);
  assert.match(source, /or pay with a card/);
  assert.doesNotMatch(source, /Buy with PayPal|continueWithPayPal/);
});

test('checkout exposes save-card only when PayPal vault is enabled and keeps saved cards reusable', async () => {
  const source = await frontend('src/components/billing/SecureCheckoutModal.tsx');
  assert.match(source, /config\?\.vaultEnabled/);
  assert.match(source, /Save this card/);
  assert.match(source, /payWithSavedCard/);
  assert.match(source, /Saved cards/);
  assert.match(source, /PREFERRED_METHOD_KEY/);
});

test('profile renders a dedicated saved-card manager without exposing provider tokens', async () => {
  const profile = await frontend('src/pages/ProfilePage.tsx');
  const panel = await frontend('src/components/account/SavedCardsPanel.tsx');
  assert.match(profile, /<SavedCardsPanel \/>/);
  assert.match(panel, /\/api\/paypal-card\/methods/);
  assert.match(panel, /Confirm remove/);
  assert.match(panel, /Save this card/);
  assert.doesNotMatch(panel, /provider_token_ref|vault_id|cardNumber|cvv/i);
});

test('subscription checkout reuses the embedded checkout UI and visual states', async () => {
  const subscription = await frontend('src/components/billing/SubscriptionCheckoutModal.tsx');
  const checkout = await frontend('src/components/billing/SecureCheckoutModal.tsx');
  assert.match(subscription, /SecureCheckoutModal/);
  assert.match(subscription, /billingMode="subscription"/);
  assert.match(checkout, /sm:max-w-\[460px\]/);
  assert.match(checkout, /Subscription active/);
  assert.match(checkout, /bg-emerald-500/);
  assert.match(checkout, /bg-rose-500/);
  assert.match(checkout, /Card details go straight to the payment processor/);
  assert.doesNotMatch(subscription, /writeCheckoutPlaceholder|window\.open/);
});

test('card fields render as one clean input surface without nested provider boxes', async () => {
  const source = await frontend('src/components/billing/SecureCheckoutModal.tsx');
  assert.match(source, /background: 'transparent'/);
  assert.match(source, /border: '0'/);
  assert.match(source, /borderRadius: '0'/);
  assert.match(source, /boxShadow: 'none'/);
  assert.match(source, /className="h-\[52px\] overflow-hidden rounded-2xl border/);
  assert.doesNotMatch(source, /p-px.*bg-\[#f8f7fb\]/);
});
