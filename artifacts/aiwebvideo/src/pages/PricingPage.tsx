import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { PricingTable } from '@/components/landing/PricingTable';
import { useSeo } from '@/lib/useSeo';

export function PricingPage() {
  useSeo({
    title: 'Pricing',
    description: 'Credit-based pricing for AI website-to-video production, with one-time credit top-ups, monthly plans, automatic refunds, and clear 1080p and 4K usage.',
    path: '/pricing',
  });
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold text-text-primary">Plans run on credits</h1>
          <p className="mt-2 max-w-lg text-sm text-text-muted">
            At 1080p, one credit equals one generated video second. Native 4K uses three credits per second. Your free preview includes capture and storyboard; buy credits once or subscribe when you are ready to generate.
          </p>
        </div>
        <PricingTable />
      </main>
      <Footer />
    </>
  );
}
