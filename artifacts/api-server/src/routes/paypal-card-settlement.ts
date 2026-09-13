import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { query } from '../lib/pool.js';
import { AppError, sendError } from '../lib/errors.js';
import { grantCreditsOnce } from '../lib/billing.js';
import { logger } from '../lib/logger.js';
import { sendCreditPurchaseEmail } from '../lib/mailer.js';
import { CREDIT_DISPLAY_MULTIPLIER } from '../lib/growth-offers.js';
import { normalizePayPalEnvironment } from './paypal.js';

const router = Router();

interface PendingPayment {
  user_id: string;
  amount_usd: string | number;
  currency: string;
  credits_granted: number;
  plan: string | null;
  status: string;
}

function paypalEnvironment() {
  return normalizePayPalEnvironment(process.env.PAYPAL_ENV);
}

function paypalBase() {
  return paypalEnvironment() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function appUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  try {
    const parsed = new URL(raw);
    if (!['http:', 'https:'].includes(parsed.protocol)) throw new Error('bad protocol');
    return parsed.toString().replace(/\/$/, '');
  } catch {
    throw new AppError('The application URL is not configured correctly.', 503, 'APP_URL_NOT_CONFIGURED');
  }
}

function vaultEnabled() {
  const value = process.env.PAYPAL_VAULT_ENABLED;
  if (value === undefined || value === '') return false;
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
}

let tokenCache: { value: string; expiresAt: number } | null = null;
let schemaReady: Promise<void> | null = null;

