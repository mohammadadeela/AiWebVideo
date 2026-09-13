import { GEMINI_COST_CATALOG } from './costs.js';
import { CREDIT_COSTS } from './credits.js';

/** Internal credits remain the accounting/security unit. Customer UI displays x5. */
export const CREDIT_DISPLAY_MULTIPLIER = 5;
/** New users receive 5 internal credits = 25 customer-facing Starter Credits. */
export const STARTER_CREDITS_INTERNAL = 5;
export const STARTER_CREDITS_DISPLAY = STARTER_CREDITS_INTERNAL * CREDIT_DISPLAY_MULTIPLIER;

/** A real, server-timed first-sign-in offer. It never resets in the browser. */
export const WELCOME_OFFER_MS = 5 * 60 * 1000;
export const WELCOME_DISCOUNT_PERCENT = 20;

/**
 * Conservative API-cost model used to protect promotional pricing.
 * The discount is allowed only when the actual checkout amount still covers
 * at least 2x the modeled provider/API cost of all spendable credits, including
 * the Starter Credits. Payment processor fees can reduce the final net multiple,
 * but the transaction still retains a large positive provider-cost margin.
 */
const BASE_PROVIDER_COST_PER_INTERNAL_CREDIT_USD = Math.max(
  GEMINI_COST_CATALOG.video.standard1080 / CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P,
  GEMINI_COST_CATALOG.video.standard4k / CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K,
);
export const MAX_PROVIDER_COST_PER_INTERNAL_CREDIT_USD = BASE_PROVIDER_COST_PER_INTERNAL_CREDIT_USD * 1.03;
export const MIN_PROVIDER_MULTIPLE = 2;

/** The welcome price discount is intentionally limited to one-time credit packs. */
export const WELCOME_OFFER_PRODUCTS = new Set(['topup50', 'topup100', 'topup250']);

function money(value: number): number {
  return Math.round((Math.max(0, Number(value) || 0) + Number.EPSILON) * 100) / 100;
}

export function proposedWelcomeDiscountAmount(amountUsd: number): number {
  return money(amountUsd * (1 - WELCOME_DISCOUNT_PERCENT / 100));
}

export function providerCoverageMultiple(input: {
  amountUsd: number;
  purchasedInternalCredits: number;
  includeStarterCredits?: boolean;
}): number {
  const totalSpendable = Math.max(
    1,
    Number(input.purchasedInternalCredits || 0) +
      (input.includeStarterCredits === false ? 0 : STARTER_CREDITS_INTERNAL),
  );
  const worstCaseProviderCost = totalSpendable * MAX_PROVIDER_COST_PER_INTERNAL_CREDIT_USD;
  return Math.max(0, Number(input.amountUsd) || 0) / worstCaseProviderCost;
}

/**
 * Returns the real amount PayPal may charge during the welcome window.
 * If the 20% price would ever violate the 2x modeled API-cost floor, the
 * server silently keeps the normal price instead of creating an unsafe sale.
 */
export function marginSafeWelcomePrice(input: {
  productId: string;
  amountUsd: number;
  purchasedInternalCredits: number;
}): number {
  const normalAmount = money(input.amountUsd);
  if (!WELCOME_OFFER_PRODUCTS.has(input.productId)) return normalAmount;
  const discountedAmount = proposedWelcomeDiscountAmount(normalAmount);
  const multiple = providerCoverageMultiple({
    amountUsd: discountedAmount,
    purchasedInternalCredits: input.purchasedInternalCredits,
  });
  return multiple + 1e-9 >= MIN_PROVIDER_MULTIPLE ? discountedAmount : normalAmount;
}
