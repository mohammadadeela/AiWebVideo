import { useEffect } from "react";
import { ArrowRight } from "lucide-react";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { useSeo } from "@/lib/useSeo";
import { CREATION_FEATURES } from "@/lib/creationFeatures";
import { requestCreationMode } from "@/lib/creationMode";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { estimateRenderCredits } from "@/lib/credits";

const steps = [
  ["Add your source", "A website, product photos, a prompt or a room."],
  ["Describe it", "Say what you want to see, or pick an idea."],
  ["Get your result", "Review it, make changes, download it."],
] as const;

const landingFaqs: ReadonlyArray<readonly [string, string]> = [
  ["Can I start without signing in?", "Yes. Start on the public site; sign in only when the workflow needs an account."],
  ["Can I create product photos and videos?", "Yes. Upload photos of the real product and choose still Product Photos or moving Product Video."],
  ["Can I redesign a room or generate a property tour?", "Yes. Interior Design accepts photos and plans for concept images or a walkthrough. Add measurements when proportions matter."],
  ["Do video and photo generation open separate apps?", "No. Every mode stays in the same creator and project conversation."],
  ["What happens during a long generation?", "The chat stays in history with live status and can be reopened while it runs."],
];

export function HomePage() {
  useSeo({
    title: "AiWebVideo — AI Video, Product Photo & Architecture Generator",
    description:
      "AiWebVideo is an AI creative platform for website marketing videos, AI videos, product photos and videos, talking scenes, interior design and architecture concept visuals.",
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

  function openCreationIntent(intent: CreationIntent) {
    requestCreationMode(intent);
    window.setTimeout(() => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <VideoShowcase />

        <section className="border-b border-white/[.06]" aria-labelledby="make-heading">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20">
            <h2 id="make-heading" className="font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">What you can make</h2>
            <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {CREATION_FEATURES.map(({ id, label, description, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => openCreationIntent(id)}
                  className="group flex items-start gap-4 rounded-2xl border border-white/[.08] bg-[#0b0919] p-5 text-left transition duration-200 hover:-translate-y-0.5 hover:border-violet/45"
                >
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/[.06] text-violet"><Icon size={20} /></span>
                  <span className="min-w-0">
                    <span className="block font-display text-base font-semibold text-white">{label}</span>
                    <span className="mt-1 block text-sm leading-5 text-text-muted">{description}</span>
                  </span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20">
            <h2 id="how-heading" className="font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">How it works</h2>
            <ol className="mt-8 grid gap-3 sm:grid-cols-3">
              {steps.map(([title, body], index) => (
                <li key={title} className="rounded-2xl border border-white/[.08] bg-[#0b0919] p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-full bg-signature text-sm font-bold text-white">{index + 1}</span>
                  <h3 className="mt-4 font-display text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-1.5 text-sm leading-6 text-text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-b border-white/[.06]" aria-labelledby="price-heading">
          <div className="mx-auto max-w-6xl px-4 py-14 sm:px-5 sm:py-20">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <h2 id="price-heading" className="font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Know the cost before generation.</h2>
              <a href="/pricing" className="inline-flex items-center gap-2 text-sm font-semibold text-white transition hover:text-mint">See plans and top-ups <ArrowRight size={14} /></a>
            </div>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              {[
                ["Product photos", `${estimateRenderCredits("photos", true)} credits`, "A set of four marketing photos using the current production logic."],
                ["8s AI video", `${estimateRenderCredits("custom", true, 8)} credits`, "A short 1080p production with scene audio and no separate narration."],
                ["32s AI video", `${estimateRenderCredits("custom", true, 32)} credits`, "A longer 1080p production quoted from the same shared credit formula."],
              ].map(([title, value, body]) => (
                <article key={title} className="rounded-[22px] border border-white/[.08] bg-panel p-5">
                  <p className="text-xs font-semibold text-white">{title}</p>
                  <p className="mt-3 font-utility text-2xl font-bold text-mint">{value}</p>
                  <p className="mt-3 text-[11px] leading-5 text-text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]" aria-labelledby="faq-heading">
          <div className="mx-auto max-w-4xl px-4 py-14 sm:px-5 sm:py-20">
            <h2 id="faq-heading" className="text-center font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Questions</h2>
            <div className="mt-8 space-y-2">
              {landingFaqs.map(([question, answer]) => (
                <details key={question} className="group rounded-2xl border border-white/[.08] bg-[#0b0919] p-5">
                  <summary className="list-none pr-6 text-sm font-semibold text-white">{question}<span className="float-right text-violet transition group-open:rotate-45">＋</span></summary>
                  <p className="mt-3 max-w-3xl text-sm leading-6 text-text-muted">{answer}</p>
                </details>
              ))}
            </div>
            <div className="mt-6 text-center"><a href="/faq" className="inline-flex items-center gap-2 text-sm font-semibold text-white hover:text-mint">All questions <ArrowRight size={14} /></a></div>
          </div>
        </section>

        <section className="px-4 py-16 text-center sm:px-5 sm:py-24">
          <h2 className="mx-auto max-w-2xl font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-5xl">Ready to make yours?</h2>
          <button type="button" onClick={() => openCreationIntent("website")} className="premium-button bg-signature mt-7 inline-flex min-h-12 items-center gap-2 rounded-xl px-6 text-sm font-bold text-white">
            Start creating <ArrowRight size={15} />
          </button>
        </section>
      </main>
      <Footer />
    </>
  );
}
