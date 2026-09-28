import { useEffect } from "react";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { CreationModes } from "@/components/landing/CreationModes";
import { CreativePresets } from "@/components/landing/CreativePresets";
import { LandingProjectsDrawer } from "@/components/landing/LandingProjectsDrawer";
import { FeatureStrip } from "@/components/landing/FeatureStrip";
import { PricingTable } from "@/components/landing/PricingTable";
import { useSeo } from "@/lib/useSeo";

const landingFaqs: ReadonlyArray<readonly [string, string]> = [
  ["What can I create?", "Create website videos, original AI videos, product photos and videos, talking scenes, and interior design images or walkthroughs."],
  ["Do I need a website URL?", "Only for website video. Other modes start from your idea, product photos, or images of a space."],
  ["Can I start without signing in?", "Yes. You can prepare a brief first; the creator asks you to sign in when an account is needed."],
  ["How do credits work?", "You'll see the credit estimate in the creator before you choose paid generation."],
];

export function HomePage() {
  useSeo({
    title: "AI Video, Product Images & Interior Design",
    description: "Create website videos, original AI videos, product photos and videos, talking scenes, and interior design images or walkthroughs from your own sources.",
    path: "/",
    faq: landingFaqs,
  });

  useEffect(() => {
    if (!window.location.hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      <Nav />
      <LandingProjectsDrawer />
      <main>
        <Hero />
        <CreativePresets />
        <VideoShowcase />
        <CreationModes />
        <FeatureStrip />
        <section id="pricing" className="border-t border-white/[.06]" aria-labelledby="landing-pricing-title">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:px-8">
            <h2 id="landing-pricing-title" className="font-display text-2xl font-bold text-white sm:text-3xl">Choose your credits</h2>
            <p className="mb-7 mt-2 text-xs text-text-muted">Your creator shows the estimated cost before you generate.</p>
            <PricingTable />
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
