import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SecureCheckoutModal } from '@/components/billing/SecureCheckoutModal';
import { SubscriptionCheckoutModal } from '@/components/billing/SubscriptionCheckoutModal';
import type { CheckoutId } from '@/lib/api-client';
import { displayCredits, estimateRenderCredits } from '@/lib/credits';
import { publicModel } from '@/lib/generationModels';
import { CREDIT_PACKS, PLAN_PACKS, VIDEO_PACKS } from '@/lib/pricing';
import { discountedPrice, fetchWelcomeGrowthOffer, formatUsd, formatWelcomeCountdown, type WelcomeGrowthOffer } from '@/lib/growth';

const PAYWALL_PLANS = PLAN_PACKS.map((plan) => ({ id: plan.id, name: plan.name, price: plan.amountUsd, credits: plan.credits, pitch: plan.pitch, highlight: Boolean(plan.highlight) }));

const ROW = 'flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition active:scale-[.995]';
const ROW_BEST = 'border-violet/45 bg-violet/[.09]';
const ROW_IDLE = 'border-white/10 bg-white/[.025] hover:border-violet/35';
const BEST_TAG = 'rounded-full bg-violet/20 px-2 py-0.5 text-[9px] font-semibold text-violet';
const BUY_PILL = 'rounded-full bg-violet/20 px-3 py-1 text-[10px] font-semibold text-violet';

type Tab = 'plans' | 'credits' | 'video';
type BestFit = {
  kind: 'direct' | 'plan';
  id: string;
  title: string;
  note: string;
  amountUsd: number;
  originalAmountUsd: number;
  credits: number;
  productName: string;
};
type DirectCheckout = {
  plan: CheckoutId;
  productName: string;
  amountUsd: number;
  originalAmountUsd?: number;
  credits: number;
};
type SubscriptionCheckout = {
  plan: 'creator' | 'pro' | 'agency';
  planName: string;
  amountUsd: number;
  credits: number;
};

