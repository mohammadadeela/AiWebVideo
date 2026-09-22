import { useEffect } from "react";
import {
  ArrowRight,
  Check,
  Film,
  Globe2,
  House,
  Image as ImageIcon,
  MessageCircleMore,
  PackageOpen,
} from "lucide-react";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { useSeo } from "@/lib/useSeo";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";

const capabilities: Array<{
  intent: CreationIntent;
  label: string;
  body: string;
  icon: typeof Globe2;
}> = [
  {
    intent: "website",
    label: "Website Video",
    body: "Use your real website, pages, products, and brand context to direct a campaign.",
    icon: Globe2,
  },
  {
    intent: "video",
    label: "AI Video",
    body: "Start from an idea, add references when useful, and direct the result in plain language.",
    icon: Film,
  },
  {
    intent: "photo",
    label: "Product Images",
    body: "Keep the real product at the center while changing environment, styling, and campaign direction.",
    icon: ImageIcon,
  },
  {
    intent: "product-video",
    label: "Product Video",
    body: "Turn product references into campaign motion with duration, format, and audio controls.",
    icon: PackageOpen,
  },
  {
    intent: "scenario",
    label: "Talking Scene",
    body: "Direct characters, dialogue, scene, pacing, and camera for scenario-driven video.",
    icon: MessageCircleMore,
  },
  {
    intent: "interior",
    label: "Interior Design",
    body: "Use real room or property photos, references, and measurements for images or walkthrough video.",
    icon: House,
  },
];

const landingFaqs: ReadonlyArray<readonly [string, string]> = [
  ["Can I start without signing in?", "Yes. Begin from the public creator. If the workflow needs an account, sign in and continue from the same creation context."],
  ["Can I create product photos and videos?", "Yes. Upload real product references and choose Product Images or Product Video depending on the result you need."],
  ["Can I redesign a room or generate a property walkthrough?", "Yes. Interior Design supports source photos, reference designs, measurements, still images, and walkthrough output where supported."],
  ["What happens during a long generation?", "The project remains in your history with its job state, progress, references, and final result so you can leave and return later."],
  ["When do I see the credit cost?", "The creator shows the generation cost before the paid generation action. Pricing and credit economics continue to come from the production configuration."],
];

const workflowLinks = [
  ["URL to Video", "/url-to-video"],
  ["Website Video", "/website-video-generator"],
  ["AI Video", "/ai-video-generator"],
  ["Product Images", "/product-photo-generator"],
  ["Product Video", "/product-video-generator"],
  ["Talking Video", "/talking-video-generator"],
  ["Interior Design", "/ai-interior-design-generator"],
  ["Interior Walkthrough", "/interior-design-walkthrough-video"],
] as const;

