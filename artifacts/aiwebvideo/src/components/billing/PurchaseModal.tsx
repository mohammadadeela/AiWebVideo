import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { SecureCheckoutModal } from "@/components/billing/SecureCheckoutModal";
import { SubscriptionCheckoutModal } from "@/components/billing/SubscriptionCheckoutModal";
import type { CheckoutId } from "@/lib/api-client";
import { discountedPrice, fetchWelcomeGrowthOffer, formatUsd, formatWelcomeCountdown, type WelcomeGrowthOffer } from "@/lib/growth";
import { buildPurchaseOptions, orderOptions, pickBestFit, pickBestPerGroup, type PurchaseGroup, type PurchaseOption } from "@/lib/purchaseOptions";

const ROW = "flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[.995]";
const BUY_PILL = "rounded-full bg-violet/20 px-3 py-1 text-[10px] font-semibold text-violet";

type DirectCheckout = { plan: CheckoutId; productName: string; amountUsd: number; originalAmountUsd?: number; credits: number };
type SubscriptionCheckout = { plan: "creator" | "pro" | "agency"; planName: string; amountUsd: number; credits: number };

const TAB_LABELS: Record<PurchaseGroup, string> = { video: "One video", credits: "Credits", plans: "Plans" };

/**
 * One place to buy. It lists every pack and plan. When a job needs credits the best fit is marked and
 * placed first in its list, and any option that would still leave the person short says by how much.
 * With no requirement (for example from the profile) it simply shows everything.
 */
