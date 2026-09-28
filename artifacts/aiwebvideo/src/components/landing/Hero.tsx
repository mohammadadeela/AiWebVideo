import { ChatWidget } from "@/components/chat/ChatWidget";

export function Hero() {
  const params = new URLSearchParams(window.location.search);
  const savedJob = params.get("job");
  const requested = params.get("create");
  const creationIntent = requested === "video" || requested === "photo" || requested === "product-video" || requested === "scenario" || requested === "interior" || requested === "architecture" || requested === "website" ? requested : "website";
  return (
    <section id="generate" className="relative scroll-mt-28 overflow-hidden border-b border-white/[.06] bg-black/10 sm:scroll-mt-32">
      <div className="pointer-events-none absolute left-1/2 top-0 h-[420px] w-[980px] -translate-x-1/2 rounded-full bg-violet/[.09] blur-[120px]" />
      <div className="relative mx-auto max-w-7xl px-4 pb-10 pt-7 sm:px-5 sm:pb-14 sm:pt-11 lg:px-8 lg:pb-16">
        <div className="mb-6 max-w-5xl sm:mb-7">
          <h1 className="mt-5 max-w-5xl font-display text-[clamp(2.5rem,9vw,4.8rem)] font-bold leading-[.98] tracking-[-.055em] text-white">
            Make something
            <span className="block bg-signature-text">worth showing.</span>
          </h1>
        </div>

        <div className="relative w-full">
          <div className="pointer-events-none absolute -inset-x-6 -inset-y-4 rounded-[44px] bg-gradient-to-r from-violet/[.08] via-pink/[.06] to-gold/[.04] blur-3xl" />
          <ChatWidget compactLanding className="relative w-full" resumeJobId={savedJob} initialCreationIntent={creationIntent} onJobCreated={(id) => {
            if (window.location.pathname === "/") window.history.replaceState({}, "", `/?job=${encodeURIComponent(id)}#generate`);
          }} />
        </div>
      </div>
    </section>
  );
}
