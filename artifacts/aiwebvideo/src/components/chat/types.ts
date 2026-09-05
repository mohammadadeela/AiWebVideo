export type JobMode =
  | "video"
  | "photos"
  | "icon"
  | "both"
  | "demo"
  | "tutorial"
  | "buy"
  | "tour"
  | "mockup"
  | "linkedin"
  | "custom";
export type AudioMode =
  "voice_music" | "native_audio" | "music_only" | "silent";

/** Chip label → mode. Order matters: it's the order shown in the chat. */
export const MODE_OPTIONS: Array<{ label: string; mode: JobMode }> = [
  { label: "Promo Video", mode: "video" },
  { label: "How to Use", mode: "tutorial" },
  { label: "How to Buy", mode: "buy" },
  { label: "Feature Tour", mode: "tour" },
  { label: "Cinematic Brand Film", mode: "demo" },
  { label: "Product Mockup Reel", mode: "mockup" },
  { label: "LinkedIn Video", mode: "linkedin" },
  { label: "Custom Idea", mode: "custom" },
  { label: "Photos", mode: "photos" },
  { label: "Website Icon", mode: "icon" },
  { label: "Video + Photos", mode: "both" },
];
export type JobStatus =
  | "queued"
  | "capturing"
  | "captured"
  | "storyboarding"
  | "rendering"
  | "done"
  | "failed"
  | "cancelled";
export type WorkflowStage =
  | "capturing"
  | "preview_ready"
  | "awaiting_private_pages"
  | "awaiting_mode"
  | "awaiting_duration"
  | "awaiting_format"
  | "awaiting_features"
  | "awaiting_brief"
  | "storyboarding"
  | "ready_to_render"
  | "rendering"
  | "done"
  | "failed";

export interface JobWorkflowState {
  savedAt: number;
  stage: WorkflowStage;
  mode: JobMode;
  durationSeconds: number;
  featuresText: string | null;
  creativeBrief: string | null;
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputQuality: "1080p" | "4k";
  frameRate: 24 | 30 | 60;
  selectedCaptureIds: string[];
  audioMode: AudioMode;
  narrationLanguage: string;
  /** True for the streamlined URL + promotion flow that continues automatically after capture. */
  websiteAutoFlow?: boolean;
  /** Landing-page website preview stops after capture; Workspace plans it but waits for an explicit Generate click. */
  manualRenderAfterPlan?: boolean;
  /** Preserves whether the visitor selected an exact length or asked AI to choose it. */
  requestedDurationSeconds?: number | "auto";
}

export interface CaptureMetadata {
  logoUrl: string | null;
  brandColors: string[];
  pageCount: number;
  /** Mirrors the API capture metadata so shared workspace UI can stay source-aware. */
  sourceType?: "website" | "upload" | "studio";
  studioKind?: "product" | "idea" | "scenario" | null;
  ideaPrompt?: string | null;
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
  sceneType?: "hook" | "feature" | "interaction" | "social_proof" | "cta";
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
  aspectRatio?: "16:9" | "9:16" | "1:1";
  outputQuality?: "1080p" | "4k";
  frameRate?: 24 | 30 | 60;
  variantSeed?: number;
  selectedCaptureIds?: string[];
  /** Exact capture ids used by each scene, aligned to scenes by index. */
  sceneCaptureIds?: string[][];
}

export const DURATION_OPTIONS = [
  { label: "Quick — 8s", seconds: 8 },
  { label: "Standard — 32s", seconds: 32 },
  { label: "Full — 64s", seconds: 64 },
] as const;

export const FORMAT_OPTIONS = [
  {
    label: "🖥 Landscape · 1080p · Native 24fps",
    aspectRatio: "16:9" as const,
    outputQuality: "1080p" as const,
    frameRate: 24 as const,
  },
  {
    label: "📱 Portrait · 1080p · Native 24fps",
    aspectRatio: "9:16" as const,
    outputQuality: "1080p" as const,
    frameRate: 24 as const,
  },
  {
    label: "◻ Square · 1080p · Native 24fps",
    aspectRatio: "1:1" as const,
    outputQuality: "1080p" as const,
    frameRate: 24 as const,
  },
  {
    label: "✦ Cinema · 4K · Native 24fps",
    aspectRatio: "16:9" as const,
    outputQuality: "4k" as const,
    frameRate: 24 as const,
  },
] as const;

export interface JobAsset {
  id: string;
  type: "screenshot" | "recording" | "video" | "photo";
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
  creditsSpent: number;
  mode: JobMode;
  sourceUrl: string;
  vibeBrief: string | null;
  captureMetadata: CaptureMetadata | null;
  storyboard: Storyboard | null;
  workflowState: JobWorkflowState | null;
  errorMessage: string | null;
  assets: JobAsset[];
  messages: Array<{
    id: string;
    role: "user" | "assistant" | "system";
    kind: string;
    content: string;
    payload: Record<string, unknown> | null;
    createdAt: string;
  }>;
}

export const VIBE_OPTIONS = [
  "Energetic & bold",
  "Warm & minimal",
  "Luxury & sleek",
  "Playful & bright",
] as const;
export type VibeOption = (typeof VIBE_OPTIONS)[number];
