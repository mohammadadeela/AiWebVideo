import { Router } from 'express';
import Stripe from 'stripe';
import { requireAuth } from '../lib/auth.js';
import { query } from '../lib/pool.js';
import { AppError, sendError } from '../lib/errors.js';
import { z } from 'zod';
import { grantCreditsOnce } from '../lib/billing.js';

const router = Router();

export const PRODUCTS = {
  creator: { env: 'STRIPE_PRICE_CREATOR', mode: 'subscription', credits: 150, plan: 'creator' },
  pro: { env: 'STRIPE_PRICE_PRO', mode: 'subscription', credits: 400, plan: 'pro' },
  agency: { env: 'STRIPE_PRICE_AGENCY', mode: 'subscription', credits: 1000, plan: 'agency' },
  single8: { env: 'STRIPE_PRICE_SINGLE_8', mode: 'payment', credits: 14, plan: 'creator' },
  single30: { env: 'STRIPE_PRICE_SINGLE_30', mode: 'payment', credits: 30, plan: 'creator' },
  single60: { env: 'STRIPE_PRICE_SINGLE_60', mode: 'payment', credits: 62, plan: 'creator' },
  topup100: { env: 'STRIPE_PRICE_TOPUP_100_CREDITS', mode: 'payment', credits: 100, plan: 'creator' },
} as const;
type ProductId = keyof typeof PRODUCTS;

let stripeClient: Stripe | null = null;
function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new AppError('Billing is not configured yet.', 503, 'BILLING_NOT_CONFIGURED');
  stripeClient ??= new Stripe(key);
  return stripeClient;
}

function appUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL ?? 'http://127.0.0.1:3001').replace(/\/$/, '');
}

router.post('/checkout', requireAuth, async (req, res) => {
  try {
    const ids = Object.keys(PRODUCTS) as [ProductId, ...ProductId[]];
    const { plan, jobId } = z.object({ plan: z.enum(ids), jobId: z.string().uuid().optional() }).parse(req.body);
    const product = PRODUCTS[plan];
    const price = process.env[product.env];
    if (!price) throw new AppError(`Stripe price ${product.env} is not configured.`, 503, 'PRICE_NOT_CONFIGURED');
    const { rows } = await query<{ stripe_customer_id: string | null }>(
      'SELECT stripe_customer_id FROM users WHERE id=$1', [req.user!.id]
    );
    const customer = rows[0]?.stripe_customer_id;
    const metadata = { userId: req.user!.id, productId: plan, plan: product.plan, credits: String(product.credits) };
    const session = await stripe().checkout.sessions.create({
      mode: product.mode,
      line_items: [{ price, quantity: 1 }],
      ...(customer ? { customer } : { customer_email: req.user!.email }),
      ...(product.mode === 'payment' && !customer ? { customer_creation: 'always' as const } : {}),
      client_reference_id: req.user!.id,
      metadata,
      ...(product.mode === 'subscription' ? { subscription_data: { metadata } } : {}),
      success_url: `${appUrl()}/dashboard?checkout=success${jobId ? `&job=${encodeURIComponent(jobId)}` : ''}`,
      cancel_url: `${appUrl()}/pricing?checkout=cancelled`,
      allow_promotion_codes: true,
    });
    if (!session.url) throw new AppError('Stripe did not return a checkout URL.', 502, 'CHECKOUT_FAILED');
    res.json({ checkoutUrl: session.url });
  } catch (err) { sendError(res, err); }
});

router.post('/portal', requireAuth, async (req, res) => {
  try {
    const { rows } = await query<{ stripe_customer_id: string | null }>('SELECT stripe_customer_id FROM users WHERE id=$1', [req.user!.id]);
    const customer = rows[0]?.stripe_customer_id;
    if (!customer) throw new AppError('No billing account was found.', 404, 'NO_BILLING_ACCOUNT');
    const portal = await stripe().billingPortal.sessions.create({ customer, return_url: `${appUrl()}/dashboard` });
    res.json({ portalUrl: portal.url });
  } catch (err) { sendError(res, err); }
});

