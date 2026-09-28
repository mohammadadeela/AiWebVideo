import type { ModelTier } from "@/components/chat/types";

export type PublicModelOption = {
  id: ModelTier;
  name: string;
  shortName: string;
  tagline: string;
  detail: string;
  features: string[];
  supports4k: boolean;
  outputLabel: string;
  internalCreditsPerUnit: number;
  internalCredits4k?: number;
};

export const VIDEO_MODEL_OPTIONS: PublicModelOption[] = [
  {
    id: "cinema1",
    name: "AIWebVideo Cinema 1",
    shortName: "Cinema 1",
    tagline: "Fast & efficient",
    detail: "Best for quick social ads, simple product motion and everyday 1080p videos.",
    features: ["1080p", "Native sound", "Fastest"],
    supports4k: false,
    outputLabel: "1080p",
    internalCreditsPerUnit: 1,
  },
  {
    id: "cinema2",
    name: "AIWebVideo Cinema 2",
    shortName: "Cinema 2",
    tagline: "Balanced quality",
    detail: "A strong balance of speed, motion quality and reference fidelity, with optional 4K.",
    features: ["1080p / 4K", "Native sound", "Balanced"],
    supports4k: true,
    outputLabel: "1080p / 4K",
    internalCreditsPerUnit: 2,
    internalCredits4k: 3,
  },
  {
    id: "cinema_pro",
    name: "AIWebVideo Cinema Pro",
    shortName: "Cinema Pro",
    tagline: "Highest fidelity",
    detail: "For premium campaigns where realism, detail and the strongest final quality matter most.",
    features: ["1080p / 4K", "Native sound", "Best detail"],
    supports4k: true,
    outputLabel: "1080p / 4K",
    internalCreditsPerUnit: 4,
    internalCredits4k: 6,
  },
];

export const IMAGE_MODEL_OPTIONS: PublicModelOption[] = [
  {
    id: "graphic1",
    name: "AIWebVideo Graphic 1",
    shortName: "Graphic 1",
    tagline: "Fast concepts",
    detail: "Quick product and campaign images for drafts, social posts and rapid creative testing.",
    features: ["1K", "Fastest", "References"],
    supports4k: false,
    outputLabel: "1K",
    internalCreditsPerUnit: 1,
  },
  {
    id: "graphic2",
    name: "AIWebVideo Graphic 2",
    shortName: "Graphic 2",
    tagline: "Detailed & balanced",
    detail: "Sharper 2K campaign images with stronger detail and reference-based editing.",
    features: ["2K", "Detailed", "References"],
    supports4k: false,
    outputLabel: "2K",
    internalCreditsPerUnit: 1,
  },
  {
    id: "graphic_pro",
    name: "AIWebVideo Graphic Pro",
    shortName: "Graphic Pro",
    tagline: "Premium 4K",
    detail: "Highest-detail image tier for polished commercial work and complex design scenes.",
    features: ["4K", "Premium detail", "Complex scenes"],
    supports4k: true,
    outputLabel: "4K",
    internalCreditsPerUnit: 3,
  },
];

export function isImageTier(tier: ModelTier | undefined): tier is "graphic1" | "graphic2" | "graphic_pro" {
  return tier === "graphic1" || tier === "graphic2" || tier === "graphic_pro";
}
export function isVideoTier(tier: ModelTier | undefined): tier is "cinema1" | "cinema2" | "cinema_pro" {
  return tier === "cinema1" || tier === "cinema2" || tier === "cinema_pro";
}
export function defaultModelTier(imageMode: boolean): ModelTier {
  return imageMode ? "graphic2" : "cinema2";
}
export function modelOption(tier: ModelTier) {
  return [...VIDEO_MODEL_OPTIONS, ...IMAGE_MODEL_OPTIONS].find((option) => option.id === tier)!;
}
export function publicModelName(tier: ModelTier, interior = false) {
  if (!interior || !isImageTier(tier)) return modelOption(tier).name;
  if (tier === "graphic1") return "AIWebVideo Space 1";
  if (tier === "graphic2") return "AIWebVideo Space 2";
  return "AIWebVideo Space Pro";
}
export function publicModelShortName(tier: ModelTier, interior = false) {
  if (!interior || !isImageTier(tier)) return modelOption(tier).shortName;
  if (tier === "graphic1") return "Space 1";
  if (tier === "graphic2") return "Space 2";
  return "Space Pro";
}
