import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approveLink, PRODUCTS as PAYPAL_PRODUCTS } from '../src/routes/paypal.js';
import { PRODUCTS as STRIPE_PRODUCTS } from '../src/routes/stripe.js';

/**
 * approveLink() parses PayPal's real response shapes — both the Orders v2
 * `rel: "approve"` link (one-time payments) and the Subscriptions API's
 * `rel: "approve"` link are covered here; `payer-action` is included too
 * since some PayPal flows (e.g. an AUTHORIZE intent, or certain funding
 * sources) return that rel name instead.
 */

test('approveLink finds the approve link in a real Orders v2 create-order response shape', () => {
  const links = [
    { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T', rel: 'self', method: 'GET' },
    { href: 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T', rel: 'approve', method: 'GET' },
    { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T', rel: 'update', method: 'PATCH' },
    { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T/capture', rel: 'capture', method: 'POST' },
  ];
  assert.equal(approveLink(links), 'https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T');
});

test('approveLink finds the approve link in a real Subscriptions API create-subscription response shape', () => {
  const links = [
    { href: 'https://api-m.sandbox.paypal.com/v1/billing/subscriptions/I-BW452GLLEP1G', rel: 'self', method: 'GET' },
    { href: 'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-2M539689T3856352J', rel: 'approve', method: 'GET' },
    { href: 'https://api-m.sandbox.paypal.com/v1/billing/subscriptions/I-BW452GLLEP1G/cancel', rel: 'cancel', method: 'POST' },
  ];
  assert.equal(approveLink(links), 'https://www.sandbox.paypal.com/webapps/billing/subscriptions?ba_token=BA-2M539689T3856352J');
});

test('approveLink falls back to payer-action rel when approve is absent', () => {
  const links = [
    { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/abc', rel: 'self', method: 'GET' },
    { href: 'https://www.sandbox.paypal.com/payer-action?token=abc', rel: 'payer-action', method: 'GET' },
  ];
  assert.equal(approveLink(links), 'https://www.sandbox.paypal.com/payer-action?token=abc');
});

test('approveLink returns null for malformed/missing links', () => {
  assert.equal(approveLink(undefined), null);
  assert.equal(approveLink([]), null);
  assert.equal(approveLink([{ href: 'x', rel: 'self' }]), null);
});

test('PayPal and Stripe charge identical credits for every matching product', () => {
  for (const id of Object.keys(STRIPE_PRODUCTS) as Array<keyof typeof STRIPE_PRODUCTS>) {
    const stripeProduct = STRIPE_PRODUCTS[id];
    const paypalProduct = PAYPAL_PRODUCTS[id as keyof typeof PAYPAL_PRODUCTS];
    assert.ok(paypalProduct, `PayPal is missing a product for "${id}" that exists in Stripe`);
    assert.equal(paypalProduct.credits, stripeProduct.credits, `"${id}": PayPal (${paypalProduct.credits} credits) and Stripe (${stripeProduct.credits} credits) must charge the same credits for the same product`);
    assert.equal(paypalProduct.plan, stripeProduct.plan, `"${id}": plan mismatch between providers`);
    assert.equal(paypalProduct.mode, stripeProduct.mode, `"${id}": mode mismatch between providers`);
  }
});

test('every PayPal product catalog entry has a real, positive USD amount', () => {
  for (const [id, product] of Object.entries(PAYPAL_PRODUCTS)) {
    assert.ok(product.amountUsd > 0, `"${id}" must have a positive amountUsd`);
    assert.ok(product.credits > 0, `"${id}" must grant a positive number of credits`);
  }
});
