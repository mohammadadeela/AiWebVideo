import { useEffect } from "react";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { CreationModes } from "@/components/landing/CreationModes";
import { CreativePresets } from "@/components/landing/CreativePresets";
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
      <main>
        <Hero />
        <CreativePresets />
        <VideoShowcase />
        <CreationModes />
      </main>
      <Footer />
    </>
  );
}
