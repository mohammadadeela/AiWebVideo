import type { ShowcaseFeature } from "./api-client";

/** The order features appear in around the hero. */
export const HERO_FEATURE_ORDER: readonly ShowcaseFeature[] = ["website", "product-video", "interior", "scenario", "architecture", "photo", "video"];

/**
 * A varied handful: one item from each feature before any feature repeats, then items that are not filed under a
 * feature yet (older uploads), then whatever is left. Items without a file are never chosen.
 */
export function pickVariety<T extends { feature?: ShowcaseFeature | null; url?: string | null }>(items: readonly T[], count: number): T[] {
  const usable = items.filter((item) => Boolean(item.url));
  const queues = HERO_FEATURE_ORDER.map((feature) => usable.filter((item) => item.feature === feature));
  const unfiled = usable.filter((item) => !item.feature || !HERO_FEATURE_ORDER.includes(item.feature));
  const chosen: T[] = [];
  for (let round = 0; chosen.length < count; round += 1) {
    let added = false;
    for (const queue of queues) {
      if (queue[round] && chosen.length < count) { chosen.push(queue[round]); added = true; }
    }
    if (!added) break;
  }
  for (const item of unfiled) if (chosen.length < count) chosen.push(item);
  return chosen;
}
