import { useEffect, useState } from "react";
import { BadgePercent, CircleDollarSign, RefreshCcw, WalletCards } from "lucide-react";
import { Nav } from "@/components/landing/Nav";
import { Footer } from "@/components/landing/Footer";
import { PricingTable } from "@/components/landing/PricingTable";
import { fetchWelcomeGrowthOffer, formatWelcomeCountdown, type WelcomeGrowthOffer } from "@/lib/growth";
import { useSeo } from "@/lib/useSeo";

export function PricingPage() {
  const [welcomeOffer, setWelcomeOffer] = useState<WelcomeGrowthOffer | null>(null);
  const [now, setNow] = useState(() => Date.now());

  useSeo({
    title: "AI Website Video Generator Pricing",
    description:
      "Credit-based pricing for AI website-to-video production, with one-time credit top-ups, monthly plans, automatic refunds, and clear 1080p and 4K usage.",
    path: "/pricing",
  });

  useEffect(() => {
    let cancelled = false;
    fetchWelcomeGrowthOffer()
      .then((offer) => { if (!cancelled) setWelcomeOffer(offer); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!welcomeOffer?.active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [welcomeOffer?.active]);

  const offerActive = Boolean(
    welcomeOffer?.active &&
    welcomeOffer.discountPercent > 0 &&
    new Date(welcomeOffer.expiresAt).getTime() > now,
  );

  return (
    <>
      <Nav />
      <main>
        <section className="relative overflow-hidden border-b border-white/[.06]">
          <div className="hero-mesh pointer-events-none absolute inset-0" />
          <div className="relative mx-auto max-w-7xl px-4 py-12 text-center sm:px-5 sm:py-20">
            <p className="font-utility text-[10px] uppercase tracking-[.22em] text-mint">
              Production pricing
            </p>
            <h1 className="mx-auto mt-5 max-w-4xl font-display text-[32px] font-bold leading-tight tracking-[-.05em] text-white sm:text-6xl">
              Know the production cost before you generate.
            </h1>

            {offerActive && welcomeOffer && (
              <a
                href="#buy-credits"
                className="mx-auto mt-6 flex max-w-xl items-center justify-between gap-3 rounded-2xl border border-mint/30 bg-mint/[.08] px-4 py-3 text-left shadow-[0_18px_50px_-35px_rgba(52,211,153,.75)] transition hover:bg-mint/[.12]"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-mint/15 text-mint">
                    <BadgePercent size={18} aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block text-sm font-bold text-white">{welcomeOffer.discountPercent}% off credit packs</span>
                    <span className="mt-0.5 block text-[11px] text-text-muted">Same credits, lower checkout price. No bonus-credit trick.</span>
                  </span>
                </span>
                <span className="shrink-0 rounded-full border border-mint/25 bg-mint/10 px-2.5 py-1 font-utility text-[10px] font-bold text-mint">
                  {formatWelcomeCountdown(welcomeOffer.expiresAt, now)}
                </span>
              </a>
            )}

            <div className="mt-10 text-left sm:mt-12">
              <PricingTable />
            </div>

            <div className="mt-14 border-t border-white/[.08] pt-12 sm:mt-16 sm:pt-14">
              <p className="mx-auto max-w-2xl text-sm leading-7 text-text-muted">
                The production system uses credits for generated media. Customer-facing
                1080p video pricing is 20 credits per generated second, 4K is 30,
                and the exact quote is shown before generation.
              </p>
              <div className="mx-auto mt-8 grid max-w-3xl gap-px overflow-hidden rounded-2xl border border-border bg-border text-left sm:grid-cols-3">
                {[
                  {
                    Icon: WalletCards,
                    title: "Choose your balance",
                    body: "Use a monthly plan or a one-time production option.",
                  },
                  {
                    Icon: CircleDollarSign,
                    title: "See the quote first",
                    body: "Duration, quality and audio determine the production credit estimate.",
                  },
                  {
                    Icon: RefreshCcw,
                    title: "Failure handling",
                    body: "The existing generation flow restores reserved credits when a paid render fails.",
                  },
                ].map(({ Icon, title, body }) => (
                  <div key={title} className="bg-panel/90 p-5">
                    <Icon size={17} className="text-violet" aria-hidden="true" />
                    <p className="mt-3 text-xs font-semibold text-text-primary">{title}</p>
                    <p className="mt-1 text-[11px] leading-5 text-text-muted">{body}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-t border-white/[.06] bg-black/10">
          <div className="mx-auto max-w-5xl px-4 py-12 sm:px-5 sm:py-16">
            <div className="grid gap-10 md:grid-cols-[.75fr_1.25fr]">
              <div>
                <p className="font-utility text-[10px] uppercase tracking-[.18em] text-mint">
                  Billing questions
                </p>
                <h2 className="mt-3 font-display text-2xl font-semibold tracking-[-.03em] text-text-primary">
                  Credits without the guesswork.
                </h2>
                <p className="mt-3 text-sm leading-6 text-text-muted">
                  AiWebVideo checks the production requirement before the final
                  render starts, so insufficient balance becomes a clear next
                  action instead of a mysterious generation failure.
                </p>
              </div>
              <div className="divide-y divide-border border-y border-border">
                {[
                  [
                    "What changes the credit quote?",
                    "Generated duration, output quality, production mode and narration options are reflected by the existing shared credit calculation.",
                  ],
                  [
                    "Can I preview before paying for a video?",
                    "The website workflow can prepare its capture and production plan before the paid final generation step.",
                  ],
                  [
                    "What if a paid generation fails?",
                    "The current production flow communicates the failure and restores the credits reserved for unfinished paid rendering where that refund path applies.",
                  ],
                  [
                    "Where do I manage my plan?",
                    "Signed-in users can open the account center for credit balance and the existing billing actions, or return here to compare current options.",
                  ],
                ].map(([question, answer]) => (
                  <details key={question} className="group py-5">
                    <summary className="list-none pr-8 text-sm font-semibold text-text-primary">
                      {question}
                      <span className="float-right text-violet transition group-open:rotate-45" aria-hidden="true">
                        +
                      </span>
                    </summary>
                    <p className="mt-3 max-w-2xl text-xs leading-5 text-text-muted">{answer}</p>
                  </details>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  );
}
