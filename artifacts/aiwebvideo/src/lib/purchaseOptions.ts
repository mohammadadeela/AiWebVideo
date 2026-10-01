import { displayCredits } from "./credits";
import { discountedPrice } from "./money";
import { CREDIT_PACKS, PLAN_PACKS, VIDEO_PACKS, creditsBuyLines } from "./pricing";

export type PurchaseGroup = "video" | "credits" | "plans";

export interface PurchaseOption {
  key: string;
  group: PurchaseGroup;
  /** "direct" is a one-time purchase, "plan" a monthly subscription. */
  kind: "direct" | "plan";
  id: string;
  title: string;
  subtitle: string;
  /** What the money buys, in plain words (credit packs and plans). */
  lines: string[];
  credits: number;
  amountUsd: number;
  originalAmountUsd: number;
  productName: string;
  /** True when the balance plus this purchase pays for the whole job. */
  covers: boolean;
  /** Credits still missing after this purchase (0 when it covers the job). */
  shortBy: number;
}

export interface WelcomeOfferLike { discountPercent: number; eligibleProducts: readonly string[] }

/**
 * Every pack and plan is listed, always. Nothing is filtered out for being too small or too large.
 * The caller decides what to do with `covers` / `shortBy` (mark, sort, explain).
 */
export function buildPurchaseOptions(input: {
  funded: number;
  required: number;
  offer: WelcomeOfferLike | null;
  includeVideoPacks: boolean;
}): PurchaseOption[] {
  const { funded, required, offer } = input;
  const evaluate = (credits: number) => {
    const total = funded + credits;
    return { covers: total >= required, shortBy: Math.max(0, required - total) };
  };
  const options: PurchaseOption[] = [];

  if (input.includeVideoPacks) {
    for (const pack of VIDEO_PACKS) {
      const credits = displayCredits(pack.credits);
      options.push({
        key: pack.id, group: "video", kind: "direct", id: pack.id,
        title: pack.name,
        subtitle: `${pack.seconds}s video · ${credits.toLocaleString()} credits`,
        lines: [],
        credits, amountUsd: pack.amountUsd, originalAmountUsd: pack.amountUsd, productName: pack.name,
        ...evaluate(credits),
      });
    }
  }

  for (const pack of CREDIT_PACKS) {
    const credits = displayCredits(pack.credits);
    const price = offer && offer.eligibleProducts.includes(pack.id) ? discountedPrice(pack.amountUsd, offer.discountPercent) : pack.amountUsd;
    options.push({
      key: pack.id, group: "credits", kind: "direct", id: pack.id,
      title: `${credits.toLocaleString()} credits`,
      subtitle: pack.note,
      lines: creditsBuyLines(pack.credits),
      credits, amountUsd: price, originalAmountUsd: pack.amountUsd,
      productName: `${credits.toLocaleString()} production credits`,
      ...evaluate(credits),
    });
  }

  for (const plan of PLAN_PACKS) {
    const credits = displayCredits(plan.credits);
    options.push({
      key: plan.id, group: "plans", kind: "plan", id: plan.id,
      title: `${plan.name} plan`,
      subtitle: `${credits.toLocaleString()} credits every month · ${plan.pitch}`,
      lines: creditsBuyLines(plan.credits),
      credits, amountUsd: plan.amountUsd, originalAmountUsd: plan.amountUsd, productName: plan.name,
      ...evaluate(credits),
    });
  }
  return options;
}

/**
 * The option that fits best: the cheapest ONE-TIME purchase that covers the job; if none does, the
 * cheapest monthly plan that covers it; if nothing covers it alone, the largest option (closest).
 * Returns null when nothing is needed.
 */
export function pickBestFit(options: PurchaseOption[], required: number): string | null {
  if (required <= 0 || !options.length) return null;
  const byPrice = (a: PurchaseOption, b: PurchaseOption) => a.amountUsd - b.amountUsd || a.credits - b.credits;
  const covering = options.filter((option) => option.covers);
  const oneTime = covering.filter((option) => option.kind === "direct").sort(byPrice);
  if (oneTime.length) return oneTime[0].key;
  const plans = covering.sort(byPrice);
  if (plans.length) return plans[0].key;
  return [...options].sort((a, b) => b.credits - a.credits)[0].key;
}

/**
 * Best fit first, then everything else that covers the job by price, then the options that would still
 * leave the person short (also by price). With no requirement the natural order is kept.
 */
export function orderOptions(options: PurchaseOption[], bestKey: string | null): PurchaseOption[] {
  if (!bestKey) return options;
  const rank = (option: PurchaseOption) => (option.key === bestKey ? 0 : option.covers ? 1 : 2);
  return [...options].sort((a, b) => rank(a) - rank(b) || a.amountUsd - b.amountUsd || a.credits - b.credits);
}

/**
 * The best choice INSIDE each list, so the person sees it marked and on top wherever they look: the
 * cheapest option in that list that covers the job, or (when none does) the largest one, which is the
 * closest. Nothing is marked when nothing is needed.
 */
export function pickBestPerGroup(options: PurchaseOption[], required: number): Partial<Record<PurchaseGroup, string>> {
  const result: Partial<Record<PurchaseGroup, string>> = {};
  if (required <= 0) return result;
  for (const group of ["video", "credits", "plans"] as const) {
    const inGroup = options.filter((option) => option.group === group);
    if (!inGroup.length) continue;
    const covering = inGroup.filter((option) => option.covers).sort((a, b) => a.amountUsd - b.amountUsd || a.credits - b.credits);
    result[group] = (covering[0] ?? [...inGroup].sort((a, b) => b.credits - a.credits)[0]).key;
  }
  return result;
}
