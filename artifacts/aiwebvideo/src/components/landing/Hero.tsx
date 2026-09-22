import { ArrowRight } from "lucide-react";
import { ChatWidget } from "@/components/chat/ChatWidget";

export function Hero() {
  return (
    <section id="generate" className="border-b border-white/[.07]">
      <div className="mx-auto max-w-7xl px-4 pb-12 pt-12 sm:px-6 sm:pb-16 sm:pt-16 lg:px-8 lg:pb-20 lg:pt-20">
        <div className="max-w-5xl">
          <p className="mb-4 text-sm font-medium text-text-muted">Creative production, in one workspace.</p>
          <h1 className="max-w-[18ch] font-display text-[clamp(2.65rem,7.5vw,5.4rem)] font-semibold leading-[.96] tracking-[-.055em] text-white">
            Create videos and images from what you already have.
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-7 text-text-muted sm:text-lg sm:leading-8">
            Use a website, product, reference image, prompt, or real space to create polished media without leaving the project.
          </p>
        </div>

        <div className="mt-9 sm:mt-11">
          <ChatWidget compactLanding className="w-full" />
        </div>

        <div className="mt-4 flex flex-col gap-3 text-sm text-text-dim sm:flex-row sm:items-center sm:justify-between">
          <p>See the cost before paid generation. Your project stays available while it runs.</p>
          <a href="/examples" className="inline-flex min-h-11 shrink-0 items-center gap-2 font-medium text-white transition hover:text-violet">
            Explore creations <ArrowRight size={15} />
          </a>
        </div>
      </div>
    </section>
  );
}
