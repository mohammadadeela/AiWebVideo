import { useState } from 'react';
import { startCheckout, type CheckoutId } from '@/lib/api-client';

const PAYWALL_PLANS = [
  {
    id: 'creator' as const,
    name: 'Creator',
    price: 39,
    credits: 150,
    pitch: '18 quick clips or 2 full campaigns',
    perVideo: 'Studio generation + mastered delivery',
    highlight: false,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: 99,
    credits: 400,
    pitch: '50 quick clips or 7 full campaigns',
    perVideo: 'Best for weekly marketing',
    highlight: true,
  },
  {
    id: 'agency' as const,
    name: 'Agency',
    price: 249,
    credits: 1000,
    pitch: '125 quick clips · client work',
    perVideo: 'Priority agency production',
    highlight: false,
  },
];

function packForDuration(durationSeconds: number) {
  if (durationSeconds >= 48) return { id: 'single60' as const, label: '~56s video', price: '$17.99' };
  if (durationSeconds >= 16) return { id: 'single30' as const, label: '~24s video', price: '$7.99' };
  return { id: 'single8' as const, label: '8s video', price: '$2.99' };
}

export function PaywallModal({
  onClose,
  context,
  durationSeconds = 8,
}: {
  onClose: () => void;
  context?: string;
  durationSeconds?: number;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const pack = packForDuration(durationSeconds);

  async function choose(planId: CheckoutId) {
    setError(null);
    setLoading(planId);
    try {
      const { checkoutUrl } = await startCheckout(planId);
      window.location.href = checkoutUrl;
    } catch {
      setError('Checkout is temporarily unavailable. Your project is saved — please try again shortly.');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-panel p-5 shadow-2xl animate-fade-in-up"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 text-center">
          <p className="font-display text-lg font-bold text-text-primary">
            {context ?? 'Unlock your video to watch & download'}
          </p>
          <p className="mt-1 text-xs text-text-muted">
            Your capture and storyboard are ready. Generation begins after checkout.
          </p>
        </div>

        {/* One-time: unlock just this video */}
        <button
          onClick={() => choose(pack.id)}
          disabled={loading !== null}
          className="mb-3 flex w-full items-center justify-between rounded-xl border border-mint/50 bg-panel-alt p-3.5 text-left transition-all hover:-translate-y-0.5 hover:border-mint"
        >
          <div>
            <p className="flex items-center gap-2 text-sm font-bold text-text-primary">
              Just this video
              <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-black">One-time</span>
            </p>
            <p className="mt-0.5 text-xs text-text-muted">Your {pack.label}, no subscription — yours forever</p>
          </div>
          <div className="text-right">
            <p className="font-display text-xl font-bold text-text-primary">{pack.price}</p>
            <p className="text-[10px] text-text-dim">once</p>
          </div>
        </button>

        <p className="mb-2 text-center text-[11px] uppercase tracking-wide text-text-dim">or subscribe &amp; save per video</p>

        <div className="space-y-2.5">
          {PAYWALL_PLANS.map((p) => (
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
          Cancel anytime · Unused credits roll over · Failed scenes auto-refunded
        </p>
        <button onClick={onClose} className="mt-2 w-full py-1.5 text-center text-xs text-text-dim hover:text-text-muted">
          Maybe later
        </button>
      </div>
    </div>
  );
}
