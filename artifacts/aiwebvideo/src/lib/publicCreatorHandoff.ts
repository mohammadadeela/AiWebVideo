import type { AudioMode } from "@/components/chat/types";
import type { PublicModelId } from "@/lib/generationModels";

export interface WebsiteHandoffSettings {
  mode: "video" | "tutorial" | "buy" | "tour" | "linkedin" | "demo";
  durationSeconds: number | "auto";
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputQuality: "1080p" | "4k";
  audioMode: AudioMode;
  narrationLanguage: string;
  modelId: PublicModelId;
}

export interface WebsiteCreatorHandoff {
  kind: "website";
  url: string;
  brief: string;
  settings: WebsiteHandoffSettings;
  attachmentDraftKey?: string;
}

export interface StudioCreatorHandoff {
  kind: "studio";
  request: {
    studioKind: "product" | "idea" | "scenario" | "interior" | "architecture";
    prompt: string;
    mode: "photos" | "video" | "custom";
    durationSeconds: number;
    aspectRatio: "16:9" | "9:16" | "1:1";
    outputQuality: "1080p" | "4k";
    audioMode: AudioMode;
    modelId: PublicModelId;
    productUrl?: string;
    productImageUrls?: string[];
    architecture?: Record<string, string | number | boolean | undefined>;
    /** Hidden idea direction and the chosen example: both must survive signing in. */
    studioDirection?: string;
    templateId?: string;
  };
  attachmentDraftKey?: string;
}

export type PublicCreatorHandoff = WebsiteCreatorHandoff | StudioCreatorHandoff;

const KEY = "aiwebvideo_public_creator_handoff";
// A waiting action is only resumed for a short while. After that it is stale and must never start paid work on its own.
export const HANDOFF_MAX_AGE_MS = 30 * 60 * 1000;

export function savePublicCreatorHandoff(value: PublicCreatorHandoff) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify({ ...value, savedAt: Date.now() }));
  } catch {}
}

export function loadPublicCreatorHandoff(): PublicCreatorHandoff | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as (PublicCreatorHandoff & { savedAt?: number }) | null;
    if (!parsed || (parsed.kind !== "website" && parsed.kind !== "studio")) return null;
    if (typeof parsed.savedAt === "number" && Date.now() - parsed.savedAt > HANDOFF_MAX_AGE_MS) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPublicCreatorHandoff() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {}
}

/** Where the workspace opens for a saved handoff. */
export function handoffDestination(handoff: PublicCreatorHandoff): string {
  if (handoff.kind === "website") return "/dashboard?create=website&handoff=1";
  const { studioKind, mode } = handoff.request;
  const create = studioKind === "idea" ? "video"
    : studioKind === "scenario" ? "scenario"
      : studioKind === "interior" ? "interior"
        : studioKind === "architecture" ? "architecture"
          : mode === "photos" ? "photo" : "product-video";
  return `/dashboard?create=${encodeURIComponent(create)}&handoff=1`;
}
