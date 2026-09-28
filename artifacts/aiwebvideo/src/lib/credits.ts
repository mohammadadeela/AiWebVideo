import { publicModel } from '@/lib/generationModels';

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
  modelId?: string | null,
) {
  if (mode === 'photos' || mode === 'icon') {
    const model = publicModel(modelId ?? 'graphic-2');
    return Math.max(1, model.internalCreditsPerImage ?? 1) * 4;
  }
  const model = publicModel(modelId ?? 'cinema-2');
  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const perSecond = outputQuality === '4k'
    ? (model.internalCredits4k ?? model.internalCredits1080p ?? CREDIT_COSTS.VIDEO_PER_SECOND_4K)
    : (model.internalCredits1080p ?? CREDIT_COSTS.VIDEO_PER_SECOND_1080P);
  const video = generatedSeconds * perSecond;
  const narration = skipVoiceover ? 0 : CREDIT_COSTS.NARRATION;
  // Combined product campaigns pair the selected video model with Graphic 2.
  const photoSet = mode === 'both' ? 4 : 0;
  return video + photoSet + narration;
}

export function estimateRenderCredits(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelId?: string | null,
) {
  return displayCredits(estimateInternalRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality, modelId));
}
