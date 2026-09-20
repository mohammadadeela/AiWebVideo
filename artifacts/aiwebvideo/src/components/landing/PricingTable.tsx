import { useEffect, useState } from "react";
import { Button } from "@/components/ui/app-button";
import { SecureCheckoutModal } from "@/components/billing/SecureCheckoutModal";
import { SubscriptionCheckoutModal } from "@/components/billing/SubscriptionCheckoutModal";
import type { CheckoutId } from "@/lib/api-client";
import { displayCredits, estimateRenderCredits } from "@/lib/credits";
import { discountedPrice, fetchWelcomeGrowthOffer, formatUsd, formatWelcomeCountdown, type WelcomeGrowthOffer } from "@/lib/growth";

function PurchaseButton({
  primary,
  onBuy,
  label = "Buy",
}: {
  primary?: boolean;
  onBuy: () => void;
  label?: string;
}) {
  return (
    <div className="mt-3 sm:mt-5">
      <Button
        variant={primary ? "primary" : "secondary"}
        size="md"
        className="w-full !text-xs sm:!text-sm"
        onClick={onBuy}
      >
        {label}
      </Button>
    </div>
  );
}

const PLANS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    period: "",
    sub: "forever",
    credits: "25 Starter Credits",
    tagline: "Preview your real website source.",
    notes: [
      "Website screenshots and source preview",
      "Real favicon and useful public pages",
      "Credits checked before paid AI planning",
      "No paid generation API starts without enough credits",
    ],
    cta: "Preview Website",
    highlight: false,
  },
  {
    id: "creator" as const,
    name: "Creator",
    price: "$39",
    amountUsd: 39,
    period: "/mo",
    sub: "",
    credits: "750 credits / mo",
    internalCredits: 150,
    tagline: "For founders and growing shops.",
    notes: [
      "3 narrated quick clips or 1 standard campaign",
      "Professional video with synchronized sound",
      "1080p and 4K mastered delivery",
      "Unused credits roll over",
    ],
    cta: "Buy",
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$99",
    amountUsd: 99,
    period: "/mo",
    sub: "",
    credits: "2,000 credits / mo",
    internalCredits: 400,
    tagline: "For marketers shipping weekly.",
    notes: [
      "10 narrated quick clips or 2 standard campaigns",
      "Custom prompts and premium presets",
      "Native 4K mastered exports",
      "AI-generated motion and cinematic sound",
    ],
    cta: "Buy",
    highlight: true,
  },
  {
    id: "agency" as const,
    name: "Agency",
    price: "$249",
    amountUsd: 249,
    period: "/mo",
    sub: "",
    credits: "5,000 credits / mo",
    internalCredits: 1000,
    tagline: "Client work, at scale.",
    notes: [
      "26 narrated quick clips or 7 standard campaigns",
      "Unlimited client websites",
      "Priority generation concurrency",
      "Flexible one-time top-ups from $14.99",
    ],
    cta: "Buy",
    highlight: false,
  },
];

const ONE_TIME_PACKS = [
  {
    id: "single8" as const,
    name: "Quick Video",
    length: "8 seconds",
    price: "$9.99",
    amountUsd: 9.99,
    credits: 38,
    note: "One punchy promo, ready in minutes",
  },
  {
    id: "single48" as const,
    name: "Full Marketing Video",
    length: "48 seconds",
    price: "$52.99",
    amountUsd: 52.99,
    credits: 198,
    note: "A complete marketing video with room for a full story",
    popular: true,
  },
  {
    id: "single144" as const,
    name: "Extended Video",
    length: "144 seconds",
    price: "$149.99",
    amountUsd: 149.99,
    credits: 582,
    note: "A longer presentation, tutorial, or detailed brand story",
  },
];

const CREDIT_PACKS = [
  { id: "topup50" as const, credits: 50, amountUsd: 14.99, note: "Quick refill" },
  { id: "topup100" as const, credits: 100, amountUsd: 28.99, note: "Small production balance" },
  { id: "topup250" as const, credits: 250, amountUsd: 69.99, note: "For several productions" },
];

