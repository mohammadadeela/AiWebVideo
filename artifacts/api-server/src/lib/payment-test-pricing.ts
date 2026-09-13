import { PRODUCTS } from '../routes/paypal.js';

/**
 * TEMPORARY LIVE PAYMENT TEST OVERRIDE.
 *
 * The owner explicitly requested Quick Video to cost $1.00 while validating the
 * live card/Google Pay checkout. Remove this override and restore the frontend
 * labels to $9.99 as soon as payment testing is finished.
 */
export const QUICK_VIDEO_TEST_PRICE_USD = 1;

export function applyTemporaryPaymentTestPricing() {
  // `as const` protects the catalog at compile time; this deliberate runtime
  // override keeps every server checkout path (embedded card, Google Pay and
  // PayPal fallback) on the exact same temporary price.
  (PRODUCTS.single8 as { amountUsd: number }).amountUsd = QUICK_VIDEO_TEST_PRICE_USD;
}
