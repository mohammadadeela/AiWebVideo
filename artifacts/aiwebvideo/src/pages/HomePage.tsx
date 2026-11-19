import { useEffect } from "react";
import { Link } from "wouter";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { useSeo } from "@/lib/useSeo";
import { CREATION_FEATURES, type CreationIntent } from "@/lib/creationFeatures";
import { requestCreationMode, useCreationMode } from "@/lib/creationMode";
import { estimateRenderCredits } from "@/lib/credits";
import { CREDIT_PACKS, STARTER_CREDITS } from "@/lib/pricing";
import { displayCredits } from "@/lib/credits";
import { BRAND } from "@/lib/brand";

/** Where each feature's own page lives (what search engines land on). */
const FEATURE_PAGES: Record<CreationIntent, string> = {
  website: "/website-video-generator",
  video: "/ai-video-generator",
  photo: "/product-photo-generator",
  "product-video": "/product-video-generator",
  scenario: "/talking-video-generator",
  interior: "/ai-interior-design-generator",
  architecture: "/ai-architectural-visualization",
};

const steps = [
  ["Paste", "Drop in a website, a product page, a map pin or a few photos."],
  ["Say what you want", "One sentence is enough. Or send it as it is."],
  ["Download", "Watch it come together, ask for changes, keep the file."],
] as const;

const landingFaqs: ReadonlyArray<readonly [string, string]> = [
  ["How do I turn a website into a video?", `Paste the website link into ${BRAND.name} and press send. It reads the pages, writes the story, and generates a finished video you can download. Adding a sentence about what to highlight is optional.`],
  ["Is it free to try?", `Yes. Reading your link and previewing what was found is free, and every new account gets ${STARTER_CREDITS} credits with no card needed.`],
  ["Can it make a video from a product link?", "Yes. Paste an Amazon, Shopify, Etsy or any product page link. The product photos are picked up automatically and turned into a product video or a set of studio photos."],
  ["What else can I make?", "Videos from a text prompt, talking scenes, interior redesigns from a room photo or plan, and a building placed on a real map location."],
  ["How much does a video cost?", `You see the exact credits before anything is generated. An 8-second video starts at ${estimateRenderCredits("video", true, 8, "1080p", "cinema-1")} credits and a set of four images at ${estimateRenderCredits("photos", true, 8, "1080p", "graphic-1")}.`],
  ["Who owns what I make?", "You do. Download your videos and images and use them in your ads, store and social channels."],
];

