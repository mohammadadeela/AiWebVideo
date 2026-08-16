import { useState } from 'react';
import { createPortal } from 'react-dom';
import { startCheckout, type CheckoutId, type PaymentProvider } from '@/lib/api-client';
import { estimateRenderCredits } from '@/lib/credits';

const PAYWALL_PLANS = [
  {
    id: 'creator' as const,
    name: 'Creator',
    price: 39,
    credits: 150,
    pitch: '10 narrated quick clips or 2 full campaigns',
    perVideo: 'Studio generation + mastered delivery',
    highlight: false,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 99,
    credits: 400,
    pitch: '28 narrated quick clips or 6 full campaigns',
    perVideo: 'Best for weekly marketing',
    highlight: true,
  },
  {
    id: 'agency' as const,
    name: 'Agency',
    price: 249,
    credits: 1000,
    pitch: '71 narrated quick clips · client work',
    perVideo: 'Priority agency production',
    highlight: false,
  },
];

function packForDuration(durationSeconds: number) {
  if (durationSeconds >= 48) return { id: 'single60' as const, label: '~56s video', price: '$17.99', credits: 62 };
  if (durationSeconds >= 16) return { id: 'single30' as const, label: '~24s video', price: '$7.99', credits: 30 };
  return { id: 'single8' as const, label: '8s video', price: '$2.99', credits: 14 };
}

export function PaywallModal({
  onClose,
  context,
  durationSeconds = 8,
  mode = 'video',
  outputQuality = '1080p',
  skipVoiceover = false,
  currentBalance = 0,
  jobId,
}: {
  onClose: () => void;
  context?: string;
  durationSeconds?: number;
  mode?: string;
  outputQuality?: '1080p' | '4k';
  skipVoiceover?: boolean;
  currentBalance?: number;
  jobId?: string | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [provider, setProvider] = useState<PaymentProvider>('stripe');
  const pack = packForDuration(durationSeconds);
  const requiredCredits = estimateRenderCredits(mode, skipVoiceover, durationSeconds, outputQuality);
  const shortfall = Math.max(0, requiredCredits - currentBalance);
  const topupsNeeded = Math.max(1, Math.ceil(shortfall / 100));
  const oneTimeVideoEligible = mode !== 'photos' && mode !== 'icon' && mode !== 'both' && outputQuality === '1080p' && currentBalance + pack.credits >= requiredCredits;
  const eligiblePlans = PAYWALL_PLANS.filter((plan) => currentBalance + plan.credits >= requiredCredits);

  async function choose(planId: CheckoutId) {
    setError(null);
    setLoading(planId);
    try {
      const { checkoutUrl } = await startCheckout(planId, provider, jobId);
      window.location.href = checkoutUrl;
    } catch {
      setError('Checkout is temporarily unavailable. Your project is saved — please try again shortly.');
    } finally {
      setLoading(null);
    }
  }

  // Portal to document.body — see the comment in AuthModal.tsx. This modal
  // renders from inside animated chat cards, whose transform makes them the
  // containing block for a plain `position: fixed` child otherwise.
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-center">
          <p className="font-display text-lg font-bold text-text-primary">
            {context ?? (currentBalance > 0 ? 'Add credits to finish this production' : 'Add credits to start generating')}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            This production needs {requiredCredits} credits. You have {currentBalance}, so you need {shortfall} more. Your saved work will be ready when you return from checkout.
          </p>
        </div>

        <div className="mb-3 flex items-center justify-center gap-1 rounded-full border border-border bg-panel-alt p-1 text-xs">
          <button
            type="button"
            onClick={() => setProvider('stripe')}
            className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${provider === 'stripe' ? 'bg-signature text-white' : 'text-text-dim hover:text-text-muted'}`}
          >
            Pay with card
          </button>
          <button
            type="button"
            onClick={() => setProvider('paypal')}
            className={`rounded-full px-3 py-1.5 font-semibold transition-colors ${provider === 'paypal' ? 'bg-signature text-white' : 'text-text-dim hover:text-text-muted'}`}
          >
            PayPal
          </button>
        </div>

        <button
          onClick={() => choose('topup100')}
          disabled={loading !== null}
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-mint/50 bg-panel-alt p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-mint"
        >
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-text-primary">
              Recharge 100 credits
              <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-black">One-time</span>
            </p>
            <p className="mt-0.5 text-xs text-text-muted">No subscription. {topupsNeeded > 1 ? `${topupsNeeded} recharges cover this production; buy them one at a time.` : 'One recharge covers this production.'}</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-text-primary">$25</p>
            <p className="text-[10px] text-text-dim">once</p>
          </div>
        </button>

        {oneTimeVideoEligible && (
          <button
            onClick={() => choose(pack.id)}
            disabled={loading !== null}
            className="mb-3 flex w-full items-center justify-between rounded-xl border border-border bg-panel-alt p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-violet/40"
          >
            <div>
              <p className="text-sm font-bold text-text-primary">Just this 1080p video</p>
              <p className="mt-0.5 text-xs text-text-muted">{pack.label} · {pack.credits} credits · no subscription</p>
            </div>
            <div className="text-right">
              <p className="font-display text-xl font-bold text-text-primary">{pack.price}</p>
              <p className="text-[10px] text-text-dim">once</p>
            </div>
          </button>
        )}

        <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-text-dim">or subscribe &amp; save per video</p>

        <div className="space-y-2.5">
          {eligiblePlans.map((p) => (
            <button
              key={p.id}
              onClick={() => choose(p.id)}
              disabled={loading !== null}
              className={`flex w-full items-center justify-between rounded-xl border p-3.5 text-left transition-all hover:-translate-y-0.5 ${
                p.highlight
                  ? 'border-violet/60 bg-signature-soft shadow-[0_0_30px_-10px_rgba(139,92,246,0.4)]'
                  : 'border-border bg-panel-alt hover:border-violet/30'
              }`}
            >
              <div>
                <p className="flex items-center gap-2 text-sm font-bold text-text-primary">
                  {p.name}
                  {p.highlight && (
                    <span className="rounded-full bg-signature px-2 py-0.5 text-[10px] font-semibold text-white">Most popular</span>
                  )}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">{p.pitch}</p>
                <p className="font-utility mt-0.5 text-[11px] text-mint">{p.credits} credits · {p.perVideo}</p>
              </div>
              <div className="text-right">
                <p className="font-display text-xl font-bold text-text-primary">${p.price}</p>
                <p className="text-[10px] text-text-dim">/month</p>
              </div>
            </button>
          ))}
        </div>

        {error && <p className="mt-3 text-center text-xs text-pink">{error}</p>}

        <p className="mt-4 text-center text-[11px] text-text-dim">
          Failed generations are automatically refunded · Subscription credits roll over
        </p>
        <button onClick={onClose} className="mt-2 w-full py-1.5 text-center text-xs text-text-dim hover:text-text-muted">
          Maybe later
        </button>
      </div>
    </div>,
    document.body
  );
}
