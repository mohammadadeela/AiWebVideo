import { useState } from 'react';
import { Button } from '@/components/ui/app-button';
import { startCheckout, type CheckoutId } from '@/lib/api-client';

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
    notes: ['18 quick clips or 2 full campaigns', 'Professional video with synchronized sound', '1080p and 4K mastered delivery', 'Unused credits roll over'],
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
    notes: ['50 quick clips or 7 full campaigns', 'Custom prompts and premium presets', '4K 60 FPS mastered exports', 'Commercial sound and transitions'],
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
    notes: ['125 quick clips or 17 full campaigns', 'Unlimited client websites', 'Priority generation concurrency', '$25 top-ups whenever you need more'],
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
    note: 'One punchy promo, ready in minutes',
  },
  {
    id: 'single30' as const,
    name: 'Standard Video',
    length: '~30 seconds',
    price: '$7.99',
    note: '3 scenes with pro transitions',
    popular: true,
  },
  {
    id: 'single60' as const,
    name: 'Full Video',
    length: '~60 seconds',
    price: '$17.99',
    note: 'Covers every feature of your site',
  },
];

const CREDIT_COSTS = [
  { item: 'Quick video · 8s · studio quality', credits: 8 },
  { item: 'Standard video · ~24s · pro transitions', credits: 24 },
  { item: 'Full video · ~56s · full campaign', credits: 56 },
  { item: 'SaaS demo video · same per-second pricing', credits: 8 },
  { item: 'Set of 4 marketing photos · up to 4K', credits: 8 },
];

export function PricingTable() {
  const [loadingPlan, setLoadingPlan] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleChoose(planId: string) {
    if (planId === 'free') { window.location.href = '/#generate'; return; }
    setError(null);
    setLoadingPlan(planId);
    try {
      const { checkoutUrl } = await startCheckout(planId as CheckoutId);
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
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PLANS.map((plan, i) => (
          <div
            key={plan.id}
            className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1 animate-fade-in-up ${
              plan.highlight
                ? 'border-violet/60 bg-signature-soft shadow-[0_0_40px_-10px_rgba(139,92,246,0.3)]'
                : 'border-border bg-panel hover:border-violet/30'
            }`}
            style={{ animationDelay: `${i * 80}ms` }}
          >
            {plan.highlight && (
              <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                <span className="inline-flex items-center rounded-full bg-signature px-3 py-0.5 text-[11px] font-semibold text-white">
                  Most popular
                </span>
              </div>
            )}
            <h3 className="font-display text-base font-bold text-text-primary">{plan.name}</h3>
            <p className="mt-0.5 text-xs text-text-muted">{plan.tagline}</p>
            <div className="mt-3">
              <span className="font-display text-3xl font-bold text-text-primary">{plan.price}</span>
              {plan.period && <span className="text-sm text-text-dim">{plan.period}</span>}
              {plan.sub && <span className="ml-1 text-sm text-text-dim">{plan.sub}</span>}
            </div>
            <p className="font-utility mt-1 text-xs text-mint">{plan.credits}</p>
            <ul className="mt-4 flex-1 space-y-2">
              {plan.notes.map((n) => (
                <li key={n} className="flex items-start gap-2 text-sm text-text-muted">
                  <span className="mt-0.5 text-mint shrink-0">✓</span>
                  {n}
                </li>
              ))}
            </ul>
            <Button
              variant={plan.highlight ? 'primary' : 'secondary'}
              size="md"
              className="mt-5 w-full"
              onClick={() => handleChoose(plan.id)}
              disabled={loadingPlan === plan.id}
            >
              {loadingPlan === plan.id ? 'Loading…' : plan.cta}
            </Button>
          </div>
        ))}
      </div>

      {/* One-time packs — no subscription */}
      <div className="mt-12">
        <h3 className="font-display text-xl font-bold text-text-primary">Just need one video?</h3>
        <p className="mt-1 text-sm text-text-muted">Pay once, no subscription. Your video is yours forever.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {ONE_TIME_PACKS.map((pack) => (
            <div
              key={pack.id}
              className={`relative flex flex-col rounded-2xl border p-5 transition-all duration-200 hover:-translate-y-1 ${
                pack.popular
                  ? 'border-mint/50 bg-panel shadow-[0_0_40px_-12px_rgba(52,211,153,0.35)]'
                  : 'border-border bg-panel hover:border-mint/30'
              }`}
            >
              {pack.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="inline-flex items-center rounded-full bg-mint px-3 py-0.5 text-[11px] font-semibold text-black">
                    Best value
                  </span>
                </div>
              )}
              <h4 className="font-display text-base font-bold text-text-primary">{pack.name}</h4>
              <p className="mt-0.5 text-xs text-text-muted">{pack.note}</p>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="font-display text-3xl font-bold text-text-primary">{pack.price}</span>
                <span className="text-xs text-text-dim">one time</span>
              </div>
              <p className="font-utility mt-1 text-xs text-mint">{pack.length} · 1080p master · with sound</p>
              <Button
                variant={pack.popular ? 'primary' : 'secondary'}
                size="md"
                className="mt-5 w-full"
                onClick={() => handleChoose(pack.id)}
                disabled={loadingPlan === pack.id}
              >
                {loadingPlan === pack.id ? 'Loading…' : 'Buy this video'}
              </Button>
            </div>
          ))}
        </div>
      </div>

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
      <p className="mt-3 text-xs text-text-dim">1 video credit = 1 generated second. Top-ups: $25 = 100 credits. Failed scenes are automatically refunded.</p>
    </div>
  );
}
