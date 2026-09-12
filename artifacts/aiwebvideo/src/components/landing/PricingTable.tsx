import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/app-button";
import {
  ApiError,
  startCheckout,
  type CheckoutId,
} from "@/lib/api-client";
import { displayCredits, estimateRenderCredits } from "@/lib/credits";
import {
  fetchWelcomeGrowthOffer,
  formatWelcomeCountdown,
  welcomeBonusDisplayCredits,
  type WelcomeGrowthOffer,
} from "@/lib/growth";

function PurchaseButton({
  primary,
  loading,
  onBuy,
  label = "Buy",
}: {
  primary?: boolean;
  loading: boolean;
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
        disabled={loading}
      >
        {loading ? "Loading…" : label}
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
    creditsInternal: 0,
    tagline: "See your real website before paying.",
    notes: [
      "Website screenshots and source preview stay free",
      "New accounts receive 50 real Starter Credits",
      "Paid AI starts only after the full credit gate passes",
      "Your preview and captured pages stay saved",
    ],
    cta: "Preview Website",
    highlight: false,
  },
  {
    id: "creator" as const,
    name: "Creator",
    price: "$39",
    period: "/mo",
    sub: "",
    creditsInternal: 150,
    tagline: "For founders and growing shops.",
    notes: [
      "3 narrated quick clips or 1 standard campaign",
      "Professional video with synchronized sound",
      "1080p and 4K mastered delivery",
      "Unused credits roll over",
    ],
    cta: "Get Creator",
    highlight: false,
  },
  {
    id: "pro" as const,
    name: "Pro",
    price: "$99",
    period: "/mo",
    sub: "",
    creditsInternal: 400,
    tagline: "For marketers shipping weekly.",
    notes: [
      "10 narrated quick clips or 2 standard campaigns",
      "Custom prompts and premium presets",
      "Native 4K mastered exports",
      "AI-generated motion and cinematic sound",
    ],
    cta: "Get Pro",
    highlight: true,
  },
  {
    id: "agency" as const,
    name: "Agency",
    price: "$249",
    period: "/mo",
    sub: "",
    creditsInternal: 1000,
    tagline: "Client work, at scale.",
    notes: [
      "26 narrated quick clips or 7 standard campaigns",
      "Unlimited client websites",
      "Priority generation concurrency",
      "Flexible one-time top-ups from $14.99",
    ],
    cta: "Get Agency",
    highlight: false,
  },
];

const ONE_TIME_PACKS = [
  {
    id: "single8" as const,
    name: "Quick Video",
    length: "8 seconds",
    price: "$9.99",
    creditsInternal: 38,
    note: "One punchy promo, ready in minutes",
  },
  {
    id: "single48" as const,
    name: "Full Marketing Video",
    length: "48 seconds",
    price: "$52.99",
    creditsInternal: 198,
    note: "A complete marketing video with room for a full story",
    popular: true,
  },
  {
    id: "single144" as const,
    name: "Extended Video",
    length: "144 seconds",
    price: "$149.99",
    creditsInternal: 582,
    note: "A longer presentation, tutorial, or detailed brand story",
  },
];

const CREDIT_PACKS = [
  { id: "topup50" as const, creditsInternal: 50, price: "$14.99", note: "Quick refill" },
  { id: "topup100" as const, creditsInternal: 100, price: "$28.99", note: "Small production balance" },
  { id: "topup250" as const, creditsInternal: 250, price: "$69.99", note: "For several productions" },
];

const CREDIT_COSTS = [
  {
    item: "Quick video · 8s · 1080p",
    credits: `${displayCredits(32)} silent · ${displayCredits(38)} with narration`,
  },
  {
    item: "Social video · 16s · 1080p",
    credits: `${displayCredits(64)} silent · ${displayCredits(70)} with narration`,
  },
  {
    item: "Standard video · 32s · 1080p",
    credits: `${displayCredits(128)} silent · ${displayCredits(134)} with narration`,
  },
  {
    item: "Full video · 64s · 1080p",
    credits: `${displayCredits(256)} silent · ${displayCredits(262)} with narration`,
  },
  {
    item: "Extended video · 144s · 1080p",
    credits: `${displayCredits(576)} silent · ${displayCredits(582)} with narration`,
  },
  {
    item: "Custom continuous video · 8s to 2m 24s",
    credits: "Exact whole-second duration · quote before generation",
  },
  { item: "4K AI video", credits: `${displayCredits(6)} per generated second · narration +${displayCredits(6)}` },
  { item: "Set of 4 marketing photos · up to 4K", credits: displayCredits(8) },
];

