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
let growthSchemaReady: Promise<void> | null = null;

type UserGrowthRow = {
  created_at: Date;
  welcome_offer_started_at: Date | null;
};

export function ensureGrowthOfferSchema(): Promise<void> {
  growthSchemaReady ??= query(
    'ALTER TABLE users ADD COLUMN IF NOT EXISTS welcome_offer_started_at TIMESTAMPTZ',
  ).then(() => undefined).catch((error) => {
    growthSchemaReady = null;
    throw error;
  });
  return growthSchemaReady;
}

/**
 * Starts the five-minute offer exactly once on the first authenticated account
 * refresh after sign-in. The timestamp is server-owned and can never be reset
 * by refreshing, changing tabs, clearing browser storage, or editing the UI.
 */
async function getOrStartWelcomeWindow(userId: string): Promise<UserGrowthRow | null> {
  await ensureGrowthOfferSchema();
  const { rows } = await query<UserGrowthRow>(
    `UPDATE users
        SET welcome_offer_started_at=COALESCE(welcome_offer_started_at,NOW()),
            updated_at=NOW()
      WHERE id=$1
      RETURNING created_at,welcome_offer_started_at`,
    [userId],
  );
  return rows[0] ?? null;
}

export async function settleGrowthCredits(userId: string) {
  const user = await getOrStartWelcomeWindow(userId);
  if (!user?.welcome_offer_started_at) return null;

  const createdAt = new Date(user.created_at);
  const offerStartedAt = new Date(user.welcome_offer_started_at);
  const now = Date.now();
  const accountAgeMs = Math.max(0, now - createdAt.getTime());

  // Starter Credits are real account credits, but deliberately remain below
  // the cheapest paid generation so they cannot trigger a provider call alone.
  if (accountAgeMs <= STARTER_ELIGIBILITY_MS) {
    await grantCreditsOnce({
      key: `growth:starter:${userId}`,
      userId,
      credits: STARTER_CREDITS_INTERNAL,
      reason: 'New-account starter credits',
    });
  }

  const offerExpiresAt = new Date(offerStartedAt.getTime() + WELCOME_OFFER_MS);
  const { rows: balances } = await query<{ credits_balance: number }>(
    'SELECT credits_balance FROM users WHERE id=$1 LIMIT 1',
    [userId],
  );
  const balanceInternal = Math.max(0, Number(balances[0]?.credits_balance ?? 0));

  return {
    active: now < offerExpiresAt.getTime(),
    startedAt: offerStartedAt,
    expiresAt: offerExpiresAt,
    discountPercent: WELCOME_DISCOUNT_PERCENT,
    // Kept at zero for one deploy cycle so an older cached frontend cannot
    // accidentally render the former bonus-credit mechanic.
    bonusPercent: 0,
    starterCredits: STARTER_CREDITS_DISPLAY,
    bonusCreditsGranted: 0,
    balanceInternal,
    balanceDisplay: balanceInternal * CREDIT_DISPLAY_MULTIPLIER,
    eligibleProducts: Array.from(WELCOME_OFFER_PRODUCTS),
  };
}

// GET /api/growth/welcome
// Authenticated only: offer timing, eligibility and Starter Credits are owned
// by the server. The browser cannot extend the five-minute window or choose a
// discount amount.
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
