export type JobMode = 'video' | 'photos' | 'icon' | 'both' | 'demo' | 'tutorial' | 'buy' | 'tour' | 'mockup' | 'linkedin' | 'custom';
export type JobStatus = 'queued' | 'capturing' | 'storyboarding' | 'rendering' | 'done' | 'failed' | 'cancelled';

export interface JobWorkflowState {
  savedAt: number;
  stage: 'capturing' | 'awaiting_private_pages' | 'awaiting_mode' | 'awaiting_duration' | 'awaiting_format' | 'awaiting_features' | 'awaiting_brief' | 'storyboarding' | 'ready_to_render' | 'rendering' | 'done' | 'failed';
  mode: JobMode;
  durationSeconds: number;
  featuresText: string | null;
  creativeBrief: string | null;
  aspectRatio: '16:9' | '9:16' | '1:1';
  outputQuality: '1080p' | '4k';
  frameRate: 30 | 60;
  selectedCaptureIds: string[];
  audioMode: 'voice_music' | 'music_only' | 'silent';
  narrationLanguage: string;
}

export interface JobStatusResponse {
  id: string;
  title: string | null;
  pinned: boolean;
  status: JobStatus;
  progress: number;
  statusMessage: string | null;
  etaSeconds: number | null;
  mode: JobMode;
  sourceUrl: string;
  vibeBrief: string | null;
  captureMetadata: {
    title?: string;
    description?: string | null;
    logoUrl?: string | null;
    brandColors?: string[];
    screenshotUrl?: string;
    pageCount?: number;
    hasScreenshotBuffer?: boolean;
  } | null;
  storyboard: {
    concept: string;
    vibe: string;
    scenes: Array<{
      sceneNumber: number;
      durationSeconds: number;
      shotDescription: string;
      onScreenCopy: string;
    }>;
    voiceoverScript: string | null;
  } | null;
  workflowState: JobWorkflowState | null;
  errorMessage: string | null;
  assets: Array<{
    id: string;
    type: 'screenshot' | 'recording' | 'video' | 'photo';
    aspectRatio: string | null;
    watermarked: boolean;
    url: string;
    downloadable: boolean;
  }>;
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    kind: string;
    content: string;
    payload: Record<string, unknown> | null;
    createdAt: Date;
  }>;
}
