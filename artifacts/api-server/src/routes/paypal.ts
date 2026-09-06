import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { query } from '../lib/pool.js';
import { AppError, sendError } from '../lib/errors.js';
import { grantCreditsOnce } from '../lib/billing.js';
import { BILLING_CREDIT_PRODUCTS } from '../lib/billing-products.js';
import { logger } from '../lib/logger.js';
import {
  sendCreditPurchaseEmail,
  sendSubscriptionStartedEmail,
  sendSubscriptionRenewalEmail,
  sendSubscriptionCancelledEmail,
  sendSubscriptionPaymentFailedEmail,
  sendPaymentRefundedEmail,
} from '../lib/mailer.js';

const router = Router();

/** The server owns all prices and grants. The browser submits only a product id. */
export const PRODUCTS = {
  creator: { ...BILLING_CREDIT_PRODUCTS.creator, mode: 'subscription', amountUsd: 39, name: 'Creator' },
  pro: { ...BILLING_CREDIT_PRODUCTS.pro, mode: 'subscription', amountUsd: 99, name: 'Pro' },
  agency: { ...BILLING_CREDIT_PRODUCTS.agency, mode: 'subscription', amountUsd: 249, name: 'Agency' },
  single8: { ...BILLING_CREDIT_PRODUCTS.single8, mode: 'payment', amountUsd: 9.99, name: 'Quick Video' },
  single48: { ...BILLING_CREDIT_PRODUCTS.single48, mode: 'payment', amountUsd: 52.99, name: 'Full Marketing Video' },
  single144: { ...BILLING_CREDIT_PRODUCTS.single144, mode: 'payment', amountUsd: 149.99, name: 'Extended Video' },
  topup50: { ...BILLING_CREDIT_PRODUCTS.topup50, mode: 'payment', amountUsd: 14.99, name: '50 Credits' },
  topup100: { ...BILLING_CREDIT_PRODUCTS.topup100, mode: 'payment', amountUsd: 28.99, name: '100 Credits' },
  topup250: { ...BILLING_CREDIT_PRODUCTS.topup250, mode: 'payment', amountUsd: 69.99, name: '250 Credits' },
} as const;

export type ProductId = keyof typeof PRODUCTS;
type SubscriptionProductId = 'creator' | 'pro' | 'agency';

interface PayPalRuntimeSettings {
  environment: 'sandbox' | 'live';
  webhookId: string;
  productId: string;
  planIds: Record<SubscriptionProductId, string>;
}

export type PayPalConnectionState = 'not_checked' | 'ready' | 'credentials_rejected' | 'unavailable';
let paypalConnectionState: PayPalConnectionState = 'not_checked';

interface PendingPayment {
  user_id: string;
  amount_usd: string | number;
  currency: string;
  credits_granted: number;
  plan: string | null;
  status: string;
}

const SUBSCRIPTION_IDS: SubscriptionProductId[] = ['creator', 'pro', 'agency'];
const WEBHOOK_EVENTS = [
  'PAYMENT.CAPTURE.COMPLETED',
  'PAYMENT.CAPTURE.REFUNDED',
  'PAYMENT.CAPTURE.REVERSED',
  'PAYMENT.SALE.COMPLETED',
  'PAYMENT.SALE.REFUNDED',
  'PAYMENT.SALE.REVERSED',
  'BILLING.SUBSCRIPTION.CREATED',
  'BILLING.SUBSCRIPTION.ACTIVATED',
  'BILLING.SUBSCRIPTION.UPDATED',
  'BILLING.SUBSCRIPTION.CANCELLED',
  'BILLING.SUBSCRIPTION.EXPIRED',
  'BILLING.SUBSCRIPTION.SUSPENDED',
  'BILLING.SUBSCRIPTION.PAYMENT.FAILED',
];

export function normalizePayPalEnvironment(value: unknown): 'sandbox' | 'live' {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['live', 'production', 'prod'].includes(normalized) ? 'live' : 'sandbox';
}

function paypalEnvironment(): 'sandbox' | 'live' {
  return normalizePayPalEnvironment(process.env.PAYPAL_ENV);
}

export function getPayPalReadiness() {
  return {
    configured: Boolean(process.env.PAYPAL_CLIENT_ID?.trim() && process.env.PAYPAL_CLIENT_SECRET?.trim()),
    environment: paypalEnvironment(),
    connection: paypalConnectionState,
  };
}

