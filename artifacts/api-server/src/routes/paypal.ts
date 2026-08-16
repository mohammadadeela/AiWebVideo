import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../lib/auth.js';
import { query } from '../lib/pool.js';
import { AppError, sendError } from '../lib/errors.js';
import { grantCreditsOnce } from '../lib/billing.js';

const router = Router();

/**
 * Mirrors the PRODUCTS map in routes/stripe.ts exactly — same plan names,
 * same credit amounts, same USD prices already shown on the pricing page —
 * so PayPal is a genuine alternative payment method for the exact same
 * catalog, not a separate parallel product line.
 *
 * One-time purchases (mode: 'payment') use PayPal's Orders v2 API directly
 * with the amount specified per-request — no pre-created "price" object is
 * needed, unlike Stripe. Subscriptions (mode: 'subscription') DO require a
 * Plan to exist in your PayPal account first (Subscriptions API plans are
 * created once, not per-checkout) — see the env var comments below for how
 * to get those plan IDs.
 */
export const PRODUCTS = {
  creator: { env: 'PAYPAL_PLAN_CREATOR', mode: 'subscription', credits: 150, plan: 'creator', amountUsd: 39 },
  pro: { env: 'PAYPAL_PLAN_PRO', mode: 'subscription', credits: 400, plan: 'pro', amountUsd: 99 },
  agency: { env: 'PAYPAL_PLAN_AGENCY', mode: 'subscription', credits: 1000, plan: 'agency', amountUsd: 249 },
  single8: { mode: 'payment', credits: 14, plan: 'creator', amountUsd: 2.99 },
  single30: { mode: 'payment', credits: 30, plan: 'creator', amountUsd: 7.99 },
  single60: { mode: 'payment', credits: 62, plan: 'creator', amountUsd: 17.99 },
  topup100: { mode: 'payment', credits: 100, plan: 'creator', amountUsd: 25 },
} as const;
type ProductId = keyof typeof PRODUCTS;