async function ensureSchema() {
  schemaReady ??= (async () => {
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT');
    await query(`CREATE TABLE IF NOT EXISTS paypal_saved_payment_methods (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      provider TEXT NOT NULL DEFAULT 'paypal',
      provider_token_ref TEXT NOT NULL,
      brand TEXT,
      last_digits TEXT,
      expiry TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(provider, provider_token_ref)
    )`);
    await query(`CREATE TABLE IF NOT EXISTS paypal_card_checkout_sessions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id TEXT UNIQUE,
      job_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
    )`);
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

async function accessToken() {
  if (tokenCache && tokenCache.expiresAt > Date.now() + 30_000) return tokenCache.value;
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const secret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !secret) throw new AppError('Checkout is not configured yet.', 503, 'BILLING_NOT_CONFIGURED');

  let response: globalThis.Response;
  try {
    response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${secret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    logger.error({ err: error }, '[paypal-card-settlement] OAuth network request failed');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
  }

  const raw = await response.text();
  let data: { access_token?: string; expires_in?: number } = {};
  try { data = JSON.parse(raw) as typeof data; } catch { data = {}; }
  if (!response.ok || !data.access_token) {
    logger.error({ status: response.status }, '[paypal-card-settlement] OAuth failed');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
  }
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000,
  };
  return data.access_token;
}

async function paypalRequest(pathname: string, method: 'GET' | 'POST', idempotencyKey?: string) {
  const token = await accessToken();
  let response: globalThis.Response;
  try {
    response = await fetch(`${paypalBase()}${pathname}`, {
      method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(idempotencyKey ? { 'PayPal-Request-Id': idempotencyKey } : {}),
      },
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    logger.error({ err: error, pathname }, '[paypal-card-settlement] provider request failed');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
  }

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try { if (raw) data = JSON.parse(raw) as Record<string, unknown>; } catch { data = {}; }
  if (!response.ok) {
    logger.warn({ status: response.status, pathname }, '[paypal-card-settlement] provider rejected request');
    throw new AppError('The payment could not be completed. No second payment is needed; please try again.', 422, 'PAYMENT_CAPTURE_FAILED');
  }
  return data;
}

function moneyToCents(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/**
 * Card Fields can return custom_id on purchase_units, on the completed capture,
 * or omit the duplicate remote copy. The local pending payment is already bound
 * to exact order id + authenticated user. Any remote account id that IS present
 * must agree with that local binding; a mismatch is always rejected.
 */
export function validateEmbeddedCompletedOrder(
  order: Record<string, unknown>,
  expected: { orderId: string; userId: string; amountUsd: number; currency: string },
) {
  if (order.id !== expected.orderId || order.status !== 'COMPLETED') {
    throw new AppError('Payment is not completed yet.', 409, 'PAYMENT_NOT_COMPLETED');
  }

  const units = Array.isArray(order.purchase_units) ? order.purchase_units as Array<Record<string, unknown>> : [];
  if (units.length !== 1) throw new AppError('Payment verification failed.', 409, 'PAYMENT_VERIFICATION_FAILED');

  const rawCaptures = (units[0]?.payments as { captures?: unknown } | undefined)?.captures;
  const captures = Array.isArray(rawCaptures)
    ? rawCaptures.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object')
    : [];
  const completed = captures.filter((capture) => capture.status === 'COMPLETED');
  if (!completed.length) throw new AppError('Payment is not completed yet.', 409, 'PAYMENT_NOT_COMPLETED');

  const remoteIds = [
    typeof units[0]?.custom_id === 'string' ? units[0].custom_id : '',
    ...completed.map((capture) => typeof capture.custom_id === 'string' ? capture.custom_id : ''),
  ].filter((value): value is string => Boolean(value));
  if (remoteIds.some((value) => value !== expected.userId)) {
    logger.error({ orderId: expected.orderId }, '[paypal-card-settlement] remote order ownership mismatch blocked');
    throw new AppError('Payment verification failed.', 409, 'PAYMENT_ACCOUNT_MISMATCH');
  }

  const expectedCents = moneyToCents(expected.amountUsd);
  let capturedCents = 0;
  let captureId = '';
  for (const capture of completed) {
    const amount = capture.amount as { value?: unknown; currency_code?: unknown } | undefined;
    if (String(amount?.currency_code ?? '').toUpperCase() !== expected.currency.toUpperCase()) {
      throw new AppError('Payment verification failed.', 409, 'PAYMENT_CURRENCY_MISMATCH');
    }
    const cents = moneyToCents(amount?.value);
    if (cents === null) throw new AppError('Payment verification failed.', 409, 'PAYMENT_AMOUNT_INVALID');
    capturedCents += cents;
    if (!captureId && typeof capture.id === 'string') captureId = capture.id;
  }
  if (expectedCents === null || capturedCents !== expectedCents || !captureId) {
    throw new AppError('Payment verification failed.', 409, 'PAYMENT_AMOUNT_MISMATCH');
  }

  const payer = order.payer as { payer_id?: unknown } | undefined;
  return { captureId, payerId: typeof payer?.payer_id === 'string' ? payer.payer_id : null };
}

async function pendingPayment(orderId: string, userId: string) {
  const { rows } = await query<PendingPayment>(
    `SELECT user_id,amount_usd,currency,credits_granted,plan,status
       FROM payments
      WHERE provider='paypal' AND provider_ref=$1 AND user_id=$2
      LIMIT 1`,
    [orderId, userId],
  );
  return rows[0] ?? null;
}

async function sendReceiptOnce(orderId: string, payment: PendingPayment) {
  const key = `receipt:order:${orderId}`;
  const inserted = await query(
    `INSERT INTO billing_notifications(notification_key,user_id,kind)
     VALUES ($1,$2,'credit_purchase') ON CONFLICT DO NOTHING RETURNING notification_key`,
    [key, payment.user_id],
  );
  if (!inserted.rowCount) return;

  try {
    const { rows } = await query<{ email: string }>('SELECT email FROM users WHERE id=$1 LIMIT 1', [payment.user_id]);
    const delivered = rows[0]?.email
      ? await sendCreditPurchaseEmail({
          to: rows[0].email,
          credits: Math.max(0, Math.round(payment.credits_granted)) * CREDIT_DISPLAY_MULTIPLIER,
          amountUsd: Number(payment.amount_usd),
          reference: orderId,
        })
      : false;
    if (!delivered) {
      await query('DELETE FROM billing_notifications WHERE notification_key=$1', [key]).catch(() => {});
      return;
    }
    await query(
      `UPDATE payments SET invoice_emailed_at=COALESCE(invoice_emailed_at,NOW())
       WHERE provider='paypal' AND provider_ref=$1`,
      [orderId],
    ).catch(() => {});
  } catch (error) {
    await query('DELETE FROM billing_notifications WHERE notification_key=$1', [key]).catch(() => {});
    logger.warn({ err: error, orderId }, '[paypal-card-settlement] receipt delivery failed');
  }
}

async function saveVaultMetadata(userId: string, order: Record<string, unknown>) {
  if (!vaultEnabled()) return null;
  await ensureSchema();
  const card = (order.payment_source as { card?: Record<string, unknown> } | undefined)?.card;
  const vault = (card?.attributes as { vault?: Record<string, unknown> } | undefined)?.vault;
  if (!card || !vault) return null;

  const customer = vault.customer as { id?: unknown } | undefined;
  if (typeof customer?.id === 'string' && customer.id) {
    await query('UPDATE users SET paypal_customer_id=$1,updated_at=NOW() WHERE id=$2', [customer.id, userId]);
  }
  const tokenRef = typeof vault.id === 'string' ? vault.id : '';
  if (!tokenRef || String(vault.status ?? '').toUpperCase() !== 'VAULTED') return null;

  const aliasId = randomUUID();
  const brand = typeof card.brand === 'string' ? card.brand : null;
  const lastDigits = typeof card.last_digits === 'string'
    ? card.last_digits
    : typeof card['last-digits'] === 'string' ? String(card['last-digits']) : null;
  const expiry = typeof card.expiry === 'string' ? card.expiry : null;
  const { rows } = await query<{ id: string }>(
    `INSERT INTO paypal_saved_payment_methods(id,user_id,provider,provider_token_ref,brand,last_digits,expiry)
     VALUES ($1,$2,'paypal',$3,$4,$5,$6)
     ON CONFLICT(provider,provider_token_ref) DO UPDATE SET
       brand=EXCLUDED.brand,last_digits=EXCLUDED.last_digits,expiry=EXCLUDED.expiry,updated_at=NOW()
     WHERE paypal_saved_payment_methods.user_id=EXCLUDED.user_id
     RETURNING id`,
    [aliasId, userId, tokenRef, brand, lastDigits, expiry],
  );
  if (!rows[0]?.id) throw new AppError('Saved card ownership could not be verified.', 409, 'PAYMENT_METHOD_OWNERSHIP_MISMATCH');
  return rows[0].id;
}

async function finalizeEmbeddedOrder(userId: string, orderId: string) {
  const payment = await pendingPayment(orderId, userId);
  if (!payment) throw new AppError('Payment order not found.', 404, 'PAYMENT_NOT_FOUND');
  if (payment.status === 'paid') {
    return {
      ok: true,
      orderId,
      amountUsd: Number(payment.amount_usd),
      creditsGranted: payment.credits_granted,
      savedPaymentMethodId: null as string | null,
    };
  }

  let completed: Record<string, unknown>;
  try {
    completed = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, 'POST', `capture-${orderId}`);
  } catch (captureError) {
    const current = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, 'GET').catch(() => null);
    if (!current || current.status !== 'COMPLETED') throw captureError;
    completed = current;
  }

  const verified = validateEmbeddedCompletedOrder(completed, {
    orderId,
    userId,
    amountUsd: Number(payment.amount_usd),
    currency: payment.currency,
  });

  await grantCreditsOnce({
    key: `paypal:order:${orderId}`,
    userId,
    credits: payment.credits_granted,
    plan: payment.plan,
    reason: `Completed card purchase ${orderId}`,
  });
  await query(
    "UPDATE payments SET status='paid',provider_capture_ref=$2 WHERE provider='paypal' AND provider_ref=$1 AND user_id=$3",
    [orderId, verified.captureId, userId],
  );
  if (verified.payerId) {
    await query('UPDATE users SET paypal_payer_id=$1,updated_at=NOW() WHERE id=$2', [verified.payerId, userId]);
  }

  const savedPaymentMethodId = await saveVaultMetadata(userId, completed).catch((error) => {
    logger.info({ err: error, orderId }, '[paypal-card-settlement] payment succeeded but vault metadata was not saved');
    return null;
  });
  await sendReceiptOnce(orderId, payment);

  return {
    ok: true,
    orderId,
    amountUsd: Number(payment.amount_usd),
    creditsGranted: payment.credits_granted,
    savedPaymentMethodId,
  };
}

router.post('/orders/:orderId/capture', requireAuth, async (req, res) => {
  const orderId = String(req.params.orderId ?? '');
  try {
    if (!/^[A-Z0-9-]{8,40}$/i.test(orderId)) throw new AppError('Invalid payment order.', 400, 'INVALID_ORDER');
    const result = await finalizeEmbeddedOrder(req.user!.id, orderId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(result);
  } catch (error) {
    logger.warn({ err: error, orderId, userId: req.user?.id }, '[paypal-card-settlement] capture finalization failed');
    sendError(res, error);
  }
});

router.get('/return/:sessionId', requireAuth, async (req, res) => {
  const fail = `${appUrl()}/dashboard?checkout=failed`;
  try {
    await ensureSchema();
    const sessionId = z.string().uuid().parse(req.params.sessionId);
    const { rows } = await query<{ order_id: string | null; job_id: string | null; expires_at: Date }>(
      `SELECT order_id,job_id,expires_at
         FROM paypal_card_checkout_sessions
        WHERE id=$1 AND user_id=$2 LIMIT 1`,
      [sessionId, req.user!.id],
    );
    const session = rows[0];
    if (!session?.order_id || new Date(session.expires_at).getTime() < Date.now()) {
      res.redirect(fail);
      return;
    }

    await finalizeEmbeddedOrder(req.user!.id, session.order_id);
    await query('DELETE FROM paypal_card_checkout_sessions WHERE id=$1 AND user_id=$2', [sessionId, req.user!.id]).catch(() => {});
    res.redirect(`${appUrl()}/dashboard?checkout=success${session.job_id ? `&job=${encodeURIComponent(session.job_id)}` : ''}`);
  } catch (error) {
    logger.warn({ err: error, userId: req.user?.id }, '[paypal-card-settlement] payer-action return failed');
    res.redirect(fail);
  }
});

export default router;
