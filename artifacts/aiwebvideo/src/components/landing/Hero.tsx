import { ChatWidget } from "@/components/chat/ChatWidget";
import { HeroExamples } from "./HeroExamples";
import { SpaceBackdrop } from "./SpaceBackdrop";

/**
 * The first screen, built so everything fits without scrolling: one horizontal headline, the creator (the features
 * are in the navbar), and the examples an admin chose, standing on the glowing road of the space picture.
 */
export function Hero() {
  return (
    <section id="generate" className="cinematic-hero relative scroll-mt-20">
      <SpaceBackdrop />
      <div className="hero-grid mx-auto w-full max-w-[1100px] px-3 pb-4 pt-4 sm:px-6">
        <h1 className="cinematic-title text-center font-display font-black tracking-[-.045em] text-white">
          Turn Anything <span className="cinematic-title-gradient">Into a Video</span>
        </h1>

        <div className="hero-creator-shell relative mt-4 w-full sm:mt-5">
          <ChatWidget compactLanding className="relative w-full" />
        </div>

        <HeroExamples />
      </div>
    </section>
  );
}
