import { useEffect, useState, type ReactNode } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/app-button";
import { AuthModal } from "@/components/auth/AuthModal";
import { SecureCheckoutModal } from "@/components/billing/SecureCheckoutModal";
import { SubscriptionCheckoutModal } from "@/components/billing/SubscriptionCheckoutModal";
import { fetchMe, type CheckoutId } from "@/lib/api-client";
import { watchAuthState } from "@/lib/firebase/client";
import { clearPendingPurchase, savePendingPurchase, takePendingPurchase, type PendingPurchase } from "@/lib/pendingPurchase";
import { displayCredits, estimateRenderCredits } from "@/lib/credits";
import { discountedPrice, fetchWelcomeGrowthOffer, formatUsd, formatWelcomeCountdown, type WelcomeGrowthOffer } from "@/lib/growth";
import {
  CREDIT_PACKS,
  PLAN_PACKS,
  STARTER_CREDITS,
  VIDEO_PACKS,
  creditsBuyLines,
  modelPriceRows,
  pricePer100Credits,
} from "@/lib/pricing";

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

function Section({ id, title, subtitle, aside, children }: { id?: string; title: string; subtitle: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 pt-10 first:pt-0 sm:pt-14">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-text-primary sm:text-2xl">{title}</h2>
          <p className="mt-1 max-w-2xl text-sm text-text-muted">{subtitle}</p>
        </div>
        {aside}
      </div>
      <div className="mt-5">{children}</div>
    </section>
  );
}

function Lines({ items, tone = "mint" }: { items: string[]; tone?: "mint" | "violet" }) {
  return (
    <ul className="mt-4 space-y-2 border-t border-white/[.07] pt-4">
      {items.map((line) => (
        <li key={line} className="flex items-start gap-2 text-[13px] leading-5 text-text-muted">
          <Check size={14} className={`mt-0.5 shrink-0 ${tone === "mint" ? "text-mint" : "text-violet"}`} aria-hidden="true" />
          <span>{line}</span>
        </li>
      ))}
    </ul>
  );
}

const CARD = "relative flex flex-col rounded-3xl border p-5 transition duration-200 hover:-translate-y-0.5 sm:p-6";

function seconds(value: number) {
  if (value < 60) return `${value} seconds`;
  const minutes = Math.floor(value / 60);
  const rest = value % 60;
  return rest ? `${minutes} min ${rest}s` : `${minutes} min`;
}

