export type VideoModelTier = "cinema1" | "cinema2" | "cinema_pro";
export type ImageModelTier = "graphic1" | "graphic_pro";
export type ModelTier = VideoModelTier | ImageModelTier;

export const VIDEO_MODEL_OPTIONS: ReadonlyArray<{
  id: VideoModelTier;
  label: string;
  helper: string;
  maxQuality: "1080p" | "4k";
  providerCost1080: number;
  providerCost4k?: number;
}> = [
  {
    id: "cinema1",
    label: "AIWebVideo Cinema 1",
    helper: "Fast drafts with full sound, up to 1080p.",
    maxQuality: "1080p",
    providerCost1080: 0.08,
  },
  {
    id: "cinema2",
    label: "AIWebVideo Cinema 2",
    helper: "Production quality up to 4K, faster turnaround.",
    maxQuality: "4k",
    providerCost1080: 0.12,
    providerCost4k: 0.30,
  },
  {
    id: "cinema_pro",
    label: "AIWebVideo Cinema Pro",
    helper: "Our highest-fidelity render, up to 4K.",
    maxQuality: "4k",
    providerCost1080: 0.40,
    providerCost4k: 0.60,
  },
];

export const IMAGE_MODEL_OPTIONS: ReadonlyArray<{
  id: ImageModelTier;
  label: string;
  helper: string;
  providerCostPerImage: number;
  providerSize: "2K" | "4K";
}> = [
  {
    id: "graphic1",
    label: "AIWebVideo Graphic 1",
    helper: "Fast, clean shots — ready for web and social.",
    providerCostPerImage: 0.101,
    providerSize: "2K",
  },
  {
    id: "graphic_pro",
    label: "AIWebVideo Graphic Pro",
    helper: "Maximum detail for print and large displays.",
    providerCostPerImage: 0.151,
    providerSize: "4K",
  },
];

export const INTERNAL_CREDIT_VALUE_USD = 99 / 400;
export const CREDIT_DISPLAY_MULTIPLIER = 5;

export function markedUpInternalCredits(providerCostUsd: number) {
  return Math.max(1, Math.ceil((Math.max(0, providerCostUsd) * 2) / INTERNAL_CREDIT_VALUE_USD));
}

export function defaultModelTier(isImage: boolean): ModelTier {
  return isImage ? "graphic1" : "cinema2";
}

export function modelTierHelper(tier: ModelTier): string {
  return [...VIDEO_MODEL_OPTIONS, ...IMAGE_MODEL_OPTIONS].find((option) => option.id === tier)?.helper ?? "";
}

export function tierCreditEstimate(input: {
  tier: ModelTier;
  durationSeconds?: number;
  imageCount?: number;
  quality?: "1080p" | "4k";
  narration?: boolean;
}) {
  const image = IMAGE_MODEL_OPTIONS.find((option) => option.id === input.tier);
  if (image) {
    return markedUpInternalCredits(image.providerCostPerImage) * Math.max(1, input.imageCount ?? 4) * CREDIT_DISPLAY_MULTIPLIER;
  }
  const video = VIDEO_MODEL_OPTIONS.find((option) => option.id === input.tier) ?? VIDEO_MODEL_OPTIONS[1];
  const quality = input.quality === "4k" && video.providerCost4k ? "4k" : "1080p";
  const providerRate = quality === "4k" ? video.providerCost4k! : video.providerCost1080;
  const perSecond = markedUpInternalCredits(providerRate);
  const videoCredits = perSecond * Math.max(8, Math.round(input.durationSeconds ?? 8));
  const narration = input.narration ? 6 : 0;
  return (videoCredits + narration) * CREDIT_DISPLAY_MULTIPLIER;
}