function paypalBase() {
  return paypalEnvironment() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function appUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(raw); }
  catch { throw new AppError('The application URL is not configured correctly.', 503, 'APP_URL_NOT_CONFIGURED'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new AppError('The application URL is not configured correctly.', 503, 'APP_URL_NOT_CONFIGURED');
  return parsed.toString().replace(/\/$/, '');
}

let cachedToken: { value: string; expiresAt: number } | null = null;

async function getAccessToken(): Promise<string> {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    paypalConnectionState = 'credentials_rejected';
    throw new AppError('Checkout is not configured yet.', 503, 'BILLING_NOT_CONFIGURED');
  }
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const basic = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
  let response: globalThis.Response;
  try {
    response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
      method: 'POST',
      headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    paypalConnectionState = 'unavailable';
    logger.error({ err: error, environment: paypalEnvironment() }, '[paypal] OAuth network request failed');
    throw new AppError('The checkout service could not be reached. Please try again shortly.', 502, 'PAYPAL_REQUEST_FAILED');
  }
  const body = await response.text();
  if (!response.ok) {
    let providerCode = '';
    try { providerCode = String((JSON.parse(body) as { error?: unknown }).error ?? ''); }
    catch { providerCode = ''; }
    const rejected = response.status === 401 || providerCode === 'invalid_client';
    paypalConnectionState = rejected ? 'credentials_rejected' : 'unavailable';
    logger.error({ status: response.status, providerCode, environment: paypalEnvironment() }, '[paypal] OAuth failed');
    if (rejected) {
      throw new AppError(
        'Checkout credentials were rejected. The Client ID, Secret, and live/sandbox mode must belong to the same REST application.',
        503,
        'PAYPAL_AUTH_FAILED',
      );
    }
    throw new AppError('The checkout service could not authenticate right now.', 502, 'PAYPAL_AUTH_FAILED');
  }
  let data: { access_token?: string; expires_in?: number } = {};
  try { data = JSON.parse(body) as typeof data; }
  catch { data = {}; }
  if (!data.access_token) {
    paypalConnectionState = 'unavailable';
    throw new AppError('The checkout service returned an invalid authentication response.', 502, 'PAYPAL_AUTH_FAILED');
  }
  paypalConnectionState = 'ready';
  cachedToken = { value: data.access_token, expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000 };
  return cachedToken.value;
}

