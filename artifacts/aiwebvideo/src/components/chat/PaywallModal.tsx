import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { SecureCheckoutModal } from '@/components/billing/SecureCheckoutModal';
import { SubscriptionCheckoutModal } from '@/components/billing/SubscriptionCheckoutModal';
import { fetchBillingCatalog } from '@/lib/api-client';
import { displayCredits, estimateInternalRenderCredits } from '@/lib/credits';
import { formatUsd } from '@/lib/growth';
import { recommendCreditOption } from '@/lib/creditRecommendation';

type Catalog = Awaited<ReturnType<typeof fetchBillingCatalog>>;
type Product = Catalog[number];

export function PaywallModal({ onClose, durationSeconds = 8, mode = 'video', outputQuality = '1080p',
  skipVoiceover = false, currentBalance = 0, reservedCredits = 0, jobId, modelId, feature = 'website', audioMode = 'native_audio', requiredCredits }: {
  onClose: () => void; context?: string; durationSeconds?: number; mode?: string;
  outputQuality?: '1080p' | '4k'; skipVoiceover?: boolean; currentBalance?: number;
  reservedCredits?: number; jobId?: string | null; modelId?: string; feature?: string; audioMode?: string; requiredCredits?: number;
}) {
  const [catalog,setCatalog] = useState<Catalog>([]);
  const [error,setError] = useState('');
  const [tab,setTab] = useState<'credits' | 'plans'>('credits');
  const [direct,setDirect] = useState<Product | null>(null);
  const [subscription,setSubscription] = useState<Product | null>(null);
  useEffect(() => {
    let active = true;
    fetchBillingCatalog().then((items) => { if (active) setCatalog(items); })
      .catch(() => { if (active) setError('Purchase options could not be loaded.'); });
    return () => { active = false; };
  },[]);
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape' && !direct && !subscription) onClose(); };
    document.addEventListener('keydown',close);
    return () => document.removeEventListener('keydown',close);
  },[onClose,direct,subscription]);

  const required = requiredCredits ?? estimateInternalRenderCredits(mode,skipVoiceover,durationSeconds,outputQuality,modelId);
  const balance = currentBalance + reservedCredits;
  const shortfall = Math.max(0,required - balance);
  const scope = catalog.filter((item) => item.type === 'create_once' && item.scope?.feature === feature
    && item.scope.modelId === modelId && item.scope.durationSeconds === (mode === 'photos' ? undefined : durationSeconds)
    && item.scope.quality === outputQuality && item.scope.audioMode === (mode === 'photos' ? 'silent' : audioMode)
    && item.credits >= required);
  const flexible = catalog.filter((item) => item.type !== 'create_once');
  const recommendation = useMemo(() => {
    const flexibleBest = recommendCreditOption(flexible,required,balance);
    return [...scope,...(flexibleBest ? [flexibleBest] : [])].sort((a,b) => a.amountUsd-b.amountUsd)[0] ?? null;
  },[catalog,required,balance,feature,modelId,durationSeconds,outputQuality,mode,skipVoiceover]);

  function buy(item: Product) {
    if (item.mode === 'subscription') setSubscription(item);
    else setDirect(item);
  }
  return createPortal(<>
    <div role="dialog" aria-modal="true" aria-label="Create this production"
      onClick={direct || subscription ? undefined : onClose}
      className={`fixed inset-0 z-[100] flex items-end justify-center bg-black/55 p-0 sm:items-center sm:p-4
        ${direct || subscription ? 'pointer-events-none opacity-0' : ''}`}>
      <div onClick={(event) => event.stopPropagation()}
        className="max-h-[min(90dvh,42rem)] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-2xl border border-white/10 bg-[#120e22] p-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-2xl sm:rounded-2xl sm:p-5">
        <div className="flex items-start justify-between gap-4">
          <div><h2 className="font-display text-base font-semibold text-white">Add {displayCredits(shortfall)} credits to continue</h2>
            <p className="mt-1 text-xs text-text-muted">{modelId?.replace('cinema-','Cinema ').replace('graphic-','Graphic ').replace('space-','Space ') ?? 'Generation'}
              {mode === 'photos' ? ' · 4 images' : ` · ${durationSeconds}s`} · {outputQuality === '4k' ? '4K' : '1080p'}</p>
            <p className="mt-2 text-xs text-mint">{displayCredits(required)} needed · {displayCredits(balance)} available</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-white/10">×</button>
        </div>
        {recommendation && shortfall > 0 && <button type="button" onClick={() => buy(recommendation)}
          className="mt-5 flex min-h-16 w-full items-center justify-between rounded-xl border border-violet/50 bg-violet/10 px-4 text-left">
          <span><span className="block text-sm font-semibold text-white">{recommendation.type === 'create_once' ? 'Create this' : recommendation.name}</span>
            <span className="mt-0.5 block text-xs text-text-muted">{recommendation.type === 'create_once' ? recommendation.name : `${recommendation.displayCredits} credits`}</span></span>
          <span className="font-display text-lg font-semibold text-white">{formatUsd(recommendation.amountUsd)}</span>
        </button>}
        <div className="mt-4 flex gap-4 border-b border-white/10 text-sm">
          <button type="button" onClick={() => setTab('credits')} className={`pb-2 ${tab === 'credits' ? 'border-b border-mint text-white' : 'text-text-muted'}`}>Add credits</button>
          <button type="button" onClick={() => setTab('plans')} className={`pb-2 ${tab === 'plans' ? 'border-b border-mint text-white' : 'text-text-muted'}`}>Plans</button>
        </div>
        <div className="mt-3 space-y-1">
          {flexible.filter((item) => item.type === (tab === 'credits' ? 'credits' : 'plan') && item.credits >= shortfall)
            .map((item) => <button type="button" key={item.id} onClick={() => buy(item)}
              className="flex min-h-11 w-full items-center justify-between rounded-lg px-2 text-left text-sm text-text-muted hover:bg-white/5 hover:text-white">
              <span>{item.name} · {item.displayCredits.toLocaleString()} credits</span><span>{formatUsd(item.amountUsd)}{tab === 'plans' ? '/mo' : ''}</span>
            </button>)}
        </div>
        {error && <p role="alert" className="mt-3 text-sm text-pink">{error}</p>}
      </div>
    </div>
    {direct && <SecureCheckoutModal plan={direct.id} productName={direct.name} amountUsd={direct.amountUsd}
      credits={direct.type === 'create_once' ? 0 : direct.displayCredits} jobId={jobId}
      onClose={() => setDirect(null)} />}
    {subscription && <SubscriptionCheckoutModal plan={subscription.id as 'creator' | 'pro' | 'agency'}
      planName={subscription.name} amountUsd={subscription.amountUsd} credits={subscription.displayCredits}
      jobId={jobId} onClose={() => setSubscription(null)} />}
  </>,document.body);
}