async function once(eventId: string, action: () => Promise<void>) {
  const { rowCount } = await query('INSERT INTO stripe_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING RETURNING event_id', [eventId]);
  if (!rowCount) return;
  try { await action(); }
  catch (err) {
    await query('DELETE FROM stripe_events WHERE event_id=$1', [eventId]).catch(() => {});
    throw err;
  }
}

router.post('/webhook', async (req, res) => {
  try {
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new AppError('Stripe webhook is not configured.', 503, 'WEBHOOK_NOT_CONFIGURED');
    const signature = req.headers['stripe-signature'];
    if (!signature) throw new AppError('Missing Stripe signature.', 400, 'MISSING_SIGNATURE');
    const event = stripe().webhooks.constructEvent(req.body as Buffer, signature, secret);

    await once(event.id, async () => {
      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const userId = session.client_reference_id ?? session.metadata?.userId;
        if (!userId) return;
        const customer = typeof session.customer === 'string' ? session.customer : session.customer?.id;
        if (customer) await query('UPDATE users SET stripe_customer_id=$1, updated_at=NOW() WHERE id=$2', [customer, userId]);
        if (session.mode === 'payment' && session.payment_status === 'paid') {
          const credits = Number(session.metadata?.credits ?? 0);
          await grantCreditsOnce({ key: `stripe:checkout:${session.id}`, userId, credits, reason: `Stripe purchase ${session.id}` });
          await query(
            `INSERT INTO payments(user_id,provider,provider_ref,kind,amount_usd,currency,credits_granted,plan,status)
             VALUES ($1,'stripe',$2,'one_time',$3,$4,$5,$6,'paid') ON CONFLICT(provider,provider_ref) DO NOTHING`,
            [userId, session.id, Number(session.amount_total ?? 0) / 100, (session.currency ?? 'usd').toUpperCase(), credits, session.metadata?.plan ?? null],
          );
        }
      }

      if (event.type === 'invoice.paid') {
        const invoice = event.data.object as Stripe.Invoice & { subscription?: string | Stripe.Subscription | null };
        const subscriptionId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
        if (!subscriptionId) return;
        const subscription = await stripe().subscriptions.retrieve(subscriptionId);
        const userId = subscription.metadata.userId;
        const credits = Number(subscription.metadata.credits ?? 0);
        const plan = subscription.metadata.plan;
        if (!userId || !credits || !plan) return;
        await grantCreditsOnce({ key: `stripe:invoice:${invoice.id}`, userId, credits, plan, reason: `Subscription renewal ${invoice.id}` });
        await query(`INSERT INTO subscriptions (user_id, stripe_subscription_id, plan, status, updated_at)
          VALUES ($1,$2,$3,$4,NOW()) ON CONFLICT (stripe_subscription_id)
          DO UPDATE SET plan=EXCLUDED.plan,status=EXCLUDED.status,updated_at=NOW()`, [userId, subscription.id, plan, subscription.status]);
        await query(
          `INSERT INTO payments(user_id,provider,provider_ref,kind,amount_usd,currency,credits_granted,plan,status)
           VALUES ($1,'stripe',$2,'subscription_renewal',$3,$4,$5,$6,'paid') ON CONFLICT(provider,provider_ref) DO NOTHING`,
          [userId, invoice.id, Number(invoice.amount_paid ?? 0) / 100, (invoice.currency ?? 'usd').toUpperCase(), credits, plan],
        );
      }

      if (event.type === 'customer.subscription.deleted') {
        const subscription = event.data.object;
        const userId = subscription.metadata.userId;
        if (userId) await query("UPDATE users SET plan='free', updated_at=NOW() WHERE id=$1", [userId]);
        await query("UPDATE subscriptions SET status='cancelled', updated_at=NOW() WHERE stripe_subscription_id=$1", [subscription.id]);
      }
    });
    res.json({ received: true });
  } catch (err) { sendError(res, err); }
});

export default router;
