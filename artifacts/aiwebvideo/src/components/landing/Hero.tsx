import { Sparkles } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";
import { HeroMediaOrbit } from "./HeroMediaOrbit";

/**
 * The first screen: a headline, then the creator (feature modes live INSIDE it) as the centrepiece, with the
 * admin's media floating around it over the space backdrop (see SpaceBackdrop).
 */
export function Hero() {
  return (
    <section id="generate" className="cinematic-hero relative scroll-mt-20 overflow-hidden">
      <HeroMediaOrbit />

      <div className="relative z-20 mx-auto flex max-w-[1500px] flex-col px-4 pb-14 pt-24 sm:px-6 lg:px-8 lg:pt-[5.25rem]">
        <div className="relative mx-auto max-w-5xl text-center">
          <div className="hero-title-ring" aria-hidden="true" />
          <div className="cinematic-kicker relative mx-auto inline-flex items-center gap-2 rounded-full border border-violet/40 bg-[#0d0920]/60 px-4 py-2 font-utility text-[9px] uppercase tracking-[.2em] text-white/80">
            <Sparkles size={13} className="text-violet" />
            Powered by advanced AI
          </div>

          <h1 className="cinematic-title relative mx-auto mt-5 max-w-5xl font-display text-[clamp(2.9rem,6.6vw,6.2rem)] font-black leading-[.9] tracking-[-.06em] text-white">
            Turn Anything
            <span className="cinematic-title-gradient block">Into a Video</span>
          </h1>

          <p className="relative mx-auto mt-5 max-w-2xl text-sm leading-7 text-white/72 sm:text-base md:text-lg">
            Transform websites, products, ideas and more into stunning AI videos in seconds.
          </p>
        </div>

        <div className="hero-creator-shell relative mx-auto mt-8 w-full max-w-[1060px] sm:mt-9">
          <ChatWidget compactLanding className="relative w-full" />
        </div>
      </div>
    </section>
  );
}
