import { useEffect, useState } from 'react';
import { Nav } from '@/components/landing/Nav';
import { Hero } from '@/components/landing/Hero';
import { FeatureStrip } from '@/components/landing/FeatureStrip';
import { PricingTable } from '@/components/landing/PricingTable';
import { Footer } from '@/components/landing/Footer';
import { Link, useLocation } from 'wouter';
import { watchAuthState } from '@/lib/firebase/client';

export function HomePage() {
  const [, navigate] = useLocation();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => watchAuthState((user) => {
    if (user) navigate('/dashboard', { replace: true });
    else setAuthChecked(true);
  }), [navigate]);

  if (!authChecked) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg" aria-label="Opening your workspace">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-violet border-t-transparent" />
      </div>
    );
  }

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <FeatureStrip />
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="max-w-2xl">
              <p className="font-utility text-xs uppercase tracking-[.18em] text-violet">One studio, every campaign</p>
              <h2 className="mt-3 font-display text-3xl font-bold text-text-primary">Make customers understand your website faster</h2>
              <p className="mt-3 text-sm leading-relaxed text-text-muted">Create content around the real journey on your site—from the first scroll to the action you want viewers to take.</p>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {[
                ['Launch & promo videos', 'Turn the strongest pages, products, and calls to action into a polished campaign.'],
                ['Tutorials & feature tours', 'Show customers exactly how to use, explore, or buy from your website.'],
                ['Marketing photo sets', 'Create on-brand campaign visuals with your real site and creative direction in mind.'],
              ].map(([title, body], index) => (
                <article key={title} className="group rounded-3xl border border-border bg-panel p-6 transition-all hover:-translate-y-1 hover:border-violet/30">
                  <span className="font-utility text-xs text-violet">0{index + 1}</span>
                  <h3 className="mt-8 font-display text-lg font-semibold text-text-primary">{title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-border bg-black/10">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="grid gap-10 lg:grid-cols-[.8fr_1.2fr] lg:items-center">
              <div><p className="font-utility text-xs uppercase tracking-[.18em] text-mint">Built for real work</p><h2 className="mt-3 font-display text-3xl font-bold text-text-primary">Your projects stay organized</h2><p className="mt-3 text-sm leading-relaxed text-text-muted">A signed-in workspace keeps production history, progress, creative plans, previews, and downloads together—so you can leave a long render and return later.</p><Link href="/features" className="mt-5 inline-block text-sm font-semibold text-violet hover:text-pink">Explore every feature →</Link></div>
              <div className="grid gap-3 sm:grid-cols-2">
                {['Real multi-page capture', 'Live percentage and estimated time', 'Account-based project history', 'Automatic failed-render credit restoration'].map((label) => <div key={label} className="flex items-center gap-3 rounded-2xl border border-border bg-panel p-4 text-sm text-text-primary"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-mint/10 text-mint">✓</span>{label}</div>)}
              </div>
            </div>
          </div>
        </section>
        {/* Pricing preview section */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <div className="mb-8 text-center">
              <h2 className="font-display text-2xl font-bold text-text-primary">Plans run on credits</h2>
              <p className="mt-2 max-w-lg mx-auto text-sm text-text-muted">
                One credit equals one generated video second. Clear pricing, automatic refunds for failed scenes, and rollover on paid plans.
              </p>
            </div>
            <PricingTable />
          </div>
        </section>

        {/* CTA banner */}
        <section className="border-t border-border">
          <div className="mx-auto max-w-6xl px-5 py-16 text-center">
            <div className="relative inline-block mb-6">
              <div className="ambient-glow absolute inset-0 -z-10" />
              <span className="text-xs font-utility text-text-dim uppercase tracking-widest">Ready to try it?</span>
            </div>
            <h2 className="font-display text-3xl font-bold text-text-primary">
              Your site. <span className="gradient-text">Your video.</span> In minutes.
            </h2>
            <p className="mt-4 max-w-md mx-auto text-text-muted">
              No editor, no brief, no agency. Just paste your URL and chat.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <a href="/#generate">
                <button className="bg-signature text-white px-6 py-3.5 rounded-xl font-semibold text-base shadow-[0_8px_30px_-8px_rgba(139,92,246,0.6)] hover:brightness-110 transition-all active:scale-[0.98]">
                  Build my free preview
                </button>
              </a>
              <a href="/#how-it-works">
                <button className="bg-panel-alt text-text-primary border border-border px-6 py-3.5 rounded-xl font-semibold text-base hover:bg-white/5 transition-all">
                  See how it works
                </button>
              </a>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