const STUDIO_PRICES = [
  {
    item: "Product photo set (4 images)",
    credits: `${displayCredits(estimateRenderCredits("photos", true))} credits`,
  },
  {
    item: "Product video · 8s · 1080p",
    credits: `${displayCredits(estimateRenderCredits("video", true, 8))} credits`,
  },
  {
    item: "Product photos + video · 8s",
    credits: `${displayCredits(estimateRenderCredits("both", true, 8))} credits`,
  },
  {
    item: "Custom idea video · 8s with cinematic scene audio",
    credits: `${displayCredits(estimateRenderCredits("custom", true, 8))} credits`,
  },
  {
    item: "Custom idea video · 8s, narrated",
    credits: `${displayCredits(estimateRenderCredits("custom", false, 8))} credits`,
  },
  {
    item: "Scenario video · 8s with native dialogue / scene audio",
    credits: `${displayCredits(estimateRenderCredits("custom", true, 8))} credits`,
  },
  {
    item: "Scenario video · 32s with native dialogue / scene audio",
    credits: `${displayCredits(estimateRenderCredits("custom", true, 32))} credits`,
  },
];

export function checkoutErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return "Checkout could not be started. Please try again shortly.";
  }
  if (error.status === 401 || error.code === "UNAUTHORIZED") {
    return "Sign in first, then select Buy again.";
  }
  if (error.code === "PAYPAL_AUTH_FAILED" || error.code === "BILLING_NOT_CONFIGURED") {
    return "Checkout configuration needs attention. The site owner must verify the payment Client ID, Secret, and live/sandbox mode.";
  }
  if (error.code === "INVALID_ORIGIN") {
    return "Checkout was blocked because this site address does not match the configured application URL.";
  }
  if (error.code === "RATE_LIMITED") return error.message;
  return error.message || "Checkout could not be started. Please try again shortly.";
}

