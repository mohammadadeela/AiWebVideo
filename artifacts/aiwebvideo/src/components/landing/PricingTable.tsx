import { useState } from 'react';
import { Button } from '@/components/ui/app-button';
import { startCheckout, type CheckoutId, type PaymentProvider } from '@/lib/api-client';

function PaymentButtons({ cta, primary, loading, onChoose }: { cta: string; primary?: boolean; loading: boolean; onChoose: (provider: PaymentProvider) => void }) {
  return (
    <div className="mt-3 sm:mt-5 grid grid-cols-2 gap-1.5 sm:gap-2">
      <Button
        variant={primary ? 'primary' : 'secondary'}
        size="md"
        className="w-full !text-xs sm:!text-sm !px-2"
        onClick={() => onChoose('stripe')}
        disabled={loading}
      >
        {loading ? '…' : cta}
      </Button>
      <Button
        variant="secondary"
        size="md"
        className="w-full !text-xs sm:!text-sm !px-2"
        onClick={() => onChoose('paypal')}
        disabled={loading}
      >
        {loading ? '…' : 'PayPal'}
      </Button>
    </div>
  );
}

const PLANS = [
  {
    id: 'free' as const,
    name: 'Free',
    price: '$0',
    period: '',
    sub: 'forever',
    credits: 'No generation credits',
    tagline: 'See your real production plan.',
    notes: ['Multi-page site capture', 'Smooth-scroll recording preview', 'AI storyboard from your site', 'No video is generated until purchase'],
    cta: 'Build Free Preview',
    highlight: false,
  },
  {
    id: 'creator' as const,
    name: 'Creator',
    price: '$39',
    period: '/mo',
    sub: '',
    credits: '150 credits / mo',
    tagline: 'For founders and growing shops.',
    notes: ['10 narrated quick clips or 2 full campaigns', 'Professional video with synchronized sound', '1080p and 4K mastered delivery', 'Unused credits roll over'],
    cta: 'Get Creator',
    highlight: false,
  },
  {
    id: 'pro' as const,
    name: 'Pro',
    price: '$99',
    period: '/mo',
    sub: '',
    credits: '400 credits / mo',
    tagline: 'For marketers shipping weekly.',
    notes: ['28 narrated quick clips or 6 full campaigns', 'Custom prompts and premium presets', '4K 60 FPS mastered exports', 'AI-generated motion and cinematic sound'],
    cta: 'Get Pro',
    highlight: true,
  },
  {
    id: 'agency' as const,
    name: 'Agency',
    price: '$249',
    period: '/mo',
    sub: '',
    credits: '1,000 credits / mo',
    tagline: 'Client work, at scale.',
    notes: ['71 narrated quick clips or 16 full campaigns', 'Unlimited client websites', 'Priority generation concurrency', '$25 top-ups whenever you need more'],
    cta: 'Get Agency',
    highlight: false,
  },
];

const ONE_TIME_PACKS = [
  {
    id: 'single8' as const,
    name: 'Quick Video',
    length: '8 seconds',
    price: '$2.99',
    credits: 14,
    note: 'One punchy promo, ready in minutes',
  },
  {
    id: 'single30' as const,
    name: 'Standard Video',
    length: '~30 seconds',
    price: '$7.99',
    credits: 30,
    note: '3 distinct AI-generated video scenes',
    popular: true,
  },
  {
    id: 'single60' as const,
    name: 'Full Video',
    length: '~60 seconds',
    price: '$17.99',
    credits: 62,
    note: 'A richer, varied AI-generated campaign',
  },
];

const CREDIT_COSTS = [
  { item: 'Quick video · 8s · 1080p', credits: '8 silent · 14 with narration' },
  { item: 'Standard video · ~24s · 1080p', credits: '24 silent · 30 with narration' },
  { item: 'Full video · ~56s · 1080p', credits: '56 silent · 62 with narration' },
  { item: 'Custom video · 8s to 4 min', credits: '8-second steps · exact quote before generation' },
  { item: '4K AI video', credits: '3 per generated second · narration +6' },
  { item: 'Set of 4 marketing photos · up to 4K', credits: 8 },
];

