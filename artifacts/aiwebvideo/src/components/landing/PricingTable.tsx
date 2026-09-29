import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { SecureCheckoutModal } from '@/components/billing/SecureCheckoutModal';
import { SubscriptionCheckoutModal } from '@/components/billing/SubscriptionCheckoutModal';
import { fetchBillingCatalog, type CheckoutId } from '@/lib/api-client';
import { formatUsd } from '@/lib/growth';

type Catalog = Awaited<ReturnType<typeof fetchBillingCatalog>>;
const FEATURES = [
  ['website','Website Video'],['video','AI Video'],['product-photo','Product Photos'],
  ['product-video','Product Video'],['interior','Interior Design'],
] as const;

export function PricingTable() {
  const [catalog, setCatalog] = useState<Catalog>([]);
  const [error, setError] = useState('');
  const [feature, setFeature] = useState<string>('website');
  const [direct, setDirect] = useState<Catalog[number] | null>(null);
  const [subscription, setSubscription] = useState<Catalog[number] | null>(null);
  useEffect(() => {
    let active = true;
    fetchBillingCatalog().then((items) => { if (active) setCatalog(items); })
      .catch(() => { if (active) setError('Pricing is unavailable. Please try again.'); });
    return () => { active = false; };
  }, []);

  const oneTime = useMemo(() => catalog.filter((item) => item.type === 'create_once' && item.scope?.feature === feature), [catalog,feature]);
  const creditPacks = catalog.filter((item) => item.type === 'credits');
  const plans = catalog.filter((item) => item.type === 'plan');

  return (
    <div className="space-y-14">
      <section id="create-once" className="scroll-mt-24">
        <h2 className="font-display text-2xl font-semibold text-white">Create once</h2>
        <p className="mt-1 text-sm text-text-muted">Choose what you want to make. No plan required.</p>
        <div className="mt-5 flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Creation type">
          {FEATURES.map(([id,label]) => (
            <button type="button" role="tab" aria-selected={feature === id} key={id} onClick={() => setFeature(id)}
              className={`shrink-0 rounded-full border px-4 py-2 text-sm transition ${feature === id
                ? 'border-violet/60 bg-violet/15 text-white' : 'border-white/10 text-text-muted hover:text-white'}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="mt-4 grid gap-3 sm:grid-cols-3">
          {oneTime.map((item) => (
            <div key={item.id} className="flex flex-col rounded-2xl border border-white/10 bg-panel p-5">
              <h3 className="text-base font-semibold text-white">{item.scope?.durationSeconds
                ? `${item.scope.durationSeconds} seconds` : `${item.displayCredits / 5} images`}</h3>
              <p className="mt-1 text-sm text-text-muted">{item.scope?.modelId.replace('cinema-', 'Cinema ').replace('graphic-', 'Graphic ').replace('space-', 'Space ')} · 1080p</p>
              <p className="mt-5 font-display text-2xl font-bold text-white">{formatUsd(item.amountUsd)}</p>
              <button type="button" onClick={() => setDirect(item)}
                className="mt-5 min-h-10 rounded-xl bg-signature px-4 text-sm font-semibold text-white hover:opacity-90">Create this</button>
            </div>
          ))}
        </div>
      </section>

      <section id="buy-credits" className="scroll-mt-24">
        <h2 className="font-display text-2xl font-semibold text-white">Add credits</h2>
        <p className="mt-1 text-sm text-text-muted">Use them for any creation. Credits do not expire.</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {creditPacks.map((item) => (
            <div key={item.id} className="flex flex-col rounded-2xl border border-white/10 bg-panel p-4">
              <h3 className="text-base font-semibold text-white">{item.displayCredits.toLocaleString()} credits</h3>
              <p className="mt-3 font-display text-xl font-bold text-white">{formatUsd(item.amountUsd)}</p>
              <button type="button" onClick={() => setDirect(item)}
                className="mt-4 min-h-10 rounded-xl border border-white/15 text-sm font-semibold text-white hover:bg-white/5">Buy credits</button>
            </div>
          ))}
        </div>
      </section>

      <section id="plans" className="scroll-mt-24">
        <h2 className="font-display text-2xl font-semibold text-white">Monthly plans</h2>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          {plans.map((item) => (
            <div key={item.id} className="flex flex-col rounded-2xl border border-white/10 bg-panel p-5">
              <h3 className="text-lg font-semibold text-white">{item.name}</h3>
              <p className="mt-3 font-display text-2xl font-bold text-white">{formatUsd(item.amountUsd)}<span className="text-sm font-normal text-text-muted"> / month</span></p>
              <p className="mt-2 text-sm text-text-muted">{item.displayCredits.toLocaleString()} credits monthly</p>
              <p className="mt-1 text-sm text-text-muted">Unused credits roll over · Cancel anytime</p>
              <button type="button" onClick={() => setSubscription(item)}
                className="mt-5 min-h-10 rounded-xl border border-white/15 text-sm font-semibold text-white hover:bg-white/5">Choose {item.name}</button>
            </div>
          ))}
        </div>
      </section>

      <p className="text-sm text-text-muted">Already have credits? <Link href="/#generate" className="text-mint hover:underline">Open the creator</Link></p>
      {error && <p role="alert" className="text-sm text-pink">{error}</p>}
      {direct && <SecureCheckoutModal plan={direct.id as CheckoutId} productName={direct.name}
        amountUsd={direct.amountUsd} originalAmountUsd={direct.amountUsd}
        credits={direct.type === 'create_once' ? 0 : direct.displayCredits} onClose={() => setDirect(null)} />}
      {subscription && <SubscriptionCheckoutModal plan={subscription.id as 'creator' | 'pro' | 'agency'}
        planName={subscription.name} amountUsd={subscription.amountUsd}
        credits={subscription.displayCredits} onClose={() => setSubscription(null)} />}
    </div>
  );
}
