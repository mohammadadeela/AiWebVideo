import { ChatWidget } from "@/components/chat/ChatWidget";
import { HeroFloatingPhotos } from "./HeroFloatingPhotos";
import { SpaceBackdrop } from "./SpaceBackdrop";

/**
 * The first screen: one horizontal headline and the creator, standing right on top of the planet in the space
 * picture (the features are in the navbar). A few admin-chosen photos float in the background around it.
 */
export function Hero() {
  return (
    <section id="generate" className="cinematic-hero relative scroll-mt-20">
      <SpaceBackdrop />
      <HeroFloatingPhotos />
      <div className="hero-grid mx-auto w-full max-w-[1100px] px-3 pt-4 sm:px-6">
        <h1 className="cinematic-title text-center font-display font-black tracking-[-.045em] text-white">
          Turn Anything <span className="cinematic-title-gradient">Into a Video</span>
        </h1>

        <div className="hero-creator-shell relative mt-4 w-full sm:mt-5">
          <ChatWidget compactLanding className="relative w-full" />
        </div>
      </div>
    </section>
  );
}
