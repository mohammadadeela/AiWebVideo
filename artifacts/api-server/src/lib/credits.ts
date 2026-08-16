export const CREDIT_COSTS = {
  PHOTO_SINGLE: 2,
  PHOTO_SET_4: 8,
  /** One credit per generated second at 1080p; retail credit value is kept above $0.20. */
  VIDEO_PER_SECOND: 1,
  /**
   * 4K multiplier for video credits. Real provider pricing (Veo 3.1 Fast,
   * confirmed against Google's published rates): 1080p = $0.12/sec, 4K =
   * $0.30/sec — a 2.5x real cost jump that was previously NOT reflected in
   * credit pricing at all (4K charged the exact same 1 credit/sec as
   * 1080p). At the account's cheapest per-credit sell price (~$0.2475,
   * Agency plan), that meant every subscription plan went net-negative for
   * any subscriber who generated 4K video, and one-time video purchases
   * shrank to near-zero margin. 3 credits/sec for 4K keeps a healthy ~2.5x+
   * margin over Fast-model cost.
   */
  VIDEO_PER_SECOND_4K: 3,
  /** Conservative rates used when the operator explicitly pins Veo Standard. */
  VIDEO_PER_SECOND_STANDARD_1080P: 4,
  VIDEO_PER_SECOND_STANDARD_4K: 5,
  /** Flat surcharge for a generated narration script + TTS synthesis pass. */
  VOICEOVER: 6,
};

export const MIN_VIDEO_SECONDS = 8;
export const MAX_VIDEO_SECONDS = 240;
export const VIDEO_SCENE_SECONDS = 8;

export function normalizedGeneratedSeconds(durationSeconds = MIN_VIDEO_SECONDS): number {
  return Math.max(MIN_VIDEO_SECONDS, Math.min(MAX_VIDEO_SECONDS, Math.ceil(durationSeconds / VIDEO_SCENE_SECONDS) * VIDEO_SCENE_SECONDS));
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
  const configuredModel = (process.env.GEMINI_VIDEO_MODEL ?? '').toLowerCase();
  const standardModel = configuredModel.includes('veo') && !configuredModel.includes('fast') && !configuredModel.includes('lite');
  const perSecondCredits = standardModel
    ? (outputQuality === '4k' ? CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_4K : CREDIT_COSTS.VIDEO_PER_SECOND_STANDARD_1080P)
    : (outputQuality === '4k' ? CREDIT_COSTS.VIDEO_PER_SECOND_4K : CREDIT_COSTS.VIDEO_PER_SECOND);
  const videoCredits = generatedSeconds * perSecondCredits;
  const photoCredits = mode === 'both' ? CREDIT_COSTS.PHOTO_SET_4 : 0;
  const narrationCredits = skipVoiceover ? 0 : CREDIT_COSTS.VOICEOVER;
  return { generatedSeconds, perSecondCredits, videoCredits, photoCredits, narrationCredits, totalCredits: videoCredits + photoCredits + narrationCredits };
}

/**
 * Cost of a render:
 * - photos: flat photo-set price
 * - video/tutorial/buy/tour: per 8s scene clip (60s ≈ 7 clips)
 * - demo: same per-second AI video price; demo no longer generates still
 *   images first or animates them with code.
 * - both: video price + photo-set price
 * - + VOICEOVER surcharge whenever narration is requested (not skipVoiceover)
 *   for any non-photos mode, since that's a real script-generation + TTS
 *   synthesis call that silent renders don't make.
 * - 4K output charges VIDEO_PER_SECOND_4K instead of VIDEO_PER_SECOND — see
 *   that constant's comment for the real-cost math behind the multiplier.
 */
export function videoCreditCost(mode: string, skipVoiceover: boolean, durationSeconds = 8, outputQuality: '1080p' | '4k' = '1080p'): number {
  return videoCreditQuote(mode, skipVoiceover, durationSeconds, outputQuality).totalCredits;
}
