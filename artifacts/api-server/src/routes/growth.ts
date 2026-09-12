import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
import { grantCreditsOnce } from '../lib/billing.js';
import { query } from '../lib/pool.js';
import { sendError } from '../lib/errors.js';
import {
  CREDIT_DISPLAY_MULTIPLIER,
  STARTER_CREDITS_INTERNAL,
  STARTER_CREDITS_DISPLAY,
  WELCOME_DISCOUNT_PERCENT,
  WELCOME_OFFER_MS,
  WELCOME_OFFER_PRODUCTS,
} from '../lib/growth-offers.js';

const router = Router();
const STARTER_ELIGIBILITY_MS = 24 * 60 * 60 * 1000;

type UserGrowthRow = {
  created_at: Date;
};

type PaidTopupRow = {
  id: string;
  product_id: string | null;
  credits_granted: number;
  created_at: Date;
};

async function settleGrowthCredits(userId: string) {
  const { rows: users } = await query<UserGrowthRow>(
    'SELECT created_at FROM users WHERE id=$1 LIMIT 1',
    [userId],
  );
  const user = users[0];
  if (!user) return null;

  const createdAt = new Date(user.created_at);
  const now = Date.now();
  const accountAgeMs = Math.max(0, now - createdAt.getTime());

  // 5 internal credits = 50 customer-facing credits. This is deliberately
  // below the cheapest paid generation (8 internal credits), so a new account
  // can see a real starter balance without ever reaching a paid provider for free.
  if (accountAgeMs <= STARTER_ELIGIBILITY_MS) {
    await grantCreditsOnce({
      key: `growth:starter:${userId}`,
      userId,
      credits: STARTER_CREDITS_INTERNAL,
      reason: 'New-account starter credits',
    });
  }

  const offerExpiresAt = new Date(createdAt.getTime() + WELCOME_OFFER_MS);
  const { rows: paidTopups } = await query<PaidTopupRow>(
    `SELECT id,product_id,credits_granted,created_at
       FROM payments
      WHERE user_id=$1
        AND status='paid'
        AND kind='one_time'
        AND product_id = ANY($2::text[])
      ORDER BY created_at ASC
      LIMIT 1`,
    [userId, Array.from(WELCOME_OFFER_PRODUCTS)],
  );

  const qualifying = paidTopups.find((payment) =>
    new Date(payment.created_at).getTime() <= offerExpiresAt.getTime()
  );
  let bonusInternal = 0;
  let bonusGranted = false;
  if (qualifying) {
    bonusInternal = Math.max(1, Math.floor(Number(qualifying.credits_granted) * (WELCOME_DISCOUNT_PERCENT / 100)));
    bonusGranted = await grantCreditsOnce({
      key: `growth:welcome20:${qualifying.id}`,
      userId,
      credits: bonusInternal,
      reason: `20% new-account credit bonus for ${qualifying.product_id ?? 'top-up'}`,
    });
  }

  const hasPaidQualifyingTopup = Boolean(qualifying);
  return {
    active: now < offerExpiresAt.getTime() && !hasPaidQualifyingTopup,
    expiresAt: offerExpiresAt,
    bonusPercent: WELCOME_DISCOUNT_PERCENT,
    starterCredits: STARTER_CREDITS_DISPLAY,
    bonusCreditsGranted: bonusGranted ? bonusInternal * CREDIT_DISPLAY_MULTIPLIER : 0,
    eligibleProducts: Array.from(WELCOME_OFFER_PRODUCTS),
  };
}

// GET /api/growth/welcome
// This endpoint is intentionally authenticated. It may settle one-time starter
// or bonus credits, but every grant is idempotent and based only on verified
// account/payment rows. The browser cannot choose the amount or extend expiry.
router.get('/welcome', requireAuth, async (req, res) => {
  try {
    const result = await settleGrowthCredits(req.user!.id);
    if (!result) {
      res.status(404).json({ error: 'Account not found.' });
      return;
    }
    res.setHeader('Cache-Control', 'private, no-store');
    res.json(result);
  } catch (error) {
    sendError(res, error);
  }
});

export default router;
