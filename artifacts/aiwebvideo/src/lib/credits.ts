export const CREDIT_COSTS = {
  PHOTO_SET_4: 8,
  VIDEO_PER_SECOND_1080P: 4,
  VIDEO_PER_SECOND_4K: 6,
  NARRATION: 6,
} as const;

/**
 * Customer-facing denomination only. Billing, reservations and provider gates
 * continue to use the smaller internal credit unit, so changing the displayed
 * denomination never changes economics or authorization.
 */
export const CREDIT_DISPLAY_MULTIPLIER = 10;

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

/** Mirrors the server quote for the premium Veo 3.1 default configuration. */
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