async function paypalFetch(path: string, init: { method: string; body?: unknown; idempotencyKey?: string }) {
  const token = await getAccessToken();
  let response: globalThis.Response;
  try {
    response = await fetch(`${paypalBase()}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
        accept: 'application/json',
        ...(init.idempotencyKey ? { 'PayPal-Request-Id': init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    logger.error({ err: error, path }, '[paypal] network request failed');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYPAL_REQUEST_FAILED');
  }
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  if (raw) {
    try { data = JSON.parse(raw) as Record<string, unknown>; }
    catch { data = {}; }
  }
  if (!response.ok) {
    logger.error({ status: response.status, path, response: raw.slice(0, 500) }, '[paypal] API error');
    throw new AppError('The payment service could not process this request.', 502, 'PAYPAL_REQUEST_FAILED');
  }
  return data;
}

export function approveLink(links: unknown): string | null {
  if (!Array.isArray(links)) return null;
  const found = links.find((link) => link && typeof link === 'object' && ['approve', 'payer-action'].includes(String((link as { rel?: string }).rel)));
  const href = (found as { href?: unknown } | undefined)?.href;
  if (typeof href !== 'string') return null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && /(^|\.)paypal\.com$/i.test(url.hostname) ? href : null;
  } catch { return null; }
}

function moneyToCents(value: unknown): number | null {
  if (typeof value !== 'string' && typeof value !== 'number') return null;
  const normalized = String(value);
  if (!/^\d+(?:\.\d{1,2})?$/.test(normalized)) return null;
  const [whole, fraction = ''] = normalized.split('.');
  const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  return Number.isSafeInteger(cents) ? cents : null;
}

/** Pure validation used by both redirect and webhook paths before any grant. */
export function validateCompletedOrder(
  order: Record<string, unknown>,
  expected: { orderId: string; userId: string; amountUsd: number; currency: string },
): { captureId: string; payerId: string | null } {
  if (order.id !== expected.orderId || order.status !== 'COMPLETED') throw new Error('Order is not completed.');
  const units = Array.isArray(order.purchase_units) ? order.purchase_units as Array<Record<string, unknown>> : [];
  if (units.length !== 1 || units[0]?.custom_id !== expected.userId) throw new Error('Order account does not match.');
  const captures = ((units[0]?.payments as { captures?: unknown } | undefined)?.captures ?? []) as unknown;
  if (!Array.isArray(captures) || captures.length < 1) throw new Error('Order has no completed capture.');
  const completed = captures.filter((capture): capture is Record<string, unknown> => Boolean(capture) && typeof capture === 'object' && (capture as { status?: unknown }).status === 'COMPLETED');
  if (!completed.length) throw new Error('Order has no completed capture.');
  const expectedCents = moneyToCents(expected.amountUsd);
  let capturedCents = 0;
  let captureId = '';
  for (const capture of completed) {
    const amount = capture.amount as { value?: unknown; currency_code?: unknown } | undefined;
    if (String(amount?.currency_code ?? '').toUpperCase() !== expected.currency.toUpperCase()) throw new Error('Order currency does not match.');
    const cents = moneyToCents(amount?.value);
    if (cents === null) throw new Error('Order amount is invalid.');
    capturedCents += cents;
    if (!captureId && typeof capture.id === 'string') captureId = capture.id;
  }
  if (expectedCents === null || capturedCents !== expectedCents || !captureId) throw new Error('Order amount does not match.');
  const payer = order.payer as { payer_id?: unknown } | undefined;
  return { captureId, payerId: typeof payer?.payer_id === 'string' ? payer.payer_id : null };
}

function parseRuntime(value: unknown): PayPalRuntimeSettings | null {
  const result = z.object({
    environment: z.enum(['sandbox', 'live']),
    webhookId: z.string().min(3),
    productId: z.string().min(3),
    planIds: z.object({ creator: z.string().min(3), pro: z.string().min(3), agency: z.string().min(3) }),
  }).safeParse(value);
  return result.success && result.data.environment === paypalEnvironment() ? result.data : null;
}

async function loadRuntimeSettings(): Promise<PayPalRuntimeSettings | null> {
  const { rows } = await query<{ value: unknown }>("SELECT value FROM system_settings WHERE key='paypal_runtime' LIMIT 1");
  return parseRuntime(rows[0]?.value);
}

async function saveRuntimeSettings(settings: PayPalRuntimeSettings) {
  await query(
    `INSERT INTO system_settings(key,value) VALUES ('paypal_runtime',$1::jsonb)
     ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW()`,
    [JSON.stringify(settings)],
  );
}

const reconciledWebhookIds = new Set<string>();

async function ensureWebhookEvents(webhookId: string) {
  if (reconciledWebhookIds.has(webhookId)) return;
  const current = await paypalFetch(`/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`, { method: 'GET' });
  const currentEvents = Array.isArray(current.event_types)
    ? (current.event_types as Array<Record<string, unknown>>)
        .map((item) => typeof item.name === 'string' ? item.name : '')
        .filter(Boolean)
    : [];
  const currentSet = new Set(currentEvents);
  const missing = WEBHOOK_EVENTS.filter((name) => !currentSet.has(name));
  if (missing.length) {
    await paypalFetch(`/v1/notifications/webhooks/${encodeURIComponent(webhookId)}`, {
      method: 'PATCH',
      body: [{ op: 'replace', path: '/event_types', value: WEBHOOK_EVENTS.map((name) => ({ name })) }],
    });
    logger.info({ webhookId, addedEvents: missing }, '[paypal] webhook subscriptions updated');
  }
  reconciledWebhookIds.add(webhookId);
}

async function ensureWebhookId(): Promise<string> {
  const configured = process.env.PAYPAL_WEBHOOK_ID?.trim();
  if (configured) {
    await ensureWebhookEvents(configured);
    return configured;
  }
  const url = `${appUrl()}/api/paypal/webhook`;
  if (!url.startsWith('https://')) throw new AppError('A public HTTPS application URL is required before checkout can be enabled.', 503, 'PAYPAL_WEBHOOK_NOT_CONFIGURED');
  const existing = await paypalFetch('/v1/notifications/webhooks?page_size=20', { method: 'GET' });
  const webhooks = Array.isArray(existing.webhooks) ? existing.webhooks as Array<Record<string, unknown>> : [];
  const match = webhooks.find((item) => item.url === url && typeof item.id === 'string');
  if (match?.id) {
    const id = String(match.id);
    await ensureWebhookEvents(id);
    return id;
  }
  const created = await paypalFetch('/v1/notifications/webhooks', {
    method: 'POST',
    idempotencyKey: `webhook-${paypalEnvironment()}-${Buffer.from(url).toString('base64url').slice(0, 40)}`,
    body: { url, event_types: WEBHOOK_EVENTS.map((name) => ({ name })) },
  });
  if (typeof created.id !== 'string') throw new AppError('Payment notifications could not be configured.', 503, 'PAYPAL_WEBHOOK_NOT_CONFIGURED');
  reconciledWebhookIds.add(created.id);
  return created.id;
}

async function ensureCatalogProductId(): Promise<string> {
  const listed = await paypalFetch('/v1/catalogs/products?page_size=20&page=1&total_required=true', { method: 'GET' });
  const products = Array.isArray(listed.products) ? listed.products as Array<Record<string, unknown>> : [];
  const existing = products.find((item) => item.name === 'AiWebVideo Production Credits' && typeof item.id === 'string');
  if (existing?.id) return String(existing.id);
  const created = await paypalFetch('/v1/catalogs/products', {
    method: 'POST',
    idempotencyKey: `catalog-${paypalEnvironment()}-aiwebvideo`,
    body: { name: 'AiWebVideo Production Credits', description: 'Monthly production-credit plans for AiWebVideo', type: 'SERVICE', category: 'SOFTWARE' },
  });
  if (typeof created.id !== 'string') throw new AppError('Subscription products could not be configured.', 503, 'PAYPAL_PLANS_NOT_CONFIGURED');
  return created.id;
}

async function ensurePlanIds(productId: string): Promise<Record<SubscriptionProductId, string>> {
  const listed = await paypalFetch(`/v1/billing/plans?product_id=${encodeURIComponent(productId)}&page_size=20&page=1&total_required=true`, { method: 'GET' });
  const plans = Array.isArray(listed.plans) ? listed.plans as Array<Record<string, unknown>> : [];
  const planIds = {} as Record<SubscriptionProductId, string>;
  for (const id of SUBSCRIPTION_IDS) {
    const product = PRODUCTS[id];
    const planName = `AiWebVideo ${product.name} Monthly`;
    const existing = plans.find((item) => item.name === planName && item.status === 'ACTIVE' && typeof item.id === 'string');
    if (existing?.id) {
      planIds[id] = String(existing.id);
      continue;
    }
    const created = await paypalFetch('/v1/billing/plans', {
      method: 'POST',
      idempotencyKey: `plan-${paypalEnvironment()}-${id}-${product.amountUsd}`,
      body: {
        product_id: productId,
        name: planName,
        description: `${product.credits} AiWebVideo credits each month`,
        status: 'ACTIVE',
        billing_cycles: [{
          frequency: { interval_unit: 'MONTH', interval_count: 1 },
          tenure_type: 'REGULAR', sequence: 1, total_cycles: 0,
          pricing_scheme: { fixed_price: { value: product.amountUsd.toFixed(2), currency_code: 'USD' } },
        }],
        payment_preferences: {
          auto_bill_outstanding: true,
          setup_fee: { value: '0.00', currency_code: 'USD' },
          setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3,
        },
      },
    });
    if (typeof created.id !== 'string') throw new AppError('Subscription plans could not be configured.', 503, 'PAYPAL_PLANS_NOT_CONFIGURED');
    planIds[id] = created.id;
  }
  return planIds;
}

let runtimeSetup: Promise<PayPalRuntimeSettings> | null = null;

async function ensureRuntimeSettings(): Promise<PayPalRuntimeSettings> {
  const stored = await loadRuntimeSettings();
  if (stored) {
    await ensureWebhookEvents(stored.webhookId);
    return stored;
  }
  runtimeSetup ??= (async () => {
    const webhookId = await ensureWebhookId();
    const productId = await ensureCatalogProductId();
    const planIds = await ensurePlanIds(productId);
    const settings: PayPalRuntimeSettings = { environment: paypalEnvironment(), webhookId, productId, planIds };
    await saveRuntimeSettings(settings);
    logger.info({ environment: settings.environment }, '[paypal] checkout catalog and webhook are ready');
    return settings;
  })();
  try { return await runtimeSetup; }
  finally { runtimeSetup = null; }
}

type Attempt = { count: number; resetAt: number };
const checkoutAttempts = new Map<string, Attempt>();

function allowCheckout(key: string): boolean {
  const now = Date.now();
  const current = checkoutAttempts.get(key);
  if (!current || current.resetAt <= now) {
    checkoutAttempts.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  if (checkoutAttempts.size > 5_000) for (const [entry, value] of checkoutAttempts) if (value.resetAt <= now) checkoutAttempts.delete(entry);
  return true;
}

router.post('/checkout', requireAuth, async (req, res) => {
  try {
    if (!allowCheckout(`user:${req.user!.id}`) || !allowCheckout(`ip:${req.ip ?? 'unknown'}`)) {
      throw new AppError('Too many checkout attempts. Please wait a few minutes.', 429, 'RATE_LIMITED');
    }
    const ids = Object.keys(PRODUCTS) as [ProductId, ...ProductId[]];
    const { plan, jobId } = z.object({ plan: z.enum(ids), jobId: z.string().uuid().optional() }).parse(req.body);
    const product = PRODUCTS[plan];
    const runtime = await ensureRuntimeSettings();

    if (product.mode === 'subscription') {
      const data = await paypalFetch('/v1/billing/subscriptions', {
        method: 'POST',
        idempotencyKey: `subscription-${req.user!.id}-${plan}-${randomUUID()}`,
        body: {
          plan_id: runtime.planIds[plan as SubscriptionProductId], custom_id: req.user!.id,
          subscriber: { email_address: req.user!.email },
          application_context: {
            brand_name: 'AiWebVideo',
            return_url: `${appUrl()}/dashboard?checkout=success${jobId ? `&job=${encodeURIComponent(jobId)}` : ''}`,
            cancel_url: `${appUrl()}/pricing?checkout=cancelled`, user_action: 'SUBSCRIBE_NOW',
          },
        },
      });
      const url = approveLink(data.links);
      if (!url) throw new AppError('The payment service did not return a checkout URL.', 502, 'CHECKOUT_FAILED');
      res.json({ checkoutUrl: url });
      return;
    }

    const data = await paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      idempotencyKey: `order-${req.user!.id}-${plan}-${randomUUID()}`,
      body: {
        intent: 'CAPTURE',
        purchase_units: [{ custom_id: req.user!.id, description: `AiWebVideo ${product.name}`, amount: { currency_code: 'USD', value: product.amountUsd.toFixed(2) } }],
        payment_source: { paypal: { experience_context: {
          brand_name: 'AiWebVideo', user_action: 'PAY_NOW',
          return_url: `${appUrl()}/api/paypal/return${jobId ? `?job=${encodeURIComponent(jobId)}` : ''}`,
          cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
        } } },
      },
    });
    const orderId = typeof data.id === 'string' ? data.id : '';
    const url = approveLink(data.links);
    if (!orderId || !url) throw new AppError('The payment service did not return a valid order.', 502, 'CHECKOUT_FAILED');
    await query(
      `INSERT INTO payments(user_id,provider,provider_ref,kind,amount_usd,currency,credits_granted,plan,status)
       VALUES ($1,'paypal',$2,'one_time',$3,'USD',$4,$5,'pending') ON CONFLICT(provider,provider_ref) DO NOTHING`,
      [req.user!.id, orderId, product.amountUsd, product.credits, product.plan],
    );
    res.json({ checkoutUrl: url });
  } catch (error) { sendError(res, error); }
});

router.get('/return', async (req, res) => {
  const orderId = typeof req.query.token === 'string' ? req.query.token : '';
  const jobId = typeof req.query.job === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.job) ? req.query.job : '';
  const redirectFail = `${appUrl()}/pricing?checkout=failed`;
  if (!/^[A-Z0-9-]{8,40}$/i.test(orderId)) {
    res.redirect(redirectFail);
    return;
  }
  try {
    try {
      const captured = await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, { method: 'POST', idempotencyKey: `capture-${orderId}` });
      await grantOneTimePayment(orderId, captured);
    } catch (captureError) {
      // A refreshed return URL can receive an "already captured" response.
      // Re-read the order and rely on local/idempotent payment state before failing.
      logger.warn({ err: captureError, orderId }, '[paypal] capture response needs reconciliation');
      await grantOneTimePayment(orderId);
    }
    res.redirect(`${appUrl()}/dashboard?checkout=success${jobId ? `&job=${encodeURIComponent(jobId)}` : ''}`);
  } catch (error) {
    logger.error({ err: error, orderId }, '[paypal] capture return failed');
    res.redirect(redirectFail);
  }
});

async function grantOneTimePayment(orderId: string, suppliedOrder?: Record<string, unknown>) {
  const { rows } = await query<PendingPayment>(
    `SELECT user_id,amount_usd,currency,credits_granted,plan,status FROM payments
     WHERE provider='paypal' AND provider_ref=$1 LIMIT 1`, [orderId],
  );
  const payment = rows[0];
  if (!payment) throw new Error('Unknown order.');
  if (payment.status === 'paid') {
    await sendOneTimeReceipt(orderId, payment);
    return;
  }
  const order = suppliedOrder ?? await paypalFetch(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' });
  const verified = validateCompletedOrder(order, { orderId, userId: payment.user_id, amountUsd: Number(payment.amount_usd), currency: payment.currency });
  await grantCreditsOnce({ key: `paypal:order:${orderId}`, userId: payment.user_id, credits: payment.credits_granted, reason: `Completed purchase ${orderId}` });
  await query("UPDATE payments SET status='paid',provider_capture_ref=$2 WHERE provider='paypal' AND provider_ref=$1", [orderId, verified.captureId]);
  if (verified.payerId) await query('UPDATE users SET paypal_payer_id=$1,updated_at=NOW() WHERE id=$2', [verified.payerId, payment.user_id]);
  await sendOneTimeReceipt(orderId, payment);
}

router.get('/subscriptions', requireAuth, async (req, res) => {
  try {
    const { rows } = await query<{ id: string; plan: string; status: string; auto_renew: boolean; current_period_start: Date | null; current_period_end: Date | null; last_payment_failed_at: Date | null }>(
      `SELECT id,plan,status,auto_renew,current_period_start,current_period_end,last_payment_failed_at FROM subscriptions
       WHERE user_id=$1 ORDER BY (status='active') DESC,updated_at DESC LIMIT 20`, [req.user!.id],
    );
    res.json({ subscriptions: rows.map((item) => ({
      id: item.id, plan: item.plan, status: item.status, autoRenew: item.auto_renew,
      currentPeriodStart: item.current_period_start, currentPeriodEnd: item.current_period_end,
      lastPaymentFailedAt: item.last_payment_failed_at,
    })) });
  } catch (error) { sendError(res, error); }
});

router.get('/billing-history', requireAuth, async (req, res) => {
  try {
    const { rows } = await query<{
      id: string; provider_ref: string; kind: string; amount_usd: string | number; currency: string;
      credits_granted: number; plan: string | null; status: string; created_at: Date;
    }>(
      `SELECT id,provider_ref,kind,amount_usd,currency,credits_granted,plan,status,created_at
       FROM payments WHERE user_id=$1 ORDER BY created_at DESC LIMIT 60`,
      [req.user!.id],
    );
    res.json({ payments: rows.map((row) => ({
      id: row.id,
      reference: row.provider_ref,
      kind: row.kind,
      amountUsd: Number(row.amount_usd),
      currency: row.currency,
      creditsGranted: row.credits_granted,
      plan: row.plan,
      status: row.status,
      createdAt: row.created_at,
    })) });
  } catch (error) { sendError(res, error); }
});

router.post('/subscriptions/:id/cancel', requireAuth, async (req, res) => {
  try {
    const id = z.string().uuid().parse(req.params.id);
    const { rows } = await query<{ paypal_subscription_id: string; status: string; plan: string; current_period_end: Date | null }>(
      'SELECT paypal_subscription_id,status,plan,current_period_end FROM subscriptions WHERE id=$1 AND user_id=$2', [id, req.user!.id],
    );
    const subscription = rows[0];
    if (!subscription?.paypal_subscription_id) throw new AppError('Subscription not found.', 404, 'NOT_FOUND');
    if (subscription.status !== 'cancelled') {
      await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscription.paypal_subscription_id)}/cancel`, { method: 'POST', body: { reason: 'Cancelled by customer' } });
      await query("UPDATE subscriptions SET auto_renew=false,status='cancelled',provider_status='CANCELLED',updated_at=NOW() WHERE id=$1 AND user_id=$2", [id, req.user!.id]);
    }
    await sendBillingOnce(`subscription:cancelled:${subscription.paypal_subscription_id}`, req.user!.id, 'subscription_cancelled', (email) =>
      sendSubscriptionCancelledEmail({
        to: email,
        plan: subscription.plan,
        periodEnd: subscription.current_period_end?.toISOString().slice(0, 10) ?? null,
      }),
    );
    res.json({ ok: true });
  } catch (error) { sendError(res, error); }
});

