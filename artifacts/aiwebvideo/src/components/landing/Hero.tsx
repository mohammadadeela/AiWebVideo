import { ChatWidget } from '@/components/chat/ChatWidget';

const STEPS = ['Paste your URL', 'Choose video, photos, or both', 'Get your result'];

export function Hero() {
  return (
    <section id="generate" className="relative overflow-hidden">
      {/* Ambient background glow */}
      <div
        className="ambient-glow pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 animate-glow-pulse"
        aria-hidden="true"
      />
      <div className="relative mx-auto grid max-w-6xl grid-cols-1 gap-12 px-5 py-16 md:grid-cols-[1.1fr_1fr] md:py-24">
        <div className="flex flex-col justify-center animate-fade-in-up">
          <span className="mb-4 inline-flex w-fit items-center rounded-full border border-gold/30 px-3.5 py-1 font-utility text-xs text-gold">
            Private creative production studio ✦
          </span>
          <h1 className="font-display text-4xl font-bold leading-[1.08] text-text-primary sm:text-5xl">
            Your website deserves
            <br />
            <span className="gradient-text">a campaign, not a template.</span>
          </h1>
          <p className="mt-5 max-w-md text-base text-text-muted">
            Paste a URL. We wait for every page to load, capture the real experience, record a smooth scroll,
            and turn your direction into polished video and campaign imagery.
          </p>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2.5 text-sm text-text-muted">
            {STEPS.map((step, i) => (
              <li key={step} className="flex items-center gap-2">
                <span className="font-utility flex h-5 w-5 items-center justify-center rounded-full border border-border bg-panel-alt text-[11px] text-gold">
                  {i + 1}
                </span>
                {step}
              </li>
            ))}
          </ul>

          {/* Verifiable product proof */}
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-1.5 rounded-full border border-border bg-panel px-3 py-1.5">
              <span className="h-2 w-2 rounded-full bg-mint animate-pulse-soft" />
              <span className="text-xs text-text-muted">Real multi-page capture</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-text-muted">
              <span className="text-gold">✦</span>
              <span>1080p and 4K mastered exports</span>
            </div>
          </div>
        </div>

        <div className="flex items-center animate-fade-in-up [animation-delay:150ms]">
          <ChatWidget className="w-full" />
        </div>
      </div>
    </section>
  );
}
