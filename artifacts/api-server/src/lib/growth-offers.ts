import { query } from './pool.js';

/** Internal credits remain the accounting/security unit. UI displays x10. */
export const CREDIT_DISPLAY_MULTIPLIER = 10;
/** New users receive 5 internal credits = 50 customer-facing credits. */
export const STARTER_CREDITS_INTERNAL = 5;
export const STARTER_CREDITS_DISPLAY = STARTER_CREDITS_INTERNAL * CREDIT_DISPLAY_MULTIPLIER;

/** A real, server-timed new-account offer. It never resets in the browser. */
export const WELCOME_OFFER_MS = 5 * 60 * 1000;
export const WELCOME_DISCOUNT_PERCENT = 20;

/**
 * Conservative economics guard.
 * Premium 1080p/4K currently tops out around $0.10 provider cost per internal
 * credit. We also reserve 4% of checkout revenue for payment processing.
 * A discounted pack is allowed only when the remaining net revenue is still
 * >= 2x that provider cost, including the 5-credit starter balance.
 */
const MAX_PROVIDER_COST_PER_INTERNAL_CREDIT_USD = 0.10;
const MIN_PROVIDER_MULTIPLE = 2;
const PAYMENT_PROCESSING_REVENUE_FACTOR = 0.96;

export const WELCOME_OFFER_PRODUCTS = new Set(['topup50', 'topup100', 'topup250']);

export interface WelcomeOfferState {
  active: boolean;
  expiresAt: Date;
  discountPercent: number;
  starterCreditsDisplay: number;
}

export async function getWelcomeOfferState(userId: string): Promise<WelcomeOfferState> {
  const { rows } = await query<{ created_at: Date; paid_count: number }>(
    `SELECT u.created_at,
            (SELECT COUNT(*)::int FROM payments p WHERE p.user_id=u.id AND p.status='paid') AS paid_count
       FROM users u WHERE u.id=$1 LIMIT 1`,
    [userId],
  );
  const row = rows[0];
  const createdAt = row?.created_at ? new Date(row.created_at) : new Date(0);
  const expiresAt = new Date(createdAt.getTime() + WELCOME_OFFER_MS);
  const active = Boolean(row && Number(row.paid_count) === 0 && Date.now() < expiresAt.getTime());
  return {
    active,
    expiresAt,
    discountPercent: WELCOME_DISCOUNT_PERCENT,
    starterCreditsDisplay: STARTER_CREDITS_DISPLAY,
  };
}

function roundedUsd(value: number) {
  return Math.round(value * 100) / 100;
}

export function marginSafeWelcomePrice(input: {
  productId: string;
  standardAmountUsd: number;
  internalCredits: number;
  offerActive: boolean;
}): { amountUsd: number; discounted: boolean } {
  const standard = roundedUsd(input.standardAmountUsd);
  if (!input.offerActive || !WELCOME_OFFER_PRODUCTS.has(input.productId)) {
    return { amountUsd: standard, discounted: false };
  }

  const candidate = roundedUsd(standard * (1 - WELCOME_DISCOUNT_PERCENT / 100));
  const spendableCredits = Math.max(1, input.internalCredits + STARTER_CREDITS_INTERNAL);
  const revenueAfterPaymentReserve = candidate * PAYMENT_PROCESSING_REVENUE_FACTOR;
  const minimumRequiredRevenue =
    spendableCredits * MAX_PROVIDER_COST_PER_INTERNAL_CREDIT_USD * MIN_PROVIDER_MULTIPLE;

  if (revenueAfterPaymentReserve + 1e-9 < minimumRequiredRevenue) {
    return { amountUsd: standard, discounted: false };
  }
  return { amountUsd: candidate, discounted: true };
}
