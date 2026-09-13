import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { pool, query } from '../lib/pool.js';
import { AppError, sendError } from '../lib/errors.js';
import { grantCreditsOnce } from '../lib/billing.js';
import { logger } from '../lib/logger.js';
import {
  sendSubscriptionStartedEmail,
  sendSubscriptionRenewalEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionPaymentFailedEmail,
} from '../lib/mailer.js';
import { CREDIT_DISPLAY_MULTIPLIER } from '../lib/growth-offers.js';
import { PRODUCTS, normalizePayPalEnvironment } from './paypal.js';
import { validateEmbeddedCompletedOrder } from './paypal-card-settlement.js';

export const paypalCardSubscriptionRouter = Router();
export const paypalManagedSubscriptionRouter = Router();

const SUBSCRIPTION_IDS = ['creator', 'pro', 'agency'] as const;
type SubscriptionId = typeof SUBSCRIPTION_IDS[number];
type SubscriptionProduct = (typeof PRODUCTS)[SubscriptionId];

const createSchema = z.object({
  plan: z.enum(SUBSCRIPTION_IDS),
  jobId: z.string().uuid().optional(),
  source: z.enum(['card', 'saved_card']).default('card'),
  paymentMethodId: z.string().uuid().optional(),
  expectedAmountUsd: z.number().positive().max(10_000).optional(),
});

interface IntentRow {
  order_id: string;
  user_id: string;
  plan: SubscriptionId;
  payment_method_id: string | null;
  amount_usd: string | number;
  credits: number;
  job_id: string | null;
  expires_at: Date;
}

interface SavedMethodRow {
  id: string;
  provider_token_ref: string;
}

interface ManagedSubscriptionRow {
  id: string;
  user_id: string;
  plan: SubscriptionId;
  payment_method_id: string;
  current_period_end: Date;
  last_payment_failed_at: Date | null;
}

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
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
  return envFlag('PAYPAL_VAULT_ENABLED', false);
}

function advancedCardsEnabled() {
  return envFlag('PAYPAL_ADVANCED_CARDS_ENABLED', true);
}

let tokenCache: { value: string; expiresAt: number } | null = null;
let schemaReady: Promise<void> | null = null;
let renewalTimer: NodeJS.Timeout | null = null;
let renewalSweepRunning = false;

type Attempt = { count: number; resetAt: number };
const attempts = new Map<string, Attempt>();

function allowAttempt(key: string) {
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  if (current.count >= 8) return false;
  current.count += 1;
  return true;
}

async function ensureManagedSubscriptionSchema() {
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
    await query("ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS billing_source TEXT NOT NULL DEFAULT 'paypal_subscription'");
    await query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method_id UUID');
    await query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewal_amount_usd NUMERIC(10,2)');
    await query('ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS last_provider_order_id TEXT');
    await query(`CREATE TABLE IF NOT EXISTS paypal_managed_subscription_intents (
      order_id TEXT PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL,
      payment_method_id UUID,
      amount_usd NUMERIC(10,2) NOT NULL,
      credits INTEGER NOT NULL,
      job_id UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
    )`);
    await query(`CREATE TABLE IF NOT EXISTS paypal_managed_subscription_returns (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id TEXT UNIQUE NOT NULL,
      job_id UUID,
      expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '2 hours')
    )`);
    await query(`CREATE TABLE IF NOT EXISTS paypal_managed_subscription_renewals (
      id UUID PRIMARY KEY,
      subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
      period_start TIMESTAMPTZ NOT NULL,
      provider_order_id TEXT,
      provider_capture_id TEXT,
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(subscription_id, period_start)
    )`);
    await query('CREATE INDEX IF NOT EXISTS managed_subscription_due_idx ON subscriptions(billing_source,auto_renew,current_period_end)');
    await query('CREATE UNIQUE INDEX IF NOT EXISTS managed_subscription_order_idx ON subscriptions(last_provider_order_id) WHERE last_provider_order_id IS NOT NULL');
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
    logger.error({ err: error }, '[paypal-managed-subscription] OAuth network failure');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
  }

  const raw = await response.text();
  let data: { access_token?: string; expires_in?: number } = {};
  try { data = JSON.parse(raw) as typeof data; } catch { data = {}; }
  if (!response.ok || !data.access_token) {
    logger.error({ status: response.status }, '[paypal-managed-subscription] OAuth failed');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
  }
  tokenCache = {
    value: data.access_token,
    expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000,
  };
  return data.access_token;
}

