export const CREDIT_COSTS = {
  PHOTO_SINGLE: 2,
  PHOTO_SET_4: 8,
  /** Premium Veo 3.1 rates used for every customer-facing final render. */
  VIDEO_PER_SECOND_STANDARD_1080P: 4,
  // Six credits keeps net revenue above 2x the official $0.60/s provider
  // rate even after a conservative payment-processing reserve.
  VIDEO_PER_SECOND_STANDARD_4K: 6,
  /** Flat surcharge for a generated narration script + TTS synthesis pass. */
  VOICEOVER: 6,
};

export const MIN_VIDEO_SECONDS = 8;
export const MAX_VIDEO_SECONDS = 144;
export const VIDEO_SCENE_SECONDS = 8;

export function normalizedGeneratedSeconds(durationSeconds = MIN_VIDEO_SECONDS): number {
  // The continuous renderer can trim the final Veo continuation to the exact
  // customer-selected whole second. Keep 8 seconds as the provider minimum,
  // but do not force customer durations onto old 8-second scene boundaries.
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

export function videoCreditQuote(mode: string, skipVoiceover: boolean, durationSeconds = 8, outputQuality: '1080p' | '4k' = '1080p'): VideoCreditQuote {
  if (mode === 'photos' || mode === 'icon') {
    return { generatedSeconds: 0, perSecondCredits: 0, videoCredits: 0, photoCredits: CREDIT_COSTS.PHOTO_SET_4, narrationCredits: 0, totalCredits: CREDIT_COSTS.PHOTO_SET_4 };
  }
  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  // Customer credit pricing is a product rule, not a provider-model rule.
  // Keeping it fixed prevents Smart Settings from showing one price while the
  // server charges another just because an operator changes GEMINI_VIDEO_MODEL.
  const perSecondCredits = outputQuality === '4k'
    ? CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K
    : CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P;
  const videoCredits = generatedSeconds * perSecondCredits;
  const photoCredits = mode === 'both' ? CREDIT_COSTS.PHOTO_SET_4 : 0;
  const narrationCredits = skipVoiceover ? 0 : CREDIT_COSTS.VOICEOVER;
  return { generatedSeconds, perSecondCredits, videoCredits, photoCredits, narrationCredits, totalCredits: videoCredits + photoCredits + narrationCredits };
}

/**
 * Cost of a render:
 * - photos: flat photo-set price
 * - video/tutorial/buy/tour: per requested whole second for the continuous final film
 * - demo: same per-second AI video price; demo no longer generates still
 *   images first or animates them with code.
 * - both: video price + photo-set price
 * - + VOICEOVER surcharge whenever narration is requested (not skipVoiceover)
 *   for any non-photos mode, since that's a real script-generation + TTS
 *   synthesis call that silent renders don't make.
 * - Customer pricing is fixed at the Standard 1080p/4K rates regardless of
 *   which internal provider/model an operator uses to fulfill the render.
 */
export function videoCreditCost(mode: string, skipVoiceover: boolean, durationSeconds = 8, outputQuality: '1080p' | '4k' = '1080p'): number {
  return videoCreditQuote(mode, skipVoiceover, durationSeconds, outputQuality).totalCredits;
}
