import type { AudioMode } from "@/components/chat/types";
import type { PublicModelId } from "@/lib/generationModels";

export interface WebsiteHandoffSettings {
  mode: "video" | "tutorial" | "buy" | "tour" | "linkedin" | "demo" | "character";
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
    productFacts?: { title?: string; description?: string; facts?: Record<string, string> };
    /** The units the customer confirmed for the drawing that travels with the attachments. */
    drawingUnits?: string;
  };
  attachmentDraftKey?: string;
}

export type PublicCreatorHandoff = WebsiteCreatorHandoff | StudioCreatorHandoff;

const KEY = "aiwebvideo_public_creator_handoff";
// The request is kept for a day, so a slow sign-up (a verification e-mail opened later, even in another tab)
// still finds everything the person typed and attached. Paid work only starts on its own while the request is
// fresh; after that everything is shown again and the person presses one button to start.
export const HANDOFF_MAX_AGE_MS = 24 * 60 * 60 * 1000;
export const HANDOFF_AUTOSTART_MAX_AGE_MS = 2 * 60 * 60 * 1000;

export type HandoffReason = "signin" | "credits";

type StoredHandoff = PublicCreatorHandoff & { savedAt?: number; reason?: HandoffReason };

function storage(): Storage | null {
  // localStorage so the request survives a new tab (verification links open one). sessionStorage was the old home;
  // it is still read once so nothing saved a moment before this update is lost.
  try { return window.localStorage; } catch { return null; }
}

export function savePublicCreatorHandoff(value: PublicCreatorHandoff, reason: HandoffReason = "signin") {
  const record: StoredHandoff = { ...value, savedAt: Date.now(), reason };
  try { storage()?.setItem(KEY, JSON.stringify(record)); } catch {}
  try { sessionStorage.removeItem(KEY); } catch {}
}

function readRaw(): string | null {
  try {
    const local = storage()?.getItem(KEY);
    if (local) return local;
  } catch {}
  try { return sessionStorage.getItem(KEY); } catch { return null; }
}

export function loadPublicCreatorHandoff(): (PublicCreatorHandoff & { savedAt: number; reason: HandoffReason }) | null {
  try {
    const raw = readRaw();
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredHandoff | null;
    if (!parsed || (parsed.kind !== "website" && parsed.kind !== "studio")) return null;
    const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : Date.now();
    if (Date.now() - savedAt > HANDOFF_MAX_AGE_MS) {
      clearPublicCreatorHandoff();
      return null;
    }
    return { ...parsed, savedAt, reason: parsed.reason === "credits" ? "credits" : "signin" };
  } catch {
    return null;
  }
}

/** Fresh enough to start paid work without asking again: the person pressed Generate a short while ago. */
export function isHandoffFresh(handoff: { savedAt: number } | null | undefined, now = Date.now()): boolean {
  return Boolean(handoff) && now - (handoff as { savedAt: number }).savedAt <= HANDOFF_AUTOSTART_MAX_AGE_MS;
}

export function clearPublicCreatorHandoff() {
  try { storage()?.removeItem(KEY); } catch {}
  try { sessionStorage.removeItem(KEY); } catch {}
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