async function paypalRequest(
  pathname: string,
  init: { method: 'GET' | 'POST'; body?: unknown; idempotencyKey?: string },
) {
  const token = await accessToken();
  let response: globalThis.Response;
  try {
    response = await fetch(`${paypalBase()}${pathname}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(init.idempotencyKey ? { 'PayPal-Request-Id': init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    logger.error({ err: error, pathname }, '[paypal-managed-subscription] provider network failure');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYMENT_PROVIDER_UNAVAILABLE');
  }

  const raw = await response.text();
  let data: Record<string, unknown> = {};
  try { if (raw) data = JSON.parse(raw) as Record<string, unknown>; } catch { data = {}; }
  if (!response.ok) {
    logger.warn({ status: response.status, pathname, provider: data.name }, '[paypal-managed-subscription] provider rejected request');
    if (response.status === 403) {
      throw new AppError('Recurring card payments are not enabled for this merchant account yet.', 503, 'PAYPAL_RECURRING_CARDS_NOT_ENABLED');
    }
    throw new AppError('The card payment could not be completed. Try another payment method.', 422, 'CARD_PAYMENT_FAILED');
  }
  return data;
}

function payerActionLink(links: unknown) {
  if (!Array.isArray(links)) return null;
  const found = links.find((item) => item && typeof item === 'object' && (item as { rel?: unknown }).rel === 'payer-action');
  const href = (found as { href?: unknown } | undefined)?.href;
  if (typeof href !== 'string') return null;
  try {
    const parsed = new URL(href);
    return parsed.protocol === 'https:' && /(^|\.)paypal\.com$/i.test(parsed.hostname) ? href : null;
  } catch { return null; }
}

function addOneMonth(date: Date) {
  const source = new Date(date);
  const year = source.getUTCFullYear();
  const month = source.getUTCMonth();
  const day = source.getUTCDate();
  const nextMonth = month + 1;
  const nextYear = year + Math.floor(nextMonth / 12);
  const normalizedMonth = nextMonth % 12;
  const lastDay = new Date(Date.UTC(nextYear, normalizedMonth + 1, 0)).getUTCDate();
  return new Date(Date.UTC(
    nextYear,
    normalizedMonth,
    Math.min(day, lastDay),
    source.getUTCHours(),
    source.getUTCMinutes(),
    source.getUTCSeconds(),
    source.getUTCMilliseconds(),
  ));
}

async function billingNotification(
  key: string,
  userId: string,
  kind: string,
  sender: (email: string) => Promise<boolean>,
) {
  const inserted = await query(
    `INSERT INTO billing_notifications(notification_key,user_id,kind)
     VALUES ($1,$2,$3) ON CONFLICT DO NOTHING RETURNING notification_key`,
    [key, userId, kind],
  );
  if (!inserted.rowCount) return;
  try {
    const { rows } = await query<{ email: string }>('SELECT email FROM users WHERE id=$1 LIMIT 1', [userId]);
    if (!rows[0]?.email || !(await sender(rows[0].email))) {
      await query('DELETE FROM billing_notifications WHERE notification_key=$1', [key]).catch(() => {});
    }
  } catch (error) {
    await query('DELETE FROM billing_notifications WHERE notification_key=$1', [key]).catch(() => {});
    logger.warn({ err: error, key }, '[paypal-managed-subscription] billing email failed');
  }
}

async function savedMethod(userId: string, aliasId: string) {
  const { rows } = await query<SavedMethodRow>(
    `SELECT id,provider_token_ref FROM paypal_saved_payment_methods
     WHERE id=$1 AND user_id=$2 AND provider='paypal' LIMIT 1`,
    [aliasId, userId],
  );
  return rows[0] ?? null;
}

async function saveVaultCard(userId: string, order: Record<string, unknown>) {
  const card = (order.payment_source as { card?: Record<string, unknown> } | undefined)?.card;
  const attributes = card?.attributes as { vault?: Record<string, unknown> } | undefined;
  const vault = attributes?.vault;
  if (!card || !vault) return null;

  const tokenRef = typeof vault.id === 'string' ? vault.id : '';
  const status = String(vault.status ?? '').toUpperCase();
  if (!tokenRef || !['VAULTED', 'APPROVED'].includes(status)) return null;

  const customer = vault.customer as { id?: unknown } | undefined;
  if (typeof customer?.id === 'string' && customer.id) {
    await query('UPDATE users SET paypal_customer_id=$1,updated_at=NOW() WHERE id=$2', [customer.id, userId]);
  }

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

async function captureOrRead(orderId: string, keyPrefix: string) {
  try {
    return await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      idempotencyKey: `${keyPrefix}-${orderId}`,
    });
  } catch (captureError) {
    const current = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }).catch(() => null);
    if (!current || current.status !== 'COMPLETED') throw captureError;
    return current;
  }
}

async function finalizeInitialSubscription(userId: string, orderId: string) {
  await ensureManagedSubscriptionSchema();
  const lockClient = await pool.connect();
  const lockKey = `managed-subscription-order:${orderId}`;
  try {
    await lockClient.query('SELECT pg_advisory_lock(hashtext($1))', [lockKey]);

    const { rows } = await lockClient.query<IntentRow>(
      `SELECT order_id,user_id,plan,payment_method_id,amount_usd,credits,job_id,expires_at
       FROM paypal_managed_subscription_intents WHERE order_id=$1 AND user_id=$2 LIMIT 1`,
      [orderId, userId],
    );
    const intent = rows[0];
    if (!intent) throw new AppError('Subscription checkout was not found.', 404, 'PAYMENT_NOT_FOUND');
    if (new Date(intent.expires_at).getTime() < Date.now()) throw new AppError('This checkout expired. Start again.', 409, 'PAYMENT_EXPIRED');

    const already = await lockClient.query<{ id: string }>(
      `SELECT id FROM subscriptions WHERE user_id=$1 AND billing_source='paypal_card' AND last_provider_order_id=$2 LIMIT 1`,
      [userId, orderId],
    );
    if (already.rows[0]) {
      return { ok: true, orderId, amountUsd: Number(intent.amount_usd), creditsGranted: intent.credits, subscriptionId: already.rows[0].id };
    }

    const completed = await captureOrRead(orderId, 'managed-sub-capture');
    const verified = validateEmbeddedCompletedOrder(completed, {
      orderId,
      userId,
      amountUsd: Number(intent.amount_usd),
      currency: 'USD',
    });

    const paymentMethodId = intent.payment_method_id ?? await saveVaultCard(userId, completed);
    if (!paymentMethodId) {
      throw new AppError(
        'The payment completed, but the card token is still being secured for renewal. Contact support before trying again.',
        409,
        'SUBSCRIPTION_VAULT_PENDING',
      );
    }
    if (!(await savedMethod(userId, paymentMethodId))) throw new AppError('The saved card could not be verified.', 409, 'PAYMENT_METHOD_NOT_FOUND');

    const product = PRODUCTS[intent.plan] as SubscriptionProduct;
    const periodStart = new Date();
    const periodEnd = addOneMonth(periodStart);

    await lockClient.query('BEGIN');
    try {
      await lockClient.query(
        `INSERT INTO payments(user_id,provider,provider_ref,provider_capture_ref,kind,amount_usd,currency,credits_granted,plan,product_id,status)
         VALUES ($1,'paypal',$2,$3,'subscription_initial',$4,'USD',$5,$6,$7,'paid')
         ON CONFLICT(provider,provider_ref) DO UPDATE SET status='paid',provider_capture_ref=EXCLUDED.provider_capture_ref`,
        [userId, orderId, verified.captureId, Number(intent.amount_usd), intent.credits, product.plan, intent.plan],
      );
      await lockClient.query(
        `INSERT INTO subscriptions(
          user_id,paypal_subscription_id,plan,status,auto_renew,current_period_start,current_period_end,
          provider_status,billing_source,payment_method_id,renewal_amount_usd,last_provider_order_id,updated_at
        ) VALUES ($1,NULL,$2,'active',true,$3,$4,'ACTIVE','paypal_card',$5,$6,$7,NOW())
        ON CONFLICT (last_provider_order_id) WHERE last_provider_order_id IS NOT NULL
        DO UPDATE SET status='active',auto_renew=true,provider_status='ACTIVE',payment_method_id=EXCLUDED.payment_method_id,updated_at=NOW()`,
        [userId, product.plan, periodStart, periodEnd, paymentMethodId, Number(intent.amount_usd), orderId],
      );
      await lockClient.query('COMMIT');
    } catch (error) {
      await lockClient.query('ROLLBACK');
      throw error;
    }

    await grantCreditsOnce({
      key: `paypal:order:${orderId}`,
      userId,
      credits: intent.credits,
      plan: product.plan,
      reason: `Started ${product.name} card subscription ${orderId}`,
    });
    await billingNotification(`receipt:managed-sub:${orderId}`, userId, 'subscription_initial', (email) =>
      sendSubscriptionStartedEmail({
        to: email,
        plan: product.name,
        credits: intent.credits * CREDIT_DISPLAY_MULTIPLIER,
        amountUsd: Number(intent.amount_usd),
        reference: orderId,
        nextBillingDate: periodEnd.toISOString().slice(0, 10),
      }),
    );
    await query('DELETE FROM paypal_managed_subscription_intents WHERE order_id=$1', [orderId]).catch(() => {});

    return { ok: true, orderId, amountUsd: Number(intent.amount_usd), creditsGranted: intent.credits, savedPaymentMethodId: paymentMethodId };
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
    lockClient.release();
  }
}

paypalCardSubscriptionRouter.post('/subscription-orders', requireAuth, async (req, res) => {
  try {
    if (!advancedCardsEnabled() || !vaultEnabled()) {
      throw new AppError('Recurring card checkout needs PayPal Vault enabled for this merchant account.', 503, 'PAYPAL_RECURRING_CARDS_NOT_ENABLED');
    }
    if (!allowAttempt(`user:${req.user!.id}`) || !allowAttempt(`ip:${req.ip ?? 'unknown'}`)) {
      throw new AppError('Too many payment attempts. Please wait a few minutes.', 429, 'RATE_LIMITED');
    }
    await ensureManagedSubscriptionSchema();
    const input = createSchema.parse(req.body);
    const product = PRODUCTS[input.plan] as SubscriptionProduct;
    if (input.expectedAmountUsd !== undefined && Math.abs(input.expectedAmountUsd - product.amountUsd) > 0.005) {
      throw new AppError('The subscription price changed. Review the current price and try again.', 409, 'PRICE_CHANGED');
    }

    let paymentMethodId: string | null = null;
    let cardSource: Record<string, unknown>;
    const sessionId = randomUUID();
    const returnUrl = `${appUrl()}/api/paypal-card/subscription-return/${sessionId}`;
    const cancelUrl = `${appUrl()}/pricing?checkout=cancelled`;

    if (input.source === 'saved_card') {
      if (!input.paymentMethodId) throw new AppError('Choose a saved card.', 400, 'PAYMENT_METHOD_REQUIRED');
      const method = await savedMethod(req.user!.id, input.paymentMethodId);
      if (!method) throw new AppError('That saved card is no longer available.', 404, 'PAYMENT_METHOD_NOT_FOUND');
      paymentMethodId = method.id;
      cardSource = {
        vault_id: method.provider_token_ref,
        stored_credential: { payment_initiator: 'CUSTOMER', payment_type: 'RECURRING', usage: 'SUBSEQUENT' },
        attributes: { verification: { method: 'SCA_WHEN_REQUIRED' } },
        experience_context: { shipping_preference: 'NO_SHIPPING', return_url: returnUrl, cancel_url: cancelUrl },
      };
    } else {
      cardSource = {
        stored_credential: { payment_initiator: 'CUSTOMER', payment_type: 'RECURRING', usage: 'FIRST' },
        attributes: {
          verification: { method: 'SCA_WHEN_REQUIRED' },
          vault: { store_in_vault: 'ON_SUCCESS' },
        },
        experience_context: { shipping_preference: 'NO_SHIPPING', return_url: returnUrl, cancel_url: cancelUrl },
      };
    }

    const data = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      idempotencyKey: `managed-sub-${req.user!.id}-${input.plan}-${randomUUID()}`,
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: req.user!.id,
          description: `AiWebVideo ${product.name} monthly subscription`,
          amount: { currency_code: 'USD', value: product.amountUsd.toFixed(2) },
        }],
        payment_source: { card: cardSource },
      },
    });
    const orderId = typeof data.id === 'string' ? data.id : '';
    if (!orderId) throw new AppError('The payment service did not create the subscription payment.', 502, 'CHECKOUT_FAILED');

    await query(
      `INSERT INTO paypal_managed_subscription_intents(order_id,user_id,plan,payment_method_id,amount_usd,credits,job_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(order_id) DO NOTHING`,
      [orderId, req.user!.id, input.plan, paymentMethodId, product.amountUsd, product.credits, input.jobId ?? null],
    );
    await query(
      `INSERT INTO payments(user_id,provider,provider_ref,kind,amount_usd,currency,credits_granted,plan,product_id,status)
       VALUES ($1,'paypal',$2,'subscription_initial',$3,'USD',$4,$5,$6,'pending')
       ON CONFLICT(provider,provider_ref) DO NOTHING`,
      [req.user!.id, orderId, product.amountUsd, product.credits, product.plan, input.plan],
    );
    await query(
      `INSERT INTO paypal_managed_subscription_returns(id,user_id,order_id,job_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING`,
      [sessionId, req.user!.id, orderId, input.jobId ?? null],
    );

    const providerStatus = typeof data.status === 'string' ? data.status : null;
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      orderId,
      amountUsd: product.amountUsd,
      normalAmountUsd: product.amountUsd,
      discountApplied: false,
      creditsGranted: product.credits,
      source: input.source,
      providerStatus,
      payerActionRequired: providerStatus === 'PAYER_ACTION_REQUIRED',
      payerActionUrl: payerActionLink(data.links),
    });
  } catch (error) { sendError(res, error); }
});

paypalCardSubscriptionRouter.post('/subscription-orders/:orderId/capture', requireAuth, async (req, res) => {
  try {
    const orderId = z.string().regex(/^[A-Z0-9-]{8,40}$/i).parse(req.params.orderId);
    const result = await finalizeInitialSubscription(req.user!.id, orderId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(result);
  } catch (error) { sendError(res, error); }
});

paypalCardSubscriptionRouter.get('/subscription-return/:sessionId', requireAuth, async (req, res) => {
  const fail = `${appUrl()}/dashboard?checkout=failed`;
  try {
    await ensureManagedSubscriptionSchema();
    const sessionId = z.string().uuid().parse(req.params.sessionId);
    const { rows } = await query<{ order_id: string; job_id: string | null; expires_at: Date }>(
      `SELECT order_id,job_id,expires_at FROM paypal_managed_subscription_returns
       WHERE id=$1 AND user_id=$2 LIMIT 1`,
      [sessionId, req.user!.id],
    );
    const session = rows[0];
    if (!session || new Date(session.expires_at).getTime() < Date.now()) throw new Error('expired return');
    await finalizeInitialSubscription(req.user!.id, session.order_id);
    await query('DELETE FROM paypal_managed_subscription_returns WHERE id=$1', [sessionId]).catch(() => {});
    res.redirect(`${appUrl()}/dashboard?checkout=success${session.job_id ? `&job=${encodeURIComponent(session.job_id)}` : ''}`);
  } catch (error) {
    logger.warn({ err: error, userId: req.user?.id }, '[paypal-managed-subscription] payer action return failed');
    res.redirect(fail);
  }
});

paypalManagedSubscriptionRouter.post('/subscriptions/:id/cancel', requireAuth, async (req, res, next) => {
  try {
    await ensureManagedSubscriptionSchema();
    const id = z.string().uuid().parse(req.params.id);
    const { rows } = await query<{ id: string; billing_source: string; plan: string; current_period_end: Date | null }>(
      `SELECT id,billing_source,plan,current_period_end FROM subscriptions WHERE id=$1 AND user_id=$2 LIMIT 1`,
      [id, req.user!.id],
    );
    const subscription = rows[0];
    if (!subscription || subscription.billing_source !== 'paypal_card') {
      next();
      return;
    }
    await query(
      `UPDATE subscriptions SET auto_renew=false,status='cancelled',provider_status='CANCELLED',updated_at=NOW()
       WHERE id=$1 AND user_id=$2`,
      [id, req.user!.id],
    );
    await billingNotification(`subscription:cancelled:${id}`, req.user!.id, 'subscription_cancelled', (email) =>
      sendSubscriptionCancelledEmail({
        to: email,
        plan: subscription.plan,
        periodEnd: subscription.current_period_end?.toISOString().slice(0, 10) ?? null,
      }),
    );
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
});

async function renewOne(subscription: ManagedSubscriptionRow) {
  const lockClient = await pool.connect();
  const lockKey = `aiwebvideo-managed-subscription:${subscription.id}`;
  try {
    const acquired = await lockClient.query<{ locked: boolean }>('SELECT pg_try_advisory_lock(hashtext($1)) locked', [lockKey]);
    if (!acquired.rows[0]?.locked) return;

    const current = await lockClient.query<ManagedSubscriptionRow>(
      `SELECT id,user_id,plan,payment_method_id,current_period_end,last_payment_failed_at
       FROM subscriptions
       WHERE id=$1 AND billing_source='paypal_card' AND auto_renew=true
         AND status IN ('active','past_due') AND current_period_end <= NOW()
       LIMIT 1`,
      [subscription.id],
    );
    const row = current.rows[0];
    if (!row) return;
    if (row.last_payment_failed_at && Date.now() - new Date(row.last_payment_failed_at).getTime() < 6 * 60 * 60_000) return;

    const method = await savedMethod(row.user_id, row.payment_method_id);
    if (!method) throw new Error('Saved card is no longer available.');
    const product = PRODUCTS[row.plan] as SubscriptionProduct;
    const periodStart = new Date(row.current_period_end);
    const periodEnd = addOneMonth(periodStart);
    const renewalKey = `${row.id}:${periodStart.toISOString()}`;

    const renewal = await lockClient.query<{ id: string; provider_order_id: string | null; status: string }>(
      `INSERT INTO paypal_managed_subscription_renewals(id,subscription_id,period_start,status)
       VALUES ($1,$2,$3,'pending')
       ON CONFLICT(subscription_id,period_start) DO UPDATE SET updated_at=NOW()
       RETURNING id,provider_order_id,status`,
      [randomUUID(), row.id, periodStart],
    );
    if (renewal.rows[0]?.status === 'paid') return;

    let order: Record<string, unknown>;
    const existingOrderId = renewal.rows[0]?.provider_order_id;
    if (existingOrderId) {
      order = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(existingOrderId)}`, { method: 'GET' });
    } else {
      order = await paypalRequest('/v2/checkout/orders', {
        method: 'POST',
        idempotencyKey: `renew-${row.id}-${periodStart.toISOString().slice(0, 10)}`,
        body: {
          intent: 'CAPTURE',
          purchase_units: [{
            custom_id: row.user_id,
            description: `AiWebVideo ${product.name} monthly renewal`,
            amount: { currency_code: 'USD', value: product.amountUsd.toFixed(2) },
          }],
          payment_source: {
            card: {
              vault_id: method.provider_token_ref,
              stored_credential: { payment_initiator: 'MERCHANT', payment_type: 'RECURRING', usage: 'SUBSEQUENT' },
            },
          },
        },
      });
      const createdOrderId = typeof order.id === 'string' ? order.id : '';
      if (!createdOrderId) throw new Error('Renewal order was not created.');
      await lockClient.query(
        'UPDATE paypal_managed_subscription_renewals SET provider_order_id=$2,updated_at=NOW() WHERE id=$1',
        [renewal.rows[0]!.id, createdOrderId],
      );
    }

    const orderId = typeof order.id === 'string' ? order.id : existingOrderId ?? '';
    const completed = order.status === 'COMPLETED' ? order : await captureOrRead(orderId, 'managed-renewal-capture');
    const verified = validateEmbeddedCompletedOrder(completed, {
      orderId,
      userId: row.user_id,
      amountUsd: product.amountUsd,
      currency: 'USD',
    });

    await lockClient.query('BEGIN');
    try {
      await lockClient.query(
        `INSERT INTO payments(user_id,provider,provider_ref,provider_capture_ref,kind,amount_usd,currency,credits_granted,plan,product_id,status)
         VALUES ($1,'paypal',$2,$3,'subscription_renewal',$4,'USD',$5,$6,$7,'paid')
         ON CONFLICT(provider,provider_ref) DO UPDATE SET status='paid',provider_capture_ref=EXCLUDED.provider_capture_ref`,
        [row.user_id, orderId, verified.captureId, product.amountUsd, product.credits, product.plan, row.plan],
      );
      await lockClient.query(
        `UPDATE subscriptions SET status='active',provider_status='ACTIVE',current_period_start=$2,current_period_end=$3,
         last_payment_failed_at=NULL,last_provider_order_id=$4,renewal_amount_usd=$5,updated_at=NOW() WHERE id=$1`,
        [row.id, periodStart, periodEnd, orderId, product.amountUsd],
      );
      await lockClient.query(
        `UPDATE paypal_managed_subscription_renewals SET status='paid',provider_capture_id=$2,last_error=NULL,updated_at=NOW() WHERE id=$1`,
        [renewal.rows[0]!.id, verified.captureId],
      );
      await lockClient.query('COMMIT');
    } catch (error) {
      await lockClient.query('ROLLBACK');
      throw error;
    }

    await grantCreditsOnce({
      key: `paypal:managed-renewal:${renewalKey}`,
      userId: row.user_id,
      credits: product.credits,
      plan: product.plan,
      reason: `Managed subscription renewal ${orderId}`,
    });
    await billingNotification(`receipt:managed-renewal:${orderId}`, row.user_id, 'subscription_renewal', (email) =>
      sendSubscriptionRenewalEmail({
        to: email,
        plan: product.name,
        credits: product.credits * CREDIT_DISPLAY_MULTIPLIER,
        amountUsd: product.amountUsd,
        reference: orderId,
        nextBillingDate: periodEnd.toISOString().slice(0, 10),
      }),
    );
  } catch (error) {
    logger.warn({ err: error, subscriptionId: subscription.id }, '[paypal-managed-subscription] renewal failed');
    await query(
      `UPDATE subscriptions SET status='past_due',provider_status='PAYMENT_FAILED',last_payment_failed_at=NOW(),updated_at=NOW() WHERE id=$1`,
      [subscription.id],
    ).catch(() => {});
    await query(
      `UPDATE paypal_managed_subscription_renewals SET status='failed',last_error=$2,updated_at=NOW()
       WHERE subscription_id=$1 AND status='pending'`,
      [subscription.id, error instanceof Error ? error.message.slice(0, 500) : 'Payment failed'],
    ).catch(() => {});
    const product = PRODUCTS[subscription.plan] as SubscriptionProduct;
    await billingNotification(
      `managed-subscription:payment-failed:${subscription.id}:${new Date(subscription.current_period_end).toISOString().slice(0, 10)}`,
      subscription.user_id,
      'subscription_payment_failed',
      (email) => sendSubscriptionPaymentFailedEmail({ to: email, plan: product.name, reference: subscription.id }),
    ).catch(() => {});
  } finally {
    await lockClient.query('SELECT pg_advisory_unlock(hashtext($1))', [lockKey]).catch(() => {});
    lockClient.release();
  }
}

export async function runManagedSubscriptionRenewals() {
  if (renewalSweepRunning || !vaultEnabled()) return;
  renewalSweepRunning = true;
  try {
    await ensureManagedSubscriptionSchema();
    const { rows } = await query<ManagedSubscriptionRow>(
      `SELECT id,user_id,plan,payment_method_id,current_period_end,last_payment_failed_at
       FROM subscriptions
       WHERE billing_source='paypal_card' AND auto_renew=true
         AND status IN ('active','past_due') AND current_period_end <= NOW()
       ORDER BY current_period_end ASC LIMIT 25`,
    );
    for (const row of rows) await renewOne(row);
  } catch (error) {
    logger.error({ err: error }, '[paypal-managed-subscription] renewal sweep failed');
  } finally {
    renewalSweepRunning = false;
  }
}

export async function startManagedSubscriptionRenewals() {
  await ensureManagedSubscriptionSchema();
  if (renewalTimer) return;
  renewalTimer = setInterval(() => { void runManagedSubscriptionRenewals(); }, 60 * 60_000);
  renewalTimer.unref();
  setTimeout(() => { void runManagedSubscriptionRenewals(); }, 15_000).unref();
}
