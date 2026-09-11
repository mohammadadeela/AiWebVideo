import type { StoryboardScene } from './gemini.js';
import { buildContinuousVideoPrompt as buildLegacyContinuousVideoPrompt } from './video-prompts-legacy.js';

// Keep the current renderer/refund/partial-delivery pipeline unchanged while
// restoring the older creative prompt logic that produced the preferred look.
export {
  VIDEO_MASTER_PROMPTS,
  GLOBAL_AI_VIDEO_RULES,
  buildAiVideoScenePrompt,
  INTERNAL_MASTER_VIDEO_QUALITY_DIRECTIVE,
  buildContinuousExtensionPrompt
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
  // Keep the proven creative direction while forwarding every customer
  // setting and the complete brief to the final media-model prompt.
  return buildLegacyContinuousVideoPrompt(input);
}

/**
 * Compatibility guard for the current safe continuous renderer. It prevents a
 * long production from resolving the whole story inside its first 8-second
 * provider window, but deliberately leaves the older master prompt intact.
 */
export function buildContinuousBasePrompt(masterPrompt: string, targetSeconds: number) {
  if (targetSeconds <= 8) return masterPrompt;
  const endSeconds = Math.min(8, targetSeconds);
  return `CURRENT GENERATION WINDOW — OPENING WINDOW: 0-${endSeconds}s OF ${targetSeconds}s
THIS IS NOT THE END OF THE FILM. Begin immediately with the strongest visual hook, establish the subject/brand/world, and leave meaningful natural motion that can continue seamlessly into the next extension. Do not resolve the full story, show a closing card, replay a title, fade to black, or create dead air in this opening window.

${masterPrompt}`;
}
