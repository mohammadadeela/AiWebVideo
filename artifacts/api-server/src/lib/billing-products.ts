import { GENERATION_MODELS, imageModelProviderCostPerImage, videoModelProviderCostPerSecond } from './generation-models.js';
import { CREDIT_DISPLAY_MULTIPLIER } from './growth-offers.js';

export type CreationFeature = 'website' | 'video' | 'product-photo' | 'product-video' | 'interior';
export interface CreationScope {
  feature: CreationFeature;
  modelId: string;
  durationSeconds?: number;
  quality: '1080p';
  audioMode: 'native_audio' | 'silent';
}
export interface BillingProduct {
  name: string;
  mode: 'payment' | 'subscription';
  type: 'create_once' | 'credits' | 'plan';
  amountUsd: number;
  credits: number;
  plan: string | null;
  scope?: CreationScope;
  displayCredits: number;
}

// Server-owned provider prices, 5% retry/reference overhead, planning cost,
// and a 2x provider-cost floor after the processor's variable and fixed fee.
const PROCESSOR_PERCENT = 0.0401;
const PROCESSOR_FIXED = 0.35;
const OVERHEAD_MULTIPLE = 1.05;
const PLANNING_USD = 0.02;
const REQUIRED_COST_MULTIPLE = 2;
const costPerCredit = Math.max(
  ...Object.values(GENERATION_MODELS).flatMap((model) => model.creditUnit === 'second'
    ? [videoModelProviderCostPerSecond(model, '1080p') / Math.max(1, model.internalCredits),
       ...(model.supports4k ? [videoModelProviderCostPerSecond(model, '4k') / (model.id === 'cinema-2' ? 3 : 6)] : [])]
    : [imageModelProviderCostPerImage(model, '1080p') / model.internalCredits,
       ...(model.supports4k ? [imageModelProviderCostPerImage(model, '4k') / (model.internalCredits4k ?? model.internalCredits)] : [])],
  ),
);

export function minimumSafeCheckoutUsd(providerCostUsd: number) {
  return (REQUIRED_COST_MULTIPLE * providerCostUsd + PROCESSOR_FIXED) / (1 - PROCESSOR_PERCENT);
}

/** .99 ceiling; never round a provider-cost increase below the floor. */
export function safeCatalogPrice(targetUsd: number, providerCostUsd: number) {
  const floor = minimumSafeCheckoutUsd(providerCostUsd);
  if (targetUsd + 1e-8 >= floor) return targetUsd;
  return Math.ceil(floor - 0.99 - 1e-8) + 0.99;
}

function flexible(name: string, credits: number, target: number, mode: BillingProduct['mode']): BillingProduct {
  // Four images are the smallest supported production, so planning can occur
  // once per four internal credits at the most expensive valid spend path.
  const cost = credits * (costPerCredit * OVERHEAD_MULTIPLE + PLANNING_USD / 4);
  return { name, mode, type: mode === 'subscription' ? 'plan' : 'credits',
    amountUsd: safeCatalogPrice(target, cost), credits, displayCredits: credits * CREDIT_DISPLAY_MULTIPLIER,
    plan: mode === 'subscription' ? name.toLowerCase() : null };
}

function once(feature: CreationFeature, secondsOrImages: number, target: number): BillingProduct {
  const image = feature === 'product-photo' || feature === 'interior';
  const modelId = image ? (feature === 'interior' ? 'space-2' : 'graphic-2') : feature === 'video' ? 'cinema-1' : 'cinema-2';
  const model = GENERATION_MODELS[modelId];
  const credits = secondsOrImages * model.internalCredits;
  const baseCost = image ? secondsOrImages * imageModelProviderCostPerImage(model, '1080p')
    : secondsOrImages * videoModelProviderCostPerSecond(model, '1080p');
  const scope: CreationScope = { feature, modelId, ...(image ? {} : { durationSeconds: secondsOrImages }),
    quality: '1080p', audioMode: image ? 'silent' : 'native_audio' };
  const label = ({ website: 'Website Video', video: 'AI Video', 'product-photo': 'Product Photos',
    'product-video': 'Product Video', interior: 'Interior Design' })[feature];
  return { name: `${label} · ${secondsOrImages}${image ? ' images' : 's'}`, mode: 'payment', type: 'create_once',
    amountUsd: safeCatalogPrice(target, baseCost * OVERHEAD_MULTIPLE + PLANNING_USD),
    credits, displayCredits: credits * CREDIT_DISPLAY_MULTIPLIER, plan: null, scope };
}

/** Only these keys can start new checkout. Historical payment rows remain readable. */
export const BILLING_PRODUCTS = {
  once_website_8: once('website', 8, 2.99),
  once_website_16: once('website', 16, 5.49),
  once_website_32: once('website', 32, 10.49),
  once_video_8: once('video', 8, 2.49),
  once_video_16: once('video', 16, 3.99),
  once_video_32: once('video', 32, 6.99),
  once_product_video_8: once('product-video', 8, 2.99),
  once_product_video_16: once('product-video', 16, 5.49),
  once_product_video_32: once('product-video', 32, 10.49),
  once_product_photo_4: once('product-photo', 4, 1.49),
  once_product_photo_8: once('product-photo', 8, 2.49),
  once_product_photo_12: once('product-photo', 12, 3.49),
  once_interior_4: once('interior', 4, 1.49),
  once_interior_8: once('interior', 8, 2.49),
  once_interior_12: once('interior', 12, 3.49),
  credits50: flexible('50 credits', 10, 2.99, 'payment'),
  credits100: flexible('100 credits', 20, 5.49, 'payment'),
  credits250: flexible('250 credits', 50, 12.99, 'payment'),
  credits500: flexible('500 credits', 100, 24.99, 'payment'),
  credits1000: flexible('1,000 credits', 200, 47.99, 'payment'),
  creator: flexible('Creator', 40, 9.99, 'subscription'),
  pro: flexible('Pro', 105, 24.99, 'subscription'),
  agency: flexible('Agency', 260, 59.99, 'subscription'),
} satisfies Record<string, BillingProduct>;

export const BILLING_CREDIT_PRODUCTS = Object.fromEntries(Object.entries(BILLING_PRODUCTS).map(([id, p]) => [id, { credits: p.credits, plan: p.plan }])) as Record<keyof typeof BILLING_PRODUCTS, { credits: number; plan: string | null }>;
export type BillingProductId = keyof typeof BILLING_PRODUCTS;
export function creatorIntentForProductId(id: string | null | undefined) {
  const feature = id ? BILLING_PRODUCTS[id as BillingProductId]?.scope?.feature : null;
  return feature === 'product-photo' ? 'photo' : feature === 'product-video' ? 'product-video'
    : feature === 'interior' ? 'interior' : feature === 'video' ? 'video'
    : feature === 'website' ? 'website' : null;
}
