import { useEffect } from "react";
import {
  ArrowRight,
  Check,
  Clapperboard,
  Film,
  Globe2,
  Image as ImageIcon,
  Layers3,
  MessageCircleMore,
  PackageOpen,
  ScanSearch,
  Activity,
} from "lucide-react";
import { Hero } from "@/components/landing/Hero";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { VideoShowcase } from "@/components/landing/VideoShowcase";
import { useSeo } from "@/lib/useSeo";
import type { CreationIntent } from "@/components/chat/WebsiteBriefForm";
import { estimateRenderCredits } from "@/lib/credits";

const productionSteps = [
  {
    icon: Globe2,
    number: "01",
    title: "Give it the source",
    body: "Website, idea, or real product references.",
  },
  {
    icon: ScanSearch,
    number: "02",
    title: "AI studies the context",
    body: "AI reads the brand, brief, and references.",
  },
  {
    icon: Clapperboard,
    number: "03",
    title: "A production plan appears",
    body: "Direction and format stay visible in the chat.",
  },
  {
    icon: Clapperboard,
    number: "04",
    title: "Generate and continue",
    body: "Results stay in the chat so you can keep creating.",
  },
];

const capabilities: Array<{
  intent: CreationIntent;
  label: string;
  title: string;
  body: string;
  icon: typeof Globe2;
  accent: string;
}> = [
  {
    intent: "website",
    label: "Website → Video",
    title: "Website to campaign",
    body: "Direct a campaign from the real website.",
    icon: Globe2,
    accent: "text-mint",
  },
  {
    intent: "video",
    label: "Idea → Video",
    title: "Idea to original video",
    body: "Prompt a film and add references when needed.",
    icon: Film,
    accent: "text-violet",
  },
  {
    intent: "photo",
    label: "Product → Photos",
    title: "Product campaign photos",
    body: "Keep the real product at the center of the campaign.",
    icon: ImageIcon,
    accent: "text-pink",
  },
  {
    intent: "product-video",
    label: "Product → Video",
    title: "Product campaign video",
    body: "Turn product references into motion.",
    icon: PackageOpen,
    accent: "text-gold",
  },
  {
    intent: "scenario",
    label: "Talking Scene",
    title: "Talking and scenario video",
    body: "Direct the scene, dialogue, and camera.",
    icon: MessageCircleMore,
    accent: "text-mint",
  },
];

const useCases = [
  ["E-commerce", "Launches and product campaigns."],
  ["SaaS", "Product and launch stories."],
  ["Restaurants", "Offers and experience campaigns."],
  ["Agencies", "Client campaign production."],
  ["Apps", "Product UI and launch videos."],
  ["Local business", "Fast social campaign media."],
];

const qualityLayers = [
  ["Context before generation", "Business, prompt, and references before generation."],
  ["Creative direction", "Story, pacing, shots, and format in one plan."],
  ["Transparent production", "Live stages and project state remain visible."],
  ["Result-first presentation", "Finished media is the focus."],
];

const landingFaqs: ReadonlyArray<readonly [string, string]> = [
  ["Can I start without signing in?", "Yes. Start on the public site; sign in only when the workflow needs an account."],
  ["Do video and photo generation open separate apps?", "No. Every mode stays in the same creator and project conversation."],
  ["What happens during a long generation?", "The chat stays in history with live status and can be reopened while it runs."],
];

