import type { JobWorkflowState } from '@/components/chat/types';

const PREFIX = 'aiwebvideo_workflow_';
const STAGES = new Set<JobWorkflowState['stage']>(['capturing', 'awaiting_private_pages', 'awaiting_mode', 'awaiting_duration', 'awaiting_format', 'awaiting_features', 'awaiting_brief', 'storyboarding', 'ready_to_render', 'rendering', 'done', 'failed']);
const MODES = new Set<JobWorkflowState['mode']>(['video', 'photos', 'icon', 'both', 'demo', 'tutorial', 'buy', 'tour', 'mockup', 'linkedin', 'custom']);
const AUDIO_MODES = new Set<JobWorkflowState['audioMode']>(['voice_music', 'music_only', 'silent']);
const ASPECT_RATIOS = new Set<JobWorkflowState['aspectRatio']>(['16:9', '9:16', '1:1']);

function enumValue<T extends string>(value: unknown, allowed: Set<T>, fallback: T): T {
  return typeof value === 'string' && allowed.has(value as T) ? value as T : fallback;
}

/**
 * Treat browser and server workflow JSON as untrusted/upgradeable input.
 * Older deployments, interrupted localStorage writes, browser extensions, or
 * future schema changes must never be able to crash the studio while opening
 * a saved project.
 */
export function normalizeJobWorkflow(value: unknown): JobWorkflowState | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!STAGES.has(raw.stage as JobWorkflowState['stage']) || !MODES.has(raw.mode as JobWorkflowState['mode'])) return null;
  const seconds = typeof raw.durationSeconds === 'number' && Number.isFinite(raw.durationSeconds)
    ? Math.max(8, Math.min(240, Math.ceil(raw.durationSeconds / 8) * 8))
    : 8;
  const selectedCaptureIds = Array.isArray(raw.selectedCaptureIds)
    ? raw.selectedCaptureIds.filter((item): item is string => typeof item === 'string' && item.length <= 180).slice(0, 30)
    : [];
  return {
    savedAt: typeof raw.savedAt === 'number' && Number.isFinite(raw.savedAt) ? raw.savedAt : 0,
    stage: raw.stage as JobWorkflowState['stage'],
    mode: raw.mode as JobWorkflowState['mode'],
    durationSeconds: seconds,
    featuresText: typeof raw.featuresText === 'string' ? raw.featuresText.slice(0, 2000) : null,
    creativeBrief: typeof raw.creativeBrief === 'string' ? raw.creativeBrief.slice(0, 8000) : null,
    aspectRatio: enumValue(raw.aspectRatio, ASPECT_RATIOS, '16:9'),
    outputQuality: raw.outputQuality === '4k' ? '4k' : '1080p',
    frameRate: raw.frameRate === 60 ? 60 : 30,
    selectedCaptureIds,
    audioMode: enumValue(raw.audioMode, AUDIO_MODES, 'voice_music'),
    narrationLanguage: typeof raw.narrationLanguage === 'string' && /^[a-z]{2,3}(?:-[A-Z]{2})?$/.test(raw.narrationLanguage) ? raw.narrationLanguage : 'en',
  };
}

export function saveLocalJobWorkflow(jobId: string, state: JobWorkflowState) {
  try { localStorage.setItem(`${PREFIX}${jobId}`, JSON.stringify(state)); } catch { /* server copy remains authoritative */ }
}

export function loadLocalJobWorkflow(jobId: string): JobWorkflowState | null {
  try {
    const value = normalizeJobWorkflow(JSON.parse(localStorage.getItem(`${PREFIX}${jobId}`) ?? 'null'));
    if (!value) localStorage.removeItem(`${PREFIX}${jobId}`);
    return value;
  } catch {
    try { localStorage.removeItem(`${PREFIX}${jobId}`); } catch { /* ignore */ }
    return null;
  }
}

export function clearLocalJobWorkflow(jobId: string) {
  try { localStorage.removeItem(`${PREFIX}${jobId}`); } catch { /* ignore */ }
}
