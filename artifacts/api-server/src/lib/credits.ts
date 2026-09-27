import {
  imageProviderCostPerImage,
  isImageModelTier,
  isVideoModelTier,
  markedUpCredits,
  videoProviderCostPerSecond,
  type ModelTier,
} from './model-tiers.js';

export const CREDIT_COSTS = {
  PHOTO_SINGLE: 2,
  PHOTO_SET_4: 8,
  /** Legacy/default rates retained for existing jobs that do not have a model tier saved. */
  VIDEO_PER_SECOND_STANDARD_1080P: 4,
  VIDEO_PER_SECOND_STANDARD_4K: 6,
  /** Flat surcharge for a generated narration script + TTS synthesis pass. */
  VOICEOVER: 6,
};

export const MIN_VIDEO_SECONDS = 8;
export const MAX_VIDEO_SECONDS = 144;
export const MAX_CREATOR_VIDEO_SECONDS = 60;
export const VIDEO_SCENE_SECONDS = 8;

export function normalizedGeneratedSeconds(durationSeconds = MIN_VIDEO_SECONDS): number {
  const wholeSeconds = Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : MIN_VIDEO_SECONDS;
  return Math.max(MIN_VIDEO_SECONDS, Math.min(MAX_VIDEO_SECONDS, wholeSeconds));
}

export interface VideoCreditQuote {
  generatedSeconds: number;
  perSecondCredits: number;
  videoCredits: number;
  photoCredits: number;
  photoSingleCredits?: number;
  narrationCredits: number;
  totalCredits: number;
  modelTier?: ModelTier;
}

/**
 * New tier-aware jobs derive credits from real provider cost using the requested
 * 2x markup rule. Older jobs without modelTier keep their original fixed quote
 * so reopening a saved production can never change its price unexpectedly.
 */
export function videoCreditQuote(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelTier?: ModelTier | null,
): VideoCreditQuote {
  if (mode === 'photos' || mode === 'icon') {
    const photoSingleCredits = isImageModelTier(modelTier)
      ? markedUpCredits(imageProviderCostPerImage(modelTier))
      : CREDIT_COSTS.PHOTO_SINGLE;
    const photoCredits = photoSingleCredits * 4;
    return {
      generatedSeconds: 0,
      perSecondCredits: 0,
      videoCredits: 0,
      photoCredits,
      photoSingleCredits,
      narrationCredits: 0,
      totalCredits: photoCredits,
      ...(modelTier ? { modelTier } : {}),
    };
  }

  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const perSecondCredits = isVideoModelTier(modelTier)
    ? markedUpCredits(videoProviderCostPerSecond(modelTier, outputQuality))
    : outputQuality === '4k'
      ? CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K
      : CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P;
  const videoCredits = generatedSeconds * perSecondCredits;

  // Combined legacy mode keeps the established photo portion because it has one
  // video tier, not a separate image-tier selection.
  const photoCredits = mode === 'both' ? CREDIT_COSTS.PHOTO_SET_4 : 0;
  const narrationCredits = skipVoiceover ? 0 : CREDIT_COSTS.VOICEOVER;
  return {
    generatedSeconds,
    perSecondCredits,
    videoCredits,
    photoCredits,
    narrationCredits,
    totalCredits: videoCredits + photoCredits + narrationCredits,
    ...(modelTier ? { modelTier } : {}),
  };
}

export function videoCreditCost(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelTier?: ModelTier | null,
): number {
  return videoCreditQuote(mode, skipVoiceover, durationSeconds, outputQuality, modelTier).totalCredits;
}
