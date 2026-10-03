import { ChatWidget } from "@/components/chat/ChatWidget";
import { HeroExamples } from "./HeroExamples";
import { SpaceBackdrop } from "./SpaceBackdrop";
import { HeroSideCards } from "./HeroMediaOrbit";

/**
 * The first screen, built so everything fits without scrolling: one horizontal headline, the creator (the features
 * are in the navbar), and a row of examples to remake. On wide screens floating cards fill the side margins.
 */
export function Hero() {
  return (
    <section id="generate" className="cinematic-hero relative scroll-mt-20">
      <SpaceBackdrop />
      <div className="hero-grid mx-auto w-full max-w-[1900px] px-3 pb-3 pt-4 sm:px-6 lg:px-8">
        <HeroSideCards side="left" />

        <div className="hero-center relative z-20 mx-auto w-full min-w-0 max-w-[1060px]">
          <h1 className="cinematic-title text-center font-display font-black tracking-[-.045em] text-white">
            Turn Anything <span className="cinematic-title-gradient">Into a Video</span>
          </h1>

          <div className="hero-creator-shell relative mt-4 w-full sm:mt-5">
            <ChatWidget compactLanding className="relative w-full" />
          </div>

          <HeroExamples />
        </div>

        <HeroSideCards side="right" />
      </div>
    </section>
  );
}