async function once(eventId: string, action: () => Promise<void>) {
  const { rowCount } = await query('INSERT INTO paypal_events(event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id', [eventId]);
  if (!rowCount) return;
  try { await action(); }
  catch (error) {
    await query('DELETE FROM paypal_events WHERE event_id=$1', [eventId]).catch(() => {});
    throw error;
  }
}

async function verifyWebhookSignature(headers: Record<string, unknown>, body: unknown): Promise<boolean> {
  const runtime = await ensureRuntimeSettings();
  const requiredHeaders = {
    transmission_id: headers['paypal-transmission-id'], transmission_time: headers['paypal-transmission-time'],
    cert_url: headers['paypal-cert-url'], auth_algo: headers['paypal-auth-algo'], transmission_sig: headers['paypal-transmission-sig'],
  };
  if (Object.values(requiredHeaders).some((value) => typeof value !== 'string' || !value)) return false;
  const result = await paypalFetch('/v1/notifications/verify-webhook-signature', {
    method: 'POST', body: { ...requiredHeaders, webhook_id: runtime.webhookId, webhook_event: body },
  });
  return result.verification_status === 'SUCCESS';
}

async function subscriptionProduct(planId: string): Promise<{ id: SubscriptionProductId; product: typeof PRODUCTS[SubscriptionProductId] } | null> {
  const runtime = await ensureRuntimeSettings();
  const id = SUBSCRIPTION_IDS.find((candidate) => runtime.planIds[candidate] === planId);
  return id ? { id, product: PRODUCTS[id] } : null;
}

