import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { query } from '../lib/pool.js';
import { AppError, sendError } from '../lib/errors.js';
import { grantCreditsOnce } from '../lib/billing.js';
import { logger } from '../lib/logger.js';
import { sendCreditPurchaseEmail } from '../lib/mailer.js';
import {
  CREDIT_DISPLAY_MULTIPLIER,
  WELCOME_OFFER_PRODUCTS,
  marginSafeWelcomePrice,
} from '../lib/growth-offers.js';
import { settleGrowthCredits } from './growth.js';
import { PRODUCTS, normalizePayPalEnvironment, validateCompletedOrder } from './paypal.js';

const router = Router();

const ONE_TIME_PRODUCT_IDS = [
  'single8',
  'single48',
  'single144',
  'topup50',
  'topup100',
  'topup250',
] as const;
type OneTimeProductId = typeof ONE_TIME_PRODUCT_IDS[number];

const orderSchema = z.object({
  plan: z.enum(ONE_TIME_PRODUCT_IDS),
  jobId: z.string().uuid().optional(),
  source: z.enum(['card', 'saved_card', 'google_pay']).default('card'),
  saveCard: z.boolean().optional().default(false),
  paymentMethodId: z.string().uuid().optional(),
  expectedAmountUsd: z.number().positive().max(10_000).optional(),
});

function paypalEnvironment() {
  return normalizePayPalEnvironment(process.env.PAYPAL_ENV);
}

function paypalBase() {
  return paypalEnvironment() === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function sdkBase() {
  return paypalEnvironment() === 'live' ? 'https://www.paypal.com' : 'https://www.sandbox.paypal.com';
}

function appUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
  let parsed: URL;
  try { parsed = new URL(raw); }
  catch { throw new AppError('The application URL is not configured correctly.', 503, 'APP_URL_NOT_CONFIGURED'); }
  if (!['http:', 'https:'].includes(parsed.protocol)) throw new AppError('The application URL is not configured correctly.', 503, 'APP_URL_NOT_CONFIGURED');
  return parsed.toString().replace(/\/$/, '');
}

function envFlag(name: string, fallback: boolean) {
  const value = process.env[name];
  if (value === undefined || value === '') return fallback;
  return !['0', 'false', 'off', 'no'].includes(value.trim().toLowerCase());
}

function advancedCardsEnabled() {
  return envFlag('PAYPAL_ADVANCED_CARDS_ENABLED', true);
}

function vaultEnabled() {
  return envFlag('PAYPAL_VAULT_ENABLED', false);
}

function googlePayEnabled() {
  return envFlag('PAYPAL_GOOGLE_PAY_ENABLED', true);
}

let accessTokenCache: { value: string; expiresAt: number } | null = null;
let schemaReady: Promise<void> | null = null;

type Attempt = { count: number; resetAt: number };
const checkoutAttempts = new Map<string, Attempt>();

function allowCheckout(key: string) {
  const now = Date.now();
  const current = checkoutAttempts.get(key);
  if (!current || current.resetAt <= now) {
    checkoutAttempts.set(key, { count: 1, resetAt: now + 10 * 60_000 });
    return true;
  }
  if (current.count >= 12) return false;
  current.count += 1;
  if (checkoutAttempts.size > 5_000) {
    for (const [entry, value] of checkoutAttempts) if (value.resetAt <= now) checkoutAttempts.delete(entry);
  }
  return true;
}

