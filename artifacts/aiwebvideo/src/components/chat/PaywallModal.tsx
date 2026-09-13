import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SecureCheckoutModal } from '@/components/billing/SecureCheckoutModal';
import { startCheckout, type CheckoutId } from '@/lib/api-client';
import { displayCredits, estimateRenderCredits } from '@/lib/credits';
import { discountedPrice, fetchWelcomeGrowthOffer, formatUsd, formatWelcomeCountdown, type WelcomeGrowthOffer } from '@/lib/growth';

const PAYWALL_PLANS = [
  { id: 'creator' as const, name: 'Creator', price: 39, credits: 150, pitch: 'For regular creators', highlight: false },
  { id: 'pro' as const, name: 'Pro', price: 99, credits: 400, pitch: 'Best for weekly marketing', highlight: true },
  { id: 'agency' as const, name: 'Agency', price: 249, credits: 1000, pitch: 'For client and agency production', highlight: false },
];

const VIDEO_PACKS = [
  { id: 'single8' as const, name: 'Quick Video', label: '8s video pack', amountUsd: 9.99, credits: 38 },
  { id: 'single48' as const, name: 'Full Marketing Video', label: '48s video pack', amountUsd: 52.99, credits: 198 },
  { id: 'single144' as const, name: 'Extended Video', label: '144s video pack', amountUsd: 149.99, credits: 582 },
];

const CREDIT_PACKS = [
  { id: 'topup50' as const, credits: 50, amountUsd: 14.99, note: 'Quick refill' },
  { id: 'topup100' as const, credits: 100, amountUsd: 28.99, note: 'Small production balance' },
  { id: 'topup250' as const, credits: 250, amountUsd: 69.99, note: 'For several productions' },
];

type Tab = 'plans' | 'credits' | 'video';
type DirectCheckout = {
  plan: CheckoutId;
  productName: string;
  amountUsd: number;
  credits: number;
};

