import { Sparkles } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function Hero() {
  return (
    <section id="generate" className="relative scroll-mt-20 overflow-hidden border-b border-white/[.06] bg-black/10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[980px] -translate-x-1/2 rounded-full bg-violet/[.09] blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-5 sm:pb-14 sm:pt-11 lg:px-8 lg:pb-16">
        <div className="mb-6 max-w-5xl sm:mb-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[.035] px-3 py-1.5 font-utility text-[9px] uppercase tracking-[.16em] text-mint backdrop-blur">
            <Sparkles size={12} /> Website · Product · Idea · Space
          </div>
          <h1 className="mt-10 max-w-5xl font-display text-[clamp(2.35rem,11vw,4.8rem)] font-bold leading-[.96] tracking-[-.055em] text-white">
            Make videos, product images,
            <span className="block bg-signature-text">and interior design.</span>
          </h1>
        </div>

        <div className="relative w-full">
          <div className="pointer-events-none absolute -inset-x-6 -inset-y-4 rounded-[44px] bg-gradient-to-r from-violet/[.08] via-pink/[.06] to-gold/[.04] blur-3xl" />
          <ChatWidget compactLanding className="relative w-full" />
          <div className="relative mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 px-1 text-[10px] font-medium text-text-dim sm:text-[11px]">
            <span className="inline-flex items-center gap-1.5"><span className="h-1.5 w-1.5 rounded-full bg-mint" />Website analysis & screenshots are free</span>
            <span>Pay only when you choose AI generation</span>
          </div>
        </div>
      </div>
    </section>
  );
}