export function PricingTable() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [welcomeOffer, setWelcomeOffer] = useState<WelcomeGrowthOffer | null>(null);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    let active = true;
    void fetchWelcomeGrowthOffer()
      .then((offer) => {
        if (active) setWelcomeOffer(offer);
      })
      .catch(() => {
        // Public visitors can browse pricing without signing in. The real
        // server-timed offer appears only after an authenticated new account.
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!welcomeOffer?.active) return;
    const timer = window.setInterval(() => setClock(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [welcomeOffer?.active]);

  const offerActive = useMemo(() => {
    if (!welcomeOffer?.active) return false;
    return new Date(welcomeOffer.expiresAt).getTime() > clock;
  }, [clock, welcomeOffer]);
  const countdown = offerActive ? formatWelcomeCountdown(welcomeOffer?.expiresAt, clock) : null;

  async function handleChoose(planId: string) {
    if (planId === "free") {
      window.location.href = "/#generate";
      return;
    }
    setError(null);
    setLoadingPlan(planId);
    try {
      const { checkoutUrl } = await startCheckout(planId as CheckoutId);
      window.location.href = checkoutUrl;
    } catch (error) {
      setError(checkoutErrorMessage(error));
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {offerActive && welcomeOffer && (
        <div className="mb-5 overflow-hidden rounded-2xl border border-mint/35 bg-[linear-gradient(135deg,rgba(52,211,153,.11),rgba(139,92,246,.10))] p-4 shadow-[0_20px_60px_-45px_rgba(52,211,153,.9)] sm:p-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-mint">New account boost</span>
                <span className="font-utility text-xs font-semibold text-white">Ends in {countdown}</span>
              </div>
              <h3 className="mt-2 font-display text-lg font-bold text-white sm:text-xl">Get {welcomeOffer.bonusPercent}% extra credits on any credit pack</h3>
              <p className="mt-1 max-w-2xl text-xs leading-5 text-text-muted sm:text-sm">
                Your {welcomeOffer.starterCredits.toLocaleString()} Starter Credits are real and already protected by the same server credit gate. Buy a credit pack before the timer ends and we add the bonus automatically after PayPal confirms payment.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0"><a href="#buy-credits">Claim the boost</a></Button>
          </div>
        </div>
      )}

      {error && <p className="mb-4 text-sm text-pink">{error}</p>}
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
              {plan.id === "free"
                ? "50 Starter Credits for new accounts"
                : `${displayCredits(plan.creditsInternal).toLocaleString()} credits / mo`}
            </p>
            {plan.id === "free" ? (
              <p className="mt-1.5 text-[10px] leading-4 text-text-dim">
                The starter balance is below the minimum paid generation, so no provider API can start until you add enough credits.
              </p>
            ) : (
              <p className="mt-1.5 text-[10px] leading-4 text-text-dim">
                Renews monthly automatically · cancel anytime · recurring payment handled securely by PayPal
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
                disabled={loadingPlan === plan.id}
              >
                {loadingPlan === plan.id ? "Loading…" : plan.cta}
              </Button>
            ) : (
              <PurchaseButton
                primary={plan.highlight}
                loading={loadingPlan === plan.id}
                onBuy={() => handleChoose(plan.id)}
                label={plan.cta}
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
                {displayCredits(pack.creditsInternal).toLocaleString()} credits · {pack.length} · 1080p · sound + narration
              </p>
              <PurchaseButton
                primary={pack.popular}
                loading={loadingPlan === pack.id}
                onBuy={() => handleChoose(pack.id)}
              />
            </div>
          ))}
        </div>
      </div>

      <section id="buy-credits" className="mt-10 scroll-mt-24 rounded-2xl border border-violet/40 bg-signature-soft p-5 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet">No subscription</p>
          <h3 className="mt-1 font-display text-xl font-bold text-text-primary">Buy production credits</h3>
          <p className="mt-2 max-w-2xl text-sm text-text-muted">Pay once, keep the credits until you use them, and choose only the balance you need. Top-ups never change your subscription plan.</p>
        </div>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {CREDIT_PACKS.map((pack) => {
            const baseCredits = displayCredits(pack.creditsInternal);
            const bonusCredits = offerActive && welcomeOffer && welcomeOffer.eligibleProducts.includes(pack.id)
              ? welcomeBonusDisplayCredits(pack.creditsInternal, welcomeOffer.bonusPercent)
              : 0;
            const totalCredits = baseCredits + bonusCredits;
            return (
              <div key={pack.id} className="relative rounded-2xl border border-white/10 bg-bg/35 p-4">
                {bonusCredits > 0 && (
                  <span className="absolute right-3 top-3 rounded-full border border-mint/25 bg-mint/10 px-2 py-1 text-[9px] font-bold text-mint">+{welcomeOffer?.bonusPercent}% bonus</span>
                )}
                <p className="font-display text-lg font-bold text-text-primary">{totalCredits.toLocaleString()} credits</p>
                {bonusCredits > 0 && <p className="mt-1 text-[10px] font-semibold text-mint">{baseCredits.toLocaleString()} + {bonusCredits.toLocaleString()} welcome bonus</p>}
                <p className="mt-1 text-xs text-text-muted">{pack.note}</p>
                <p className="mt-3 font-display text-2xl font-bold text-text-primary">{pack.price}</p>
                <PurchaseButton
                  primary={pack.id === "topup250"}
                  loading={loadingPlan === pack.id}
                  onBuy={() => handleChoose(pack.id)}
                  label={bonusCredits > 0 ? `Get ${totalCredits.toLocaleString()} credits` : "Buy credits"}
                />
              </div>
            );
          })}
        </div>
        {offerActive && countdown && <p className="mt-3 text-center text-[11px] font-semibold text-mint">Welcome credit boost expires in {countdown}. The timer is tied to your account creation time and does not reset.</p>}
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
        Premium video uses {displayCredits(4)} credits per requested second for a 1080p master and {displayCredits(6)} credits per requested second for a 4K master, and optional AI narration adds {displayCredits(6)} credits per video. Choose any whole-second continuous length from 8 seconds to 2 minutes 24 seconds; the exact total and any credit shortfall appear before generation. Website screenshots and public-page capture remain free. Failed provider generations follow the current refund policy shown before generation.
      </p>

      <div className="mt-10">
        <h3 className="font-display text-lg font-bold text-text-primary">
          Studio generators
        </h3>
        <p className="mt-1 text-xs text-text-muted">
          Product Photos &amp; Video, Custom Idea Video, and Scenario Video run on the exact same credit pricing above — no separate plan required.
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
    </div>
  );
}