import { GEMINI_COST_CATALOG } from './costs.js';

export type VideoModelTier = 'cinema1' | 'cinema2' | 'cinema_pro';
export type ImageModelTier = 'graphic1' | 'graphic2' | 'graphic_pro';
export type ModelTier = VideoModelTier | ImageModelTier;

export const MODEL_TIERS: readonly ModelTier[] = [
  'cinema1', 'cinema2', 'cinema_pro', 'graphic1', 'graphic2', 'graphic_pro',
] as const;

export const INTERNAL_CREDIT_VALUE_USD = Math.max(
  0.01,
  Number(process.env.INTERNAL_CREDIT_VALUE_USD ?? (99 / 400)),
);

export const TARGET_PROVIDER_MULTIPLE = Math.max(
  2,
  Number(process.env.AIWEBVIDEO_PROVIDER_COST_MULTIPLE ?? 2.2),
);

export function isModelTier(value: unknown): value is ModelTier {
  return typeof value === 'string' && (MODEL_TIERS as readonly string[]).includes(value);
}
export function isVideoModelTier(value: unknown): value is VideoModelTier {
  return value === 'cinema1' || value === 'cinema2' || value === 'cinema_pro';
}
export function isImageModelTier(value: unknown): value is ImageModelTier {
  return value === 'graphic1' || value === 'graphic2' || value === 'graphic_pro';
}
export function videoModelForTier(tier: VideoModelTier): string {
  if (tier === 'cinema1') return 'veo-3.1-lite-generate-preview';
  if (tier === 'cinema2') return 'veo-3.1-fast-generate-preview';
  return 'veo-3.1-generate-preview';
}
export function videoProviderCostPerSecond(tier: VideoModelTier, quality: '1080p' | '4k'): number {
  if (tier === 'cinema1') {
    if (quality === '4k') throw new Error('Cinema 1 does not support 4K output.');
    return GEMINI_COST_CATALOG.video.lite1080;
  }
  if (tier === 'cinema2') return quality === '4k' ? GEMINI_COST_CATALOG.video.fast4k : GEMINI_COST_CATALOG.video.fast1080;
  return quality === '4k' ? GEMINI_COST_CATALOG.video.standard4k : GEMINI_COST_CATALOG.video.standard1080;
}
export function imageModelForTier(tier: ImageModelTier): string {
  if (tier === 'graphic1') return 'gemini-3.1-flash-lite-image';
  if (tier === 'graphic2') return 'gemini-3.1-flash-image';
  return 'gemini-3-pro-image';
}
export function imageProviderSizeForTier(tier: ImageModelTier): '1K' | '2K' | '4K' {
  if (tier === 'graphic1') return '1K';
  if (tier === 'graphic2') return '2K';
  return '4K';
}
export function imageProviderCostPerImage(tier: ImageModelTier): number {
  if (tier === 'graphic1') return GEMINI_COST_CATALOG.image.lite1K;
  if (tier === 'graphic2') return GEMINI_COST_CATALOG.image.flash2K;
  return GEMINI_COST_CATALOG.image.pro4K;
}
export function markedUpCredits(providerCostUsd: number): number {
  return Math.max(1, Math.ceil((Math.max(0, Number(providerCostUsd) || 0) * TARGET_PROVIDER_MULTIPLE) / INTERNAL_CREDIT_VALUE_USD));
}
export function publicModelLabel(tier: ModelTier): string {
  if (tier === 'cinema1') return 'AIWebVideo Cinema 1';
  if (tier === 'cinema2') return 'AIWebVideo Cinema 2';
  if (tier === 'cinema_pro') return 'AIWebVideo Cinema Pro';
  if (tier === 'graphic1') return 'AIWebVideo Graphic 1';
  if (tier === 'graphic2') return 'AIWebVideo Graphic 2';
  return 'AIWebVideo Graphic Pro';
}
