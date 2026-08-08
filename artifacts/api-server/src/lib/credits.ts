export const CREDIT_COSTS = {
  PHOTO_SINGLE: 2,
  PHOTO_SET_4: 8,
  /** One credit per generated second; retail credit value is kept above $0.20. */
  VIDEO_PER_SECOND: 1,
};

/**
 * Cost of a render:
 * - photos: flat photo-set price
 * - video/tutorial/buy/tour: per 8s scene clip (60s ≈ 7 clips)
 * - demo: same per-second video price PLUS one PHOTO_SINGLE surcharge per
 *   scene, since every scene is also a full AI-generated image (imagen) call
 *   before it ever reaches the FFmpeg assembly step — real added cost that
 *   exact-capture modes don't have.
 * - both: video price + photo-set price
 */
export function videoCreditCost(mode: string, skipVoiceover: boolean, durationSeconds = 8): number {
  if (mode === 'photos') return CREDIT_COSTS.PHOTO_SET_4;
  const generatedSeconds = Math.max(8, Math.round(durationSeconds / 8) * 8);
  const videoCost = generatedSeconds * CREDIT_COSTS.VIDEO_PER_SECOND;
  if (mode === 'demo') {
    const sceneCount = Math.max(1, Math.round(generatedSeconds / 8));
    return videoCost + sceneCount * CREDIT_COSTS.PHOTO_SINGLE;
  }
  if (mode === 'both') return videoCost + CREDIT_COSTS.PHOTO_SET_4;
  return videoCost;
}
