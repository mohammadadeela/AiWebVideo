import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { PricingTable } from '@/components/landing/PricingTable';
import { useSeo } from '@/lib/useSeo';

export function PricingPage() {
  useSeo({ title: 'AiWebVideo Pricing', description: 'Create once, add credits, or choose a monthly plan.', path: '/pricing' });
  return <><Nav /><main className="mx-auto max-w-7xl px-4 pb-20 pt-12 sm:px-5 sm:pt-16">
    <h1 className="font-display text-3xl font-semibold tracking-tight text-white sm:text-5xl">Make what you need.</h1>
    <p className="mb-12 mt-3 text-base text-text-muted">Pay for a creation, keep flexible credits, or choose a plan.</p>
    <PricingTable />
  </main><Footer /></>;
}

export default PricingPage;
