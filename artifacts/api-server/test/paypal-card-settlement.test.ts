import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { validateEmbeddedCompletedOrder } from '../src/routes/paypal-card-settlement.js';

const expected = {
  orderId: 'ORDER-12345678',
  userId: 'user-123',
  amountUsd: 52.99,
  currency: 'USD',
};

function completedOrder(options?: { unitCustomId?: string | null; captureCustomId?: string | null }) {
  const unit: Record<string, unknown> = {
    payments: {
      captures: [{
        id: 'CAPTURE-123',
        status: 'COMPLETED',
        amount: { currency_code: 'USD', value: '52.99' },
        ...(options?.captureCustomId === undefined ? { custom_id: 'user-123' } : options.captureCustomId ? { custom_id: options.captureCustomId } : {}),
      }],
    },
  };
  if (options?.unitCustomId === undefined) unit.custom_id = 'user-123';
  else if (options.unitCustomId) unit.custom_id = options.unitCustomId;

  return {
    id: expected.orderId,
    status: 'COMPLETED',
    purchase_units: [unit],
  };
}

test('embedded card settlement accepts PayPal custom_id on the completed capture', () => {
  const order = completedOrder({ unitCustomId: null, captureCustomId: 'user-123' });
  assert.deepEqual(validateEmbeddedCompletedOrder(order, expected), { captureId: 'CAPTURE-123', payerId: null });
});

test('local authenticated order ownership is authoritative when PayPal omits duplicate custom_id fields', () => {
  const order = completedOrder({ unitCustomId: null, captureCustomId: null });
  assert.deepEqual(validateEmbeddedCompletedOrder(order, expected), { captureId: 'CAPTURE-123', payerId: null });
});

test('every present remote account id must match the authenticated local order owner', () => {
  assert.throws(() => validateEmbeddedCompletedOrder(
    completedOrder({ unitCustomId: null, captureCustomId: 'other-user' }),
    expected,
  ));
  assert.throws(() => validateEmbeddedCompletedOrder(
    completedOrder({ unitCustomId: 'other-user', captureCustomId: 'user-123' }),
    expected,
  ));
  assert.throws(() => validateEmbeddedCompletedOrder(
    completedOrder({ unitCustomId: 'user-123', captureCustomId: 'other-user' }),
    expected,
  ));
});

test('embedded settlement still enforces exact amount and currency', () => {
  const wrongAmount = completedOrder();
  const units = wrongAmount.purchase_units as Array<Record<string, unknown>>;
  const captures = (units[0].payments as { captures: Array<Record<string, unknown>> }).captures;
  captures[0].amount = { currency_code: 'USD', value: '0.01' };
  assert.throws(() => validateEmbeddedCompletedOrder(wrongAmount, expected));

  const wrongCurrency = completedOrder();
  const currencyUnits = wrongCurrency.purchase_units as Array<Record<string, unknown>>;
  const currencyCaptures = (currencyUnits[0].payments as { captures: Array<Record<string, unknown>> }).captures;
  currencyCaptures[0].amount = { currency_code: 'EUR', value: '52.99' };
  assert.throws(() => validateEmbeddedCompletedOrder(wrongCurrency, expected));
});

test('settlement override is mounted before the legacy card router', async () => {
  const source = await readFile(path.resolve(process.cwd(), 'src/routes/index.ts'), 'utf8');
  const settlementMount = source.indexOf("router.use('/paypal-card', paypalCardSettlementRouter)");
  const legacyMount = source.indexOf("router.use('/paypal-card', paypalCardRouter)");
  assert.ok(settlementMount >= 0);
  assert.ok(legacyMount > settlementMount);
});
