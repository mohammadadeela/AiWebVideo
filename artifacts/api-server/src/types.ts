export type JobMode = 'video' | 'photos' | 'both' | 'demo' | 'tutorial' | 'buy' | 'tour';
export type JobStatus = 'queued' | 'capturing' | 'storyboarding' | 'rendering' | 'done' | 'failed';

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
