import { Building2, Film, Globe2, House, Image as ImageIcon, MessageCircleMore, PackageOpen, type LucideIcon } from "lucide-react";

/**
 * The seven things AiWebVideo can make. ONE list, used by the navbar menu, the chat box and the floating cards, so they
 * can never disagree about names or order.
 */
export type CreationIntent =
  | "website"
  | "video"
  | "photo"
  | "product-video"
  | "scenario"
  | "interior"
  | "architecture";

export interface CreationFeature {
  id: CreationIntent;
  label: string;
  /** A short label for tight spaces. */
  short: string;
  description: string;
  icon: LucideIcon;
}

export const CREATION_FEATURES: readonly CreationFeature[] = [
  { id: "website", label: "Website Video", short: "Website", description: "Turn any website into a video", icon: Globe2 },
  { id: "video", label: "AI Video", short: "AI Video", description: "Create a film from a prompt", icon: Film },
  { id: "photo", label: "Product Photos", short: "Photos", description: "Studio images from your product", icon: ImageIcon },
  { id: "product-video", label: "Product Video", short: "Product", description: "Show your product in motion", icon: PackageOpen },
  { id: "scenario", label: "Talking Scene", short: "Talking", description: "Dialogue, testimonials and scenes", icon: MessageCircleMore },
  { id: "interior", label: "Interior Design", short: "Interior", description: "Redesign any room or space", icon: House },
  { id: "architecture", label: "Architecture", short: "Architect", description: "See a building on a real site", icon: Building2 },
] as const;

export function featureById(id: CreationIntent): CreationFeature {
  return CREATION_FEATURES.find((feature) => feature.id === id) ?? CREATION_FEATURES[0];
}

export function isCreationIntent(value: unknown): value is CreationIntent {
  return typeof value === "string" && CREATION_FEATURES.some((feature) => feature.id === value);
}
