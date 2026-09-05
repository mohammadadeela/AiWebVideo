import { useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { startCheckout, type CheckoutId } from '@/lib/api-client';
import { estimateRenderCredits } from '@/lib/credits';

const PAYWALL_PLANS = [
  { id: 'creator' as const, name: 'Creator', price: 39, credits: 150, pitch: 'For regular creators', highlight: false },
  { id: 'pro' as const, name: 'Pro', price: 99, credits: 400, pitch: 'Best for weekly marketing', highlight: true },
  { id: 'agency' as const, name: 'Agency', price: 249, credits: 1000, pitch: 'For client and agency production', highlight: false },
];

const VIDEO_PACKS = [
  { id: 'single8' as const, name: 'Quick Video', label: '8s video pack', price: '$9.99', credits: 38 },
  { id: 'single48' as const, name: 'Full Marketing Video', label: '48s video pack', price: '$52.99', credits: 198 },
  { id: 'single144' as const, name: 'Extended Video', label: '144s video pack', price: '$149.99', credits: 582 },
];

const CREDIT_PACKS = [
  { id: 'topup50' as const, credits: 50, price: '$14.99', note: 'Quick refill' },
  { id: 'topup100' as const, credits: 100, price: '$28.99', note: 'Small production balance' },
  { id: 'topup250' as const, credits: 250, price: '$69.99', note: 'For several productions' },
];

type Tab = 'plans' | 'credits' | 'video';

export function PaywallModal({
  onClose, context, durationSeconds = 8, mode = 'video', outputQuality = '1080p', skipVoiceover = false, currentBalance = 0, reservedCredits = 0, jobId,
}: {
  onClose: () => void; context?: string; durationSeconds?: number; mode?: string; outputQuality?: '1080p' | '4k'; skipVoiceover?: boolean; currentBalance?: number; reservedCredits?: number; jobId?: string | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('credits');
  const requiredCredits = estimateRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality);
  const fundedCredits = currentBalance + reservedCredits;
  const shortfall = Math.max(0, requiredCredits - fundedCredits);
  const eligibleVideoPacks = useMemo(() => mode !== 'photos' && mode !== 'icon' && mode !== 'both' && outputQuality === '1080p'
    ? VIDEO_PACKS.filter((pack) => fundedCredits + pack.credits >= requiredCredits)
    : [], [fundedCredits, mode, outputQuality, requiredCredits]);
  const bestCreditPackId = useMemo(() => CREDIT_PACKS.find((pack) => fundedCredits + pack.credits >= requiredCredits)?.id ?? null, [fundedCredits, requiredCredits]);
  const eligiblePlans = useMemo(() => PAYWALL_PLANS.filter((plan) => fundedCredits + plan.credits >= requiredCredits), [fundedCredits, requiredCredits]);

  async function choose(planId: CheckoutId) {
    setError(null); setLoading(planId);
    try {
      const { checkoutUrl } = await startCheckout(planId, jobId);
      window.location.href = checkoutUrl;
    } catch {
      setError('Checkout is temporarily unavailable. Your project is saved — please try again shortly.');
    } finally { setLoading(null); }
  }

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[92dvh] overflow-y-auto overscroll-contain rounded-t-[24px] border border-white/10 bg-[#120e22] p-4 pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl animate-fade-in-up sm:max-h-[90vh] sm:rounded-3xl sm:p-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="font-display text-lg font-bold text-white">{context ?? 'Choose how to continue'}</p>
            <p className="mt-1 text-xs leading-5 text-text-muted">This production needs {requiredCredits} credits. Your available balance is {currentBalance}{reservedCredits ? ` · ${reservedCredits} already reserved for this production` : ''}{shortfall ? ` · ${shortfall} more needed` : ''}. Website preview/screenshots stay free; paid AI/provider work starts only after the credit gate passes.</p>
          </div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 text-base text-text-muted hover:bg-white/5 hover:text-white" aria-label="Close">×</button>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/20 p-1">
          {([['plans','Plans'],['credits','Buy credits'],['video','Buy video']] as const).map(([id,label]) => (
            <button key={id} type="button" onClick={() => setTab(id)} className={`min-h-10 rounded-xl px-2 py-2 text-[11px] font-semibold transition sm:px-3 sm:py-2.5 sm:text-xs ${tab === id ? 'bg-signature text-white shadow-lg' : 'text-text-muted hover:bg-white/5 hover:text-white'}`}>{label}</button>
          ))}
        </div>

        {tab === 'credits' && (
          <div className="mt-4 space-y-2.5">
            {CREDIT_PACKS.map((pack) => (
              <button key={pack.id} onClick={() => choose(pack.id)} disabled={loading !== null} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition disabled:opacity-50 ${bestCreditPackId === pack.id ? 'border-mint/45 bg-mint/[.07]' : 'border-white/10 bg-white/[.025] hover:border-mint/30'}`}>
                <div>
                  <p className="text-sm font-bold text-white">{pack.credits} credits {bestCreditPackId === pack.id && <span className="ml-2 rounded-full border border-mint/25 bg-mint/10 px-2 py-0.5 text-[9px] font-semibold text-mint">Best fit</span>}</p>
                  <p className="mt-1 text-xs text-text-muted">{pack.note} · one-time · no subscription</p>
                </div>
                <div className="text-right"><p className="font-display text-xl font-bold text-white">{pack.price}</p><p className="text-[10px] font-semibold text-mint">Buy</p></div>
              </button>
            ))}
            {shortfall > 250 && <p className="rounded-xl border border-white/10 bg-white/[.03] p-3 text-[11px] leading-5 text-text-muted">This setup needs {shortfall} additional credits. You can combine top-ups or choose a monthly plan with a larger balance.</p>}
          </div>
        )}

        {tab === 'video' && (
          <div className="mt-4 space-y-2.5">
            {eligibleVideoPacks.length ? eligibleVideoPacks.map((pack, index) => (
              <button key={pack.id} onClick={() => choose(pack.id)} disabled={loading !== null} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition disabled:opacity-50 ${index === 0 ? 'border-violet/45 bg-violet/[.08]' : 'border-white/10 bg-white/[.025] hover:border-violet/30'}`}>
                <div>
                  <p className="text-sm font-bold text-white">{pack.name} {index === 0 && <span className="ml-2 rounded-full border border-violet/25 bg-violet/10 px-2 py-0.5 text-[9px] font-semibold text-violet">Best fit</span>}</p>
                  <p className="mt-1 text-xs text-text-muted">{pack.label} · {pack.credits} credits added · no subscription</p>
                </div>
                <div className="text-right"><p className="font-display text-xl font-bold text-white">{pack.price}</p><p className="text-[10px] font-semibold text-mint">Buy</p></div>
              </button>
            )) : (
              <div className="rounded-2xl border border-white/10 bg-white/[.03] p-4 text-sm leading-6 text-text-muted">
                One-video packs are for supported 1080p setups up to 144 seconds. This setup needs {requiredCredits} credits, so use <button type="button" onClick={() => setTab('credits')} className="font-semibold text-mint">Buy credits</button> or <button type="button" onClick={() => setTab('plans')} className="font-semibold text-violet">Plans</button> to keep these exact settings.
              </div>
            )}
          </div>
        )}

        {tab === 'plans' && (
          <div className="mt-4 space-y-2.5">
            {(eligiblePlans.length ? eligiblePlans : PAYWALL_PLANS).map((p) => (
              <button key={p.id} onClick={() => choose(p.id)} disabled={loading !== null} className={`flex w-full items-center justify-between rounded-2xl border p-4 text-left transition disabled:opacity-50 ${p.highlight ? 'border-violet/55 bg-signature-soft' : 'border-white/10 bg-white/[.025] hover:border-violet/30'}`}>
                <div><p className="text-sm font-bold text-white">{p.name}{p.highlight && <span className="ml-2 rounded-full bg-signature px-2 py-0.5 text-[9px]">Popular</span>}</p><p className="mt-1 text-xs text-text-muted">{p.credits} credits · {p.pitch}</p></div>
                <div className="text-right"><p className="font-display text-xl font-bold text-white">${p.price}<span className="text-[10px] font-normal text-text-dim">/month</span></p><p className="text-[10px] font-semibold text-mint">Buy</p></div>
              </button>
            ))}
          </div>
        )}

        {error && <p className="mt-3 rounded-xl border border-pink/20 bg-pink/5 p-3 text-center text-xs text-pink">{error}</p>}
        <p className="mt-4 text-center text-[10px] text-text-dim">Failed paid generations are automatically refunded · your project remains saved during checkout</p>
      </div>
    </div>, document.body
  );
}
