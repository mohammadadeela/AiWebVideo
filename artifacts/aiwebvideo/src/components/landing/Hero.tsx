import { Check, Globe2 } from "lucide-react";
import { MARKETING_COPY } from "@/lib/marketingCopy";
import { trackGrowthEvent } from "@/lib/marketingAnalytics";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function Hero() {
  return (
    <section id="generate" className="relative scroll-mt-20 overflow-hidden border-b border-white/[.06] bg-black/10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[980px] -translate-x-1/2 rounded-full bg-violet/[.09] blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-5 sm:pb-14 sm:pt-11 lg:px-8 lg:pb-16">
        <div className="mb-6 max-w-5xl sm:mb-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 font-utility text-[9px] uppercase tracking-[.16em] text-mint backdrop-blur">
            <Globe2 size={12} /> {MARKETING_COPY.hero.eyebrow}
          </div>
          <h1 className="mt-4 max-w-5xl font-display text-[clamp(2.35rem,11vw,4.8rem)] font-bold leading-[.96] tracking-[-.055em] text-white">
            Your website already tells the story.
            <span className="block bg-signature-text">Turn it into a campaign.</span>
          </h1>
          <p className="mt-4 max-w-2xl text-[15px] leading-6 text-text-muted sm:text-base">
            Paste your URL, tell AI what you want to promote, and get a complete marketing video built around your real business.
          </p>
        </div>

        <div className="relative w-full">
          <div className="pointer-events-none absolute -inset-x-6 -inset-y-4 rounded-[44px] bg-gradient-to-r from-violet/[.08] via-pink/[.06] to-gold/[.04] blur-3xl" />
          <div data-growth-event="hero_cta_click" onFocus={() => trackGrowthEvent("hero_cta_click", { source: "hero_creator" })}>
            <ChatWidget compactLanding className="relative w-full" />
          </div>
          <div className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-3">
            {["See website context first", "Exact cost before generation", "Saved projects you can return to"].map((item) => <div key={item} className="flex items-center gap-2 rounded-xl border border-white/[.07] bg-white/[.02] px-3 py-2.5 text-[10px] text-text-muted"><Check size={13} className="shrink-0 text-mint" />{item}</div>)}
          </div>
        </div>
      </div>
    </section>
  );
}