function verifySubscriptionSaleAmount(resource: Record<string, unknown>, expectedUsd: number) {
  const amount = resource.amount as { total?: unknown; value?: unknown; currency?: unknown; currency_code?: unknown } | undefined;
  const cents = moneyToCents(amount?.total ?? amount?.value);
  const currency = String(amount?.currency ?? amount?.currency_code ?? '').toUpperCase();
  if (cents !== moneyToCents(expectedUsd) || currency !== 'USD') throw new Error('Subscription payment amount does not match the configured plan.');
}

function subscriptionDates(resource: Record<string, unknown>) {
  const billing = resource.billing_info as { next_billing_time?: unknown; last_payment?: { time?: unknown } } | undefined;
  const start = typeof billing?.last_payment?.time === 'string'
    ? billing.last_payment.time
    : typeof resource.start_time === 'string'
      ? resource.start_time
      : null;
  const end = typeof billing?.next_billing_time === 'string' ? billing.next_billing_time : null;
  return { start, end };
}

async function sendBillingOnce(
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
  if (!inserted.rowCount) return false;
  try {
    const { rows } = await query<{ email: string }>('SELECT email FROM users WHERE id=$1 LIMIT 1', [userId]);
    const email = rows[0]?.email;
    if (!email || !(await sender(email))) {
      await query('DELETE FROM billing_notifications WHERE notification_key=$1', [key]).catch(() => {});
      return false;
    }
    return true;
  } catch (error) {
    await query('DELETE FROM billing_notifications WHERE notification_key=$1', [key]).catch(() => {});
    logger.warn({ err: error, kind, userId }, '[billing-email] delivery failed; notification remains retryable');
    return false;
  }
}