export function PricingTable() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(planId: string, provider: PaymentProvider) {
    if (planId === 'free') { window.location.href = '/#generate'; return; }
    setError(null);
    setLoadingPlan(planId);
    try {
      const { checkoutUrl } = await startCheckout(planId as CheckoutId, provider);
      window.location.href = checkoutUrl;
    } catch {
      setError('Checkout is temporarily unavailable. Sign in first, then try again shortly.');
    } finally {
      setLoadingPlan(null);
    }
  }

  return (
    <div>
      {error && <p className="mb-4 text-sm text-pink">{error}</p>}
      <div id="plans" className="scroll-mt-24 grid grid-cols-2 gap-2.5 sm:gap-4 lg:grid-cols-4">
        {PLANS.map((plan, i) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-3 sm:p-5 transition-all duration-200 hover:-translate-y-1 animate-fade-in-up ${
              plan.highlight
                ? 'border-violet/60 bg-signature-soft shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]'
                : 'border-border bg-panel hover:border-violet/30'
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
            <h3 className="font-display text-sm sm:text-base font-bold text-text-primary">{plan.name}</h3>
            <p className="mt-0.5 text-[10px] sm:text-xs text-text-muted line-clamp-1 sm:line-clamp-none">{plan.tagline}</p>
            <div className="mt-2 sm:mt-3">
              <span className="font-display text-xl sm:text-3xl font-bold text-text-primary">{plan.price}</span>
              {plan.period && <span className="text-xs sm:text-sm text-text-dim">{plan.period}</span>}
              {plan.sub && <span className="ml-1 text-xs sm:text-sm text-text-dim">{plan.sub}</span>}
            </div>
            <p className="font-utility mt-1 text-[10px] sm:text-xs text-mint">{plan.credits}</p>
            <ul className="mt-2 sm:mt-4 flex-1 space-y-1 sm:space-y-2">
              {plan.notes.map((n) => (
                <li key={n} className="flex items-start gap-1.5 sm:gap-2 text-[11px] sm:text-sm text-text-muted">
                  <span className="mt-0.5 text-mint shrink-0">✓</span>
                  {n}
                </li>
              ))}
            </ul>
            {plan.id === 'free' ? (
              <Button
                variant={plan.highlight ? 'primary' : 'secondary'}
                size="md"
                className="mt-3 sm:mt-5 w-full !text-xs sm:!text-sm"
                onClick={() => handleChoose(plan.id, 'stripe')}
                disabled={loadingPlan === plan.id}
              >
                {loadingPlan === plan.id ? 'Loading…' : plan.cta}
              </Button>
            ) : (
              <PaymentButtons
                cta={plan.cta}
                primary={plan.highlight}
                loading={loadingPlan === plan.id}
                onChoose={(provider) => handleChoose(plan.id, provider)}
              />
            )}
          </div>
        ))}
      </div>

      {/* One-time packs — no subscription */}
      <div className="mt-8 sm:mt-12">
        <h3 className="font-display text-lg sm:text-xl font-bold text-text-primary">Just need one video?</h3>
        <p className="mt-1 text-xs sm:text-sm text-text-muted">Pay once, no subscription. Your video is yours forever.</p>
        <div className="mt-4 grid grid-cols-2 gap-2.5 sm:gap-4 sm:grid-cols-3">
          {ONE_TIME_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative flex flex-col rounded-2xl border p-3 sm:p-5 transition-all duration-200 hover:-translate-y-1 ${
                pack.popular
                  ? 'border-mint/50 bg-panel shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)]'
                  : 'border-border bg-panel hover:border-mint/30'
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-mint px-2 sm:px-3 py-0.5 text-[9px] sm:text-[11px] font-semibold text-black whitespace-nowrap">
                    Best value
                  </span>
                </div>
              )}
              <h4 className="font-display text-sm sm:text-base font-bold text-text-primary">{pack.name}</h4>
              <p className="mt-0.5 text-[10px] sm:text-xs text-text-muted line-clamp-2 sm:line-clamp-none">{pack.note}</p>
              <div className="mt-2 sm:mt-3 flex items-baseline gap-1 sm:gap-2">
                <span className="font-display text-xl sm:text-3xl font-bold text-text-primary">{pack.price}</span>
                <span className="text-[10px] sm:text-xs text-text-dim">one time</span>
              </div>
              <p className="font-utility mt-1 text-[10px] sm:text-xs text-mint">{pack.credits} credits · {pack.length} · 1080p · sound + narration</p>
              <PaymentButtons
                cta="Buy this video"
                primary={pack.popular}
                loading={loadingPlan === pack.id}
                onChoose={(provider) => handleChoose(pack.id, provider)}
              />
            </div>
          ))}
        </div>
      </div>

      <section id="buy-credits" className="mt-10 scroll-mt-24 rounded-2xl border border-violet/40 bg-signature-soft p-5 sm:flex sm:items-center sm:justify-between sm:gap-6 sm:p-6">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[.16em] text-violet">No subscription</p>
          <h3 className="mt-1 font-display text-xl font-bold text-text-primary">Recharge 100 credits</h3>
          <p className="mt-2 max-w-xl text-sm text-text-muted">Pay once and add 100 production credits to your account. Credits stay available until you use them, and buying them does not change your subscription plan.</p>
        </div>
        <div className="mt-4 min-w-56 sm:mt-0">
          <p className="text-center font-display text-3xl font-bold text-text-primary">$25</p>
          <PaymentButtons cta="Buy credits" primary loading={loadingPlan === 'topup100'} onChoose={(provider) => handleChoose('topup100', provider)} />
        </div>
      </section>

      {/* Credit cost table */}
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
              <tr key={row.item} className="border-b border-border last:border-0 hover:bg-panel-alt/50 transition-colors">
                <td className="px-4 py-2.5 text-text-primary">{row.item}</td>
                <td className="font-utility px-4 py-2.5 text-mint">{row.credits}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-text-dim">At 1080p, one credit pays for one generated video second. Native 4K uses 3 credits per generated second, and optional AI narration adds 6 credits per video. Choose any length from 8 seconds to 4 minutes in 8-second production steps; the exact total and any credit shortfall appear before generation. Failed generations are automatically refunded.</p>
    </div>
  );
}
