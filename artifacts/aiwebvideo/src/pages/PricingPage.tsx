import { Nav } from '@/components/landing/Nav';
import { Footer } from '@/components/landing/Footer';
import { PricingTable } from '@/components/landing/PricingTable';

export function PricingPage() {
  return (
    <>
      <Nav />
      <main className="mx-auto max-w-6xl px-5 py-16">
        <div className="mb-10">
          <h1 className="font-display text-3xl font-bold text-text-primary">Plans run on credits</h1>
          <p className="mt-2 max-w-lg text-sm text-text-muted">
            One credit equals one generated video second. Your free preview includes capture and storyboard; paid generation starts only after checkout.
          </p>
        </div>
        <PricingTable />
      </main>
      <Footer />
    </>
  );
}