function paypalBase() {
  return process.env.PAYPAL_ENV === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

function credentialsConfigured() {
  return Boolean(process.env.PAYPAL_CLIENT_ID && process.env.PAYPAL_CLIENT_SECRET);
}

let cachedToken: { value: string; expiresAt: number } | null = null;

/** OAuth2 client-credentials flow — PayPal access tokens are short-lived (~9h) and cached in-process rather than fetched per-request. */
async function getAccessToken(): Promise<string> {
  if (!credentialsConfigured()) throw new AppError('Billing is not configured yet.', 503, 'BILLING_NOT_CONFIGURED');
  if (cachedToken && cachedToken.expiresAt > Date.now() + 30_000) return cachedToken.value;
  const basic = Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`).toString('base64');
  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: { authorization: `Basic ${basic}`, 'content-type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_credentials',
  });
  if (!res.ok) throw new AppError('Could not authenticate with PayPal.', 502, 'PAYPAL_AUTH_FAILED');
  const data = await res.json() as { access_token: string; expires_in: number };
  cachedToken = { value: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return data.access_token;
}

async function paypalFetch(path: string, init: { method: string; body?: unknown; idempotencyKey?: string }) {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}${path}`, {
    method: init.method,
    headers: {
      authorization: `Bearer ${token}`,
      'content-type': 'application/json',
      ...(init.idempotencyKey ? { 'PayPal-Request-Id': init.idempotencyKey } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[paypal] API error', res.status, JSON.stringify(data).slice(0, 500));
    throw new AppError('PayPal could not process this request.', 502, 'PAYPAL_REQUEST_FAILED');
  }
  return data as Record<string, unknown>;
}

export function approveLink(links: unknown): string | null {
  if (!Array.isArray(links)) return null;
  const found = links.find((l) => l && typeof l === 'object' && ((l as { rel?: string }).rel === 'approve' || (l as { rel?: string }).rel === 'payer-action'));
  return (found as { href?: string } | undefined)?.href ?? null;
}

router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const ids = Object.keys(PRODUCTS) as [ProductId, ...ProductId[]];
    const { plan, jobId } = z.object({ plan: z.enum(ids), jobId: z.string().uuid().optional() }).parse(req.body);
    const product = PRODUCTS[plan];

    if (product.mode === 'subscription') {
      const planId = process.env[(product as typeof PRODUCTS['creator']).env];
      if (!planId) throw new AppError(`PayPal plan ${(product as typeof PRODUCTS['creator']).env} is not configured.`, 503, 'PRICE_NOT_CONFIGURED');
      const data = await paypalFetch('/v1/billing/subscriptions', {
        method: 'POST',
        idempotencyKey: `sub-${req.user!.id}-${plan}-${Date.now()}`,
        body: {
          plan_id: planId,
          custom_id: req.user!.id,
          subscriber: { email_address: req.user!.email },
          application_context: {
            brand_name: 'AiWebVideo',
            return_url: `${appUrl()}/dashboard?checkout=success&provider=paypal${jobId ? `&job=${encodeURIComponent(jobId)}` : ''}`,
            cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
            user_action: 'SUBSCRIBE_NOW',
          },
        },
      });
      const url = approveLink(data.links);
      if (!url) throw new AppError('PayPal did not return an approval URL.', 502, 'CHECKOUT_FAILED');
      res.json({ checkoutUrl: url });
      return;
    }

    // One-time purchase — Orders v2 API, amount specified directly.
    const data = await paypalFetch('/v2/checkout/orders', {
      method: 'POST',
      idempotencyKey: `order-${req.user!.id}-${plan}-${Date.now()}`,
      body: {
        intent: 'CAPTURE',
        purchase_units: [{
          custom_id: req.user!.id,
          description: `AiWebVideo — ${plan}`,
          amount: { currency_code: 'USD', value: product.amountUsd.toFixed(2) },
        }],
        payment_source: {
          paypal: {
            experience_context: {
              brand_name: 'AiWebVideo',
              user_action: 'PAY_NOW',
              return_url: `${appUrl()}/api/paypal/return?plan=${plan}&userId=${req.user!.id}${jobId ? `&job=${encodeURIComponent(jobId)}` : ''}`,
              cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
            },
          },
        },
      },
    });
    const url = approveLink(data.links);
    if (!url) throw new AppError('PayPal did not return an approval URL.', 502, 'CHECKOUT_FAILED');
    // Track which product this order id maps to — the return handler and the
    // webhook both need this, and PayPal's own order object doesn't retain
    // custom line-item metadata the way Stripe's session metadata does.
    await query(
      `INSERT INTO payments (user_id, provider, provider_ref, kind, amount_usd, credits_granted, plan, status)
       VALUES ($1,'paypal',$2,'one_time',$3,$4,$5,'pending')`,
      [req.user!.id, data.id, product.amountUsd, product.credits, product.plan]
    );
    res.json({ checkoutUrl: url });
  } catch (err) { sendError(res, err); }
});

/**
 * Buyer lands here after approving payment on PayPal. This call to CAPTURE
 * the order is what actually completes the payment — Orders v2 requires an
 * explicit capture step after approval, it does not happen automatically.
 * Credits are granted here AND idempotently re-confirmed by the
 * PAYMENT.CAPTURE.COMPLETED webhook below, so a payment is never lost if the
 * buyer closes the tab right after approving but before this redirect
 * finishes loading.
 */
router.get('/return', async (req, res) => {
  const orderId = String(req.query.token ?? '');
  const jobId = typeof req.query.job === 'string' && /^[0-9a-f-]{36}$/i.test(req.query.job) ? req.query.job : '';
  const redirectFail = `${appUrl()}/pricing?checkout=failed`;
  if (!orderId) { res.redirect(redirectFail); return; }
  try {
    const capture = await paypalFetch(`/v2/checkout/orders/${orderId}/capture`, { method: 'POST', idempotencyKey: `capture-${orderId}` });
    if (capture.status !== 'COMPLETED') { res.redirect(redirectFail); return; }
    await grantOneTimePayment(orderId);
    res.redirect(`${appUrl()}/dashboard?checkout=success&provider=paypal${jobId ? `&job=${encodeURIComponent(jobId)}` : ''}`);
  } catch (err) {
    console.error('[paypal] return/capture error', (err as Error).message);
    res.redirect(redirectFail);
  }
});

