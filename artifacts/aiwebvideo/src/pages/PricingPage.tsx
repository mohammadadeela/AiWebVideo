import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { PricingTable } from '@/components/landing/PricingTable';
import { useSeo } from '@/lib/useSeo';

export function PricingPage() {
  useSeo({ title: 'AiWebVideo Pricing', description: 'Create once, add credits, or choose a monthly plan.', path: '/pricing' });
  return <><Nav /><main>
    <section className="relative overflow-hidden border-b border-white/[.06]">
      <div className="hero-mesh pointer-events-none absolute inset-0" />
      <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-5 sm:pt-20">
        <div className="text-center">
          <p className="font-utility text-[10px] uppercase tracking-[.22em] text-mint">Production pricing</p>
          <h1 className="mx-auto mt-5 max-w-4xl font-display text-[32px] font-bold leading-tight tracking-[-.05em] text-white sm:text-6xl">
            Know the cost before you generate.
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm text-text-muted sm:text-base">Create once, add credits, or choose a monthly plan.</p>
        </div>
        <div className="mt-10 sm:mt-12"><PricingTable /></div>
      </div>
    </section>
  </main><Footer /></>;
}

export default PricingPage;