export function PaywallModal({
  onClose,
  context,
  durationSeconds = 8,
  mode = 'video',
  outputQuality = '1080p',
  skipVoiceover = false,
  modelId = null,
  currentBalance = 0,
  reservedCredits = 0,
  jobId,
}: {
  onClose: () => void;
  context?: string;
  durationSeconds?: number;
  mode?: string;
  outputQuality?: '1080p' | '4k';
  skipVoiceover?: boolean;
  modelId?: string | null;
  currentBalance?: number;
  reservedCredits?: number;
  jobId?: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>(() =>
    mode !== 'photos' && mode !== 'icon' && mode !== 'both' && outputQuality === '1080p' && [8, 48, 144].includes(durationSeconds)
      ? 'video'
      : 'credits',
  );
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
  const requiredCredits = estimateRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality, modelId);
  const fundedCredits = currentBalance + reservedCredits;
  const shortfall = Math.max(0, requiredCredits - fundedCredits);
  const eligibleVideoPacks = useMemo(() => mode !== 'photos' && mode !== 'icon' && mode !== 'both' && outputQuality === '1080p'
    ? VIDEO_PACKS.filter((pack) => fundedCredits + displayCredits(pack.credits) >= requiredCredits)
    : [], [fundedCredits, mode, outputQuality, requiredCredits]);
  const bestCreditPackId = useMemo(() => CREDIT_PACKS.find((pack) => fundedCredits + displayCredits(pack.credits) >= requiredCredits)?.id ?? null, [fundedCredits, requiredCredits]);
  const eligiblePlans = useMemo(() => PAYWALL_PLANS.filter((plan) => fundedCredits + displayCredits(plan.credits) >= requiredCredits), [fundedCredits, requiredCredits]);
  const exactVideoPack = useMemo(() => {
    if (mode === 'photos' || mode === 'icon' || mode === 'both' || outputQuality !== '1080p') return null;
    const id = durationSeconds === 8 ? 'single8' : durationSeconds === 48 ? 'single48' : durationSeconds === 144 ? 'single144' : null;
    const pack = id ? VIDEO_PACKS.find((item) => item.id === id) ?? null : null;
    // Packs are sized for Cinema 2 · 1080p. Only offer one as "this video" when it really covers the job.
    return pack && fundedCredits + displayCredits(pack.credits) >= requiredCredits ? pack : null;
  }, [durationSeconds, fundedCredits, mode, outputQuality, requiredCredits]);

  const modelLabel = useMemo(() => {
    try { return publicModel(modelId ?? (mode === 'photos' || mode === 'icon' ? 'graphic-2' : 'cinema-2')).name.replace(/^AiWebVideo\s+/, ''); } catch { return null; }
  }, [mode, modelId]);
  const isPhotoMode = mode === 'photos' || mode === 'icon';
  const qualityLabel = outputQuality === '4k' ? '4K' : '1080p';
  const setupSummary = [
    isPhotoMode ? '4 photos' : `${durationSeconds}s`,
    qualityLabel,
    modelLabel,
    `${requiredCredits.toLocaleString()} credits`,
  ].filter(Boolean).join(' · ');
  const setupTitle = isPhotoMode
    ? `Generate these ${outputQuality === '4k' ? '4K ' : ''}photos`
    : mode === 'both'
      ? 'Generate this video and photo set'
      : `Generate this ${durationSeconds}s ${outputQuality === '4k' ? '4K ' : ''}video`;

  // The single option that covers exactly what is configured right now, at the lowest price.
  const bestFit = useMemo<BestFit | null>(() => {
    if (shortfall <= 0) return null;
    if (exactVideoPack) {
      return {
        kind: 'direct',
        id: exactVideoPack.id,
        title: setupTitle,
        note: 'One-time purchase · no subscription',
        amountUsd: exactVideoPack.amountUsd,
        originalAmountUsd: exactVideoPack.amountUsd,
        credits: displayCredits(exactVideoPack.credits),
        productName: exactVideoPack.name,
      };
    }
    const pack = CREDIT_PACKS.find((item) => fundedCredits + displayCredits(item.credits) >= requiredCredits);
    const plan = PAYWALL_PLANS.find((item) => fundedCredits + displayCredits(item.credits) >= requiredCredits);
    const packPrice = pack
      ? (activeOffer && activeOffer.eligibleProducts.includes(pack.id) ? discountedPrice(pack.amountUsd, activeOffer.discountPercent) : pack.amountUsd)
      : Infinity;
    if (pack && (!plan || packPrice <= plan.price)) {
      return {
        kind: 'direct',
        id: pack.id,
        title: setupTitle,
        note: `Adds ${displayCredits(pack.credits).toLocaleString()} credits · one-time`,
        amountUsd: packPrice,
        originalAmountUsd: pack.amountUsd,
        credits: displayCredits(pack.credits),
        productName: `${displayCredits(pack.credits).toLocaleString()} production credits`,
      };
    }
    const chosen = plan ?? PAYWALL_PLANS[PAYWALL_PLANS.length - 1];
    return {
      kind: 'plan',
      id: chosen.id,
      title: setupTitle,
      note: `${chosen.name} plan · ${displayCredits(chosen.credits).toLocaleString()} credits every month`,
      amountUsd: chosen.price,
      originalAmountUsd: chosen.price,
      credits: displayCredits(chosen.credits),
      productName: chosen.name,
    };
  }, [activeOffer, exactVideoPack, fundedCredits, requiredCredits, setupTitle, shortfall]);

  function chooseBestFit() {
    if (!bestFit) return;
    if (bestFit.kind === 'plan') {
      chooseSubscription(bestFit.id as 'creator' | 'pro' | 'agency');
      return;
    }
    setDirectCheckout({
      plan: bestFit.id as CheckoutId,
      productName: bestFit.productName,
      amountUsd: bestFit.amountUsd,
      originalAmountUsd: bestFit.originalAmountUsd,
      credits: bestFit.credits,
    });
  }

  function chooseSubscription(planId: 'creator' | 'pro' | 'agency') {
    setError(null);
    const plan = PAYWALL_PLANS.find((item) => item.id === planId);
    if (!plan) return;
    setSubscriptionCheckout({
      plan: plan.id,
      planName: plan.name,
      amountUsd: plan.price,
      credits: displayCredits(plan.credits),
    });
  }

  return createPortal(
    <>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Credits required"
        className={`fixed inset-0 z-50 flex items-end justify-center p-0 transition-all duration-200 sm:items-center sm:p-4 ${directCheckout || subscriptionCheckout ? 'pointer-events-none bg-transparent backdrop-blur-none' : 'bg-[#080410]/30 backdrop-blur-[2px] backdrop-saturate-125'}`}
        onClick={directCheckout || subscriptionCheckout ? undefined : onClose}
      >
        <div className={`w-full max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-[24px] border border-white/10 bg-[#120e22]/96 p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-fade-in-up transition-opacity duration-150 sm:max-h-[90vh] sm:rounded-3xl sm:p-5 ${directCheckout || subscriptionCheckout ? 'invisible opacity-0' : 'visible opacity-100'}`} onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="font-display text-lg font-bold leading-tight text-white">Finish this production</p>
              <p className="mt-1.5 text-xs font-medium text-white/70">{setupSummary}</p>
              {context && <p className="mt-1 text-[11px] leading-4 text-text-dim">{context}</p>}
            </div>
            <button type="button" onClick={onClose} disabled={Boolean(directCheckout || subscriptionCheckout)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-base text-text-muted hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Close">×</button>
          </div>

          {activeOffer && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-mint/25 bg-mint/[.07] px-3 py-2 text-[11px]">
              <span className="font-semibold text-mint">{activeOffer.discountPercent}% off credit packs</span>
              <span className="font-utility text-mint/80">{formatWelcomeCountdown(activeOffer.expiresAt, now)} left</span>
            </div>
          )}

          {bestFit && (
            <button
              type="button"
              onClick={chooseBestFit}
              className="mt-4 flex w-full items-center justify-between gap-3 rounded-2xl border border-violet/40 bg-gradient-to-br from-violet/[.16] via-pink/[.06] to-transparent px-4 py-3.5 text-left shadow-[0_18px_50px_-34px_rgba(139,92,246,.95)] transition hover:border-violet/70 active:scale-[.995]"
            >
              <span className="min-w-0">
                <span className="block text-sm font-bold leading-snug text-white">{bestFit.title}</span>
                <span className="mt-0.5 block text-[11px] leading-4 text-text-muted">{bestFit.note}</span>
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <span className="font-display text-xl font-bold leading-none text-white">{formatUsd(bestFit.amountUsd)}{bestFit.kind === 'plan' && <span className="text-[10px] font-normal text-text-dim">/mo</span>}</span>
                <span className={BUY_PILL}>Buy</span>
              </span>
            </button>
          )}

          <div className="mt-3 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/25 p-1">
            {([['video', 'This video'], ['credits', 'Credits'], ['plans', 'Plans']] as const).map(([id, label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-10 rounded-xl px-2 py-2 text-[11px] font-semibold transition sm:px-3 sm:py-2.5 sm:text-xs ${tab === id ? 'bg-signature text-white shadow-lg' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}>{isPhotoMode && id === 'video' ? 'This set' : label}</button>
            ))}
          </div>

          {tab === 'credits' && (
            <div className="mt-3 space-y-2">
              {CREDIT_PACKS.map((pack) => {
                const discounted = activeOffer && activeOffer.eligibleProducts.includes(pack.id)
                  ? discountedPrice(pack.amountUsd, activeOffer.discountPercent)
                  : pack.amountUsd;
                const packCredits = displayCredits(pack.credits);
                const hasDiscount = discounted < pack.amountUsd;
                const isBest = bestCreditPackId === pack.id;
                return (
                  <button
                    key={pack.id}
                    onClick={() => setDirectCheckout({
                      plan: pack.id,
                      productName: `${packCredits.toLocaleString()} production credits`,
                      amountUsd: discounted,
                      originalAmountUsd: pack.amountUsd,
                      credits: packCredits,
                    })}
                    className={`${ROW} ${isBest ? ROW_BEST : ROW_IDLE}`}
                  >
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold text-white">{packCredits.toLocaleString()} credits {isBest && <span className={BEST_TAG}>Best fit</span>}</span>
                      <span className="mt-0.5 block text-xs text-text-muted">{pack.note}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      {hasDiscount && <span className="text-[10px] leading-none text-text-dim line-through">{formatUsd(pack.amountUsd)}</span>}
                      <span className="font-display text-xl font-bold leading-none text-white">{formatUsd(discounted)}</span>
                      <span className={BUY_PILL}>{hasDiscount && activeOffer ? `${activeOffer.discountPercent}% off · Buy` : 'Buy'}</span>
                    </span>
                  </button>
                );
              })}
              {shortfall > displayCredits(250) && <p className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-[11px] leading-5 text-text-muted">This setup needs {shortfall.toLocaleString()} more credits. Combine top-ups or choose a larger monthly plan.</p>}
            </div>
          )}

          {tab === 'video' && (
            <div className="mt-3 space-y-2">
              {eligibleVideoPacks.length ? eligibleVideoPacks.map((pack, index) => (
                <button
                  key={pack.id}
                  onClick={() => setDirectCheckout({
                    plan: pack.id,
                    productName: pack.name,
                    amountUsd: pack.amountUsd,
                    originalAmountUsd: pack.amountUsd,
                    credits: displayCredits(pack.credits),
                  })}
                  className={`${ROW} ${index === 0 ? ROW_BEST : ROW_IDLE}`}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-sm font-bold text-white">{pack.name} {index === 0 && <span className={BEST_TAG}>Best fit</span>}</span>
                    <span className="mt-0.5 block text-xs text-text-muted">{pack.seconds}s video · {displayCredits(pack.credits).toLocaleString()} credits</span>
                  </span>
                  <span className="flex shrink-0 flex-col items-end gap-1">
                    <span className="font-display text-xl font-bold leading-none text-white">{formatUsd(pack.amountUsd)}</span>
                    <span className={BUY_PILL}>Buy</span>
                  </span>
                </button>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm leading-6 text-text-muted">
                  {isPhotoMode ? 'Photo sets' : outputQuality === '4k' ? '4K videos' : 'This setup'} need{isPhotoMode || outputQuality === '4k' ? '' : 's'} {requiredCredits.toLocaleString()} credits. Use <button type="button" onClick={() => setTab('credits')} className="font-semibold text-violet">Credits</button> or <button type="button" onClick={() => setTab('plans')} className="font-semibold text-violet">Plans</button>.
                </div>
              )}
            </div>
          )}

          {tab === 'plans' && (
            <div className="mt-3 space-y-2">
              {(eligiblePlans.length ? eligiblePlans : PAYWALL_PLANS).map((p, index) => {
                const isBest = eligiblePlans.length > 0 && index === 0;
                return (
                  <button key={p.id} onClick={() => chooseSubscription(p.id)} className={`${ROW} ${isBest ? ROW_BEST : ROW_IDLE}`}>
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-bold text-white">{p.name} {isBest && <span className={BEST_TAG}>Best fit</span>}</span>
                      <span className="mt-0.5 block text-xs text-text-muted">{displayCredits(p.credits).toLocaleString()} credits/mo · {p.pitch}</span>
                    </span>
                    <span className="flex shrink-0 flex-col items-end gap-1">
                      <span className="font-display text-xl font-bold leading-none text-white">${p.price}<span className="text-[10px] font-normal text-text-dim">/mo</span></span>
                      <span className={BUY_PILL}>Buy</span>
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {error && <p className="mt-3 rounded-xl border border-pink/20 bg-pink/5 p-3 text-center text-xs text-pink">{error}</p>}
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