async function sendOneTimeReceipt(orderId: string, payment: PendingPayment) {
  await sendBillingOnce(`receipt:order:${orderId}`, payment.user_id, 'credit_purchase', (email) =>
    sendCreditPurchaseEmail({
      to: email,
      credits: payment.credits_granted,
      amountUsd: Number(payment.amount_usd),
      reference: orderId,
    }),
  );
  await query(
    `UPDATE payments SET invoice_emailed_at=COALESCE(invoice_emailed_at,NOW())
     WHERE provider='paypal' AND provider_ref=$1`,
    [orderId],
  ).catch(() => {});
}

router.post('/webhook', async (req, res) => {
  try {
    const event = z.object({
      id: z.string().min(3).max(200),
      event_type: z.string().min(3).max(120),
      resource: z.record(z.string(), z.unknown()),
    }).parse(req.body);
    const verified = await verifyWebhookSignature(req.headers as Record<string, unknown>, event).catch(() => false);
    if (!verified) throw new AppError('Invalid payment notification signature.', 400, 'INVALID_SIGNATURE');

    await once(event.id, async () => {
      const resource = event.resource;

      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = (resource.supplementary_data as { related_ids?: { order_id?: unknown } } | undefined)?.related_ids?.order_id;
        if (typeof orderId === 'string') await grantOneTimePayment(orderId);
        return;
      }

      if (['BILLING.SUBSCRIPTION.CREATED', 'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.UPDATED'].includes(event.event_type)) {
        const subscriptionId = typeof resource.id === 'string' ? resource.id : '';
        if (!subscriptionId) throw new Error('Subscription identifier is missing.');
        const remote = event.event_type === 'BILLING.SUBSCRIPTION.UPDATED'
          ? await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'GET' })
          : resource;
        const userId = typeof remote.custom_id === 'string' ? remote.custom_id : '';
        const planId = typeof remote.plan_id === 'string' ? remote.plan_id : '';
        const matched = planId ? await subscriptionProduct(planId) : null;
        if (!userId || !matched) throw new Error('Unknown subscription lifecycle event.');
        const providerStatus = String(remote.status ?? resource.status ?? '').toUpperCase() || 'UNKNOWN';
        const active = ['ACTIVE', 'APPROVED'].includes(providerStatus);
        const dates = subscriptionDates(remote);
        await query(
          `INSERT INTO subscriptions(
             user_id,paypal_subscription_id,plan,status,auto_renew,current_period_start,current_period_end,provider_status,updated_at
           ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,NOW())
           ON CONFLICT(paypal_subscription_id) DO UPDATE SET
             user_id=EXCLUDED.user_id,
             plan=EXCLUDED.plan,
             status=EXCLUDED.status,
             auto_renew=EXCLUDED.auto_renew,
             current_period_start=COALESCE(EXCLUDED.current_period_start,subscriptions.current_period_start),
             current_period_end=COALESCE(EXCLUDED.current_period_end,subscriptions.current_period_end),
             provider_status=EXCLUDED.provider_status,
             updated_at=NOW()`,
          [userId, subscriptionId, matched.product.plan, active ? 'active' : providerStatus.toLowerCase(), active, dates.start, dates.end, providerStatus],
        );
        return;
      }

      if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
        const saleId = typeof resource.id === 'string' ? resource.id : '';
        const subscriptionId = typeof resource.billing_agreement_id === 'string' ? resource.billing_agreement_id : '';
        if (!saleId || !subscriptionId) throw new Error('Subscription payment identifiers are missing.');

        const remote = await paypalFetch(`/v1/billing/subscriptions/${encodeURIComponent(subscriptionId)}`, { method: 'GET' });
        const userId = typeof remote.custom_id === 'string' ? remote.custom_id : '';
        const planId = typeof remote.plan_id === 'string' ? remote.plan_id : '';
        const matched = planId ? await subscriptionProduct(planId) : null;
        if (!userId || !matched || !['ACTIVE', 'APPROVED'].includes(String(remote.status))) {
          throw new Error('Subscription payment could not be verified.');
        }
        verifySubscriptionSaleAmount(resource, matched.product.amountUsd);
        const dates = subscriptionDates(remote);

        await query(
          `INSERT INTO subscriptions(
             user_id,paypal_subscription_id,plan,status,auto_renew,current_period_start,current_period_end,provider_status,last_payment_failed_at,updated_at
           ) VALUES ($1,$2,$3,'active',true,$4,$5,$6,NULL,NOW())
           ON CONFLICT(paypal_subscription_id) DO UPDATE SET
             user_id=EXCLUDED.user_id,
             plan=EXCLUDED.plan,
             status='active',
             auto_renew=true,
             current_period_start=COALESCE(EXCLUDED.current_period_start,subscriptions.current_period_start),
             current_period_end=COALESCE(EXCLUDED.current_period_end,subscriptions.current_period_end),
             provider_status=EXCLUDED.provider_status,
             last_payment_failed_at=NULL,
             updated_at=NOW()`,
          [userId, subscriptionId, matched.product.plan, dates.start, dates.end, String(remote.status)],
        );

        const existing = await query<{ count: number }>(
          "SELECT COUNT(*)::int count FROM payments WHERE provider='paypal' AND user_id=$1 AND kind LIKE 'subscription_%' AND status='paid'",
          [userId],
        );
        const kind = (existing.rows[0]?.count ?? 0) === 0 ? 'subscription_initial' : 'subscription_renewal';

        await grantCreditsOnce({
          key: `paypal:sale:${saleId}`,
          userId,
          credits: matched.product.credits,
          plan: matched.product.plan,
          reason: `Completed subscription payment ${saleId}`,
        });
        await query(
          `INSERT INTO payments(user_id,provider,provider_ref,kind,amount_usd,currency,credits_granted,plan,status)
           VALUES ($1,'paypal',$2,$3,$4,'USD',$5,$6,'paid')
           ON CONFLICT(provider,provider_ref) DO UPDATE SET status='paid'`,
          [userId, saleId, kind, matched.product.amountUsd, matched.product.credits, matched.product.plan],
        );

        const nextBillingDate = dates.end ? new Date(dates.end).toISOString().slice(0, 10) : null;
        await sendBillingOnce(`receipt:sale:${saleId}`, userId, kind, (email) =>
          kind === 'subscription_initial'
            ? sendSubscriptionStartedEmail({
                to: email,
                plan: matched.product.name,
                credits: matched.product.credits,
                amountUsd: matched.product.amountUsd,
                reference: subscriptionId,
                nextBillingDate,
              })
            : sendSubscriptionRenewalEmail({
                to: email,
                plan: matched.product.name,
                credits: matched.product.credits,
                amountUsd: matched.product.amountUsd,
                reference: saleId,
                nextBillingDate,
              }),
        );
        await query(
          `UPDATE payments SET invoice_emailed_at=COALESCE(invoice_emailed_at,NOW())
           WHERE provider='paypal' AND provider_ref=$1`,
          [saleId],
        ).catch(() => {});
        return;
      }

      if (event.event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') {
        const subscriptionId =
          (typeof resource.id === 'string' && resource.id.startsWith('I-') ? resource.id : '') ||
          (typeof resource.billing_agreement_id === 'string' ? resource.billing_agreement_id : '');
        if (!subscriptionId) throw new Error('Subscription identifier is missing for failed payment.');
        const { rows } = await query<{ user_id: string; plan: string }>(
          `UPDATE subscriptions
           SET status='past_due',provider_status='PAYMENT_FAILED',last_payment_failed_at=NOW(),updated_at=NOW()
           WHERE paypal_subscription_id=$1
           RETURNING user_id,plan`,
          [subscriptionId],
        );
        const local = rows[0];
        if (local) {
          await sendBillingOnce(`subscription:payment-failed:${event.id}`, local.user_id, 'subscription_payment_failed', (email) =>
            sendSubscriptionPaymentFailedEmail({ to: email, plan: local.plan, reference: subscriptionId }),
          );
        }
        return;
      }

      if (['BILLING.SUBSCRIPTION.CANCELLED', 'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.SUSPENDED'].includes(event.event_type)) {
        const subscriptionId = typeof resource.id === 'string' ? resource.id : '';
        if (!subscriptionId) throw new Error('Subscription identifier is missing.');
        const providerStatus =
          event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED' ? 'SUSPENDED' :
          event.event_type === 'BILLING.SUBSCRIPTION.EXPIRED' ? 'EXPIRED' : 'CANCELLED';
        const localStatus = providerStatus === 'SUSPENDED' ? 'suspended' : 'cancelled';
        const { rows } = await query<{ user_id: string; plan: string; current_period_end: Date | null }>(
          `UPDATE subscriptions
           SET status=$2,auto_renew=false,provider_status=$3,updated_at=NOW()
           WHERE paypal_subscription_id=$1
           RETURNING user_id,plan,current_period_end`,
          [subscriptionId, localStatus, providerStatus],
        );
        const local = rows[0];
        if (local) {
          if (providerStatus === 'SUSPENDED') {
            await sendBillingOnce(`subscription:suspended:${event.id}`, local.user_id, 'subscription_suspended', (email) =>
              sendSubscriptionPaymentFailedEmail({ to: email, plan: local.plan, reference: subscriptionId }),
            );
          } else {
            await sendBillingOnce(`subscription:cancelled:${subscriptionId}`, local.user_id, 'subscription_cancelled', (email) =>
              sendSubscriptionCancelledEmail({
                to: email,
                plan: local.plan,
                periodEnd: local.current_period_end?.toISOString().slice(0, 10) ?? null,
              }),
            );
          }
        }
        return;
      }

      if ([
        'PAYMENT.SALE.REFUNDED',
        'PAYMENT.SALE.REVERSED',
        'PAYMENT.CAPTURE.REFUNDED',
        'PAYMENT.CAPTURE.REVERSED',
      ].includes(event.event_type)) {
        const isCaptureEvent = event.event_type.startsWith('PAYMENT.CAPTURE.');
        const relatedOrderId =
          (resource.supplementary_data as { related_ids?: { order_id?: unknown } } | undefined)?.related_ids?.order_id;
        const providerRef = isCaptureEvent
          ? (typeof relatedOrderId === 'string' ? relatedOrderId : '')
          : (typeof resource.sale_id === 'string' ? resource.sale_id : typeof resource.id === 'string' ? resource.id : '');
        if (providerRef) {
          const status = event.event_type.endsWith('.REFUNDED') ? 'refunded' : 'reversed';
          const { rows } = await query<{ user_id: string; amount_usd: string | number }>(
            `UPDATE payments SET status=$2
             WHERE provider='paypal' AND provider_ref=$1
             RETURNING user_id,amount_usd`,
            [providerRef, status],
          );
          const payment = rows[0];
          if (payment) {
            await sendBillingOnce(`payment:${status}:${event.id}`, payment.user_id, `payment_${status}`, (email) =>
              sendPaymentRefundedEmail({
                to: email,
                amountUsd: Number(payment.amount_usd),
                reference: providerRef,
                reversed: status === 'reversed',
              }),
            );
          }
        }
      }
    });

    res.json({ received: true });
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
