import type { StoryboardScene } from './gemini.js';
import { buildContinuousVideoPrompt as buildLegacyContinuousVideoPrompt } from './video-prompts-legacy.js';

// Keep the current renderer/refund/partial-delivery pipeline unchanged while
// restoring the older creative prompt logic that produced the preferred look.
export {
  VIDEO_MASTER_PROMPTS,
  GLOBAL_AI_VIDEO_RULES,
  buildAiVideoScenePrompt,
  INTERNAL_MASTER_VIDEO_QUALITY_DIRECTIVE,
  buildContinuousExtensionPrompt,
} from './video-prompts-legacy.js';

export type { VideoScenePromptInput } from './video-prompts-legacy.js';

export interface ContinuousVideoPromptInput {
  mode: string;
  siteTitle: string;
  concept: string;
  vibe: string;
  scenes: StoryboardScene[];
  targetDurationSeconds: number;
  creativeBrief?: string;
  referenceLabels?: string[];
  aspectRatio?: '16:9' | '9:16' | '1:1';
  outputQuality?: '1080p' | '4k';
  frameRate?: 24 | 30 | 60;
  nativeAudio: boolean;
  musicOnly?: boolean;
  separateNarration?: boolean;
  variantSeed?: number;
}

export function buildContinuousVideoPrompt(input: ContinuousVideoPromptInput) {
  // The legacy creative prompt did not use frameRate as creative direction.
  // Strip only that compatibility field and pass every real customer setting
  // and storyboard detail through unchanged.
  const { frameRate: _frameRate, ...legacyInput } = input;
  return buildLegacyContinuousVideoPrompt(legacyInput);
}

/**
 * Compatibility guard for the current safe continuous renderer. It prevents a
 * long production from resolving the whole story inside its first 8-second
 * provider window, but deliberately leaves the older master prompt intact.
 */
export function buildContinuousBasePrompt(masterPrompt: string, targetSeconds: number) {
  if (targetSeconds <= 8) return masterPrompt;
  return `OPENING OF THE SAME CONTINUOUS FILM — do not finish the full story yet.
Begin immediately with the strongest visual hook, establish the subject/brand/world, and leave natural motion that can continue seamlessly into the next extension. No black intro, no early closing card, no recap.

${masterPrompt}`;
}
