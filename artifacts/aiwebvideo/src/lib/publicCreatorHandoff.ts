import type { AudioMode } from "@/components/chat/types";

export interface WebsiteHandoffSettings {
  mode: "video" | "tutorial" | "buy" | "tour" | "linkedin" | "demo";
  durationSeconds: number | "auto";
  aspectRatio: "16:9" | "9:16" | "1:1";
  outputQuality: "1080p" | "4k";
  audioMode: AudioMode;
  narrationLanguage: string;
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
    studioKind: "product" | "idea" | "scenario";
    prompt: string;
    mode: "photos" | "video" | "custom";
    durationSeconds: number;
    aspectRatio: "16:9" | "9:16" | "1:1";
    outputQuality: "1080p" | "4k";
    audioMode: AudioMode;
  };
  attachmentDraftKey?: string;
}

export type PublicCreatorHandoff = WebsiteCreatorHandoff | StudioCreatorHandoff;

const KEY = "aiwebvideo_public_creator_handoff";

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