export function HomePage() {
  useSeo({
    title: `${BRAND.name}: turn any link into a video with AI`,
    description:
      `Paste a website, product page or map link and ${BRAND.name} turns it into a finished AI video or image set. Free to try, no card needed.`,
    path: "/",
    faq: landingFaqs,
  });

  const activeMode = useCreationMode();

  useEffect(() => {
    if (!window.location.hash) return;
    const frame = window.requestAnimationFrame(() => {
      document.getElementById(window.location.hash.slice(1))?.scrollIntoView({ block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, []);

  function pick(intent: CreationIntent) {
    requestCreationMode(intent);
    document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" });
    window.setTimeout(() => document.querySelector<HTMLTextAreaElement>("[data-composer] textarea")?.focus({ preventScroll: true }), 250);
  }

  return (
    <>
      <Nav />
      <main>
        <section id="generate" className="scroll-mt-16 px-3 sm:px-5">
          <div className="mx-auto flex min-h-[calc(100svh-3.5rem)] w-full max-w-[760px] flex-col justify-center pb-16 pt-8 sm:min-h-[calc(100svh-4rem)] sm:pb-24">
            <h1 className="hero-title rise text-center text-text-primary">
              Paste a link. <span className="lit">Get a video.</span>
            </h1>
            <p className="rise rise-2 mx-auto mt-5 max-w-[46ch] text-center text-[17px] leading-7 text-text-muted">
              Websites, product pages, places and photos, turned into finished videos and images.
            </p>

            <div className="rise rise-3 mt-8">
              <ChatWidget compactLanding className="w-full" />
            </div>

            <div className="rise rise-4 mt-4 flex flex-wrap justify-center gap-1.5" role="group" aria-label="What to make">
              {CREATION_FEATURES.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => pick(id)}
                  aria-pressed={activeMode === id}
                  className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition ${activeMode === id ? "border-white/25 bg-white/[.08] text-white" : "border-white/[.09] text-text-muted hover:border-white/20 hover:text-white"}`}
                >
                  <Icon size={14} className={activeMode === id ? "text-violet" : "text-text-dim"} />
                  {label}
                </button>
              ))}
            </div>
            <p className="rise rise-4 mt-6 text-center text-[13px] text-text-dim">{STARTER_CREDITS} free credits when you sign up. No card needed.</p>
          </div>
        </section>

        <VideoShowcase />

        <section className="border-t border-white/[.07] px-5" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl py-16 sm:py-24">
            <h2 id="how-heading" className="font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-[40px]">Three steps, a few minutes</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {steps.map(([title, body], index) => (
                <li key={title} className="border-t border-white/15 pt-5">
                  <span className="font-utility text-[13px] text-gold">{index + 1}</span>
                  <h3 className="mt-2 font-display text-xl font-semibold tracking-[-.02em] text-white">{title}</h3>
                  <p className="mt-2 max-w-[34ch] text-[15px] leading-6 text-text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-white/[.07] px-5" aria-labelledby="make-heading">
          <div className="mx-auto grid max-w-6xl gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1.6fr]">
            <h2 id="make-heading" className="font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-[40px]">What you can make</h2>
            <ul className="divide-y divide-white/[.08] border-y border-white/[.08]">
              {CREATION_FEATURES.map(({ id, label, description, icon: Icon }) => (
                <li key={id}>
                  <Link href={FEATURE_PAGES[id]} className="group flex items-center gap-4 py-4 transition hover:bg-white/[.025] sm:px-2">
                    <Icon size={20} className="shrink-0 text-violet" />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[17px] font-medium text-white">{label}</span>
                      <span className="block text-[14px] text-text-dim">{description}</span>
                    </span>
                    <span className="shrink-0 text-[13px] font-medium text-text-dim transition group-hover:text-white">Learn more</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="border-t border-white/[.07] px-5" aria-labelledby="price-heading">
          <div className="mx-auto max-w-6xl py-16 sm:py-24">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <h2 id="price-heading" className="max-w-[18ch] font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-[40px]">Pay for what you make</h2>
              <Link href="/pricing" className="text-[15px] font-medium text-violet hover:underline">See all plans</Link>
            </div>
            <div className="mt-10 grid gap-3 sm:grid-cols-3">
              {CREDIT_PACKS.map((pack, index) => (
                <Link key={pack.id} href="/pricing#buy-credits" className={`rounded-3xl border p-6 transition hover:border-white/25 ${index === 1 ? "border-violet/50 bg-violet/[.06]" : "border-white/[.09]"}`}>
                  <p className="text-[14px] font-medium text-text-muted">{pack.name}</p>
                  <p className="mt-3 font-display text-4xl font-bold tracking-[-.03em] text-white">${pack.amountUsd}</p>
                  <p className="mt-1 font-utility text-[13px] text-text-dim">{displayCredits(pack.credits)} credits, one-time</p>
                  <p className="mt-5 text-[14px] leading-6 text-text-muted">{pack.note}</p>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="border-t border-white/[.07] px-5" aria-labelledby="faq-heading">
          <div className="mx-auto grid max-w-6xl gap-10 py-16 sm:py-24 lg:grid-cols-[1fr_1.6fr]">
            <h2 id="faq-heading" className="font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-[40px]">Questions</h2>
            <div className="divide-y divide-white/[.08] border-y border-white/[.08]">
              {landingFaqs.map(([question, answer]) => (
                <details key={question} className="group py-1">
                  <summary className="flex list-none items-center justify-between gap-4 py-4 text-[17px] font-medium text-white">
                    {question}
                    <span className="shrink-0 text-xl leading-none text-text-dim transition group-open:rotate-45" aria-hidden="true">+</span>
                  </summary>
                  <p className="max-w-[62ch] pb-5 text-[15px] leading-7 text-text-muted">{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="border-t border-white/[.07] px-5 py-20 text-center sm:py-28">
          <h2 className="hero-title mx-auto text-text-primary">Your link is <span className="lit">the brief.</span></h2>
          <button type="button" onClick={() => pick("website")} className="mt-9 inline-flex h-12 items-center rounded-full bg-white px-7 text-[15px] font-semibold text-bg transition hover:bg-white/90">
            Paste a link
          </button>
        </section>
      </main>
      <Footer />
    </>
  );
}
