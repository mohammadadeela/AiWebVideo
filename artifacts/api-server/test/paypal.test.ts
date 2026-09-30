import { test } from 'node:test';
import assert from 'node:assert/strict';
import { approveLink, normalizePayPalEnvironment, PRODUCTS, validateCompletedOrder } from '../src/routes/paypal.js';

test('checkout environment accepts documented values and safe aliases', () => {
  assert.equal(normalizePayPalEnvironment('live'), 'live');
  assert.equal(normalizePayPalEnvironment(' LIVE '), 'live');
  assert.equal(normalizePayPalEnvironment('production'), 'live');
  assert.equal(normalizePayPalEnvironment('sandbox'), 'sandbox');
  assert.equal(normalizePayPalEnvironment(undefined), 'sandbox');
});

test('approveLink accepts official checkout links and rejects arbitrary hosts', () => {
  const links = [
    { href: 'https://api-m.sandbox.paypal.com/v2/checkout/orders/ORDER-123', rel: 'self', method: 'GET' },
    { href: 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123', rel: 'approve', method: 'GET' },
  ];
  assert.equal(approveLink(links), 'https://www.sandbox.paypal.com/checkoutnow?token=ORDER-123');
  assert.equal(approveLink([{ href: 'https://paypal.com.attacker.example/checkout', rel: 'approve' }]), null);
  assert.equal(approveLink([{ href: 'javascript:alert(1)', rel: 'approve' }]), null);
  assert.equal(approveLink(undefined), null);
});

test('approveLink supports payer-action when approve is absent', () => {
  assert.equal(
    approveLink([{ href: 'https://www.paypal.com/payer-action?token=ORDER-123', rel: 'payer-action' }]),
    'https://www.paypal.com/payer-action?token=ORDER-123',
  );
});

function completedOrder(overrides: Record<string, unknown> = {}) {
  return {
    id: 'ORDER-12345678',
    status: 'COMPLETED',
    payer: { payer_id: 'PAYER-123' },
    purchase_units: [{
      custom_id: 'user-123',
      payments: { captures: [{
        id: 'CAPTURE-123',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '9.99' },
      }] },
    }],
    ...overrides,
  };
}

const expected = { orderId: 'ORDER-12345678', userId: 'user-123', amountUsd: 9.99, currency: 'USD' };

test('completed orders require an exact account, amount, currency, and capture', () => {
  assert.deepEqual(validateCompletedOrder(completedOrder(), expected), { captureId: 'CAPTURE-123', payerId: 'PAYER-123' });
});

test('tampered or incomplete orders cannot grant credits', () => {
  assert.throws(() => validateCompletedOrder(completedOrder({ status: 'APPROVED' }), expected));
  assert.throws(() => validateCompletedOrder(completedOrder({ id: 'OTHER-ORDER' }), expected));
  assert.throws(() => validateCompletedOrder(completedOrder({ purchase_units: [{ custom_id: 'other-user', payments: { captures: [] } }] }), expected));
  assert.throws(() => validateCompletedOrder(completedOrder({ purchase_units: [{ custom_id: 'user-123', payments: { captures: [{ id: 'CAPTURE-123', status: 'COMPLETED', amount: { currency_code: 'USD', value: '0.01' } }] } }] }), expected));
  assert.throws(() => validateCompletedOrder(completedOrder({ purchase_units: [{ custom_id: 'user-123', payments: { captures: [{ id: 'CAPTURE-123', status: 'COMPLETED', amount: { currency_code: 'EUR', value: '9.99' } }] } }] }), expected));
});

test('the server-owned product catalog has fixed valid prices and credit grants', () => {
  assert.deepEqual(Object.keys(PRODUCTS), ['creator', 'pro', 'agency', 'single8', 'single48', 'single144', 'topup50', 'topup100', 'topup250']);
  for (const [id, product] of Object.entries(PRODUCTS)) {
    assert.ok(product.amountUsd > 0, `${id} must have a positive amount`);
    assert.ok(Number.isSafeInteger(product.credits) && product.credits > 0, `${id} must grant whole positive credits`);
  }
});