async function ensureCardCheckoutSchema() {
  schemaReady ??= (async () => {
    await query('ALTER TABLE users ADD COLUMN IF NOT EXISTS paypal_customer_id TEXT');
    await query(`
      CREATE TABLE IF NOT EXISTS paypal_saved_payment_methods (
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
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS paypal_saved_payment_methods_user_idx ON paypal_saved_payment_methods(user_id, created_at DESC)');
    await query(`
      CREATE TABLE IF NOT EXISTS paypal_card_checkout_sessions (
        id UUID PRIMARY KEY,
        user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        order_id TEXT UNIQUE,
        job_id UUID,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '30 minutes')
      )
    `);
    await query('CREATE INDEX IF NOT EXISTS paypal_card_checkout_sessions_user_idx ON paypal_card_checkout_sessions(user_id, created_at DESC)');
  })().catch((error) => {
    schemaReady = null;
    throw error;
  });
  return schemaReady;
}

async function oauthToken(options?: { includeIdToken?: boolean; targetCustomerId?: string | null }) {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) {
    throw new AppError('Checkout is not configured yet.', 503, 'BILLING_NOT_CONFIGURED');
  }

  if (!options?.includeIdToken && accessTokenCache && accessTokenCache.expiresAt > Date.now() + 30_000) {
    return { accessToken: accessTokenCache.value, idToken: null as string | null };
  }

  const params = new URLSearchParams({ grant_type: 'client_credentials' });
  if (options?.includeIdToken) params.set('response_type', 'id_token');
  if (options?.targetCustomerId) params.set('target_customer_id', options.targetCustomerId);

  let response: globalThis.Response;
  try {
    response = await fetch(`${paypalBase()}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: params.toString(),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (error) {
    logger.error({ err: error }, '[paypal-card] OAuth network request failed');
    throw new AppError('The card payment service could not be reached.', 502, 'PAYPAL_REQUEST_FAILED');
  }

  const raw = await response.text();
  let data: { access_token?: string; id_token?: string; expires_in?: number; error?: string } = {};
  try { data = JSON.parse(raw) as typeof data; }
  catch { data = {}; }
  if (!response.ok || !data.access_token) {
    logger.error({ status: response.status, providerCode: data.error }, '[paypal-card] OAuth failed');
    throw new AppError('Secure card checkout is not available right now.', 503, 'PAYPAL_CARD_AUTH_FAILED');
  }

  if (!options?.includeIdToken) {
    accessTokenCache = {
      value: data.access_token,
      expiresAt: Date.now() + Math.max(60, Number(data.expires_in) || 300) * 1000,
    };
  }
  return { accessToken: data.access_token, idToken: data.id_token ?? null };
}

async function paypalRequest(
  path: string,
  init: { method: string; body?: unknown; idempotencyKey?: string; accept404?: boolean },
) {
  const { accessToken } = await oauthToken();
  let response: globalThis.Response;
  try {
    response = await fetch(`${paypalBase()}${path}`, {
      method: init.method,
      headers: {
        authorization: `Bearer ${accessToken}`,
        accept: 'application/json',
        'content-type': 'application/json',
        ...(init.idempotencyKey ? { 'PayPal-Request-Id': init.idempotencyKey } : {}),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: AbortSignal.timeout(25_000),
    });
  } catch (error) {
    logger.error({ err: error, path }, '[paypal-card] provider network request failed');
    throw new AppError('The payment service is temporarily unavailable.', 502, 'PAYPAL_REQUEST_FAILED');
  }

  if (init.accept404 && response.status === 404) return null;
  const raw = await response.text();
  let data: Record<string, unknown> = {};
  if (raw) {
    try { data = JSON.parse(raw) as Record<string, unknown>; }
    catch { data = {}; }
  }
  if (!response.ok) {
    const providerName = String(data.name ?? data.issue ?? '');
    const details = Array.isArray(data.details) ? data.details.slice(0, 2) : undefined;
    logger.warn({ status: response.status, path, providerName, details }, '[paypal-card] provider rejected request');
    if (response.status === 403) {
      throw new AppError(
        'Direct card payments are not enabled for this PayPal merchant account yet. Use PayPal checkout or enable Advanced Card Payments in PayPal.',
        503,
        'PAYPAL_ADVANCED_CARDS_NOT_ENABLED',
      );
    }
    throw new AppError('The card payment could not be processed. Please check the card or try another payment method.', 422, 'CARD_PAYMENT_FAILED');
  }
  return data;
}

async function paypalCustomerId(userId: string) {
  await ensureCardCheckoutSchema();
  const { rows } = await query<{ paypal_customer_id: string | null }>(
    'SELECT paypal_customer_id FROM users WHERE id=$1 LIMIT 1',
    [userId],
  );
  return rows[0]?.paypal_customer_id ?? null;
}

async function currentCheckoutAmount(userId: string, plan: OneTimeProductId) {
  const product = PRODUCTS[plan];
  const growth = WELCOME_OFFER_PRODUCTS.has(plan)
    ? await settleGrowthCredits(userId).catch(() => null)
    : null;
  const amountUsd = growth?.active
    ? marginSafeWelcomePrice({
        productId: plan,
        amountUsd: product.amountUsd,
        purchasedInternalCredits: product.credits,
      })
    : product.amountUsd;
  return {
    amountUsd,
    normalAmountUsd: product.amountUsd,
    discountApplied: amountUsd < product.amountUsd,
  };
}

async function pendingPayment(orderId: string, userId: string) {
  const { rows } = await query<{
    user_id: string;
    amount_usd: string | number;
    currency: string;
    credits_granted: number;
    plan: string | null;
    status: string;
    product_id: string | null;
  }>(
    `SELECT user_id,amount_usd,currency,credits_granted,plan,status,product_id
       FROM payments
      WHERE provider='paypal' AND provider_ref=$1 AND user_id=$2
      LIMIT 1`,
    [orderId, userId],
  );
  return rows[0] ?? null;
}

async function sendReceiptOnce(orderId: string, userId: string, credits: number, amountUsd: number) {
  const notificationKey = `receipt:order:${orderId}`;
  const inserted = await query(
    `INSERT INTO billing_notifications(notification_key,user_id,kind)
     VALUES ($1,$2,'credit_purchase') ON CONFLICT DO NOTHING RETURNING notification_key`,
    [notificationKey, userId],
  );
  if (!inserted.rowCount) return;
  try {
    const { rows } = await query<{ email: string }>('SELECT email FROM users WHERE id=$1 LIMIT 1', [userId]);
    const email = rows[0]?.email;
    const delivered = email
      ? await sendCreditPurchaseEmail({
          to: email,
          credits: Math.max(0, Math.round(credits)) * CREDIT_DISPLAY_MULTIPLIER,
          amountUsd,
          reference: orderId,
        })
      : false;
    if (!delivered) {
      await query('DELETE FROM billing_notifications WHERE notification_key=$1', [notificationKey]).catch(() => {});
      return;
    }
    await query(
      `UPDATE payments SET invoice_emailed_at=COALESCE(invoice_emailed_at,NOW())
       WHERE provider='paypal' AND provider_ref=$1`,
      [orderId],
    ).catch(() => {});
  } catch (error) {
    await query('DELETE FROM billing_notifications WHERE notification_key=$1', [notificationKey]).catch(() => {});
    logger.warn({ err: error, orderId }, '[paypal-card] receipt delivery failed');
  }
}

async function upsertSavedMethod(input: {
  userId: string;
  providerTokenRef: string;
  brand: string | null;
  lastDigits: string | null;
  expiry: string | null;
}) {
  const aliasId = randomUUID();
  const { rows } = await query<{ id: string }>(
    `INSERT INTO paypal_saved_payment_methods(id,user_id,provider,provider_token_ref,brand,last_digits,expiry)
     VALUES ($1,$2,'paypal',$3,$4,$5,$6)
     ON CONFLICT(provider,provider_token_ref) DO UPDATE SET
       brand=EXCLUDED.brand,last_digits=EXCLUDED.last_digits,
       expiry=EXCLUDED.expiry,updated_at=NOW()
     WHERE paypal_saved_payment_methods.user_id=EXCLUDED.user_id
     RETURNING id`,
    [aliasId, input.userId, input.providerTokenRef, input.brand, input.lastDigits, input.expiry],
  );
  if (!rows[0]?.id) {
    logger.error({ userId: input.userId }, '[paypal-card] vault token ownership mismatch blocked');
    throw new AppError('Saved payment method ownership could not be verified.', 409, 'PAYMENT_METHOD_OWNERSHIP_MISMATCH');
  }
  return rows[0].id;
}

async function saveVaultMetadata(userId: string, captured: Record<string, unknown>) {
  if (!vaultEnabled()) return null;
  const paymentSource = captured.payment_source as { card?: Record<string, unknown> } | undefined;
  const card = paymentSource?.card;
  if (!card) return null;
  const attributes = card.attributes as { vault?: Record<string, unknown> } | undefined;
  const vault = attributes?.vault;
  const customer = vault?.customer as { id?: unknown } | undefined;
  const customerId = typeof customer?.id === 'string' ? customer.id : '';
  if (customerId) {
    await ensureCardCheckoutSchema();
    await query('UPDATE users SET paypal_customer_id=$1,updated_at=NOW() WHERE id=$2', [customerId, userId]);
  }

  const vaultId = typeof vault?.id === 'string' ? vault.id : '';
  const vaultStatus = String(vault?.status ?? '').toUpperCase();
  if (!vaultId || vaultStatus !== 'VAULTED') return null;

  const brand = typeof card.brand === 'string' ? card.brand : null;
  const lastDigits = typeof card.last_digits === 'string'
    ? card.last_digits
    : typeof card['last-digits'] === 'string'
      ? String(card['last-digits'])
      : null;
  const expiry = typeof card.expiry === 'string' ? card.expiry : null;
  return upsertSavedMethod({ userId, providerTokenRef: vaultId, brand, lastDigits, expiry });
}

async function refreshSavedMethods(userId: string) {
  await ensureCardCheckoutSchema();
  const customerId = await paypalCustomerId(userId);
  if (!customerId || !vaultEnabled()) return;
  try {
    const data = await paypalRequest(
      `/v3/vault/payment-tokens?customer_id=${encodeURIComponent(customerId)}&page_size=20`,
      { method: 'GET' },
    );
    const tokens = Array.isArray(data?.payment_tokens) ? data.payment_tokens as Array<Record<string, unknown>> : [];
    const activeRefs: string[] = [];
    for (const token of tokens) {
      if (typeof token.id !== 'string') continue;
      const source = token.payment_source as { card?: Record<string, unknown> } | undefined;
      const card = source?.card;
      if (!card) continue;
      activeRefs.push(token.id);
      await upsertSavedMethod({
        userId,
        providerTokenRef: token.id,
        brand: typeof card.brand === 'string' ? card.brand : null,
        lastDigits: typeof card.last_digits === 'string' ? card.last_digits : null,
        expiry: typeof card.expiry === 'string' ? card.expiry : null,
      });
    }
    await query(
      `DELETE FROM paypal_saved_payment_methods
        WHERE user_id=$1 AND provider='paypal' AND NOT (provider_token_ref = ANY($2::text[]))`,
      [userId, activeRefs],
    );
  } catch (error) {
    logger.info({ err: error, userId }, '[paypal-card] saved-method refresh unavailable; using local masked metadata');
  }
}

function payerActionLink(links: unknown) {
  if (!Array.isArray(links)) return null;
  const found = links.find((item) => item && typeof item === 'object' && (item as { rel?: unknown }).rel === 'payer-action');
  const href = (found as { href?: unknown } | undefined)?.href;
  if (typeof href !== 'string') return null;
  try {
    const url = new URL(href);
    return url.protocol === 'https:' && /(^|\.)paypal\.com$/i.test(url.hostname) ? href : null;
  } catch { return null; }
}

async function finalizeOrder(userId: string, orderId: string) {
  const payment = await pendingPayment(orderId, userId);
  if (!payment) throw new AppError('Payment order not found.', 404, 'NOT_FOUND');
  if (payment.status === 'paid') {
    return {
      ok: true,
      orderId,
      creditsGranted: payment.credits_granted,
      amountUsd: Number(payment.amount_usd),
      savedPaymentMethodId: null as string | null,
    };
  }

  let captured: Record<string, unknown>;
  try {
    captured = (await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}/capture`, {
      method: 'POST',
      idempotencyKey: `capture-${orderId}`,
    })) ?? {};
  } catch (captureError) {
    const current = await paypalRequest(`/v2/checkout/orders/${encodeURIComponent(orderId)}`, { method: 'GET' }).catch(() => null);
    if (!current || current.status !== 'COMPLETED') throw captureError;
    captured = current;
  }

  const verified = validateCompletedOrder(captured, {
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

  const savedPaymentMethodId = await saveVaultMetadata(userId, captured).catch((error) => {
    logger.info({ err: error, orderId }, '[paypal-card] payment succeeded but card vault metadata was not persisted');
    return null;
  });
  await sendReceiptOnce(orderId, userId, payment.credits_granted, Number(payment.amount_usd));

  return {
    ok: true,
    orderId,
    amountUsd: Number(payment.amount_usd),
    creditsGranted: payment.credits_granted,
    savedPaymentMethodId,
  };
}

router.get('/config', requireAuth, async (req, res) => {
  try {
    await ensureCardCheckoutSchema();
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const configured = Boolean(clientId && process.env.PAYPAL_CLIENT_SECRET?.trim());
    let userIdToken: string | null = null;
    let canVault = configured && vaultEnabled();
    if (canVault) {
      try {
        const customerId = await paypalCustomerId(req.user!.id);
        const token = await oauthToken({ includeIdToken: true, targetCustomerId: customerId });
        userIdToken = token.idToken;
        canVault = Boolean(userIdToken);
      } catch (error) {
        logger.info({ err: error, userId: req.user!.id }, '[paypal-card] vault identity token unavailable');
        canVault = false;
      }
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      configured,
      clientId: configured ? clientId : null,
      environment: paypalEnvironment(),
      sdkBase: sdkBase(),
      advancedCardsEnabled: configured && advancedCardsEnabled(),
      vaultEnabled: canVault,
      googlePayEnabled: configured && googlePayEnabled(),
      userIdToken,
    });
  } catch (error) { sendError(res, error); }
});

router.get('/methods', requireAuth, async (req, res) => {
  try {
    await refreshSavedMethods(req.user!.id);
    const { rows } = await query<{
      id: string;
      brand: string | null;
      last_digits: string | null;
      expiry: string | null;
      created_at: Date;
    }>(
      `SELECT id,brand,last_digits,expiry,created_at
         FROM paypal_saved_payment_methods
        WHERE user_id=$1 AND provider='paypal'
        ORDER BY updated_at DESC,created_at DESC
        LIMIT 10`,
      [req.user!.id],
    );
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      methods: rows.map((row) => ({
        id: row.id,
        brand: row.brand ?? 'CARD',
        lastDigits: row.last_digits ?? '',
        expiry: row.expiry,
      })),
    });
  } catch (error) { sendError(res, error); }
});

router.delete('/methods/:id', requireAuth, async (req, res) => {
  try {
    await ensureCardCheckoutSchema();
    const id = z.string().uuid().parse(req.params.id);
    const { rows } = await query<{ provider_token_ref: string }>(
      `SELECT provider_token_ref FROM paypal_saved_payment_methods
       WHERE id=$1 AND user_id=$2 AND provider='paypal' LIMIT 1`,
      [id, req.user!.id],
    );
    const tokenRef = rows[0]?.provider_token_ref;
    if (!tokenRef) throw new AppError('Saved card not found.', 404, 'NOT_FOUND');
    await paypalRequest(`/v3/vault/payment-tokens/${encodeURIComponent(tokenRef)}`, { method: 'DELETE', accept404: true });
    await query('DELETE FROM paypal_saved_payment_methods WHERE id=$1 AND user_id=$2', [id, req.user!.id]);
    res.json({ deleted: true });
  } catch (error) { sendError(res, error); }
});

router.post('/orders', requireAuth, async (req, res) => {
  try {
    if (!allowCheckout(`user:${req.user!.id}`) || !allowCheckout(`ip:${req.ip ?? 'unknown'}`)) {
      throw new AppError('Too many payment attempts. Please wait a few minutes.', 429, 'RATE_LIMITED');
    }
    if (!advancedCardsEnabled()) {
      throw new AppError('Direct card checkout is disabled. Use PayPal checkout.', 503, 'PAYPAL_ADVANCED_CARDS_DISABLED');
    }
    await ensureCardCheckoutSchema();
    const input = orderSchema.parse(req.body);
    const product = PRODUCTS[input.plan];
    if (product.mode !== 'payment') throw new AppError('This product uses subscription checkout.', 400, 'CARD_CHECKOUT_NOT_SUPPORTED');

    const pricing = await currentCheckoutAmount(req.user!.id, input.plan);
    if (input.expectedAmountUsd !== undefined && input.expectedAmountUsd + 0.005 < pricing.amountUsd) {
      throw new AppError('The limited-time price changed before payment. Review the current price and try again.', 409, 'PRICE_CHANGED');
    }

    const checkoutSessionId = randomUUID();
    const returnUrl = `${appUrl()}/api/paypal-card/return/${checkoutSessionId}`;
    let paymentSource: Record<string, unknown> | undefined;
    if (input.source === 'saved_card') {
      if (!input.paymentMethodId) throw new AppError('Choose a saved card.', 400, 'PAYMENT_METHOD_REQUIRED');
      const { rows } = await query<{ provider_token_ref: string }>(
        `SELECT provider_token_ref FROM paypal_saved_payment_methods
         WHERE id=$1 AND user_id=$2 AND provider='paypal' LIMIT 1`,
        [input.paymentMethodId, req.user!.id],
      );
      const tokenRef = rows[0]?.provider_token_ref;
      if (!tokenRef) throw new AppError('That saved card is no longer available.', 404, 'PAYMENT_METHOD_NOT_FOUND');
      paymentSource = {
        card: {
          vault_id: tokenRef,
          stored_credential: {
            payment_initiator: 'CUSTOMER',
            payment_type: 'ONE_TIME',
            usage: 'SUBSEQUENT',
          },
          attributes: { verification: { method: 'SCA_WHEN_REQUIRED' } },
          experience_context: {
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: `${appUrl()}/dashboard?checkout=cancelled${input.jobId ? `&job=${encodeURIComponent(input.jobId)}` : ''}`,
          },
        },
      };
    } else if (input.source === 'card') {
      const attributes: Record<string, unknown> = {
        verification: { method: 'SCA_WHEN_REQUIRED' },
      };
      if (input.saveCard && vaultEnabled()) {
        const customerId = await paypalCustomerId(req.user!.id);
        attributes.customer = customerId
          ? { id: customerId, merchant_customer_id: req.user!.id }
          : { merchant_customer_id: req.user!.id };
        attributes.vault = { store_in_vault: 'ON_SUCCESS' };
      }
      paymentSource = {
        card: {
          attributes,
          experience_context: {
            shipping_preference: 'NO_SHIPPING',
            return_url: returnUrl,
            cancel_url: `${appUrl()}/dashboard?checkout=cancelled${input.jobId ? `&job=${encodeURIComponent(input.jobId)}` : ''}`,
          },
        },
      };
    } else if (input.source === 'google_pay') {
      paymentSource = {
        google_pay: {
          attributes: { verification: { method: 'SCA_WHEN_REQUIRED' } },
        },
      };
    }

    const orderPayload: Record<string, unknown> = {
      intent: 'CAPTURE',
      purchase_units: [{
        custom_id: req.user!.id,
        description: `AiWebVideo ${product.name}${pricing.discountApplied ? ' · 20% welcome offer' : ''}`,
        amount: { currency_code: 'USD', value: pricing.amountUsd.toFixed(2) },
      }],
      ...(paymentSource ? { payment_source: paymentSource } : {}),
    };

    const data = await paypalRequest('/v2/checkout/orders', {
      method: 'POST',
      idempotencyKey: `card-order-${req.user!.id}-${input.plan}-${randomUUID()}`,
      body: orderPayload,
    });
    const orderId = typeof data?.id === 'string' ? data.id : '';
    if (!orderId) throw new AppError('The payment service did not create a card order.', 502, 'CHECKOUT_FAILED');

    await query(
      `INSERT INTO payments(user_id,provider,provider_ref,kind,amount_usd,currency,credits_granted,plan,product_id,status)
       VALUES ($1,'paypal',$2,'one_time',$3,'USD',$4,$5,$6,'pending')
       ON CONFLICT(provider,provider_ref) DO NOTHING`,
      [req.user!.id, orderId, pricing.amountUsd, product.credits, product.plan, input.plan],
    );
    await query(
      `INSERT INTO paypal_card_checkout_sessions(id,user_id,order_id,job_id)
       VALUES ($1,$2,$3,$4) ON CONFLICT(order_id) DO NOTHING`,
      [checkoutSessionId, req.user!.id, orderId, input.jobId ?? null],
    );

    const providerStatus = typeof data?.status === 'string' ? data.status : null;
    const actionUrl = payerActionLink(data?.links);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json({
      orderId,
      amountUsd: pricing.amountUsd,
      normalAmountUsd: pricing.normalAmountUsd,
      discountApplied: pricing.discountApplied,
      creditsGranted: product.credits,
      source: input.source,
      providerStatus,
      payerActionRequired: providerStatus === 'PAYER_ACTION_REQUIRED',
      payerActionUrl: actionUrl,
    });
  } catch (error) { sendError(res, error); }
});

router.post('/orders/:orderId/capture', requireAuth, async (req, res) => {
  const orderId = String(req.params.orderId ?? '');
  try {
    if (!/^[A-Z0-9-]{8,40}$/i.test(orderId)) throw new AppError('Invalid payment order.', 400, 'INVALID_ORDER');
    const result = await finalizeOrder(req.user!.id, orderId);
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(result);
  } catch (error) { sendError(res, error); }
});

router.get('/return/:sessionId', requireAuth, async (req, res) => {
  const fail = `${appUrl()}/dashboard?checkout=failed`;
  try {
    await ensureCardCheckoutSchema();
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
    await finalizeOrder(req.user!.id, session.order_id);
    await query('DELETE FROM paypal_card_checkout_sessions WHERE id=$1 AND user_id=$2', [sessionId, req.user!.id]).catch(() => {});
    res.redirect(`${appUrl()}/dashboard?checkout=success${session.job_id ? `&job=${encodeURIComponent(session.job_id)}` : ''}`);
  } catch (error) {
    logger.warn({ err: error, userId: req.user?.id }, '[paypal-card] payer-action return failed');
    res.redirect(fail);
  }
});

export default router;