export function HomePage() {
  useSeo({
    title: "AI Website Video Generator — Turn Any Website Into Video",
    description:
      "Turn a website URL into a brand-aware AI marketing video. AiWebVideo reads the site, plans the campaign, generates the film, and keeps the work in one creative workspace.",
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
    window.setTimeout(() => document.getElementById("generate")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
  }

  return (
    <>
      <Nav />
      <main>
        <Hero />
        <VideoShowcase />

        <section className="border-b border-white/[.06] bg-black/10" aria-label="Product advantages">
          <div className="mx-auto grid max-w-7xl grid-cols-2 divide-x divide-white/[.06] px-5 sm:grid-cols-4">
            {["Website → campaign", "AI-directed", "No template workflow", "Export ready"].map((item, index) => (
              <div key={item} className="flex items-center justify-center gap-2 py-5 text-center font-utility text-[9px] uppercase tracking-[.16em] text-text-dim">
                <span className={`h-1.5 w-1.5 rounded-full ${index === 3 ? "bg-gold" : index === 2 ? "bg-pink" : index === 0 ? "bg-mint" : "bg-violet"}`} />
                {item}
              </div>
            ))}
          </div>
        </section>

        <section id="showcase" className="relative overflow-hidden border-b border-white/[.06]">
          <div className="pointer-events-none absolute right-0 top-0 h-[520px] w-[520px] rounded-full bg-pink/[.06] blur-[130px]" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:py-20">
            <div className="max-w-3xl">
              <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">One product · multiple creative starts</p>
              <h2 className="mt-4 font-display text-3xl font-bold leading-tight tracking-[-.04em] text-white sm:text-5xl">Start anywhere. Stay in one creator.</h2>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-text-muted sm:text-base">Five starting points. One creative chat.</p>
            </div>

            <div className="mt-12 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
              {capabilities.map(({ intent, label, title, body, icon: Icon, accent }) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => openCreationIntent(intent)}
                  className="group flex min-h-[220px] flex-col rounded-[26px] border border-white/[.08] bg-white/[.025] p-5 text-left transition duration-300 hover:-translate-y-1 hover:border-white/[.16] hover:bg-white/[.04]"
                >
                  <span className={`flex h-10 w-10 items-center justify-center rounded-xl border border-white/[.08] bg-black/20 ${accent}`}><Icon size={18} /></span>
                  <p className={`mt-auto pt-8 font-utility text-[8px] uppercase tracking-[.16em] ${accent}`}>{label}</p>
                  <h3 className="mt-2 font-display text-base font-semibold leading-6 text-white">{title}</h3>
                  <p className="mt-2 text-[11px] leading-5 text-text-muted">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-[10px] font-semibold text-white">Configure creator <ArrowRight size={12} className="transition group-hover:translate-x-1" /></span>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-[.82fr_1.18fr] lg:items-start">
              <div>
                <p className="font-utility text-[10px] uppercase tracking-[.2em] text-gold">Website to campaign</p>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">See the production, live.</h2>
                <p className="mt-5 max-w-lg text-sm leading-7 text-text-muted">See what is happening from source analysis to final master.</p>
                <button type="button" onClick={() => openCreationIntent("website")} className="mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/10 bg-white/[.035] px-4 text-xs font-semibold text-white transition hover:bg-white/[.07]">Start with a website <ArrowRight size={14} /></button>
              </div>
              <div className="relative">
                <div className="absolute left-[25px] top-8 bottom-8 w-px bg-gradient-to-b from-mint via-violet to-pink opacity-40 sm:left-[31px]" />
                <div className="space-y-3">
                  {productionSteps.map(({ icon: Icon, number, title, body }) => (
                    <article key={number} className="relative grid gap-4 rounded-[24px] border border-white/[.08] bg-panel/70 p-5 sm:grid-cols-[52px_1fr] sm:p-6">
                      <span className="relative z-10 flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-bg text-violet sm:h-12 sm:w-12"><Icon size={19} /></span>
                      <div>
                        <p className="font-utility text-[8px] uppercase tracking-[.18em] text-text-dim">Stage {number}</p>
                        <h3 className="mt-1.5 font-display text-lg font-semibold text-white">{title}</h3>
                        <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                      </div>
                    </article>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.1fr_.9fr] lg:items-center">
              <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#0c0917] shadow-[0_36px_100px_-50px_rgba(139,92,246,.7)]">
                <div className="flex items-center justify-between border-b border-white/[.08] px-4 py-3">
                  <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-mint" /><span className="text-xs font-semibold text-white">Campaign workspace</span></div>
                  <span className="font-utility text-[8px] uppercase tracking-[.14em] text-text-dim">Interface preview</span>
                </div>
                <div className="grid min-h-[420px] sm:grid-cols-[180px_1fr]">
                  <div className="hidden border-r border-white/[.07] bg-black/15 p-3 sm:block">
                    <div className="rounded-xl bg-violet/10 p-3 text-[10px] font-semibold text-white">+ New creation</div>
                    <p className="mt-5 px-2 font-utility text-[8px] uppercase tracking-[.15em] text-text-dim">Active</p>
                    <div className="mt-2 rounded-xl border border-violet/20 bg-violet/[.06] p-3"><p className="text-[10px] font-semibold text-white">Launch campaign</p><p className="mt-1 text-[8px] text-violet">Scenes generating · active</p></div>
                    <p className="mt-5 px-2 font-utility text-[8px] uppercase tracking-[.15em] text-text-dim">Recent</p>
                    <div className="mt-2 space-y-1 text-[9px] text-text-dim"><p className="rounded-lg px-2 py-2">Product photos</p><p className="rounded-lg px-2 py-2">Website promo</p></div>
                  </div>
                  <div className="relative p-4 sm:p-6">
                    <div className="mx-auto max-w-xl">
                      <div className="rounded-2xl border border-white/[.08] bg-white/[.025] p-4 text-xs leading-5 text-text-muted">Create a premium launch video from the website, focus on the new product and make the ending feel confident.</div>
                      <div className="mt-3 overflow-hidden rounded-2xl border border-white/[.09] bg-[#100c20]">
                        <div className="grid sm:grid-cols-[148px_1fr]">
                          <div className="relative flex min-h-[180px] items-center justify-center border-b border-white/[.07] p-4 sm:border-b-0 sm:border-r">
                            <div className="absolute left-3 top-3 flex items-center gap-1.5 text-[8px] font-semibold uppercase tracking-[.14em] text-white/55"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-mint" /> Live</div>
                            <div className="relative h-[132px] w-[74px] overflow-hidden rounded-[14px] border border-white/15 bg-[radial-gradient(circle_at_35%_25%,rgba(139,92,246,.28),transparent_38%),linear-gradient(145deg,#18112b,#090711)] shadow-[0_18px_45px_-22px_rgba(139,92,246,.9)]">
                              <div className="absolute inset-x-2 bottom-2 flex gap-1"><span className="h-1 flex-1 rounded-full bg-mint" /><span className="h-1 flex-1 rounded-full bg-violet" /><span className="h-1 flex-1 rounded-full bg-violet/35" /></div>
                            </div>
                            <span className="absolute right-3 top-3 text-[9px] font-semibold text-white/70">68%</span>
                          </div>
                          <div className="p-4">
                            <p className="font-utility text-[8px] uppercase tracking-[.15em] text-mint">Website campaign</p>
                            <h3 className="mt-1.5 text-sm font-semibold text-white">Scene generation</h3>
                            <p className="mt-1.5 text-[10px] leading-5 text-text-muted">Creating original scenes while the conversation stays available.</p>
                            <div className="mt-4 grid grid-cols-4 gap-1.5">
                              {['Brand', 'Direction', 'Scenes', 'Master'].map((stage, index) => (
                                <div key={stage} className="min-w-0">
                                  <div className={`h-1 rounded-full ${index < 2 ? 'bg-mint' : index === 2 ? 'bg-violet' : 'bg-white/[.08]'}`} />
                                  <p className={`mt-1.5 truncate text-[7px] ${index <= 2 ? 'text-white/70' : 'text-text-dim'}`}>{stage}</p>
                                </div>
                              ))}
                            </div>
                            <div className="mt-4 h-1 overflow-hidden rounded-full bg-white/[.07]"><div className="h-full w-[68%] rounded-full bg-signature" /></div>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="absolute inset-x-4 bottom-4 rounded-2xl border border-white/[.08] bg-[#151027] p-3 text-[10px] text-text-dim sm:inset-x-6">Keep creating in the same chat while production continues.</div>
                  </div>
                </div>
              </div>

              <div>
                <p className="font-utility text-[10px] uppercase tracking-[.2em] text-violet">A workspace, not another landing page</p>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Leave. Come back. Keep the context.</h2>
                <p className="mt-5 text-sm leading-7 text-text-muted">Active generations and completed work stay attached to the same conversation.</p>
                <div className="mt-7 grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                  {["Active generations remain visible", "Project history is searchable", "Completed media stays with the project", "Credits are visible before the next production"].map((item) => (
                    <div key={item} className="flex items-start gap-2 rounded-xl border border-white/[.07] bg-white/[.02] p-3 text-xs text-text-muted"><Check size={14} className="mt-0.5 shrink-0 text-mint" />{item}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-[.85fr_1.15fr] lg:items-center">
              <div>
                <p className="font-utility text-[10px] uppercase tracking-[.2em] text-pink">Where it fits</p>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Campaign intent, not rigid templates.</h2>
                <p className="mt-5 max-w-lg text-sm leading-7 text-text-muted">Start from the business, product, or message — not a rigid template.</p>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {useCases.map(([title, body]) => (
                  <article key={title} className="border-l border-white/[.1] px-5 py-3 transition hover:border-violet/45">
                    <h3 className="font-display text-base font-semibold text-white">{title}</h3>
                    <p className="mt-2 text-xs leading-5 text-text-muted">{body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:py-20">
            <div className="grid gap-12 lg:grid-cols-[1fr_1fr] lg:items-center">
              <div className="relative overflow-hidden rounded-[30px] border border-white/10 bg-panel p-5 sm:p-7">
                <div className="generation-grid relative aspect-video overflow-hidden rounded-[22px] border border-white/[.08] bg-[#090712]">
                  <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(139,92,246,.18),transparent_42%)]" />
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/[.05] text-mint"><Activity size={22} /></div>
                    <p className="font-display text-lg font-semibold text-white">Quality starts before render</p>
                    <p className="mt-2 max-w-sm px-7 text-xs leading-5 text-text-dim">Context, direction, continuity and delivery are treated as one system.</p>
                  </div>
                  <div className="generation-scan absolute inset-x-0 h-px bg-gradient-to-r from-transparent via-mint to-transparent" />
                </div>
              </div>
              <div>
                <p className="font-utility text-[10px] uppercase tracking-[.2em] text-gold">Quality system</p>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Quality starts before export.</h2>
                <div className="mt-7 divide-y divide-white/[.07] border-y border-white/[.07]">
                  {qualityLayers.map(([title, body], index) => (
                    <div key={title} className="grid gap-3 py-4 sm:grid-cols-[34px_1fr]"><span className="font-utility text-[9px] text-violet">0{index + 1}</span><div><h3 className="text-sm font-semibold text-white">{title}</h3><p className="mt-1 text-xs leading-5 text-text-muted">{body}</p></div></div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:py-20">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">Pricing preview</p>
                <h2 className="mt-4 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Know the cost before generation.</h2>
              </div>
              <a href="/pricing" className="inline-flex items-center gap-2 text-xs font-semibold text-white transition hover:text-mint">See plans and top-ups <ArrowRight size={14} /></a>
            </div>
            <div className="mt-9 grid gap-3 sm:grid-cols-3">
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


        <section className="border-b border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-7xl px-4 py-12 sm:px-5 sm:py-16 lg:py-20">
            <div className="max-w-3xl">
              <p className="font-utility text-[10px] uppercase tracking-[.2em] text-mint">Website-to-video resources</p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Start with the exact video job you need.</h2>
              <p className="mt-5 text-sm leading-7 text-text-muted">AiWebVideo is built around turning public website context into campaign-ready media. Explore the focused workflows and guides below.</p>
            </div>
            <div className="mt-9 grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              {[
                ["URL to Video", "/url-to-video", "Paste a public webpage and turn it into an AI-directed campaign."],
                ["Website Video Generator", "/website-video-generator", "Use broader website context for a marketing video."],
                ["SaaS Demo Video", "/saas-demo-video-generator", "Create product and launch stories from a SaaS website."],
                ["Product Page to Video", "/product-page-to-video", "Turn ecommerce product context into promotional video."],
              ].map(([title, href, body]) => (
                <a key={href} href={href} className="group rounded-[22px] border border-white/[.08] bg-panel p-5 transition hover:-translate-y-1 hover:border-violet/35">
                  <h3 className="font-display text-base font-semibold text-white">{title}</h3>
                  <p className="mt-2 text-xs leading-6 text-text-muted">{body}</p>
                  <span className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-violet">Explore <ArrowRight size={12} className="transition group-hover:translate-x-1" /></span>
                </a>
              ))}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              <a href="/guides/turn-website-into-video" className="rounded-2xl border border-white/[.07] bg-white/[.02] px-4 py-4 text-xs font-semibold text-white hover:border-mint/30">Guide: turn a website into video</a>
              <a href="/guides/saas-product-demo-video" className="rounded-2xl border border-white/[.07] bg-white/[.02] px-4 py-4 text-xs font-semibold text-white hover:border-mint/30">Guide: SaaS product video</a>
              <a href="/guides/product-page-video-ads" className="rounded-2xl border border-white/[.07] bg-white/[.02] px-4 py-4 text-xs font-semibold text-white hover:border-mint/30">Guide: product-page video ads</a>
            </div>
          </div>
        </section>

        <section className="border-b border-white/[.06]">
          <div className="mx-auto max-w-5xl px-4 py-14 sm:px-5 sm:py-20">
            <div className="text-center">
              <p className="font-utility text-[10px] uppercase tracking-[.2em] text-violet">Questions before creating</p>
              <h2 className="mt-4 font-display text-3xl font-bold tracking-[-.04em] text-white sm:text-4xl">Quick answers.</h2>
            </div>
            <div className="mt-9 space-y-2">
              {landingFaqs.map(([question, answer]) => (
                <details key={question} className="group rounded-2xl border border-white/[.08] bg-white/[.02] p-5">
                  <summary className="list-none pr-6 text-sm font-semibold text-white">{question}<span className="float-right text-violet transition group-open:rotate-45">＋</span></summary>
                  <p className="mt-3 max-w-3xl text-xs leading-6 text-text-muted">{answer}</p>
                </details>
              ))}
            </div>
            <div className="mt-6 text-center"><a href="/faq" className="inline-flex items-center gap-2 text-xs font-semibold text-white hover:text-mint">View all FAQs <ArrowRight size={14} /></a></div>
          </div>
        </section>

        <section className="px-4 py-12 sm:px-5 sm:py-16 lg:py-24">
          <div className="relative mx-auto max-w-7xl overflow-hidden rounded-[26px] border border-white/10 bg-panel px-4 py-10 text-center sm:rounded-[34px] sm:px-12 sm:py-16">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(139,92,246,.22),transparent_50%)]" />
            <Layers3 className="relative mx-auto text-mint" size={26} />
            <h2 className="relative mx-auto mt-5 max-w-3xl font-display text-4xl font-bold tracking-[-.045em] text-white sm:text-5xl">Bring the source. AiWebVideo directs the campaign.</h2>
            <p className="relative mx-auto mt-4 max-w-lg text-sm leading-6 text-text-muted">Website, idea, or product — one creation flow.</p>
            <button type="button" onClick={() => openCreationIntent("website")} className="premium-button bg-signature relative mt-7 inline-flex min-h-11 items-center gap-2 rounded-xl px-4 text-xs font-semibold text-white shadow-violet">Start creating <ArrowRight size={14} /></button>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