export function PurchaseModal({ onClose, title, summary, context, funded = 0, required = 0, includeVideoPacks = true, videoTabLabel, jobId }: {
  onClose: () => void;
  title: string;
  summary?: string;
  context?: string;
  /** Credits the person already has (balance plus whatever is reserved for this job). */
  funded?: number;
  /** Credits the job needs. 0 means "just browsing". */
  required?: number;
  includeVideoPacks?: boolean;
  videoTabLabel?: string;
  jobId?: string | null;
}) {
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

  const activeOffer = welcomeOffer?.active && welcomeOffer.discountPercent > 0 && new Date(welcomeOffer.expiresAt).getTime() > now ? welcomeOffer : null;
  const shortfall = Math.max(0, required - funded);

  const options = useMemo(
    () => buildPurchaseOptions({ funded, required, offer: activeOffer, includeVideoPacks }),
    [funded, required, activeOffer, includeVideoPacks],
  );
  // Overall winner decides which tab opens first; each list marks and leads with its own best.
  const bestKey = useMemo(() => pickBestFit(options, required), [options, required]);
  const bestByGroup = useMemo(() => pickBestPerGroup(options, required), [options, required]);
  const groups = (["video", "credits", "plans"] as const).filter((group) => options.some((option) => option.group === group));
  const [tab, setTab] = useState<PurchaseGroup | null>(null);
  const activeTab: PurchaseGroup = tab && groups.includes(tab) ? tab : (options.find((option) => option.key === bestKey)?.group ?? groups[0] ?? "credits");
  const bestInTab = bestByGroup[activeTab] ?? null;
  const list = orderOptions(options.filter((option) => option.group === activeTab), bestInTab);

  function buy(option: PurchaseOption) {
    if (option.kind === "plan") {
      setSubscriptionCheckout({ plan: option.id as SubscriptionCheckout["plan"], planName: option.productName, amountUsd: option.amountUsd, credits: option.credits });
      return;
    }
    setDirectCheckout({
      plan: option.id as CheckoutId,
      productName: option.productName,
      amountUsd: option.amountUsd,
      originalAmountUsd: option.originalAmountUsd,
      credits: option.credits,
    });
  }

  const busyCheckout = Boolean(directCheckout || subscriptionCheckout);

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={`fixed inset-0 z-50 flex items-end justify-center p-0 transition-all duration-200 sm:items-center sm:p-4 ${busyCheckout ? "pointer-events-none bg-transparent" : "bg-black/70 backdrop-blur-sm"}`}
        onClick={busyCheckout ? undefined : onClose}
      >
        <div
          className={`w-full max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-[24px] border border-white/10 bg-[#120e22]/96 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-fade-in-up transition-opacity duration-150 sm:max-h-[90vh] sm:rounded-3xl sm:p-5 ${busyCheckout ? "invisible opacity-0" : "visible opacity-100"}`}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight text-white">{title}</p>
              {summary && <p className="mt-1.5 text-xs font-medium text-white/70">{summary}</p>}
              {shortfall > 0 && <p className="mt-1 text-[11px] leading-4 text-amber-200">You need {shortfall.toLocaleString()} more credit{shortfall === 1 ? "" : "s"} for this.</p>}
              {context && <p className="mt-1 text-[11px] leading-4 text-text-dim">{context}</p>}
            </div>
            <button type="button" onClick={onClose} disabled={busyCheckout} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-base text-text-muted hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Close">×</button>
          </div>

          {activeOffer && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-mint/25 bg-mint/[.07] px-3 py-2 text-[11px]">
              <span className="font-semibold text-mint">{activeOffer.discountPercent}% off credit packs</span>
              <span className="font-utility text-mint/80">{formatWelcomeCountdown(activeOffer.expiresAt, now)} left</span>
            </div>
          )}

          <div role="tablist" aria-label="Ways to add credits" className={`mt-4 grid gap-1 rounded-2xl border border-white/10 bg-black/25 p-1 ${groups.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
            {groups.map((group) => (
              <button key={group} type="button" role="tab" aria-selected={activeTab === group} onClick={() => setTab(group)}
                className={`min-h-10 rounded-xl px-2 py-2 text-[11px] font-semibold transition sm:px-3 sm:text-xs ${activeTab === group ? "bg-signature text-white shadow-lg" : "text-text-muted hover:bg-white/5 hover:text-white"}`}>
                {group === "video" && videoTabLabel ? videoTabLabel : TAB_LABELS[group]}
              </button>
            ))}
          </div>

          <div className="mt-3 space-y-2" role="tabpanel">
            {list.map((option) => {
              const isBest = option.key === bestInTab;
              const hasDiscount = option.amountUsd < option.originalAmountUsd;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => buy(option)}
                  aria-label={`${option.title}, ${formatUsd(option.amountUsd)}${option.kind === "plan" ? " per month" : ""}${isBest ? (option.covers ? ", best fit" : ", closest fit") : ""}`}
                  className={`${ROW} ${isBest ? "border-violet/55 bg-violet/[.12] shadow-[0_16px_40px_-26px_rgba(139,92,246,.95)]" : "border-white/10 bg-white/[.025] hover:border-violet/35"}`}
                >
                  <span className="min-w-0">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
                      {option.title}
                      {isBest && <span className="rounded-full bg-violet px-2 py-0.5 text-[10px] font-semibold text-white">{option.covers ? "Best fit" : "Closest"}</span>}
                    </span>
                    <span className="mt-0.5 block text-xs text-text-muted">{option.subtitle}</span>
                    {option.lines.length > 0 && <span className="mt-1 block text-[11px] leading-4 text-white/45">{option.lines.slice(0, 2).join(" · ")}</span>}
                    {required > 0 && !option.covers && (
                      <span className="mt-1 block text-[11px] font-medium text-amber-200">Still {option.shortBy.toLocaleString()} credit{option.shortBy === 1 ? "" : "s"} short for this video, so you'd add more later</span>
                    )}
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    {hasDiscount && <span className="text-[10px] leading-none text-text-dim line-through">{formatUsd(option.originalAmountUsd)}</span>}
                    <span className="font-display text-xl font-bold leading-none text-white">
                      {formatUsd(option.amountUsd)}{option.kind === "plan" && <span className="text-[10px] font-normal text-text-dim">/mo</span>}
                    </span>
                    <span className={BUY_PILL}>{hasDiscount && activeOffer ? `${activeOffer.discountPercent}% off · Buy` : "Buy"}</span>
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {directCheckout && (
        <SecureCheckoutModal
          plan={directCheckout.plan}
          productName={directCheckout.productName}
          amountUsd={directCheckout.amountUsd}
          originalAmountUsd={directCheckout.originalAmountUsd}
          credits={directCheckout.credits}
          jobId={jobId}
          onClose={() => setDirectCheckout(null)}
        />
      )}
      {subscriptionCheckout && (
        <SubscriptionCheckoutModal
          plan={subscriptionCheckout.plan}
          planName={subscriptionCheckout.planName}
          amountUsd={subscriptionCheckout.amountUsd}
          credits={subscriptionCheckout.credits}
          jobId={jobId}
          onClose={() => setSubscriptionCheckout(null)}
        />
      )}
    </>,
    document.body,
  );
}
