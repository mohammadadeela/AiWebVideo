import { GEMINI_COST_CATALOG } from './costs.js';

export type VideoModelTier = 'cinema1' | 'cinema2' | 'cinema_pro';
export type ImageModelTier = 'graphic1' | 'graphic_pro';
export type ModelTier = VideoModelTier | ImageModelTier;

/**
 * One internal credit is the accounting unit behind five customer-facing credits.
 * $99 / 400 internal credits is the current lowest plan credit value and matches
 * the existing Standard 1080p pricing (4 internal / 20 displayed credits per second).
 */
export const INTERNAL_CREDIT_VALUE_USD = Math.max(
  0.01,
  Number(process.env.INTERNAL_CREDIT_VALUE_USD ?? (99 / 400)),
);

export function isVideoModelTier(value: unknown): value is VideoModelTier {
  return value === 'cinema1' || value === 'cinema2' || value === 'cinema_pro';
}

export function isImageModelTier(value: unknown): value is ImageModelTier {
  return value === 'graphic1' || value === 'graphic_pro';
}

export function isModelTier(value: unknown): value is ModelTier {
  return isVideoModelTier(value) || isImageModelTier(value);
}

export function defaultModelTierForMode(mode: string): ModelTier {
  return mode === 'photos' || mode === 'icon' ? 'graphic1' : 'cinema2';
}

export function modelTierForMode(mode: string, value: unknown): ModelTier {
  if (mode === 'photos' || mode === 'icon') {
    return isImageModelTier(value) ? value : 'graphic1';
  }
  return isVideoModelTier(value) ? value : 'cinema2';
}

export function videoModelForTier(tier: VideoModelTier): string {
  if (tier === 'cinema1') return 'veo-3.1-lite-generate-preview';
  if (tier === 'cinema_pro') return 'veo-3.1-generate-preview';
  return 'veo-3.1-fast-generate-preview';
}

export function videoProviderCostPerSecond(
  tier: VideoModelTier,
  quality: '1080p' | '4k',
): number {
  if (tier === 'cinema1') {
    if (quality === '4k') throw new Error('AIWebVideo Cinema 1 supports up to 1080p.');
    return GEMINI_COST_CATALOG.video.lite1080;
  }
  if (tier === 'cinema2') {
    return quality === '4k'
      ? GEMINI_COST_CATALOG.video.fast4k
      : GEMINI_COST_CATALOG.video.fast1080;
  }
  return quality === '4k'
    ? GEMINI_COST_CATALOG.video.standard4k
    : GEMINI_COST_CATALOG.video.standard1080;
}

export function imageProviderCostPerImage(tier: ImageModelTier): number {
  return tier === 'graphic_pro'
    ? GEMINI_COST_CATALOG.image.fourK
    : GEMINI_COST_CATALOG.image.twoK;
}

export function imageProviderSizeForTier(tier: ImageModelTier): '2K' | '4K' {
  return tier === 'graphic_pro' ? '4K' : '2K';
}

/** User-requested pricing rule: always charge at least a 2x provider-cost multiple. */
export function markedUpCredits(providerCostUsd: number): number {
  return Math.max(
    1,
    Math.ceil((Math.max(0, providerCostUsd) * 2) / INTERNAL_CREDIT_VALUE_USD),
  );
}

export function modelTierLabel(tier: ModelTier): string {
  switch (tier) {
    case 'cinema1': return 'AIWebVideo Cinema 1';
    case 'cinema2': return 'AIWebVideo Cinema 2';
    case 'cinema_pro': return 'AIWebVideo Cinema Pro';
    case 'graphic1': return 'AIWebVideo Graphic 1';
    case 'graphic_pro': return 'AIWebVideo Graphic Pro';
  }
}
