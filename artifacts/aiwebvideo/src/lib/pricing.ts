import { displayCredits, estimateInternalRenderCredits } from "@/lib/credits";
import { PUBLIC_MODELS } from "@/lib/generationModels";

/**
 * Customer-facing price list. The server (api-server billing-products.ts + routes/paypal.ts)
 * owns the real prices and grants; a contract test keeps this file identical to them.
 * `credits` are INTERNAL credits — always show them through displayCredits().
 */
export const CREDIT_PACKS = [
  { id: "topup50" as const, name: "Starter", credits: 14, amountUsd: 4.99, note: "Try a few creations" },
  { id: "topup100" as const, name: "Creator", credits: 53, amountUsd: 14.99, note: "A month of regular use" },
  { id: "topup250" as const, name: "Studio", credits: 92, amountUsd: 24.99, note: "Best price per credit" },
];

export const VIDEO_PACKS = [
  { id: "single8" as const, name: "Quick Video", seconds: 8, amountUsd: 5.99, credits: 22, note: "One short promo, ready in minutes" },
  { id: "single48" as const, name: "Full Marketing Video", seconds: 48, amountUsd: 27.99, credits: 102, note: "A complete story with room to breathe", popular: true },
  { id: "single144" as const, name: "Extended Video", seconds: 144, amountUsd: 79.99, credits: 294, note: "A presentation, tutorial or detailed brand film" },
];

export const PLAN_PACKS = [
  { id: "creator" as const, name: "Creator", amountUsd: 39, credits: 150, pitch: "For regular creators" },
  { id: "pro" as const, name: "Pro", amountUsd: 99, credits: 400, pitch: "Best for weekly marketing", highlight: true },
  { id: "agency" as const, name: "Agency", amountUsd: 249, credits: 1000, pitch: "For client and agency production" },
];

/** Customer-facing starter grant (matches the server: 5 internal × 5). */
export const STARTER_CREDITS = 25;

const IMAGE_SET_INTERNAL = estimateInternalRenderCredits("photos", true, 8, "1080p", "graphic-2");
const CINEMA2_8S_INTERNAL = estimateInternalRenderCredits("video", true, 8, "1080p", "cinema-2");
const CINEMA1_8S_INTERNAL = estimateInternalRenderCredits("video", true, 8, "1080p", "cinema-1");
const CINEMA2_PER_SECOND_INTERNAL = CINEMA2_8S_INTERNAL / 8;

export interface CreditsBuy {
  imageSets: number;
  cinema2Videos: number;
  cinema1Videos: number;
  cinema2Seconds: number;
}

/** What a balance of INTERNAL credits can produce today (Cinema 2 / Graphic 2 at 1080p). */
export function whatCreditsBuy(internalCredits: number): CreditsBuy {
  const credits = Math.max(0, internalCredits);
  return {
    imageSets: Math.floor(credits / IMAGE_SET_INTERNAL),
    cinema2Videos: Math.floor(credits / CINEMA2_8S_INTERNAL),
    cinema1Videos: Math.floor(credits / CINEMA1_8S_INTERNAL),
    cinema2Seconds: Math.floor(credits / CINEMA2_PER_SECOND_INTERNAL),
  };
}

function duration(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return rest ? `${minutes}m ${rest}s` : `${minutes}m`;
}

/** Up to three plain-language lines describing what a balance buys. */
export function creditsBuyLines(internalCredits: number): string[] {
  const buy = whatCreditsBuy(internalCredits);
  const lines: string[] = [];
  if (buy.imageSets > 0) {
    lines.push(`${buy.imageSets.toLocaleString()} image set${buy.imageSets === 1 ? "" : "s"} · 4 images each`);
  }
  if (buy.cinema2Videos > 0) {
    lines.push(`${buy.cinema2Videos.toLocaleString()} × 8s video${buy.cinema2Videos === 1 ? "" : "s"} · Cinema 2 with sound`);
  } else if (buy.cinema1Videos > 0) {
    lines.push(`${buy.cinema1Videos} × 8s video · Cinema 1`);
  }
  if (buy.cinema2Seconds >= 16) {
    lines.push(`or ${duration(buy.cinema2Seconds)} of video in total`);
  }
  return lines;
}

/** Price per 100 customer credits, for a quick value comparison. */
export function pricePer100Credits(amountUsd: number, internalCredits: number) {
  const shown = displayCredits(internalCredits);
  return shown > 0 ? (amountUsd / shown) * 100 : 0;
}

export interface ModelPriceRow {
  id: string;
  name: string;
  kind: "Video" | "Images" | "Interior & architecture";
  unit: string;
  /** Credits at the model's standard output (1080p / 2K), or its only quality. */
  standard: number;
  /** Credits at 4K when the model offers both; null otherwise. */
  ultra: number | null;
  /** Set when a model has a single fixed quality (for example "4K"). */
  fixedQuality: string | null;
}

/** One row per public model, straight from the model catalog. */
export function modelPriceRows(): ModelPriceRow[] {
  return PUBLIC_MODELS.map((model) => {
    const isVideo = model.family === "video";
    const perUnit = (quality: "1080p" | "4k") => {
      const internal = isVideo
        ? (quality === "4k" ? (model.internalCredits4k ?? model.internalCredits1080p ?? 0) : (model.internalCredits1080p ?? 0))
        : (quality === "4k" ? (model.internalCredits4k ?? model.internalCreditsPerImage ?? 0) : (model.internalCreditsPerImage ?? 0)) * 4;
      return displayCredits(internal);
    };
    const single = model.supportedQualities.length === 1;
    const both = model.supportedQualities.includes("1080p") && model.supportedQualities.includes("4k");
    return {
      id: model.id,
      name: model.name.replace(/^AiWebVideo\s+/, ""),
      kind: isVideo ? "Video" : model.family === "image" ? "Images" : "Interior & architecture",
      unit: isVideo ? "per second" : "per set of 4",
      standard: single && model.supportedQualities[0] === "4k" ? perUnit("4k") : perUnit("1080p"),
      ultra: both ? perUnit("4k") : null,
      fixedQuality: single && model.supportedQualities[0] === "4k" ? "4K" : null,
    };
  });
}
