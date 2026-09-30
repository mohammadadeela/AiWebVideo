/**
 * Single source of truth for the number of credits a successful payment grants.
 * Provider-specific routes add their own price/plan IDs, but must not redefine
 * credit amounts independently.
 */
export const BILLING_CREDIT_PRODUCTS = {
  creator: { credits: 150, plan: 'creator' },
  pro: { credits: 400, plan: 'pro' },
  agency: { credits: 1000, plan: 'agency' },
  single8: { credits: 38, plan: 'creator' },
  single48: { credits: 198, plan: 'creator' },
  single144: { credits: 582, plan: 'creator' },
  topup50: { credits: 50, plan: 'creator' },
  topup100: { credits: 100, plan: 'creator' },
  topup250: { credits: 250, plan: 'creator' },
} as const;

export type BillingProductId = keyof typeof BILLING_CREDIT_PRODUCTS;