const CREDIT_COSTS = [
  {
    item: "Quick video · 8s · 1080p",
    credits: "160 silent · 190 with narration",
  },
  {
    item: "Social video · 16s · 1080p",
    credits: "320 silent · 350 with narration",
  },
  {
    item: "Standard video · 32s · 1080p",
    credits: "640 silent · 670 with narration",
  },
  {
    item: "Full video · 64s · 1080p",
    credits: "1,280 silent · 1,310 with narration",
  },
  {
    item: "Extended video · 144s · 1080p",
    credits: "2,880 silent · 2,910 with narration",
  },
  {
    item: "Custom continuous video · 8s to 2m 24s",
    credits: "Exact whole-second duration · quote before generation",
  },
  { item: "4K AI video", credits: "30 per generated second · narration +30" },
  { item: "Set of 4 marketing photos · up to 4K", credits: 40 },
];

const STUDIO_PRICES = [
  {
    item: "Product photo set (4 images)",
    credits: `${estimateRenderCredits("photos", true)} credits`,
  },
  {
    item: "Product video · 8s · 1080p",
    credits: `${estimateRenderCredits("video", true, 8)} credits`,
  },
  {
    item: "Product photos + video · 8s",
    credits: `${estimateRenderCredits("both", true, 8)} credits`,
  },
  {
    item: "Custom idea video · 8s with cinematic scene audio",
    credits: `${estimateRenderCredits("custom", true, 8)} credits`,
  },
  {
    item: "Custom idea video · 8s, narrated",
    credits: `${estimateRenderCredits("custom", false, 8)} credits`,
  },
  {
    item: "Scenario video · 8s with native dialogue / scene audio",
    credits: `${estimateRenderCredits("custom", true, 8)} credits`,
  },
  {
    item: "Scenario video · 32s with native dialogue / scene audio",
    credits: `${estimateRenderCredits("custom", true, 32)} credits`,
  },
];

type DirectCheckout = {
  plan: CheckoutId;
  productName: string;
  amountUsd: number;
  originalAmountUsd?: number;
  credits: number;
};

type SubscriptionCheckout = {
  plan: "creator" | "pro" | "agency";
  planName: string;
  amountUsd: number;
  credits: number;
};

