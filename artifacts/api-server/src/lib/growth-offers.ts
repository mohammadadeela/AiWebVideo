import { GEMINI_COST_CATALOG } from './costs.js';
import { CREDIT_COSTS } from './credits.js';

/** Internal credits remain the accounting/security unit. UI displays x10. */
export const CREDIT_DISPLAY_MULTIPLIER = 10;
/** New users receive 5 internal credits = 50 customer-facing credits. */
export const STARTER_CREDITS_INTERNAL = 5;
export const STARTER_CREDITS_DISPLAY = STARTER_CREDITS_INTERNAL * CREDIT_DISPLAY_MULTIPLIER;

/** A real, server-timed new-account offer. It never resets in the browser. */
export const WELCOME_OFFER_MS = 5 * 60 * 1000;
export const WELCOME_BONUS_PERCENT = 20;

/**
 * Conservative economics guard.
 * Derive the most expensive premium-video provider cost per internal credit
 * from the same cost catalog and credit schedule used by production, then add
 * 3% for small planning/TTS/provider overhead. Before promotional credits are
 * issued we also reserve 10% of checkout revenue for payment/refund overhead.
 * The remaining revenue must still cover at least 2x this all-in API estimate,
 * including the 5-credit starter balance.
 */
const BASE_PROVIDER_COST_PER_INTERNAL_CREDIT_USD = Math.max(
  GEMINI_COST_CATALOG.video.standard1080 / CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P,
  GEMINI_COST_CATALOG.video.standard4k / CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K,
);
export const MAX_PROVIDER_COST_PER_INTERNAL_CREDIT_USD = BASE_PROVIDER_COST_PER_INTERNAL_CREDIT_USD * 1.03;
export const MIN_PROVIDER_MULTIPLE = 2;
export const PAYMENT_REVENUE_AFTER_RESERVE_FACTOR = 0.90;

export const WELCOME_OFFER_PRODUCTS = new Set(['topup50', 'topup100', 'topup250']);

export function marginSafeWelcomeBonusCredits(input: {
  productId: string;
  amountUsd: number;
  purchasedInternalCredits: number;
}): number {
  if (!WELCOME_OFFER_PRODUCTS.has(input.productId)) return 0;
  const amountUsd = Math.max(0, Number(input.amountUsd) || 0);
  const purchasedCredits = Math.max(0, Math.floor(Number(input.purchasedInternalCredits) || 0));
  if (!amountUsd || !purchasedCredits) return 0;

  const proposedBonus = Math.max(1, Math.floor(purchasedCredits * (WELCOME_BONUS_PERCENT / 100)));
  const totalSpendable = purchasedCredits + proposedBonus + STARTER_CREDITS_INTERNAL;
  const revenueAfterReserve = amountUsd * PAYMENT_REVENUE_AFTER_RESERVE_FACTOR;
  const minimumRevenue = totalSpendable * MAX_PROVIDER_COST_PER_INTERNAL_CREDIT_USD * MIN_PROVIDER_MULTIPLE;

  return revenueAfterReserve + 1e-9 >= minimumRevenue ? proposedBonus : 0;
}

export function providerCoverageMultiple(input: {
  amountUsd: number;
  purchasedInternalCredits: number;
  bonusInternalCredits?: number;
}): number {
  const totalSpendable = Math.max(
    1,
    Number(input.purchasedInternalCredits || 0) +
      Number(input.bonusInternalCredits || 0) +
      STARTER_CREDITS_INTERNAL,
  );
  const worstCaseProviderCost = totalSpendable * MAX_PROVIDER_COST_PER_INTERNAL_CREDIT_USD;
  return (Math.max(0, Number(input.amountUsd) || 0) * PAYMENT_REVENUE_AFTER_RESERVE_FACTOR) / worstCaseProviderCost;
}
