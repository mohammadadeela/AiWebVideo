/**
 * Single source of truth for the number of credits a successful payment grants.
 * Provider-specific routes add their own price/plan IDs, but must not redefine
 * credit amounts independently.
 */
export const BILLING_CREDIT_PRODUCTS = {
  creator: { credits: 150, plan: 'creator' },
  pro: { credits: 400, plan: 'pro' },
  agency: { credits: 1000, plan: 'agency' },
  // One-video packs are sized to fully cover a Cinema 2 · 1080p video of that length
  // including narration (2 credits/s + 6), so the customer never pays for unused headroom.
  single8: { credits: 22, plan: 'creator' },
  single48: { credits: 102, plan: 'creator' },
  single144: { credits: 294, plan: 'creator' },
  // Credit packs. The product ids are historical (they are stored on past payments) and
  // no longer match the amounts: topup50 = $4.99, topup100 = $14.99, topup250 = $24.99.
  // Sizes keep the 20% welcome price above 2x modeled provider cost (see growth-offers.ts).
  topup50: { credits: 14, plan: 'creator' },
  topup100: { credits: 53, plan: 'creator' },
  topup250: { credits: 92, plan: 'creator' },
} as const;

export type BillingProductId = keyof typeof BILLING_CREDIT_PRODUCTS;
