export type JobMode = 'video' | 'photos' | 'both' | 'demo' | 'tutorial' | 'buy' | 'tour';

/** Chip label → mode. Order matters: it's the order shown in the chat. */
export const MODE_OPTIONS: Array<{ label: string; mode: JobMode }> = [
  { label: '🎬 Promo Video', mode: 'video' },
  { label: '🧭 How to Use', mode: 'tutorial' },
  { label: '🛒 How to Buy', mode: 'buy' },
  { label: '✨ Feature Tour', mode: 'tour' },
  { label: '🪄 Cinematic Brand Film', mode: 'demo' },
  { label: '📸 Photos', mode: 'photos' },
  { label: '🎞️ Video + Photos', mode: 'both' },
];
export type JobStatus = 'queued' | 'capturing' | 'storyboarding' | 'rendering' | 'done' | 'failed';

export interface CaptureMetadata {
  logoUrl: string | null;
  brandColors: string[];
  pageCount: number;
  screenshotUrl?: string | null;
  title?: string;
  fullPageScreenshotUrl?: string | null;
  mobileScreenshotUrl?: string | null;
  mobileFullPageScreenshotUrl?: string | null;
  recordingUrl?: string | null;
  pages?: Array<{ url: string; title: string; screenshotUrl: string }>;
}

export interface StoryboardScene {
  sceneNumber: number;
  durationSeconds: number;
  sceneType?: 'hook' | 'feature' | 'interaction' | 'social_proof' | 'cta';
  shotDescription: string;
  onScreenCopy: string;
  transition?: string;
}

export interface Storyboard {
  concept: string;
  vibe: string;
  ideas?: string[];
  scenes: StoryboardScene[];
  voiceoverScript: string | null;
  targetDurationSeconds?: number;
  creativeBrief?: string;
  aspectRatio?: '16:9' | '9:16' | '1:1';
  outputQuality?: '1080p' | '4k';
  frameRate?: 30 | 60;
  variantSeed?: number;
}

export const DURATION_OPTIONS = [
  { label: 'Quick — 8s', seconds: 8 },
  { label: 'Standard — ~30s', seconds: 24 },
  { label: 'Full — ~60s', seconds: 56 },
] as const;

export const FORMAT_OPTIONS = [
  { label: '🖥 Landscape · 1080p', aspectRatio: '16:9' as const, outputQuality: '1080p' as const, frameRate: 30 as const },
  { label: '📱 Portrait · 1080p', aspectRatio: '9:16' as const, outputQuality: '1080p' as const, frameRate: 30 as const },
  { label: '◻ Square · 1080p', aspectRatio: '1:1' as const, outputQuality: '1080p' as const, frameRate: 30 as const },
  { label: '✦ Cinema · 4K 60', aspectRatio: '16:9' as const, outputQuality: '4k' as const, frameRate: 60 as const },
] as const;

export interface JobAsset {
  id: string;
  type: 'screenshot' | 'recording' | 'video' | 'photo';
  aspectRatio: string | null;
  watermarked: boolean;
  url: string;
  downloadable: boolean;
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
  captureMetadata: CaptureMetadata | null;
  storyboard: Storyboard | null;
  errorMessage: string | null;
  assets: JobAsset[];
  messages: Array<{
    id: string;
    role: 'user' | 'assistant' | 'system';
    kind: string;
    content: string;
    payload: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export const VIBE_OPTIONS = ['Energetic & bold', 'Warm & minimal', 'Luxury & sleek', 'Playful & bright'] as const;
export type VibeOption = (typeof VIBE_OPTIONS)[number];
