import { useEffect } from "react";
import { ArrowRight, Layers3 } from "lucide-react";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { CreationModes } from "@/components/landing/CreationModes";
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
        <VideoShowcase />
        <CreationModes />

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto grid max-w-7xl gap-7 px-4 py-12 sm:px-5 sm:py-16 lg:grid-cols-[.7fr_1.3fr] lg:items-center lg:gap-16">
            <div>
              <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Start with what you have.</h2>
              <p className="mt-4 max-w-md text-sm leading-7 text-text-muted">A link, a prompt, a product photo, or a picture of a room. Choose a mode and create in the same workspace.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Choose a mode", "Pick the result you want to make."],
                ["02", "Add your source", "Describe the idea and add references."],
                ["03", "Create and refine", "Review the cost, follow progress, and keep the result in your project."],
              ].map(([number, title, body]) => (
                <div key={number} className="border-t border-white/15 pt-4">
                  <span className="font-utility text-[10px] text-violet">{number}</span>
                  <h3 className="mt-3 font-display text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto flex max-w-7xl flex-col gap-5 px-4 py-12 sm:px-5 sm:py-16 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="font-display text-2xl font-bold tracking-[-.035em] text-white sm:text-3xl">See the cost before you create.</h2>
              <p className="mt-2 text-sm leading-6 text-text-muted">The creator shows the credit estimate before paid generation.</p>
            </div>
            <a href="/pricing" className="inline-flex min-h-11 shrink-0 items-center gap-2 self-start rounded-xl border border-white/15 px-4 text-xs font-semibold text-white transition hover:border-violet/50 hover:bg-white/[.04]">Explore pricing <ArrowRight size={14} /></a>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-4xl px-4 py-12 sm:px-5 sm:py-16">
            <h2 className="font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">A few useful answers.</h2>
            <div className="mt-7 divide-y divide-white/[.08] border-y border-white/[.08]">
              {landingFaqs.map(([question, answer]) => (
                <details key={question} className="group py-5">
                  <summary className="cursor-pointer list-none pr-8 text-sm font-semibold text-white">{question}<span className="float-right text-violet transition group-open:rotate-45">+</span></summary>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">{answer}</p>
                </details>
              ))}
            </div>
            <a href="/faq" className="mt-5 inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-mint">More answers <ArrowRight size={14} /></a>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-5 sm:py-16">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[26px] border border-white/10 bg-panel px-5 py-10 text-center sm:rounded-[34px] sm:px-12 sm:py-14">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,.18),transparent_55%)]" />
            <Layers3 className="relative mx-auto text-mint" size={24} />
            <h2 className="relative mx-auto mt-4 max-w-2xl font-display text-3xl font-bold tracking-[-.045em] text-white sm:text-4xl">Your next creation starts here.</h2>
            <a href="#generate" className="premium-button bg-signature relative mt-6 inline-flex min-h-11 items-center gap-2 rounded-xl px-5 text-xs font-semibold text-white shadow-violet">Open the creator <ArrowRight size={14} /></a>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