export function PaywallModal({
  onClose, context, durationSeconds = 8, mode = 'video', outputQuality = '1080p', skipVoiceover = false, currentBalance = 0, reservedCredits = 0, jobId,
}: {
  onClose: () => void; context?: string; durationSeconds?: number; mode?: string; outputQuality?: '1080p' | '4k'; skipVoiceover?: boolean; currentBalance?: number; reservedCredits?: number; jobId?: string | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('credits');
  const [welcomeOffer, setWelcomeOffer] = useState<WelcomeGrowthOffer | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [directCheckout, setDirectCheckout] = useState<DirectCheckout | null>(null);

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
  const requiredCredits = estimateRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality);
  const fundedCredits = currentBalance + reservedCredits;
  const shortfall = Math.max(0, requiredCredits - fundedCredits);
  const eligibleVideoPacks = useMemo(() => mode !== 'photos' && mode !== 'icon' && mode !== 'both' && outputQuality === '1080p'
    ? VIDEO_PACKS.filter((pack) => fundedCredits + displayCredits(pack.credits) >= requiredCredits)
    : [], [fundedCredits, mode, outputQuality, requiredCredits]);
  const bestCreditPackId = useMemo(() => CREDIT_PACKS.find((pack) => fundedCredits + displayCredits(pack.credits) >= requiredCredits)?.id ?? null, [fundedCredits, requiredCredits]);
  const eligiblePlans = useMemo(() => PAYWALL_PLANS.filter((plan) => fundedCredits + displayCredits(plan.credits) >= requiredCredits), [fundedCredits, requiredCredits]);

  async function chooseSubscription(planId: CheckoutId) {
    setError(null); setLoading(planId);
    try {
      const { checkoutUrl } = await startCheckout(planId, jobId);
      window.location.href = checkoutUrl;
    } catch {
      setError('Checkout is temporarily unavailable. Your project is saved — please try again shortly.');
    } finally { setLoading(null); }
  }

  return createPortal(
    <>
      <div role="dialog" aria-modal="true" aria-label="Credits required" className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={directCheckout ? undefined : onClose}>
        <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-[24px] border border-white/10 bg-[#120e22] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-fade-in-up sm:max-h-[90vh] sm:rounded-3xl sm:p-5" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="font-display text-lg font-bold text-white">{context ?? 'Choose how to continue'}</p>
              <p className="mt-1 text-xs leading-5 text-text-muted">This production needs {requiredCredits.toLocaleString()} credits. Your available balance is {currentBalance.toLocaleString()}{reservedCredits ? ` · ${reservedCredits.toLocaleString()} already reserved for this production` : ''}{shortfall ? ` · ${shortfall.toLocaleString()} more needed` : ''}. Website preview/screenshots stay free; paid AI/provider work starts only after the credit gate passes.</p>
            </div>
            <button type="button" onClick={onClose} disabled={Boolean(directCheckout)} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-base text-text-muted hover:bg-white/5 hover:text-white disabled:opacity-40" aria-label="Close">×</button>
          </div>

          {activeOffer && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-mint/25 bg-mint/[.07] px-3 py-2 text-[11px]">
              <span className="font-semibold text-mint">{activeOffer.discountPercent}% off credit packs</span>
              <span className="font-utility text-mint/80">{formatWelcomeCountdown(activeOffer.expiresAt, now)} left</span>
            </div>
          )}

          <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
            {([['plans','Plans'],['credits','Buy credits'],['video','Buy video']] as const).map(([id,label]) => (
              <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-10 rounded-xl px-2 py-2 text-[11px] font-semibold transition sm:px-3 sm:py-2.5 sm:text-xs ${tab === id ? 'bg-signature text-white shadow-lg' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}>{label}</button>
            ))}
          </div>

          {tab === 'credits' && (
            <div className="mt-4 space-y-2.5">
              {CREDIT_PACKS.map((pack) => {
                const discounted = activeOffer && activeOffer.eligibleProducts.includes(pack.id)
                  ? discountedPrice(pack.amountUsd, activeOffer.discountPercent)
                  : pack.amountUsd;
                const packCredits = displayCredits(pack.credits);
                const hasDiscount = discounted < pack.amountUsd;
                return (
                  <button
                    key={pack.id}
                    onClick={() => setDirectCheckout({
                      plan: pack.id,
                      productName: `${packCredits.toLocaleString()} production credits`,
                      amountUsd: discounted,
                      credits: packCredits,
                    })}
                    disabled={loading !== null}
                    className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition disabled:opacity-50 ${bestCreditPackId === pack.id ? 'border-mint/45 bg-mint/[.07]' : 'border-white/10 bg-white/[.025] hover:border-mint/30'}`}
                  >
                    <div>
                      <p className="text-sm font-bold text-white">{packCredits.toLocaleString()} credits {bestCreditPackId === pack.id && <span className="ml-2 rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 text-[9px] font-semibold text-mint">Best fit</span>}</p>
                      <p className="mt-1 text-xs text-text-muted">{pack.note} · one-time · card or PayPal</p>
                    </div>
                    <div className="text-right">
                      {hasDiscount && <p className="text-[10px] text-text-dim line-through">{formatUsd(pack.amountUsd)}</p>}
                      <p className="font-display text-xl font-bold text-white">{formatUsd(discounted)}</p>
                      <p className={`text-[10px] font-semibold ${hasDiscount ? 'text-mint' : 'text-text-dim'}`}>{hasDiscount && activeOffer ? `${activeOffer.discountPercent}% OFF` : 'Pay securely'}</p>
                    </div>
                  </button>
                );
              })}
              {shortfall > displayCredits(250) && <p className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-[11px] leading-5 text-text-muted">This setup needs {shortfall.toLocaleString()} additional credits. You can combine top-ups or choose a monthly plan with a larger balance.</p>}
            </div>
          )}

          {tab === 'video' && (
            <div className="mt-4 space-y-2.5">
              {eligibleVideoPacks.length ? eligibleVideoPacks.map((pack, index) => (
                <button
                  key={pack.id}
                  onClick={() => setDirectCheckout({
                    plan: pack.id,
                    productName: pack.name,
                    amountUsd: pack.amountUsd,
                    credits: displayCredits(pack.credits),
                  })}
                  disabled={loading !== null}
                  className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition disabled:opacity-50 ${index === 0 ? 'border-violet/45 bg-violet/[.08]' : 'border-white/10 bg-white/[.025] hover:border-violet/30'}`}
                >
                  <div>
                    <p className="text-sm font-bold text-white">{pack.name} {index === 0 && <span className="ml-2 rounded-full border border-violet/25 bg-violet/10 px-2 py-0.5 text-[9px] font-semibold text-violet">Best fit</span>}</p>
                    <p className="mt-1 text-xs text-text-muted">{pack.label} · {displayCredits(pack.credits).toLocaleString()} credits added · no subscription</p>
                  </div>
                  <div className="text-right"><p className="font-display text-xl font-bold text-white">{formatUsd(pack.amountUsd)}</p><p className="text-[10px] font-semibold text-mint">Pay securely</p></div>
                </button>
              )) : (
                <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm leading-6 text-text-muted">
                  One-video packs are for supported 1080p setups up to 144 seconds. This setup needs {requiredCredits.toLocaleString()} credits, so use <button type="button" onClick={() => setTab('credits')} className="font-semibold text-mint">Buy credits</button> or <button type="button" onClick={() => setTab('plans')} className="font-semibold text-violet">Plans</button> to keep these exact settings.
                </div>
              )}
            </div>
          )}

          {tab === 'plans' && (
            <div className="mt-4 space-y-2.5">
              {(eligiblePlans.length ? eligiblePlans : PAYWALL_PLANS).map((p) => (
                <button key={p.id} onClick={() => chooseSubscription(p.id)} disabled={loading !== null} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition disabled:opacity-50 ${p.highlight ? 'border-violet/55 bg-signature-soft' : 'border-white/10 bg-white/[.025] hover:border-violet/30'}`}>
                  <div><p className="text-sm font-bold text-white">{p.name}{p.highlight && <span className="ml-2 rounded-full bg-signature px-2 py-0.5 text-[9px]">Popular</span>}</p><p className="mt-1 text-xs text-text-muted">{displayCredits(p.credits).toLocaleString()} credits · {p.pitch}</p></div>
                  <div className="text-right"><p className="font-display text-xl font-bold text-white">${p.price}<span className="text-[10px] font-normal text-text-dim">/month</span></p><p className="text-[10px] font-semibold text-mint">Subscribe</p></div>
                </button>
              ))}
            </div>
          )}

          {error && <p className="mt-3 rounded-xl border border-pink/20 bg-pink/5 p-3 text-center text-xs text-pink">{error}</p>}
          <p className="mt-4 text-center text-[10px] text-text-dim">One-time purchases can be paid by card without leaving AiWebVideo · failed paid generations are automatically refunded · your project remains saved during checkout</p>
        </div>
      </div>

      {directCheckout && (
        <SecureCheckoutModal
          plan={directCheckout.plan}
          productName={directCheckout.productName}
          amountUsd={directCheckout.amountUsd}
          credits={directCheckout.credits}
          jobId={jobId}
          onClose={() => setDirectCheckout(null)}
        />
      )}
    </>,
    document.body,
  );
}
