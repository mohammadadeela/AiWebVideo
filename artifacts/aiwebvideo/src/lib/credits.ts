import type { ModelTier } from "@/components/chat/types";
import { isImageTier, isVideoTier, modelOption } from "@/lib/modelTiers";

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
export const MAX_VIDEO_SECONDS = 144;
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
  modelTier?: ModelTier,
) {
  if (mode === 'photos' || mode === 'icon') {
    if (modelTier && isImageTier(modelTier)) return modelOption(modelTier).internalCreditsPerUnit * 4;
    return CREDIT_COSTS.PHOTO_SET_4;
  }

  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const perSecond = modelTier && isVideoTier(modelTier)
    ? (outputQuality === '4k'
        ? modelOption(modelTier).internalCredits4k ?? modelOption(modelTier).internalCreditsPerUnit
        : modelOption(modelTier).internalCreditsPerUnit)
    : (outputQuality === '4k' ? CREDIT_COSTS.VIDEO_PER_SECOND_4K : CREDIT_COSTS.VIDEO_PER_SECOND_1080P);
  const video = generatedSeconds * perSecond;
  const narration = skipVoiceover ? 0 : CREDIT_COSTS.NARRATION;
  // Video + Photos uses the balanced Graphic 2 four-image add-on.
  const photoAddon = mode === 'both' ? modelOption('graphic2').internalCreditsPerUnit * 4 : 0;
  return video + photoAddon + narration;
}

export function estimateRenderCredits(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelTier?: ModelTier,
) {
  return displayCredits(estimateInternalRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality, modelTier));
}

export function displayedModelUnitCredits(tier: ModelTier, outputQuality: '1080p' | '4k' = '1080p') {
  const option = modelOption(tier);
  const internal = outputQuality === '4k' ? option.internalCredits4k ?? option.internalCreditsPerUnit : option.internalCreditsPerUnit;
  return displayCredits(internal);
}