export function HomePage() {
  useSeo({
    title: "AI Video, Product Images & Interior Design",
    description:
      "Create website videos, original AI videos, product photos and videos, talking scenes, and interior design images or walkthroughs from your own sources.",
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
    window.dispatchEvent(new CustomEvent<CreationIntent>("aiwebvideo:creation-intent", { detail: intent }));
    window.setTimeout(
      () => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" }),
      0,
    );
  }

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <VideoShowcase />

        <section className="border-b border-white/[.07]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="grid gap-10 lg:grid-cols-[.72fr_1.28fr] lg:gap-20">
              <div className="lg:sticky lg:top-28 lg:self-start">
                <p className="text-sm font-medium text-violet">Create</p>
                <h2 className="mt-3 max-w-[12ch] font-display text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl lg:text-5xl">
                  Six ways to start. One place to finish.
                </h2>
                <p className="mt-5 max-w-md text-sm leading-7 text-text-muted sm:text-base">
                  Choose the source you have. The creator only shows controls that matter for that workflow.
                </p>
              </div>

              <div className="border-t border-white/[.09]">
                {capabilities.map(({ intent, label, body, icon: Icon }) => (
                  <button
                    key={intent}
                    type="button"
                    onClick={() => openCreationIntent(intent)}
                    className="group grid w-full grid-cols-[24px_1fr_auto] items-start gap-4 border-b border-white/[.09] py-5 text-left transition hover:bg-white/[.018] sm:grid-cols-[28px_180px_1fr_auto] sm:items-center sm:gap-5"
                  >
                    <Icon size={19} className="mt-0.5 text-text-dim transition group-hover:text-violet sm:mt-0" />
                    <h3 className="text-[15px] font-semibold text-white">{label}</h3>
                    <p className="col-start-2 text-sm leading-6 text-text-muted sm:col-start-auto">{body}</p>
                    <ArrowRight size={16} className="mt-1 text-text-dim transition group-hover:translate-x-1 group-hover:text-white sm:mt-0" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.07] bg-white/[.012]">
          <div className="mx-auto max-w-7xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8 lg:py-24">
            <div className="max-w-3xl">
              <p className="text-sm font-medium text-violet">How it works</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl lg:text-5xl">
                Source. Direct. Create.
              </h2>
            </div>

            <div className="mt-10 grid border-y border-white/[.09] md:grid-cols-3 md:divide-x md:divide-white/[.09]">
              {[
                ["01", "Give AiWebVideo your source.", "Paste a website, write a prompt, or upload product, scene, or interior references."],
                ["02", "Direct what you want.", "Set the goal and only the settings that matter for this result."],
                ["03", "Generate, refine, and export.", "Follow real production state, review the media, edit where supported, and download the result."],
              ].map(([number, title, body]) => (
                <article key={number} className="border-b border-white/[.09] py-7 last:border-b-0 md:border-b-0 md:px-7 md:first:pl-0 md:last:pr-0">
                  <p className="font-mono text-xs text-text-dim">{number}</p>
                  <h3 className="mt-5 text-lg font-semibold text-white">{title}</h3>
                  <p className="mt-3 text-sm leading-7 text-text-muted">{body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.07]">
          <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 sm:py-20 lg:grid-cols-[1fr_1fr] lg:gap-20 lg:px-8 lg:py-24">
            <div>
              <p className="text-sm font-medium text-violet">Built around real work</p>
              <h2 className="mt-3 max-w-[15ch] font-display text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">
                Your media stays connected to the project.
              </h2>
            </div>
            <div className="space-y-0 border-t border-white/[.09]">
              {[
                "Use your own websites, product photos, references, rooms, and plans.",
                "See generation cost before the paid action.",
                "Navigate away while long generations continue and return to their real state.",
                "Keep captures, generated images, videos, edits, and results in project history.",
                "Open finished media at useful size instead of burying it inside chat text.",
              ].map((item) => (
                <div key={item} className="flex gap-3 border-b border-white/[.09] py-4 text-sm leading-6 text-text-muted">
                  <Check size={17} className="mt-0.5 shrink-0 text-mint" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.07] bg-white/[.012]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold text-white">Popular workflows</p>
                <p className="mt-1 text-sm text-text-muted">Open a focused tool page or start from the creator above.</p>
              </div>
              <nav aria-label="Popular creation workflows" className="flex max-w-4xl flex-wrap gap-x-5 gap-y-3">
                {workflowLinks.map(([label, href]) => (
                  <a key={href} href={href} className="text-sm text-text-muted underline-offset-4 transition hover:text-white hover:underline">
                    {label}
                  </a>
                ))}
              </nav>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.07]">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-6 sm:py-20 lg:py-24">
            <div className="max-w-2xl">
              <p className="text-sm font-medium text-violet">Questions</p>
              <h2 className="mt-3 font-display text-3xl font-semibold tracking-[-.04em] text-white sm:text-4xl">What people need to know before creating.</h2>
            </div>
            <div className="mt-9 border-t border-white/[.09]">
              {landingFaqs.map(([question, answer]) => (
                <details key={question} className="group border-b border-white/[.09] py-5">
                  <summary className="flex min-h-11 list-none items-center justify-between gap-5 text-left text-[15px] font-semibold text-white">
                    <span>{question}</span>
                    <span aria-hidden="true" className="text-xl font-light text-text-dim transition group-open:rotate-45">+</span>
                  </summary>
                  <p className="max-w-3xl pb-1 pr-10 text-sm leading-7 text-text-muted">{answer}</p>
                </details>
              ))}
            </div>
            <a href="/faq" className="mt-6 inline-flex min-h-11 items-center gap-2 text-sm font-medium text-white transition hover:text-violet">
              More answers <ArrowRight size={15} />
            </a>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
            <div className="grid gap-8 border-y border-white/[.09] py-10 sm:py-14 lg:grid-cols-[1fr_auto] lg:items-end">
              <div>
                <h2 className="max-w-[14ch] font-display text-4xl font-semibold tracking-[-.045em] text-white sm:text-5xl">
                  Start with the source you already have.
                </h2>
                <p className="mt-4 max-w-xl text-sm leading-7 text-text-muted sm:text-base">
                  Open the creator, choose a mode, and keep the entire production in one project.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <a href="/#generate" className="inline-flex min-h-12 items-center gap-2 rounded-xl bg-violet px-5 text-sm font-semibold text-white transition hover:bg-violet/90">
                  Start creating <ArrowRight size={16} />
                </a>
                <a href="/pricing" className="inline-flex min-h-12 items-center rounded-xl border border-white/[.12] px-5 text-sm font-semibold text-white transition hover:bg-white/[.05]">
                  View pricing
                </a>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
