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
  VIDEO_PER_SECOND_STANDARD_1080P: 4,
  VIDEO_PER_SECOND_STANDARD_4K: 6,
  VOICEOVER: 6,
};

export const MIN_VIDEO_SECONDS = 8;
export const MAX_VIDEO_SECONDS = 144;
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
  narrationCredits: number;
  totalCredits: number;
}
function photoSetCredits(modelTier?: ModelTier): number {
  if (!isImageModelTier(modelTier)) return CREDIT_COSTS.PHOTO_SET_4;
  return markedUpCredits(imageProviderCostPerImage(modelTier)) * 4;
}
export function videoCreditQuote(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelTier?: ModelTier,
): VideoCreditQuote {
  if (mode === 'photos' || mode === 'icon') {
    const photoCredits = photoSetCredits(modelTier);
    return { generatedSeconds: 0, perSecondCredits: 0, videoCredits: 0, photoCredits, narrationCredits: 0, totalCredits: photoCredits };
  }
  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const perSecondCredits = isVideoModelTier(modelTier)
    ? markedUpCredits(videoProviderCostPerSecond(modelTier, outputQuality))
    : outputQuality === '4k'
      ? CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K
      : CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P;
  const videoCredits = generatedSeconds * perSecondCredits;
  const photoCredits = mode === 'both' ? markedUpCredits(imageProviderCostPerImage('graphic2')) * 4 : 0;
  const narrationCredits = skipVoiceover ? 0 : CREDIT_COSTS.VOICEOVER;
  return { generatedSeconds, perSecondCredits, videoCredits, photoCredits, narrationCredits, totalCredits: videoCredits + photoCredits + narrationCredits };
}
export function videoCreditCost(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelTier?: ModelTier,
): number {
  return videoCreditQuote(mode, skipVoiceover, durationSeconds, outputQuality, modelTier).totalCredits;
}
