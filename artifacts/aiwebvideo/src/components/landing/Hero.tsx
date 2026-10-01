import { Sparkles } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { HeroMediaOrbit } from "./HeroMediaOrbit";

export function Hero() {
  return (
    <section id="generate" className="cinematic-hero relative min-h-[900px] scroll-mt-20 overflow-hidden border-b border-white/[.07]">
      <div className="cinematic-hero-speed pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="cinematic-hero-horizon pointer-events-none absolute inset-x-0 bottom-0 h-[42%]" aria-hidden="true" />
      <HeroMediaOrbit />

      <div className="relative z-20 mx-auto flex min-h-[900px] max-w-[1500px] flex-col px-4 pb-14 pt-10 sm:px-6 sm:pt-16 lg:px-8 xl:pt-20">
        <div className="mx-auto max-w-5xl text-center">
          <div className="cinematic-kicker mx-auto inline-flex items-center gap-2 rounded-full border border-violet/35 bg-[#0d0920]/55 px-4 py-2 font-utility text-[9px] uppercase tracking-[.24em] text-white/80 backdrop-blur-xl">
            <Sparkles size={13} className="text-mint" />
            Powered by advanced AI
          </div>

          <h1 className="cinematic-title mx-auto mt-7 max-w-5xl font-display text-[clamp(3rem,8vw,7.2rem)] font-black leading-[.86] tracking-[-.072em] text-white">
            Turn anything
            <span className="cinematic-title-gradient block">into a video.</span>
          </h1>

          <p className="mx-auto mt-7 max-w-2xl text-sm leading-7 text-white/62 sm:text-base md:text-lg">
            Transform websites, products, ideas, talking scenes, interiors and architecture into cinematic AI media from one creative command center.
          </p>
        </div>

        <div className="hero-creator-shell relative mx-auto mt-10 w-full max-w-[1120px] sm:mt-12">
          <div className="pointer-events-none absolute -inset-8 rounded-[44px] bg-[radial-gradient(circle_at_50%_0%,rgba(124,58,237,.30),transparent_42%),linear-gradient(90deg,rgba(34,211,238,.08),rgba(217,70,239,.12),rgba(251,146,60,.06))] blur-3xl" />
          <div className="pointer-events-none absolute -inset-px rounded-[30px] bg-[linear-gradient(115deg,rgba(80,220,255,.66),rgba(139,92,246,.70),rgba(236,72,153,.72),rgba(255,168,76,.60))] opacity-70 blur-[2px]" />
          <ChatWidget compactLanding className="relative w-full" />
        </div>

        <div className="cinematic-scroll-cue mt-auto hidden items-center justify-center gap-2 pt-10 font-utility text-[8px] uppercase tracking-[.22em] text-white/35 lg:flex" aria-hidden="true">
          <span className="h-px w-10 bg-gradient-to-r from-transparent to-white/30" />
          Explore the orbit
          <span className="h-px w-10 bg-gradient-to-l from-transparent to-white/30" />
        </div>
      </div>
    </section>
  );
}
