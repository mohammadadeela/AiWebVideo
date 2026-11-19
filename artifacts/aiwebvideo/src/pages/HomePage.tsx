import { useEffect } from "react";
import { Link } from "wouter";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { LiveDemo } from "@/components/landing/LiveDemo";
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

/** The seven features, grouped by what a person starts from. */
const GROUPS: ReadonlyArray<{ from: string; title: string; body: string; say: string; features: CreationIntent[] }> = [
  {
    from: "From a website link",
    title: "A video of your business",
    body: "It reads your pages, finds what you sell and why it matters, and builds a promo, a tour or a how-to-buy video around it.",
    say: "Make a 16 second vertical ad for mystore.com",
    features: ["website"],
  },
  {
    from: "From a product link or a photo",
    title: "Product videos and studio photos",
    body: "Paste a product page and the real product photos are picked up for you. The product stays the product; the scene around it is new.",
    say: "Studio photos of this on a marble counter",
    features: ["product-video", "photo"],
  },
  {
    from: "From a sentence",
    title: "Original videos and talking scenes",
    body: "Describe a scene, or who is speaking and what they say. Add a photo when a face, a place or a style has to match.",
    say: "Two founders explain the app in a bright studio",
    features: ["video", "scenario"],
  },
  {
    from: "From a room photo or a map pin",
    title: "Rooms redesigned, buildings on real sites",
    body: "Redesign a space from a photo, a plan or a CAD drawing, or see a new building standing on a real street. Concept visuals, not construction plans.",
    say: "A two-floor clothes shop on this corner",
    features: ["interior", "architecture"],
  },
];

const OUTPUT_FACTS: ReadonlyArray<readonly [string, string]> = [
  ["8 to 60 s", "Video length, your choice"],
  ["3 shapes", "Vertical, wide and square"],
  ["Up to 4K", "Full HD as standard"],
  ["14 languages", "For narration and voice-over"],
];

const steps = [
  ["Paste", "Drop in a website, a product page, a map pin or a few photos."],
  ["Say what you want", "One sentence is enough. Or send it as it is."],
  ["Download", "Watch it come together, ask for changes, keep the file."],
] as const;

const landingFaqs: ReadonlyArray<readonly [string, string]> = [
  ["Is it a real AI I can talk to?", `Yes. Write what you want in plain language, in any language. ${BRAND.name} works out what to make, the length, the shape and the voice, tells you its plan and starts. You can also just paste a link.`],
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
          <div className="mx-auto flex min-h-[calc(92svh-3.5rem)] w-full max-w-[760px] flex-col justify-center pb-14 pt-8 sm:min-h-[calc(92svh-4rem)] sm:pb-20">
            <div className="intro-copy">
              <h1 className="hero-title rise text-center text-text-primary">
                Paste a link. <span className="lit">Get a video.</span>
              </h1>
              <p className="rise rise-2 mx-auto mt-5 max-w-[50ch] text-center text-[17px] leading-7 text-text-muted">
                Tell {BRAND.name} what you want in your own words. It reads your link, plans the shots and makes the video.
              </p>
            </div>

            <div className="rise rise-3 mt-8">
              <ChatWidget compactLanding className="w-full" />
            </div>

            <div className="intro-chips">
              <div className="rise rise-4 mt-4 flex flex-wrap justify-center gap-1.5" role="group" aria-label="What to make">
                {CREATION_FEATURES.map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => pick(id)}
                    aria-pressed={activeMode === id}
                    className={`inline-flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-medium transition ${activeMode === id ? "border-white/30 bg-white/[.06] text-white" : "border-white/[.12] text-text-muted hover:border-white/25 hover:text-white"}`}
                  >
                    <Icon size={14} className={activeMode === id ? "text-violet" : "text-text-dim"} />
                    {label}
                  </button>
                ))}
              </div>
              <p className="rise rise-4 mt-6 text-center text-[13px] text-text-dim">{STARTER_CREDITS} free credits when you sign up. No card needed.</p>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[.07] bg-sunken px-4 sm:px-5" aria-labelledby="demo-heading">
          <div className="mx-auto max-w-6xl py-16 sm:py-24">
            <h2 id="demo-heading" className="mx-auto max-w-[18ch] text-center font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-[44px] sm:leading-[1.05]">Talk to it like you would to a person</h2>
            <p className="mx-auto mt-4 max-w-[52ch] text-center text-[16px] leading-7 text-text-muted">No forms and no settings to learn. Say the length, the shape and the language in one sentence, and watch it work.</p>
            <div className="mt-10"><LiveDemo /></div>
          </div>
        </section>

        <VideoShowcase />

        <section className="border-t border-white/[.07] px-5" aria-labelledby="how-heading">
          <div className="mx-auto max-w-6xl py-16 sm:py-24">
            <h2 id="how-heading" className="font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-[40px]">Three steps, a few minutes</h2>
            <ol className="mt-10 grid gap-8 sm:grid-cols-3 sm:gap-6">
              {steps.map(([title, body], index) => (
                <li key={title} className="border-t border-white/15 pt-5">
                  <span className="font-utility text-[13px] text-text-dim">{index + 1}</span>
                  <h3 className="mt-2 font-display text-xl font-semibold tracking-[-.02em] text-white">{title}</h3>
                  <p className="mt-2 max-w-[34ch] text-[15px] leading-6 text-text-muted">{body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="border-t border-white/[.07] px-4 sm:px-5" aria-labelledby="make-heading">
          <div className="mx-auto max-w-6xl py-16 sm:py-24">
            <h2 id="make-heading" className="font-display text-3xl font-bold tracking-[-.035em] text-white sm:text-[40px]">What you can make</h2>
            <div className="mt-10 grid gap-3 md:grid-cols-2">
              {GROUPS.map((group) => (
                <article key={group.title} className="flex flex-col rounded-3xl border border-white/10 p-6 sm:p-8">
                  <p className="text-[14px] font-medium text-text-dim">{group.from}</p>
                  <h3 className="mt-2 font-display text-2xl font-semibold tracking-[-.025em] text-white">{group.title}</h3>
                  <p className="mt-3 max-w-[44ch] text-[15px] leading-7 text-text-muted">{group.body}</p>
                  <p className="mt-5 rounded-2xl bg-white/[.04] px-4 py-3 text-[14px] leading-6 text-text-primary">“{group.say}”</p>
                  <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 pt-1">
                    {group.features.map((id) => {
                      const feature = CREATION_FEATURES.find((item) => item.id === id)!;
                      return (
                        <li key={id}>
                          <Link href={FEATURE_PAGES[id]} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-violet hover:underline">
                            <feature.icon size={15} /> {feature.label}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </article>
              ))}
            </div>

            <dl className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
              {OUTPUT_FACTS.map(([value, label]) => (
                <div key={label} className="rounded-3xl border border-white/10 p-6">
                  <dt className="font-display text-2xl font-semibold tracking-[-.025em] text-white">{value}</dt>
                  <dd className="mt-1 text-[14px] text-text-dim">{label}</dd>
                </div>
              ))}
            </dl>
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
                <Link key={pack.id} href="/pricing#buy-credits" className={`rounded-3xl border p-6 transition hover:border-white/30 ${index === 1 ? "border-white/40 bg-white/[.03]" : "border-white/10"}`}>
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
