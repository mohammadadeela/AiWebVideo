import { generationModelForMode, imageModelCreditsPerImage, videoModelCreditsPerSecond } from './generation-models.js';

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
  modelId?: string;
}

/**
 * Server-authoritative quote. modelId is a public AiWebVideo model id; real
 * provider ids remain server-only. If an old client omits it, the catalog
 * safely falls back to Cinema 2 / Graphic 2.
 */
export function videoCreditQuote(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelId?: string | null,
  studioKind?: string | null,
): VideoCreditQuote {
  if (mode === 'photos' || mode === 'icon') {
    const imageModel = generationModelForMode(modelId, mode, studioKind);
    const photoCredits = imageModelCreditsPerImage(imageModel, outputQuality) * 4;
    return {
      generatedSeconds: 0,
      perSecondCredits: 0,
      videoCredits: 0,
      photoCredits,
      narrationCredits: 0,
      totalCredits: photoCredits,
      modelId: imageModel.id,
    };
  }

  const videoModel = generationModelForMode(modelId, mode, studioKind);
  const generatedSeconds = normalizedGeneratedSeconds(durationSeconds);
  const perSecondCredits = videoModelCreditsPerSecond(videoModel, outputQuality);
  const videoCredits = generatedSeconds * perSecondCredits;
  // "both" keeps the standard Graphic 2 four-image set alongside the selected
  // video model. It is intentionally not tied to a hidden provider setting.
  const photoCredits = mode === 'both'
    ? imageModelCreditsPerImage(generationModelForMode('graphic-2', 'photos', 'product'), outputQuality) * 4
    : 0;
  const narrationCredits = skipVoiceover ? 0 : CREDIT_COSTS.VOICEOVER;
  return {
    generatedSeconds,
    perSecondCredits,
    videoCredits,
    photoCredits,
    narrationCredits,
    totalCredits: videoCredits + photoCredits + narrationCredits,
    modelId: videoModel.id,
  };
}

export function videoCreditCost(
  mode: string,
  skipVoiceover: boolean,
  durationSeconds = 8,
  outputQuality: '1080p' | '4k' = '1080p',
  modelId?: string | null,
  studioKind?: string | null,
): number {
  return videoCreditQuote(mode, skipVoiceover, durationSeconds, outputQuality, modelId, studioKind).totalCredits;
}