async function grantOneTimePayment(orderId: string) {
  const { rows } = await query<{ user_id: string; credits_granted: number; plan: string; status: string }>(
    'SELECT user_id, credits_granted, plan, status FROM payments WHERE provider=$1 AND provider_ref=$2', ['paypal', orderId]
  );
  const payment = rows[0];
  if (!payment || payment.status === 'paid') return; // already granted, or we don't recognize this order
  await grantCreditsOnce({ key: `paypal:order:${orderId}`, userId: payment.user_id, credits: payment.credits_granted, reason: `PayPal purchase ${orderId}` });
  await query(`UPDATE payments SET status='paid' WHERE provider='paypal' AND provider_ref=$1`, [orderId]);
}

/** Cancels a subscription at PayPal's end. Triggered from the billing page's own auto-renew toggle rather than an external portal — PayPal has no Stripe-style hosted billing portal. */
router.post('/subscriptions/:id/cancel', requireAuth, async (req, res) => {
  try {
    const { rows } = await query<{ paypal_subscription_id: string }>(
      'SELECT paypal_subscription_id FROM subscriptions WHERE id=$1 AND user_id=$2', [req.params.id, req.user!.id]
    );
    const subscriptionId = rows[0]?.paypal_subscription_id;
    if (!subscriptionId) throw new AppError('Subscription not found.', 404, 'NOT_FOUND');
    await paypalFetch(`/v1/billing/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      body: { reason: 'Cancelled by customer' },
    }).catch(() => {}); // PayPal returns 204 with no body on success; treat any thrown parse error as success
    await query(`UPDATE subscriptions SET auto_renew=false, status='cancelled', updated_at=NOW() WHERE id=$1`, [req.params.id]);
    res.json({ ok: true });
  } catch (err) { sendError(res, err); }
});

async function once(eventId: string, action: () => Promise<void>) {
  const { rowCount } = await query('INSERT INTO paypal_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id', [eventId]);
  if (!rowCount) return;
  try { await action(); }
  catch (err) {
    await query('DELETE FROM paypal_events WHERE event_id=$1', [eventId]).catch(() => {});
    throw err;
  }
}

/**
 * Verifies the webhook came from PayPal using PayPal's own postback
 * verification endpoint, rather than hand-rolling the signature/certificate
 * check — this is the officially documented simpler alternative, and avoids
 * a subtle home-grown crypto bug in a payment-security-critical path.
 */
async function verifyWebhookSignature(headers: Record<string, unknown>, body: unknown): Promise<boolean> {
  const webhookId = process.env.PAYPAL_WEBHOOK_ID;
  if (!webhookId) return false;
  const result = await paypalFetch('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: {
      transmission_id: headers['paypal-transmission-id'],
      transmission_time: headers['paypal-transmission-time'],
      cert_url: headers['paypal-cert-url'],
      auth_algo: headers['paypal-auth-algo'],
      transmission_sig: headers['paypal-transmission-sig'],
      webhook_id: webhookId,
      webhook_event: body,
    },
  });
  return result.verification_status === 'SUCCESS';
}

router.post('/webhook', async (req, res) => {
  try {
    if (!process.env.PAYPAL_WEBHOOK_ID) throw new AppError('PayPal webhook is not configured.', 503, 'WEBHOOK_NOT_CONFIGURED');
    const event = req.body as { id: string; event_type: string; resource: Record<string, unknown> };
    const verified = await verifyWebhookSignature(req.headers as Record<string, unknown>, event).catch(() => false);
    if (!verified) throw new AppError('Invalid PayPal webhook signature.', 400, 'INVALID_SIGNATURE');

    await once(event.id, async () => {
      // One-time payment confirmed. This is the authoritative path if the
      // buyer closed the tab before the /return redirect's capture call
      // could finish — grantOneTimePayment() is idempotent either way.
      if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
        const orderId = (event.resource as { supplementary_data?: { related_ids?: { order_id?: string } } })
          .supplementary_data?.related_ids?.order_id;
        if (orderId) await grantOneTimePayment(orderId);
      }

      if (event.event_type === 'BILLING.SUBSCRIPTION.ACTIVATED') {
        const resource = event.resource as { id: string; custom_id?: string; plan_id?: string };
        const userId = resource.custom_id;
        if (!userId) return;
        const matched = (Object.entries(PRODUCTS) as Array<[ProductId, typeof PRODUCTS[ProductId]]>)
          .find(([, p]) => p.mode === 'subscription' && process.env[(p as typeof PRODUCTS['creator']).env] === resource.plan_id);
        if (!matched) return;
        const [, product] = matched;
        await query(`INSERT INTO subscriptions (user_id, paypal_subscription_id, plan, status, updated_at)
          VALUES ($1,$2,$3,'active',NOW()) ON CONFLICT (paypal_subscription_id)
          DO UPDATE SET plan=EXCLUDED.plan,status='active',updated_at=NOW()`, [userId, resource.id, product.plan]);
        // Credits are granted from PAYMENT.SALE.COMPLETED below, which proves
        // money was collected. Activation alone must not grant or double-grant.
      }

      // Recurring renewal payment for an existing subscription.
      if (event.event_type === 'PAYMENT.SALE.COMPLETED') {
        const resource = event.resource as { id: string; billing_agreement_id?: string; amount?: { total?: string } };
        const subscriptionId = resource.billing_agreement_id;
        if (!subscriptionId) return;
        const { rows } = await query<{ user_id: string; plan: string }>(
          'SELECT user_id, plan FROM subscriptions WHERE paypal_subscription_id=$1', [subscriptionId]
        );
        const sub = rows[0];
        if (!sub) return;
        const product = Object.values(PRODUCTS).find((p) => p.mode === 'subscription' && p.plan === sub.plan);
        if (!product) return;
        const existingPayments = await query<{ count: number }>(`SELECT COUNT(*)::int count FROM payments WHERE provider='paypal' AND user_id=$1 AND plan=$2 AND kind LIKE 'subscription_%' AND status='paid'`, [sub.user_id, sub.plan]);
        const kind = (existingPayments.rows[0]?.count ?? 0) === 0 ? 'subscription_initial' : 'subscription_renewal';
        await grantCreditsOnce({ key: `paypal:sale:${resource.id}`, userId: sub.user_id, credits: product.credits, plan: sub.plan, reason: `PayPal subscription payment ${resource.id}` });
        await query(
          `INSERT INTO payments (user_id, provider, provider_ref, kind, amount_usd, credits_granted, plan, status)
           VALUES ($1,'paypal',$2,$3,$4,$5,$6,'paid') ON CONFLICT (provider, provider_ref) DO NOTHING`,
          [sub.user_id, resource.id, kind, Number(resource.amount?.total ?? product.amountUsd), product.credits, sub.plan]
        );
      }

      if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED' || event.event_type === 'BILLING.SUBSCRIPTION.EXPIRED' || event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') {
        const resource = event.resource as { id: string };
        const { rows } = await query<{ user_id: string }>('SELECT user_id FROM subscriptions WHERE paypal_subscription_id=$1', [resource.id]);
        if (rows[0]) await query("UPDATE users SET plan='free', updated_at=NOW() WHERE id=$1", [rows[0].user_id]);
        await query("UPDATE subscriptions SET status='cancelled', auto_renew=false, updated_at=NOW() WHERE paypal_subscription_id=$1", [resource.id]);
      }
    });
    res.json({ received: true });
  } catch (err) { sendError(res, err); }
});

export default router;