export function PricingTable() {
  const [welcomeOffer, setWelcomeOffer] = useState<WelcomeGrowthOffer | null>(null);
  const [offerLoaded, setOfferLoaded] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [directCheckout, setDirectCheckout] = useState<DirectCheckout | null>(null);
  const [subscriptionCheckout, setSubscriptionCheckout] = useState<SubscriptionCheckout | null>(null);
  const [signedIn, setSignedIn] = useState<boolean | null>(null);
  const [showAuth, setShowAuth] = useState(false);

  useEffect(() => watchAuthState((user) => setSignedIn(Boolean(user))), []);

  // The welcome price belongs to the account: load it again once the person is signed in.
  useEffect(() => {
    let cancelled = false;
    setOfferLoaded(false);
    fetchWelcomeGrowthOffer()
      .then((offer) => { if (!cancelled) setWelcomeOffer(offer); })
      .catch(() => {})
      .finally(() => { if (!cancelled) setOfferLoaded(true); });
    return () => { cancelled = true; };
  }, [signedIn]);

  useEffect(() => {
    if (!welcomeOffer?.active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [welcomeOffer?.active]);

  const activeOffer = welcomeOffer?.active && welcomeOffer.discountPercent > 0 && new Date(welcomeOffer.expiresAt).getTime() > now
    ? welcomeOffer
    : null;

  /** Opens the checkout for a remembered choice, priced exactly as the pricing page shows it. */
  function openChoice(choice: PendingPurchase) {
    if (choice.kind === "plan") {
      const plan = PLAN_PACKS.find((item) => item.id === choice.id);
      if (plan) setSubscriptionCheckout({ plan: plan.id, planName: plan.name, amountUsd: plan.amountUsd, credits: displayCredits(plan.credits) });
      return;
    }
    const video = VIDEO_PACKS.find((item) => item.id === choice.id);
    if (video) {
      setDirectCheckout({ plan: video.id, productName: video.name, amountUsd: video.amountUsd, originalAmountUsd: video.amountUsd, credits: displayCredits(video.credits) });
      return;
    }
    const pack = CREDIT_PACKS.find((item) => item.id === choice.id);
    if (pack) {
      const discounted = activeOffer && activeOffer.eligibleProducts.includes(pack.id) ? discountedPrice(pack.amountUsd, activeOffer.discountPercent) : pack.amountUsd;
      const credits = displayCredits(pack.credits);
      setDirectCheckout({ plan: pack.id, productName: `${credits.toLocaleString()} production credits`, amountUsd: discounted, originalAmountUsd: pack.amountUsd, credits });
    }
  }

  /**
   * Buy / Subscribe. A signed-out visitor is asked to sign in FIRST, and lands on exactly what they clicked
   * afterwards. Sign-in is checked with the server at click time (not from page state that may still be loading).
   */
  async function requestPurchase(choice: PendingPurchase) {
    const ok = signedIn === true || await fetchMe().then(() => true).catch(() => false);
    if (ok) { openChoice(choice); return; }
    savePendingPurchase(choice);
    setShowAuth(true);
  }

  // Signed in by any route (same tab, after a reload, another tab): resume the purchase that was waiting.
  useEffect(() => {
    if (signedIn !== true || !offerLoaded) return;
    const waiting = takePendingPurchase();
    if (waiting) openChoice(waiting);
  }, [signedIn, offerLoaded]); // eslint-disable-line react-hooks/exhaustive-deps

  const modelRows = modelPriceRows();
  const costRows: Array<[string, number, number]> = [
    ["Video · 8 seconds", estimateRenderCredits("video", true, 8), estimateRenderCredits("video", false, 8)],
    ["Video · 16 seconds", estimateRenderCredits("video", true, 16), estimateRenderCredits("video", false, 16)],
    ["Video · 32 seconds", estimateRenderCredits("video", true, 32), estimateRenderCredits("video", false, 32)],
    ["Video · 48 seconds", estimateRenderCredits("video", true, 48), estimateRenderCredits("video", false, 48)],
    ["Video · 60 seconds", estimateRenderCredits("video", true, 60), estimateRenderCredits("video", false, 60)],
    ["4K video · 8 seconds", estimateRenderCredits("video", true, 8, "4k"), estimateRenderCredits("video", false, 8, "4k")],
  ];

  return (
    <div className="text-left">
      {/* 1 · Credits */}
      <Section
        id="buy-credits"
        title="Buy credits"
        subtitle="Pay once, no subscription. Credits stay in your account until you use them and work for every feature."
        aside={activeOffer && (
          <span className="rounded-full border border-mint/30 bg-mint/10 px-3 py-1.5 text-xs font-bold text-mint">
            {activeOffer.discountPercent}% off · {formatWelcomeCountdown(activeOffer.expiresAt, now)} left
          </span>
        )}
      >
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {CREDIT_PACKS.map((pack, index) => {
            const packCredits = displayCredits(pack.credits);
            const discounted = activeOffer && activeOffer.eligibleProducts.includes(pack.id)
              ? discountedPrice(pack.amountUsd, activeOffer.discountPercent)
              : pack.amountUsd;
            const hasDiscount = discounted < pack.amountUsd;
            const featured = index === 1;
            return (
              <div key={pack.id} className={`${CARD} ${featured ? "border-violet/60 bg-signature-soft shadow-[0_0_44px_-14px_rgba(139,92,246,.45)]" : "border-border bg-panel hover:border-violet/30"}`}>
                <p className="text-sm font-semibold text-text-muted">{pack.name}</p>
                <p className="mt-2 font-display text-4xl font-bold leading-none text-text-primary">
                  {packCredits.toLocaleString()} <span className="text-base font-semibold text-text-muted">credits</span>
                </p>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-2xl font-bold text-text-primary">{formatUsd(discounted)}</span>
                  {hasDiscount && <span className="text-sm text-text-dim line-through">{formatUsd(pack.amountUsd)}</span>}
                  <span className="ml-auto text-[11px] text-text-dim">${pricePer100Credits(discounted, pack.credits).toFixed(2)} / 100</span>
                </div>
                <Lines items={creditsBuyLines(pack.credits)} />
                <Button
                  variant={featured || hasDiscount ? "primary" : "secondary"}
                  className="mt-5 w-full"
                  onClick={() => void requestPurchase({ kind: "pack", id: pack.id })}
                >
                  Buy {formatUsd(discounted)}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-text-dim">New accounts get {STARTER_CREDITS} free credits, enough for one set of 4 images. Videos need more credits.</p>
      </Section>

      {/* 2 · One video */}
      <Section
        id="one-video"
        title="Just need one video?"
        subtitle="A single video, paid once. Each pack covers a full Cinema 2 · 1080p video with sound, or narration if you add it."
      >
        <div className="grid gap-3 sm:grid-cols-3 sm:gap-4">
          {VIDEO_PACKS.map((pack) => (
            <div key={pack.id} className={`${CARD} ${pack.popular ? "border-mint/50 bg-panel shadow-[0_0_44px_-16px_rgba(52,211,153,.4)]" : "border-border bg-panel hover:border-mint/30"}`}>
              <p className="text-sm font-semibold text-text-muted">{pack.name}</p>
              <p className="mt-2 font-display text-4xl font-bold leading-none text-text-primary">{pack.seconds}<span className="text-base font-semibold text-text-muted"> seconds</span></p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold text-text-primary">{formatUsd(pack.amountUsd)}</span>
                <span className="text-xs text-text-dim">one time</span>
              </div>
              <Lines
                tone="violet"
                items={[
                  pack.note,
                  `${displayCredits(pack.credits).toLocaleString()} credits · ${seconds(pack.seconds)} · 1080p`,
                  "Sound, or AI narration in 14 languages",
                ]}
              />
              <Button
                variant={pack.popular ? "primary" : "secondary"}
                className="mt-5 w-full"
                onClick={() => void requestPurchase({ kind: "pack", id: pack.id })}
              >
                Buy {formatUsd(pack.amountUsd)}
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* 3 · Plans */}
      <Section
        id="plans"
        title="Monthly plans"
        subtitle="Credits refresh every month and unused credits roll over. Cancel any time. Every plan includes every feature."
      >
        <div className="grid gap-3 sm:grid-cols-2 sm:gap-4 lg:grid-cols-4">
          <div className={`${CARD} border-border bg-panel`}>
            <p className="text-sm font-semibold text-text-muted">Free</p>
            <p className="mt-2 font-display text-4xl font-bold leading-none text-text-primary">$0</p>
            <p className="mt-2 font-utility text-xs text-mint">{STARTER_CREDITS} credits when you sign up</p>
            <Lines items={[
              "Website preview and source capture",
              "Enough for 1 set of 4 images",
              "Add any pack when you are ready for video",
            ]} />
            <Button variant="secondary" className="mt-5 w-full" onClick={() => { window.location.href = "/#generate"; }}>Start free</Button>
          </div>

          {PLAN_PACKS.map((plan) => (
            <div key={plan.id} className={`${CARD} ${plan.highlight ? "border-violet/60 bg-signature-soft shadow-[0_0_44px_-14px_rgba(139,92,246,.45)]" : "border-border bg-panel hover:border-violet/30"}`}>
              <p className="text-sm font-semibold text-text-muted">{plan.name}</p>
              <p className="mt-2 font-display text-4xl font-bold leading-none text-text-primary">${plan.amountUsd}<span className="text-base font-semibold text-text-muted"> /mo</span></p>
              <p className="mt-2 font-utility text-xs text-mint">{displayCredits(plan.credits).toLocaleString()} credits every month</p>
              <Lines items={[...creditsBuyLines(plan.credits), plan.pitch]} />
              <Button
                variant={plan.highlight ? "primary" : "secondary"}
                className="mt-5 w-full"
                onClick={() => void requestPurchase({ kind: "plan", id: plan.id })}
              >
                Subscribe ${plan.amountUsd}/mo
              </Button>
            </div>
          ))}
        </div>
      </Section>

      {/* 4 · What things cost */}
      <Section
        id="costs"
        title="What things cost"
        subtitle="The exact price is always shown before you generate. Failed generations are refunded automatically."
      >
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="overflow-hidden rounded-2xl border border-border bg-panel">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-panel-alt text-xs text-text-muted"><th className="px-4 py-3 font-semibold">Example</th><th className="px-4 py-3 font-semibold">Sound</th><th className="px-4 py-3 font-semibold">Narrated</th></tr></thead>
              <tbody>
                {costRows.map(([label, silent, narrated]) => (
                  <tr key={label} className="border-t border-border">
                    <td className="px-4 py-2.5 text-text-primary">{label}</td>
                    <td className="font-utility px-4 py-2.5 text-mint">{silent.toLocaleString()}</td>
                    <td className="font-utility px-4 py-2.5 text-mint">{narrated.toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="border-t border-border">
                  <td className="px-4 py-2.5 text-text-primary">Set of 4 images</td>
                  <td colSpan={2} className="font-utility px-4 py-2.5 text-mint">{estimateRenderCredits("photos", true).toLocaleString()} · 4K {estimateRenderCredits("photos", true, 8, "4k").toLocaleString()}</td>
                </tr>
                <tr className="border-t border-border">
                  <td className="px-4 py-2.5 text-text-primary">Product photos + 8s video</td>
                  <td colSpan={2} className="font-utility px-4 py-2.5 text-mint">{estimateRenderCredits("both", true, 8).toLocaleString()}</td>
                </tr>
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-3 text-xs text-text-dim">Cinema 2 · 1080p shown. Website, AI, product, talking-scene, interior and architecture videos all use the same video prices. Image sets cover product, AI, interior and architecture images.</p>
          </div>

          <div className="overflow-hidden rounded-2xl border border-border bg-panel">
            <table className="w-full text-left text-sm">
              <thead><tr className="bg-panel-alt text-xs text-text-muted"><th className="px-4 py-3 font-semibold">Model</th><th className="px-4 py-3 font-semibold">Standard</th><th className="px-4 py-3 font-semibold">4K</th></tr></thead>
              <tbody>
                {modelRows.map((row) => (
                  <tr key={row.id} className="border-t border-border">
                    <td className="px-4 py-2.5 text-text-primary">{row.name}<span className="ml-2 text-[11px] text-text-dim">{row.kind}</span></td>
                    <td className="font-utility px-4 py-2.5 text-mint">{row.standard}<span className="ml-1 text-[11px] text-text-dim">{row.fixedQuality ? `${row.fixedQuality} ` : ""}{row.unit}</span></td>
                    <td className="font-utility px-4 py-2.5 text-mint">{row.ultra ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="border-t border-border px-4 py-3 text-xs text-text-dim">Credits per second (video) or per set of 4 images. AI narration adds {displayCredits(6)} credits per video.</p>
          </div>
        </div>
      </Section>

      {showAuth && (
        <AuthModal
          onClose={() => { clearPendingPurchase(); setShowAuth(false); }}
          onSignedIn={() => {
            setShowAuth(false);
            setSignedIn(true);
            // The effect above opens the waiting purchase as soon as the account's offer has loaded.
          }}
        />
      )}

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