export function PricingTable() {
  const [welcomeOffer, setWelcomeOffer] = useState<WelcomeGrowthOffer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [directCheckout, setDirectCheckout] = useState<DirectCheckout | null>(null);
  const [subscriptionCheckout, setSubscriptionCheckout] = useState<SubscriptionCheckout | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchWelcomeGrowthOffer().then((offer) => { if (!cancelled) setWelcomeOffer(offer); }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!welcomeOffer?.active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [welcomeOffer?.active]);

  const activeOffer = welcomeOffer?.active && welcomeOffer.discountPercent > 0 && new Date(welcomeOffer.expiresAt).getTime() > now
    ? welcomeOffer
    : null;

  function handleChoose(planId: string) {
    if (planId === "free") {
      window.location.href = "/#generate";
      return;
    }
    const plan = PLANS.find((item) => item.id === planId);
    if (!plan || plan.id === "free" || !("amountUsd" in plan) || !("internalCredits" in plan)) return;
    setSubscriptionCheckout({
      plan: plan.id,
      planName: plan.name,
      amountUsd: plan.amountUsd,
      credits: displayCredits(plan.internalCredits),
    });
  }

  return (
    <div>
      <div
        id="plans"
        className="scroll-mt-24 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4"
      >
        {PLANS.map((plan, i) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-3 sm:p-5 transition-all duration-200 hover:-translate-y-1 animate-fade-in-up ${
              plan.highlight
                ? "border-violet/60 bg-signature-soft shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]"
                : "border-border bg-panel hover:border-violet/30"
            }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center rounded-full bg-signature px-2 sm:px-3 py-0.5 text-[9px] sm:text-[11px] font-semibold text-white whitespace-nowrap">
                  Most popular
                </span>
              </div>
            )}
            <h3 className="font-display text-sm sm:text-base font-bold text-text-primary">
              {plan.name}
            </h3>
            <p className="mt-0.5 text-[10px] sm:text-xs text-text-muted line-clamp-1 sm:line-clamp-none">
              {plan.tagline}
            </p>
            <div className="mt-2 sm:mt-3">
              <span className="font-display text-xl sm:text-3xl font-bold text-text-primary">
                {plan.price}
              </span>
              {plan.period && (
                <span className="text-xs sm:text-sm text-text-dim">
                  {plan.period}
                </span>
              )}
              {plan.sub && (
                <span className="ml-1 text-xs sm:text-sm text-text-dim">
                  {plan.sub}
                </span>
              )}
            </div>
            <p className="font-utility mt-1 text-[10px] sm:text-xs text-mint">
              {plan.credits}
            </p>
            {plan.id !== "free" && (
              <p className="mt-1.5 text-[10px] leading-4 text-text-dim">
                Renews monthly · cancel anytime
              </p>
            )}
            <ul className="mt-2 sm:mt-4 flex-1 space-y-1 sm:space-y-2">
              {plan.notes.map((n) => (
                <li
                  key={n}
                  className="flex items-start gap-1.5 sm:gap-2 text-[11px] sm:text-sm text-text-muted"
                >
                  <span className="mt-0.5 text-mint shrink-0">✓</span>
                  {n}
                </li>
              ))}
            </ul>
            {plan.id === "free" ? (
              <Button
                variant={plan.highlight ? "primary" : "secondary"}
                size="md"
                className="mt-3 sm:mt-5 w-full !text-xs sm:!text-sm"
                onClick={() => handleChoose(plan.id)}
              >
                {plan.cta}
              </Button>
            ) : (
              <PurchaseButton
                primary={plan.highlight}
                onBuy={() => handleChoose(plan.id)}
              />
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 sm:mt-12">
        <h3 className="font-display text-lg sm:text-xl font-bold text-text-primary">
          Just need one video?
        </h3>
        <p className="mt-1 text-xs sm:text-sm text-text-muted">
          Pay once, no subscription. Your video is yours forever.
        </p>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3">
          {ONE_TIME_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative flex flex-col rounded-2xl border p-3 sm:p-5 transition-all duration-200 hover:-translate-y-1 ${
                pack.popular
                  ? "border-mint/50 bg-panel shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)]"
                  : "border-border bg-panel hover:border-mint/30"
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-mint px-2 sm:px-3 py-0.5 text-[9px] sm:text-[11px] font-semibold text-black whitespace-nowrap">
                    Best value
                  </span>
                </div>
              )}
              <h4 className="font-display text-sm sm:text-base font-bold text-text-primary">
                {pack.name}
              </h4>
              <p className="mt-0.5 text-[10px] sm:text-xs text-text-muted line-clamp-2 sm:line-clamp-none">
                {pack.note}
              </p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-1 sm:gap-2">
                <span className="font-display text-xl sm:text-3xl font-bold text-text-primary">
                  {pack.price}
                </span>
                <span className="text-[10px] sm:text-xs text-text-dim">
                  one time
                </span>
              </div>
              <p className="font-utility mt-1 text-[10px] sm:text-xs text-mint">
                {displayCredits(pack.credits).toLocaleString()} credits · {pack.length} · 1080p · sound + narration
              </p>
              <PurchaseButton
                primary={pack.popular}
                onBuy={() => setDirectCheckout({
                  plan: pack.id,
                  productName: pack.name,
                  amountUsd: pack.amountUsd,
                  originalAmountUsd: pack.amountUsd,
                  credits: displayCredits(pack.credits),
                })}
              />
            </div>
          ))}
        </div>
      </div>

      <section id="buy-credits" className="mt-10 scroll-mt-24 rounded-2xl border border-violet/40 bg-signature-soft p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet">No subscription</p>
              {activeOffer && (
                <span className="rounded-full border border-mint/30 bg-mint/10 px-2.5 py-1 text-[10px] font-bold text-mint">
                  {activeOffer.discountPercent}% OFF · {formatWelcomeCountdown(activeOffer.expiresAt, now)} left
                </span>
              )}
            </div>
            <h3 className="mt-1 font-display text-xl font-bold text-text-primary">Buy production credits</h3>
            <p className="mt-2 max-w-2xl text-sm text-text-muted">Pay once, keep the credits until you use them, and choose only the balance you need. Top-ups never change your subscription plan.</p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => {
            const packCredits = displayCredits(pack.credits);
            const discounted = activeOffer && activeOffer.eligibleProducts.includes(pack.id)
              ? discountedPrice(pack.amountUsd, activeOffer.discountPercent)
              : pack.amountUsd;
            const hasDiscount = discounted < pack.amountUsd;
            return (
              <div key={pack.id} className={`rounded-2xl border p-4 ${hasDiscount ? "border-mint/30 bg-mint/[.055]" : "border-white/10 bg-bg/35"}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-display text-lg font-bold text-text-primary">{packCredits.toLocaleString()} credits</p>
                    <p className="mt-1 text-xs text-text-muted">{pack.note}</p>
                  </div>
                  {hasDiscount && activeOffer && <span className="rounded-full bg-mint px-2 py-1 text-[9px] font-black text-[#08211b]">{activeOffer.discountPercent}% OFF</span>}
                </div>
                <div className="mt-3 flex items-end gap-2">
                  <p className="font-display text-2xl font-bold text-text-primary">{formatUsd(discounted)}</p>
                  {hasDiscount && <p className="pb-0.5 text-xs text-text-dim line-through">{formatUsd(pack.amountUsd)}</p>}
                </div>
                {hasDiscount && activeOffer && <p className="mt-1 text-[10px] font-semibold text-mint">Offer ends in {formatWelcomeCountdown(activeOffer.expiresAt, now)}</p>}
                <PurchaseButton
                  primary={pack.id === "topup250" || hasDiscount}
                  onBuy={() => setDirectCheckout({
                    plan: pack.id,
                    productName: `${packCredits.toLocaleString()} production credits`,
                    amountUsd: discounted,
                    originalAmountUsd: pack.amountUsd,
                    credits: packCredits,
                  })}
                />
              </div>
            );
          })}
        </div>
      </section>

      <div className="mt-10 overflow-x-auto rounded-xl border border-border">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-panel-alt text-text-muted">
              <th className="px-4 py-3 font-semibold">Generation type</th>
              <th className="px-4 py-3 font-semibold">Credits used</th>
            </tr>
          </thead>
          <tbody>
            {CREDIT_COSTS.map((row) => (
              <tr
                key={row.item}
                className="border-b border-border last:border-0 hover:bg-panel-alt/50 transition-colors"
              >
                <td className="px-4 py-2.5 text-text-primary">{row.item}</td>
                <td className="font-utility px-4 py-2.5 text-mint">
                  {row.credits}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-dim">
        Premium video uses 20 credits per requested second for a 1080p master and 30
        credits per requested second for a 4K master, and optional AI narration
        adds 30 credits per video. Choose any whole-second continuous length from 8 seconds to 2 minutes 24 seconds;
        the exact total and any credit shortfall appear before generation. For videos longer than 8 seconds,
        Veo continuity extensions use a 720p provider source and AiWebVideo masters that continuous source to the selected delivery size. Failed generations are automatically refunded.
      </p>

      <div className="mt-10">
        <h3 className="font-display text-lg font-bold text-text-primary">
          Studio generators
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          Product Photos &amp; Video, Custom Idea Video, and Scenario Video run
          on the exact same credit pricing above — no separate plan required.
        </p>
        <div className="mt-4 overflow-x-auto rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-panel-alt text-text-muted">
                <th className="px-4 py-3 font-semibold">Studio feature</th>
                <th className="px-4 py-3 font-semibold">Starting price</th>
              </tr>
            </thead>
            <tbody>
              {STUDIO_PRICES.map((row) => (
                <tr
                  key={row.item}
                  className="border-b border-border last:border-0 hover:bg-panel-alt/50 transition-colors"
                >
                  <td className="px-4 py-2.5 text-text-primary">{row.item}</td>
                  <td className="font-utility px-4 py-2.5 text-mint">
                    {row.credits}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {directCheckout && (
        <SecureCheckoutModal
          plan={directCheckout.plan}
          productName={directCheckout.productName}
          amountUsd={directCheckout.amountUsd}
          originalAmountUsd={directCheckout.originalAmountUsd}
          credits={directCheckout.credits}
          onClose={() => setDirectCheckout(null)}
        />
      )}

      {subscriptionCheckout && (
        <SubscriptionCheckoutModal
          plan={subscriptionCheckout.plan}
          planName={subscriptionCheckout.planName}
          amountUsd={subscriptionCheckout.amountUsd}
          credits={subscriptionCheckout.credits}
          onClose={() => setSubscriptionCheckout(null)}
        />
      )}
    </div>
  );
}
