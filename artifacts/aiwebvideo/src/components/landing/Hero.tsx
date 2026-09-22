import { ChatWidget } from "@/components/chat/ChatWidget";

export function Hero() {
  return (
    <section id="generate" className="relative scroll-mt-20 overflow-hidden border-b border-white/[.06] bg-black/10">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[980px] -translate-x-1/2 rounded-full bg-violet/[.09] blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-5 sm:pb-14 sm:pt-11 lg:px-8 lg:pb-16">
        <div className="mb-6 max-w-5xl sm:mb-7">
          <h1 className="max-w-5xl font-display text-[clamp(2.7rem,11vw,5.2rem)] font-bold leading-[.94] tracking-[-.06em] text-white">
            Bring your ideas
            <span className="block bg-signature-text">to life.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-sm leading-6 text-text-muted sm:text-base sm:leading-7">
            Start with a website, product, image, or space.
          </p>
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
