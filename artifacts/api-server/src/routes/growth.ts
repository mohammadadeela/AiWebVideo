import { Router } from 'express';
import { requireAuth } from '../lib/auth.js';
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
const NEW_ACCOUNT_ELIGIBILITY_MS = 24 * 60 * 60 * 1000;
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
 * refresh for a newly-created account. Existing/old accounts do not suddenly
 * receive a welcome offer after a deploy. The timestamp is server-owned and
 * cannot be reset by refreshing, changing tabs or clearing browser storage.
 */
async function getOrStartWelcomeWindow(userId: string): Promise<UserGrowthRow | null> {
  await ensureGrowthOfferSchema();
  await query(
    `UPDATE users
        SET welcome_offer_started_at=NOW(),updated_at=NOW()
      WHERE id=$1
        AND welcome_offer_started_at IS NULL
        AND created_at >= NOW() - INTERVAL '24 hours'`,
    [userId],
  );
  const { rows } = await query<UserGrowthRow>(
    'SELECT created_at,welcome_offer_started_at FROM users WHERE id=$1 LIMIT 1',
    [userId],
  );
  return rows[0] ?? null;
}

export async function settleGrowthCredits(userId: string) {
  const user = await getOrStartWelcomeWindow(userId);
  if (!user) return null;

  const createdAt = new Date(user.created_at);
  const now = Date.now();
  const accountAgeMs = Math.max(0, now - createdAt.getTime());
  const newAccount = accountAgeMs <= NEW_ACCOUNT_ELIGIBILITY_MS;

  // Starter allowance is separate from the production wallet. This conditional
  // update is idempotent across refreshes and concurrent authenticated requests.
  if (newAccount) {
    await query(`WITH candidate AS (
      SELECT id,encode(digest(lower(trim(email)),'sha256'),'hex') AS email_digest FROM users
      WHERE id=$1 AND starter_granted_at IS NULL AND email_verified=TRUE
    ), first_grant AS (
      INSERT INTO starter_identity_grants(email_digest)
      SELECT email_digest FROM candidate ON CONFLICT DO NOTHING RETURNING email_digest
    )
    UPDATE users SET starter_credits_balance=$2,starter_granted_at=NOW(),updated_at=NOW()
    WHERE id=$1 AND EXISTS (SELECT 1 FROM first_grant)`, [userId, STARTER_CREDITS_INTERNAL]);
  }

  const offerStartedAt = user.welcome_offer_started_at ? new Date(user.welcome_offer_started_at) : null;
  const offerExpiresAt = offerStartedAt
    ? new Date(offerStartedAt.getTime() + WELCOME_OFFER_MS)
    : createdAt;
  const { rows: balances } = await query<{ credits_balance: number; starter_credits_balance: number }>(
    'SELECT credits_balance,starter_credits_balance FROM users WHERE id=$1 LIMIT 1',
    [userId],
  );
  const balanceInternal = Math.max(0, Number(balances[0]?.credits_balance ?? 0));

  return {
    active: Boolean(WELCOME_OFFER_PRODUCTS.size && newAccount && offerStartedAt && now < offerExpiresAt.getTime()),
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
    starterBalanceDisplay: Math.max(0, Number(balances[0]?.starter_credits_balance ?? 0)) * CREDIT_DISPLAY_MULTIPLIER,
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
