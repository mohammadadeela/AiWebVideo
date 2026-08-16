export const CREDIT_COSTS = {
  PHOTO_SET_4: 8,
  VIDEO_PER_SECOND_1080P: 1,
  VIDEO_PER_SECOND_4K: 3,
  NARRATION: 6,
} as const;

export const MIN_VIDEO_SECONDS = 8;
export const MAX_VIDEO_SECONDS = 240;
export const VIDEO_SCENE_SECONDS = 8;

export function normalizedGeneratedSeconds(durationSeconds = MIN_VIDEO_SECONDS) {
  return Math.max(MIN_VIDEO_SECONDS, Math.min(MAX_VIDEO_SECONDS, Math.ceil(durationSeconds / VIDEO_SCENE_SECONDS) * VIDEO_SCENE_SECONDS));
}

/** Mirrors the server quote for the margin-safe default Veo Fast configuration. */
export function estimateRenderCredits(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
) {
  if (mode === 'photos' || mode === 'icon') return CREDIT_COSTS.PHOTO_SET_4;
  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const video = generatedSeconds * (outputQuality === '4k' ? CREDIT_COSTS.VIDEO_PER_SECOND_4K : CREDIT_COSTS.VIDEO_PER_SECOND_1080P);
  const narration = skipVoiceover ? 0 : CREDIT_COSTS.NARRATION;
  return video + (mode === 'both' ? CREDIT_COSTS.PHOTO_SET_4 : 0) + narration;
}
