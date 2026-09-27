import { IMAGE_MODEL_OPTIONS, VIDEO_MODEL_OPTIONS, markedUpInternalCredits, type ModelTier } from './modelTiers';

export const CREDIT_COSTS = {
  PHOTO_SET_4: 8,
  VIDEO_PER_SECOND_1080P: 4,
  VIDEO_PER_SECOND_4K: 6,
  NARRATION: 6,
} as const;

export const CREDIT_DISPLAY_MULTIPLIER = 5;

export function displayCredits(value: number | null | undefined): number {
  const numeric = Number(value ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric * CREDIT_DISPLAY_MULTIPLIER));
}

export function formatDisplayCredits(value: number | null | undefined): string {
  return displayCredits(value).toLocaleString();
}

export const MIN_VIDEO_SECONDS = 8;
export const MAX_VIDEO_SECONDS = 60;
export const VIDEO_SCENE_SECONDS = 8;

export function normalizedGeneratedSeconds(durationSeconds = MIN_VIDEO_SECONDS) {
  const wholeSeconds = Number.isFinite(durationSeconds) ? Math.round(durationSeconds) : MIN_VIDEO_SECONDS;
  return Math.max(MIN_VIDEO_SECONDS, Math.min(MAX_VIDEO_SECONDS, wholeSeconds));
}

export function estimateInternalRenderCredits(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelTier?: ModelTier | null,
) {
  if (mode === 'photos' || mode === 'icon') {
    const imageTier = IMAGE_MODEL_OPTIONS.find((option) => option.id === modelTier);
    return imageTier
      ? markedUpInternalCredits(imageTier.providerCostPerImage) * 4
      : CREDIT_COSTS.PHOTO_SET_4;
  }

  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const videoTier = VIDEO_MODEL_OPTIONS.find((option) => option.id === modelTier);
  const perSecond = videoTier
    ? markedUpInternalCredits(
        outputQuality === '4k' && videoTier.providerCost4k
          ? videoTier.providerCost4k
          : videoTier.providerCost1080,
      )
    : outputQuality === '4k'
      ? CREDIT_COSTS.VIDEO_PER_SECOND_4K
      : CREDIT_COSTS.VIDEO_PER_SECOND_1080P;
  const video = generatedSeconds * perSecond;
  const narration = skipVoiceover ? 0 : CREDIT_COSTS.NARRATION;
  return video + (mode === 'both' ? CREDIT_COSTS.PHOTO_SET_4 : 0) + narration;
}

export function estimateRenderCredits(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelTier?: ModelTier | null,
) {
  return displayCredits(estimateInternalRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality, modelTier));
}
